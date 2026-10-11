"""pytest bootstrap: repo root on sys.path so backend.agents / backend.imaging
import as absolute packages (their frozen layout)."""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent
for p in (str(REPO_ROOT), str(BACKEND_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)
