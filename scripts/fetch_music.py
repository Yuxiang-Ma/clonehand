"""Fetch the MUSIC hand model at a pinned commit into a local cache outside this repository.

MUSIC (Xu et al. 2026, https://github.com/xupei0610/music) adds five thumb and little-finger
muscles to MyoHand. Its repository has no license, so its files are not vendored here. The engine
reads the five muscle definitions from this cache at load time; without it, the model runs
without them.

Usage: .venv/bin/python scripts/fetch_music.py
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.simulation.engine import MUSIC_COMMIT, MUSIC_REPOSITORY, music_directory

target = music_directory()
if (target / ".git").is_dir():
    head = subprocess.check_output(["git", "-C", str(target), "rev-parse", "HEAD"], text=True)
    if head.strip() == MUSIC_COMMIT:
        print(f"MUSIC {MUSIC_COMMIT[:7]} already present at {target}")
        raise SystemExit(0)
    raise SystemExit(f"{target} holds a different commit; remove it and run again.")
target.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(
    ["git", "clone", "--filter=blob:none", "--no-checkout", MUSIC_REPOSITORY, str(target)],
    check=True,
)
subprocess.run(["git", "-C", str(target), "checkout", MUSIC_COMMIT], check=True)
print(f"Fetched MUSIC {MUSIC_COMMIT[:7]} to {target}")
