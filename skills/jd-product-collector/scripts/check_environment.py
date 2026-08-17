#!/usr/bin/env python3
"""Check local prerequisites for a JD product collection task."""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path


def command_path(name: str) -> str | None:
    return shutil.which(name) or (shutil.which(f"{name}.cmd") if os.name == "nt" else None)


def chrome_path() -> str | None:
    commands = ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser")
    for command in commands:
        if path := command_path(command):
            return path

    candidates: list[Path] = []
    if sys.platform == "darwin":
        candidates.append(Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"))
    elif os.name == "nt":
        for root in (os.environ.get("PROGRAMFILES"), os.environ.get("PROGRAMFILES(X86)"), os.environ.get("LOCALAPPDATA")):
            if root:
                candidates.append(Path(root) / "Google" / "Chrome" / "Application" / "chrome.exe")
    return next((str(path) for path in candidates if path.is_file()), None)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--with-video", action="store_true", help="also check Node.js, FFmpeg, and HyperFrames")
    args = parser.parse_args()
    failures: list[str] = []

    if sys.version_info < (3, 10):
        failures.append(f"Python 3.10+ is required; found {sys.version.split()[0]}")
    else:
        print(f"Python: {sys.version.split()[0]}")

    if chrome := chrome_path():
        print(f"Chrome/Chromium: {chrome}")
    else:
        failures.append("Chrome or Chromium was not found")

    print("Agent browser integration: must be provided by the invoking agent and explicitly authorized by the user")

    if args.with_video:
        from subprocess import PIPE, STDOUT, run

        node = command_path("node")
        npx = command_path("npx")
        ffmpeg = command_path("ffmpeg")
        if not node:
            failures.append("Node.js 22+ is required for HyperFrames")
        if not npx:
            failures.append("npx is required for HyperFrames")
        if not ffmpeg:
            failures.append("FFmpeg is required for HyperFrames rendering")
        if node and npx and ffmpeg:
            result = run(
                (npx, "--yes", "hyperframes@latest", "doctor"),
                stdout=PIPE,
                stderr=STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
            )
            if result.returncode:
                failures.append("HyperFrames doctor failed")
            else:
                print("HyperFrames: available")

    if failures:
        for failure in failures:
            print(f"ERROR: {failure}", file=sys.stderr)
        return 1
    print("Environment check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
