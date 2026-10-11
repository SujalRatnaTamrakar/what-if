"""From backend/:
  python -m imaging.cli render  --source S --mask M --prompt "..." [--provider fake|comfyui|gemini_image|xai_image] [--seed N] [--debug]
  python -m imaging.cli guide / composite / make-mask / diff / check / regress
"""
import argparse
import json
import os
import sys
import time
from dataclasses import asdict
from pathlib import Path

from PIL import Image

from . import composite_external, outside_mask_change, render_edit
from .masks import overlay_debug

ROOT = Path(__file__).resolve().parents[2]
NEG = "text, watermark, people, cars, distortion, cartoon, blurry"


def _load_env():
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT / "backend" / ".env")
    except ImportError:
        pass


def _render(source, mask, prompt, provider=None, seed=None, timeout=240, debug=False):
    if provider:
        os.environ["RENDER_PROVIDER"] = provider
    p = {"positive": prompt, "negative": NEG, "preserve": [], "editGoal": prompt}
    r = render_edit(Path(source), Path(mask), p, seed=seed, timeout_s=timeout)
    d = asdict(r)
    d["output_path"] = str(r.output_path)
    d["outsideMaskChange"] = round(outside_mask_change(Path(source), r.output_path, Path(mask)), 5)
    if debug:
        ov = r.output_path.parent / "overlay.png"
        overlay_debug(Image.open(r.output_path), Image.open(mask).convert("L")).save(ov)
        d["overlay"] = str(ov)
    return d


def main(argv=None):
    _load_env()
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("render")
    for a in ("--source", "--mask", "--prompt"):
        r.add_argument(a, required=True)
    r.add_argument("--provider"); r.add_argument("--seed", type=int)
    r.add_argument("--timeout", type=int, default=240); r.add_argument("--debug", action="store_true")

    g = sub.add_parser("guide")
    g.add_argument("--source", required=True); g.add_argument("--mask", required=True); g.add_argument("--out", default="guide.png")

    c = sub.add_parser("composite")
    for a in ("--source", "--mask", "--edited"):
        c.add_argument(a, required=True)
    c.add_argument("--out", default="concept.png")

    m = sub.add_parser("make-mask")
    m.add_argument("--source", required=True)
    m.add_argument("--rect", required=True, help="normalized x0,y0,x1,y1 (0..1)")
    m.add_argument("--out", required=True)

    df = sub.add_parser("diff")
    for a in ("--source", "--concept", "--mask"):
        df.add_argument(a, required=True)

    b = sub.add_parser("bench")
    b.add_argument("--source", default=str(ROOT / "shared/demo/bus_stop.jpg"))
    b.add_argument("--mask", default=str(ROOT / "shared/demo/bus_stop_mask.png"))
    b.add_argument("--prompt", default="a flat metal roof canopy on slim steel posts above the bench")
    b.add_argument("--provider"); b.add_argument("--runs", type=int, default=5)
    b.add_argument("--parallel", type=int, default=1, help="run N renders at the same time (queue test)")
    b.add_argument("--timeout", type=int, default=240)

    sub.add_parser("check")
    rg = sub.add_parser("regress")
    rg.add_argument("--provider"); rg.add_argument("--timeout", type=int, default=240)
    a = ap.parse_args(argv)

    if a.cmd == "render":
        print(json.dumps(_render(a.source, a.mask, a.prompt, a.provider, a.seed, a.timeout, a.debug), indent=2))
    elif a.cmd == "guide":
        overlay_debug(Image.open(a.source), Image.open(a.mask).convert("L")).save(a.out)
        print("wrote", a.out)
    elif a.cmd == "composite":
        out = composite_external(Path(a.source), Path(a.edited), Path(a.mask), Path(a.out))
        print("wrote", out, "outsideMaskChange", round(outside_mask_change(Path(a.source), out, Path(a.mask)), 5))
    elif a.cmd == "make-mask":
        from PIL import ImageDraw
        w, h = Image.open(a.source).size
        x0, y0, x1, y1 = [float(v) for v in a.rect.split(",")]
        mk = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mk).rectangle([x0 * w, y0 * h, x1 * w, y1 * h], fill=255)
        mk.save(a.out); print("wrote", a.out, (w, h))
    elif a.cmd == "diff":
        print(round(outside_mask_change(Path(a.source), Path(a.concept), Path(a.mask)), 5))
    elif a.cmd == "bench":
        from concurrent.futures import ThreadPoolExecutor
        import statistics

        def one(_):
            t = time.time()
            d = _render(a.source, a.mask, a.prompt, a.provider, timeout=a.timeout)
            return d["duration_ms"], round(time.time() - t, 1), d["outsideMaskChange"], d["provider"]

        with ThreadPoolExecutor(max_workers=max(a.parallel, 1)) as ex:
            res = list(ex.map(one, range(a.runs)))
        ms = [r[0] for r in res]
        print(json.dumps({"provider": res[0][3], "runs": a.runs, "parallel": a.parallel,
                          "p50_ms": int(statistics.median(ms)), "max_ms": max(ms), "min_ms": min(ms),
                          "worst_outside_change": max(r[2] for r in res)}, indent=2))
    elif a.cmd == "check":
        import requests
        base = os.environ.get("COMFYUI_BASE_URL", "http://localhost:8188").rstrip("/")
        try:
            s = requests.get(base + "/system_stats", timeout=10).json()
            q = requests.get(base + "/queue", timeout=10).json()
            dev = (s.get("devices") or [{}])[0]
            print(json.dumps({"base": base, "device": dev.get("name"), "vram_free": dev.get("vram_free"),
                              "vram_total": dev.get("vram_total"), "queue_running": len(q.get("queue_running", [])),
                              "queue_pending": len(q.get("queue_pending", []))}, indent=2))
        except Exception as e:
            print("ComfyUI check failed:", e); return 1
    elif a.cmd == "regress":
        cases_file = ROOT / "shared/demo/cases.json"
        cases = json.loads(cases_file.read_text()) if cases_file.exists() else [{
            "source": "shared/demo/bus_stop.jpg", "mask": "shared/demo/bus_stop_mask.png",
            "positive": "photorealistic bus stop shelter with a flat metal roof on slim posts", "negative": NEG}]
        limit = int(os.environ.get("COMFYUI_TIMEOUT_SECONDS", a.timeout))
        rows, bad = [], 0
        for cs in cases:
            src, msk = ROOT / cs["source"], ROOT / cs["mask"]
            d = _render(src, msk, cs["positive"], a.provider, timeout=a.timeout)
            ok = ((d["width"], d["height"]) == Image.open(src).size and d["outsideMaskChange"] < 0.01
                  and d["duration_ms"] < limit * 1000)
            bad += 0 if ok else 1
            rows.append(f"| {cs['source']} | {d['provider']} | {d['duration_ms']} ms | {d['outsideMaskChange']} | {'PASS' if ok else 'FAIL'} | {d['output_path']} |")
        report = ["# Regression report", "", "| source | provider | time | outside change | result | output |", "|---|---|---|---|---|---|"] + rows
        (ROOT / "workflows").mkdir(exist_ok=True)
        (ROOT / "workflows/regress_report.md").write_text("\n".join(report) + "\n")
        print("\n".join(report)); return 1 if bad else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
