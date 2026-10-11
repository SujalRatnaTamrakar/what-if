#!/usr/bin/env python
"""Django management entrypoint.

Adds the repo root to sys.path so sibling modules can be imported as
``backend.agents`` / ``backend.imaging`` (their frozen package layout),
while this project's own packages (config, core) resolve from backend/.
"""
import os
import sys
from pathlib import Path


def main():
    backend_dir = Path(__file__).resolve().parent
    repo_root = backend_dir.parent
    for p in (str(repo_root), str(backend_dir)):
        if p not in sys.path:
            sys.path.insert(0, p)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Is it installed in the active venv?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
