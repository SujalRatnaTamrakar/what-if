#!/usr/bin/env python3
"""Copy shared/fixtures -> mobile/src/fixtures and web/src/fixtures.

Usage: python3 scripts/sync_fixtures.py
Run from the repo root. Creates target dirs if missing.
"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "shared" / "fixtures"
TARGETS = [ROOT / "mobile" / "src" / "fixtures", ROOT / "web" / "src" / "fixtures"]

IGNORE = {".DS_Store"}


def main() -> int:
    if not SRC.is_dir():
        print(f"ERROR: source dir missing: {SRC}", file=sys.stderr)
        return 1
    for target in TARGETS:
        target.mkdir(parents=True, exist_ok=True)
        copied = 0
        for item in sorted(SRC.rglob("*")):
            if item.name in IGNORE:
                continue
            rel = item.relative_to(SRC)
            dest = target / rel
            if item.is_dir():
                dest.mkdir(parents=True, exist_ok=True)
            else:
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(item, dest)
                copied += 1
        print(f"synced {copied} file(s) -> {target.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
