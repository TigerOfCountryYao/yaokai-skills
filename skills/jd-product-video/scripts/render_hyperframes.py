#!/usr/bin/env python3
"""Validate and render a HyperFrames project to MP4 on any supported OS."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path
from typing import Sequence


def npx_command() -> str:
    return shutil.which("npx") or (shutil.which("npx.cmd") if os.name == "nt" else None) or "npx"


def run(command: Sequence[str], cwd: Path | None = None) -> None:
    result = subprocess.run(command, cwd=cwd, check=False)
    if result.returncode:
        raise RuntimeError(f"HyperFrames command failed: {' '.join(command)}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-dir", required=True)
    parser.add_argument("--output-path", required=True)
    parser.add_argument("--quality", choices=("draft", "standard", "high"), default="high")
    parser.add_argument("--fps", choices=("24", "30", "60"), default="30")
    args = parser.parse_args()

    project_dir = Path(args.project_dir).expanduser().resolve()
    if not project_dir.is_dir():
        raise FileNotFoundError(f"project directory does not exist: {project_dir}")
    output_path = Path(args.output_path).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    npx = npx_command()
    run((npx, "hyperframes", "doctor"))
    run((npx, "hyperframes", "lint", "."), project_dir)
    run((npx, "hyperframes", "validate", "."), project_dir)
    run((npx, "hyperframes", "inspect", ".", "--samples", "15", "--strict"), project_dir)
    run(
        (npx, "hyperframes", "render", "--output", str(output_path), "--quality", args.quality, "--fps", args.fps, "--strict-all"),
        project_dir,
    )
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

