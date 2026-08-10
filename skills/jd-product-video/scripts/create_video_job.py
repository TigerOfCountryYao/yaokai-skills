#!/usr/bin/env python3
"""Create a collision-safe internal video workspace below a confirmed JD dossier."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path


VALID_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,79}")
SUBDIRECTORIES = ("assets", "voice", "project", "output")


def valid_id(value: str) -> str:
    if not VALID_ID.fullmatch(value):
        raise ValueError("video ID must be 1-80 letters, digits, hyphens, or underscores")
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dossier-dir", required=True, help="confirmed collection directory")
    parser.add_argument("--video-id", required=True, help="new ID for this video job")
    parser.add_argument("--dry-run", action="store_true", help="print the job plan without writing files")
    args = parser.parse_args()

    dossier_dir = Path(args.dossier_dir).expanduser().resolve()
    if not dossier_dir.is_dir():
        raise FileNotFoundError(f"dossier directory does not exist: {dossier_dir}")
    video_id = valid_id(args.video_id)
    job_dir = dossier_dir / "videos" / video_id
    if job_dir.exists():
        raise FileExistsError(f"video job already exists: {job_dir}")

    job = {
        "video_id": video_id,
        "dossier_dir": str(dossier_dir),
        "created_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "status": "initialized",
        "deliverable": "output/final.mp4",
        "internal_directories": list(SUBDIRECTORIES),
    }
    if args.dry_run:
        print(json.dumps({"job_dir": str(job_dir), "job": job}, ensure_ascii=False, indent=2))
        return 0

    for directory in SUBDIRECTORIES:
        (job_dir / directory).mkdir(parents=True, exist_ok=False)
    (job_dir / "job.json").write_text(json.dumps(job, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(job_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

