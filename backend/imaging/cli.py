"""Imaging CLI.

Run from ``backend/`` as::

    python -m imaging.cli render --source S --mask M --prompt "..." [--provider fake] [--debug]
    python -m imaging.cli regress [--provider fake]

``render`` prints the RenderResult as JSON. With ``--debug`` it also writes
``overlay.png`` (source + red mask overlay) next to the output so mask
alignment can be verified visually (§11.3).

``regress`` (§11.6 item 7) runs the demo triple (``shared/demo/bus_stop.jpg``
+ ``bus_stop_mask.png`` when present, else a synthetic triple), then asserts:
output size == source size and ``outside_mask_change < 0.01`` after the
composite. Exits non-zero on failure.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time
from dataclasses import asdict
from pathlib import Path

from PIL import Image, ImageDraw


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]  # backend/imaging/cli.py -> placepatch/


def _make_edit_prompt(text: str):
    from imaging import EditPrompt

    return EditPrompt(
        positive=f"photorealistic {text}, matching existing lighting, perspective and materials, daytime street photo",
        negative="text, watermark, people, cars, distortion, extra signs, cartoon, blurry",
        preserve=[],
        editGoal=text,
    )


def _write_debug_overlay(source: Path, mask: Path, out_path: Path) -> Path:
    s = Image.open(source).convert("RGBA")
    m = Image.open(mask).convert("L").resize(s.size, Image.NEAREST)
    red = Image.new("RGBA", s.size, (255, 0, 0, 110))
    ov = Image.composite(red, s, m).convert("RGB")
    ov.save(out_path)
    return out_path


def _synthetic_triple(tmpdir: Path, size=(640, 480)) -> tuple[Path, Path]:
    """Gradient source + centered-rect mask, for regress when no demo photo."""
    w, h = size
    src = Image.new("RGB", size)
    px = src.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = (int(255 * x / w), int(255 * y / h), 128)
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    d.rectangle([w // 4, h // 4, 3 * w // 4, 3 * h // 4], fill=255)
    sp, mp = tmpdir / "synth_source.png", tmpdir / "synth_mask.png"
    src.save(sp)
    mask.save(mp)
    return sp, mp


def cmd_render(args) -> int:
    from imaging import render_edit

    t0 = time.perf_counter()
    res = render_edit(
        Path(args.source),
        Path(args.mask),
        _make_edit_prompt(args.prompt),
        seed=args.seed,
        timeout_s=args.timeout,
    )
    out = Path(args.out) if args.out else Path.cwd() / (
        Path(args.source).stem + "_concept.png"
    )
    Image.open(res.output_path).save(out)

    payload = asdict(res)
    payload["output_path"] = str(res.output_path)
    payload["cli_output"] = str(out)
    payload["cli_wall_ms"] = int((time.perf_counter() - t0) * 1000)
    if args.debug:
        ov = out.parent / "overlay.png"
        _write_debug_overlay(Path(args.source), Path(args.mask), ov)
        payload["debug_overlay"] = str(ov)
    print(json.dumps(payload, indent=2))
    return 0


def cmd_regress(args) -> int:
    from imaging import outside_mask_change, render_edit

    tmpdir = Path(tempfile.mkdtemp(prefix="placepatch_regress_"))
    demo_src = _repo_root() / "shared" / "demo" / "bus_stop.jpg"
    demo_mask = _repo_root() / "shared" / "demo" / "bus_stop_mask.png"
    if demo_src.exists() and demo_mask.exists():
        src, mask = demo_src, demo_mask
        triple = "demo"
    else:
        src, mask = _synthetic_triple(tmpdir)
        triple = "synthetic"

    t0 = time.perf_counter()
    res = render_edit(
        src, mask, _make_edit_prompt("a freestanding shade canopy"), seed=7
    )
    wall_ms = int((time.perf_counter() - t0) * 1000)

    failures = []
    s = Image.open(src)
    o = Image.open(res.output_path)
    if o.size != s.size:
        failures.append(f"output size {o.size} != source size {s.size}")
    diff = outside_mask_change(src, res.output_path, mask)
    if not diff < 0.01:
        failures.append(f"outside_mask_change {diff:.4f} >= 0.01")

    report = {
        "triple": triple,
        "provider": res.provider,
        "model": res.model,
        "workflow_version": res.workflow_version,
        "size": f"{res.width}x{res.height}",
        "outside_mask_change": round(diff, 6),
        "render_ms": res.duration_ms,
        "wall_ms": wall_ms,
        "output": str(res.output_path),
        "ok": not failures,
        "failures": failures,
    }
    print(json.dumps(report, indent=2))
    return 1 if failures else 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="python -m imaging.cli")
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("render", help="render one edit")
    r.add_argument("--source", required=True)
    r.add_argument("--mask", required=True)
    r.add_argument("--prompt", required=True, help="edit goal, e.g. 'a shade canopy'")
    r.add_argument("--provider", default=None, help="overrides RENDER_PROVIDER")
    r.add_argument("--seed", type=int, default=None)
    r.add_argument("--timeout", type=int, default=240)
    r.add_argument("--debug", action="store_true")
    r.add_argument("--out", default=None)

    g = sub.add_parser("regress", help="regression per §11.6 item 7")
    g.add_argument("--provider", default="fake", help="overrides RENDER_PROVIDER")

    args = p.parse_args(argv)
    if getattr(args, "provider", None):
        os.environ["RENDER_PROVIDER"] = args.provider
    try:
        if args.cmd == "render":
            return cmd_render(args)
        return cmd_regress(args)
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
