#!/usr/bin/env python3
"""PlacePatch agents CLI (§10.6).

Run from the repo root:
    python -m backend.agents.cli check
    python -m backend.agents.cli scene --image shared/demo/bus_stop.jpg \\
        --problem "No shade while waiting." --place "Ponce & Highland bus stop"
    python -m backend.agents.cli review --source s.jpg --concept c.jpg --mask m.png \\
        --option shade_canopy --change-request "Please add shade."
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.agents import analyze_scene, review_concept  # noqa: E402
from backend.agents.catalog import CATALOG  # noqa: E402
from backend.agents.providers import get_provider  # noqa: E402
from backend.agents.schemas import Option  # noqa: E402


def cmd_check(_args) -> int:
    ok = True
    for role in ("scene", "draft", "review"):
        try:
            p = get_provider(role)
        except Exception as e:
            print(f"{role:6} ERROR: {e}")
            ok = False
            continue
        print(f"{role:6} provider={p.name} model={p.model}")
        if p.name == "ollama":
            try:
                models = p.list_models()
                print(f"       reachable; installed models: {', '.join(models) or '(none)'}")
                t0 = time.time()
                d = p.generate_json(
                    "Reply with JSON only.",
                    'Return exactly {"ok": true} as JSON.',
                    [],
                    {"type": "object", "properties": {"ok": {"type": "boolean"}}},
                    30,
                )
                print(f"       ping ok in {time.time()-t0:.1f}s: {d}")
            except Exception as e:
                print(f"       FAILED: {e}")
                ok = False
        elif p.name == "gemini":
            import os

            print(
                "       GEMINI_API_KEY " + ("set" if os.environ.get("GEMINI_API_KEY") else "MISSING")
            )
        elif p.name == "openai":
            import os

            print(
                "       OPENAI_API_KEY " + ("set" if os.environ.get("OPENAI_API_KEY") else "MISSING")
            )
        elif p.name == "fallback":
            from backend.agents.providers.chain import FallbackProvider

            assert isinstance(p, FallbackProvider)
            print(f"       chain: {' -> '.join(leg.name for leg in p.legs)}")
        else:
            print("       fake provider — no network needed")
    return 0 if ok else 1


def cmd_scene(args) -> int:
    t0 = time.time()
    scene = analyze_scene(
        Path(args.image),
        problem_text=args.problem,
        place_label=args.place,
        category=args.category,
    )
    ms = int((time.time() - t0) * 1000)
    print(json.dumps(scene.model_dump(by_alias=True, mode="json"), indent=2))
    print(f"\ndurationMs={ms} provider={scene.provider} model={scene.model}")
    return 0


def _option_from_catalog(option_id: str) -> Option:
    for _cat, entries in CATALOG.items():
        for e in entries:
            if e["id"] == option_id:
                return Option(
                    id=e["id"],
                    category=_cat,
                    title=e["title"],
                    description=e["title"],
                    edit_goal=f"Add {e['base_goal']}.",
                    mask_hint="Brush the area to change.",
                    request_draft="Please consider this improvement.",
                )
    raise SystemExit(f"Unknown catalog option id: {option_id}")


def cmd_review(args) -> int:
    option = _option_from_catalog(args.option)
    t0 = time.time()
    review = review_concept(
        Path(args.source),
        Path(args.concept),
        Path(args.mask),
        option,
        args.change_request,
    )
    ms = int((time.time() - t0) * 1000)
    print(json.dumps(review.model_dump(by_alias=True, mode="json"), indent=2))
    print(f"\ndurationMs={ms} provider={review.provider} model={review.model}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="agents.cli")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("check", help="List providers/models and ping them")

    s = sub.add_parser("scene", help="Run analyze_scene on an image")
    s.add_argument("--image", required=True)
    s.add_argument("--problem", required=True)
    s.add_argument("--place", required=True)
    s.add_argument("--category", default="shade")
    s.set_defaults(fn=cmd_scene)

    r = sub.add_parser("review", help="Run review_concept on source/concept/mask")
    r.add_argument("--source", required=True)
    r.add_argument("--concept", required=True)
    r.add_argument("--mask", required=True)
    r.add_argument("--option", default="shade_canopy")
    r.add_argument("--change-request", default="Please consider adding shade.")
    r.set_defaults(fn=cmd_review)

    args = ap.parse_args(argv)
    if args.cmd == "check":
        return cmd_check(args)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
