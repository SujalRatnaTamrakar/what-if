import io
import json
import os
import time
import uuid
from pathlib import Path

import requests
from PIL import Image

from .._errors import ProviderTimeout, ProviderUnavailable, RenderFailed
from ..types import ProviderOutput, prompt_field

REPO_ROOT = Path(__file__).resolve().parents[3]


def _find_workflow(path_str: str) -> Path:
    p = Path(path_str)
    for cand in ([p] if p.is_absolute() else [Path.cwd() / p, REPO_ROOT / p]):
        if cand.exists():
            return cand
    raise RenderFailed(f"ComfyUI workflow not found: {path_str}")


def _node_by_title(wf: dict, title: str):
    for nid, node in wf.items():
        if node.get("_meta", {}).get("title") == title:
            return nid, node
    return None, None


class ComfyUIProvider:
    def __init__(self):
        self.base = os.environ.get("COMFYUI_BASE_URL", "http://localhost:8188").rstrip("/")
        self.workflow_path = _find_workflow(os.environ.get("COMFYUI_WORKFLOW", "workflows/inpaint_v1.api.json"))

    def _req(self, method, path, timeout, **kw):
        try:
            return requests.request(method, self.base + path, timeout=timeout, **kw)
        except requests.ConnectionError as e:
            raise ProviderUnavailable(f"ComfyUI unreachable at {self.base}: {e}")
        except requests.Timeout:
            raise ProviderTimeout("ComfyUI request timed out")

    def _upload(self, img, name, timeout):
        buf = io.BytesIO()
        img.save(buf, "PNG")
        r = self._req("POST", "/upload/image", timeout, files={"image": (name, buf.getvalue(), "image/png")},
                      data={"overwrite": "true", "type": "input"})
        if not r.ok:
            raise RenderFailed(f"ComfyUI upload failed: {r.status_code} {r.text[:200]}")
        return r.json()["name"]

    def edit(self, source, mask, prompt, *, seed, timeout_s):
        deadline = time.time() + timeout_s
        left = lambda: max(5, deadline - time.time())
        run = uuid.uuid4().hex[:8]

        img_name = self._upload(source.convert("RGB"), f"wi_src_{run}.png", left())
        # RGB mask so LoadImageMask(channel=red) reads white = edit (avoids the inverted-alpha trap)
        mask_name = self._upload(mask.convert("L").convert("RGB"), f"wi_mask_{run}.png", left())

        wf = json.loads(self.workflow_path.read_text())

        def patch(title, key, value):
            _, node = _node_by_title(wf, title)
            if node is None:
                raise RenderFailed(f"workflow missing node {title}")
            node["inputs"][key] = value

        patch("INPUT_IMAGE", "image", img_name)
        patch("INPUT_MASK", "image", mask_name)
        patch("POSITIVE", "text", prompt_field(prompt, "positive"))
        patch("NEGATIVE", "text", prompt_field(prompt, "negative"))
        patch("SAMPLER", "seed", seed)

        r = self._req("POST", "/prompt", left(), json={"prompt": wf, "client_id": run})
        if not r.ok:
            raise RenderFailed(f"ComfyUI rejected workflow: {r.status_code} {r.text[:400]}")
        pid = r.json()["prompt_id"]
        out_nid, _ = _node_by_title(wf, "OUTPUT")

        imgs = None
        while imgs is None:
            if time.time() > deadline:
                try:
                    self._req("POST", "/interrupt", 5)
                except Exception:
                    pass
                raise ProviderTimeout(f"ComfyUI render exceeded {timeout_s}s")
            h = self._req("GET", f"/history/{pid}", 10)
            data = h.json() if h.ok else {}
            if pid in data:
                entry = data[pid]
                st = entry.get("status", {})
                if st.get("status_str") == "error":
                    raise RenderFailed(f"ComfyUI execution error: {json.dumps(st)[:400]}")
                imgs = ((entry.get("outputs", {}).get(out_nid) or {}).get("images")) or None
            if imgs is None:
                time.sleep(1)

        i = imgs[0]
        v = self._req("GET", "/view", left(), params={"filename": i["filename"],
                                                      "subfolder": i.get("subfolder", ""), "type": i.get("type", "output")})
        if not v.ok:
            raise RenderFailed(f"ComfyUI /view failed: {v.status_code}")
        result = Image.open(io.BytesIO(v.content)).convert("RGB")

        ck = next((x for x in wf.values() if x.get("class_type") == "CheckpointLoaderSimple"), None)
        model = ck["inputs"]["ckpt_name"] if ck else "unknown"
        return ProviderOutput(result, "comfyui", model, seed, self.workflow_path.name.replace(".api.json", ""))
