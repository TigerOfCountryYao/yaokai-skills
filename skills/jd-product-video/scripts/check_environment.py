#!/usr/bin/env python3
"""Validate cross-platform prerequisites for a JD product video job."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from typing import Sequence


def command_path(name: str) -> str | None:
    return shutil.which(name) or (shutil.which(f"{name}.cmd") if os.name == "nt" else None)


def run(command: Sequence[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tts-mode", choices=("none", "edge-tts", "minimax"), default="none")
    parser.add_argument("--required-secret-env", action="append", default=[], metavar="NAME")
    args = parser.parse_args()

    failures: list[str] = []

    python_version = sys.version_info
    if python_version < (3, 10):
        failures.append(f"Python 3.10 or newer is required; found {sys.version.split()[0]}")
    else:
        print(f"Python: {sys.version.split()[0]}")

    node = command_path("node")
    if not node:
        failures.append("Missing command: node")
    else:
        version = run((node, "--version")).stdout.strip()
        match = re.match(r"^v(\d+)", version)
        if not match or int(match.group(1)) < 22:
            failures.append(f"Node.js 22 or newer is required; found {version or 'unknown'}")
        else:
            print(f"Node.js: {version}")

    ffmpeg = command_path("ffmpeg")
    if not ffmpeg:
        failures.append("Missing command: ffmpeg")
    else:
        print(f"FFmpeg: {run((ffmpeg, '-version')).stdout.splitlines()[0]}")

    npx = command_path("npx")
    if not npx:
        failures.append("Missing command: npx")
    else:
        result = run((npx, "--yes", "hyperframes@latest", "doctor"))
        if result.returncode:
            failures.append("HyperFrames environment check failed")
        else:
            print("HyperFrames: available")

    if args.tts_mode == "edge-tts":
        result = run((sys.executable, "-c", "import edge_tts"))
        if result.returncode:
            failures.append("Python package edge-tts is not installed")
        else:
            print("Edge TTS: available")

    for name in args.required_secret_env:
        if not name.strip():
            failures.append("Required secret environment variable name cannot be empty")
        elif not os.environ.get(name):
            failures.append(f"Required secret environment variable is missing from this process: {name}")
        else:
            print(f"Secret environment variable is present: {name}")

    if failures:
        for failure in failures:
            print(f"ERROR: {failure}", file=sys.stderr)
        return 1

    print("Environment check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
