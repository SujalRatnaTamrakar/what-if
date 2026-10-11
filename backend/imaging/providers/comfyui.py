"""ComfyUI render provider (§11.5, primary).

Flow: upload source + mask -> load COMFYUI_WORKFLOW (API-format JSON) ->
patch node inputs by node TITLE -> POST /prompt -> poll /history/{id} ->
download via /view.

Env:
  COMFYUI_BASE_URL   default http://localhost:8188
  COMFYUI_WORKFLOW   default workflows/shade_inpaint_v1.api.json
                     (relative paths resolve against the repo root first,
                     then the current working directory)
  COMFYUI_MODEL_NAME default: workflow file stem (recorded in workflows/README.md)
"""

from __future__ import annotations

import io
import json
import os
import time
import uuid
from pathlib import Path

import httpx
from PIL import Image

from ..errors import ProviderTimeout, ProviderUnavailable, RenderFailed

WORKFLOW_VERSION = "shade_inpaint_v1"  # overridden by workflow file stem if set


def _base_url() -> str:
    return os.environ.get("COMFYUI_BASE_URL", "http://localhost:8188").rstrip("/")


def _workflow_path() -> Path:
    raw = os.environ.get("COMFYUI_WORKFLOW", "workflows/shade_inpaint_v1.api.json")
    p = Path(raw)
    if not p.is_absolute():
        repo_root = Path(__file__).resolve().parents[3]  # .../placepatch
        cand = repo_root / p
        p = cand if cand.exists() else Path.cwd() / p
    return p


def _model_name(workflow_path: Path) -> str:
    return os.environ.get("COMFYUI_MODEL_NAME", workflow_path.stem)


def _upload(client: httpx.Client, path: Path, filename: str) -> str:
    with open(path, "rb") as f:
        r = client.post(
            "/upload/image",
            files={"image": (filename, f, "image/png")},
        )
    if r.status_code != 200:
        raise RenderFailed(f"ComfyUI /upload/image -> {r.status_code}: {r.text[:200]}")
    name = r.json().get("name")
    if not name:
        raise RenderFailed(f"ComfyUI upload returned no name: {r.text[:200]}")
    return name


def _patch_workflow(workflow: dict, *, src_name: str, mask_name: str, prompt, seed: int) -> None:
    """Patch node inputs by _meta.title (never by numeric id)."""
    for node in workflow.values():
        if not isinstance(node, dict):
            continue
        title = (node.get("_meta") or {}).get("title")
        inputs = node.get("inputs")
        if not isinstance(inputs, dict):
            continue
        if title == "INPUT_IMAGE":
            inputs["image"] = src_name
        elif title == "INPUT_MASK":
            inputs["image"] = mask_name
        elif title == "POSITIVE" and "text" in inputs:
            inputs["text"] = prompt.positive
        elif title == "NEGATIVE" and "text" in inputs:
            inputs["text"] = prompt.negative
        elif title in ("SEED", "SAMPLER") and "seed" in inputs:
            inputs["seed"] = seed


def _output_node_id(workflow: dict) -> str | None:
    for nid, node in workflow.items():
        if isinstance(node, dict) and (node.get("_meta") or {}).get("title") == "OUTPUT":
            return str(nid)
    return None


def render_at_work_size(
    work_source: Path, work_mask: Path, prompt, *, seed: int, timeout_s: int
):
    """Render via ComfyUI. Returns (edited PIL image at work size, model name)."""
    base = _base_url()
    wf_path = _workflow_path()
    try:
        workflow = json.loads(wf_path.read_text())
    except Exception as e:
        raise RenderFailed(f"cannot load ComfyUI workflow {wf_path}: {e}")

    timeout = httpx.Timeout(connect=10.0, read=float(timeout_s), write=30.0, pool=10.0)
    try:
        # trust_env=False: ComfyUI is local traffic; never send it through an
        # egress proxy (and sidestep env NO_PROXY parsing quirks in httpx).
        client = httpx.Client(base_url=base, timeout=timeout, trust_env=False)
    except Exception as e:  # pragma: no cover - defensive
        raise ProviderUnavailable(f"cannot init HTTP client for {base}: {e}")

    try:
        try:
            src_name = _upload(client, work_source, "placepatch_source.png")
            mask_name = _upload(client, work_mask, "placepatch_mask.png")
        except httpx.ConnectError as e:
            raise ProviderUnavailable(f"cannot reach ComfyUI at {base}: {e}")
        except httpx.TimeoutException as e:
            raise ProviderTimeout(f"ComfyUI upload timed out: {e}")

        _patch_workflow(workflow, src_name=src_name, mask_name=mask_name,
                        prompt=prompt, seed=seed)

        try:
            r = client.post("/prompt", json={"prompt": workflow, "client_id": str(uuid.uuid4())})
        except httpx.ConnectError as e:
            raise ProviderUnavailable(f"cannot reach ComfyUI at {base}: {e}")
        except httpx.TimeoutException as e:
            raise ProviderTimeout(f"ComfyUI /prompt timed out: {e}")
        if r.status_code != 200:
            raise RenderFailed(f"ComfyUI /prompt -> {r.status_code}: {r.text[:300]}")
        prompt_id = r.json().get("prompt_id")
        if not prompt_id:
            raise RenderFailed(f"ComfyUI /prompt returned no prompt_id: {r.text[:200]}")

        out_node = _output_node_id(workflow)
        deadline = time.time() + timeout_s
        while True:
            if time.time() > deadline:
                raise ProviderTimeout(
                    f"ComfyUI render exceeded {timeout_s}s (prompt {prompt_id})"
                )
            try:
                h = client.get(f"/history/{prompt_id}")
            except httpx.TimeoutException:
                raise ProviderTimeout("ComfyUI /history poll timed out")
            if h.status_code == 200:
                hist = h.json()
                entry = hist.get(prompt_id, {})
                outputs = entry.get("outputs", {})
                images = []
                if out_node and out_node in outputs:
                    images = outputs[out_node].get("images", [])
                if not images:  # fall back: any images in any output node
                    for o in outputs.values():
                        images.extend(o.get("images", []))
                if images:
                    info = images[0]
                    v = client.get(
                        "/view",
                        params={
                            "filename": info["filename"],
                            "subfolder": info.get("subfolder", ""),
                            "type": info.get("type", "output"),
                        },
                    )
                    if v.status_code != 200:
                        raise RenderFailed(
                            f"ComfyUI /view -> {v.status_code}: {v.text[:200]}"
                        )
                    return Image.open(io.BytesIO(v.content)).convert("RGB"), _model_name(wf_path)
                # surface execution errors instead of polling forever
                status = entry.get("status", {})
                if status.get("completed") is False or "failed" in str(status.get("status_str", "")):
                    raise RenderFailed(f"ComfyUI execution failed: {status}")
            time.sleep(1)
    finally:
        client.close()
