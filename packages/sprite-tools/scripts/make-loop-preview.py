#!/usr/bin/env python3
"""Create a short video preview from transparent PNG frames."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser()
	parser.add_argument("--frames", nargs="+", required=True, help="PNG frames in playback order")
	parser.add_argument("--out", required=True, help="Output .webm or .mp4 path")
	parser.add_argument("--fps", type=int, default=4)
	parser.add_argument("--loops", type=int, default=8)
	return parser.parse_args()


def main() -> None:
	args = parse_args()
	frames = [Path(frame) for frame in args.frames]
	if not frames:
		raise SystemExit("at least one frame is required")
	for frame in frames:
		if not frame.exists():
			raise SystemExit(f"missing frame: {frame}")

	out = Path(args.out)
	out.parent.mkdir(parents=True, exist_ok=True)

	ffmpeg = shutil.which("ffmpeg")
	if ffmpeg is None:
		raise SystemExit("ffmpeg is required to create preview videos")

	with tempfile.TemporaryDirectory(prefix="sprite-loop-preview-") as tmpdir:
		tmp = Path(tmpdir)
		index = 0
		for _ in range(args.loops):
			for frame in frames:
				shutil.copyfile(frame, tmp / f"frame_{index:04d}.png")
				index += 1

		common = [
			ffmpeg,
			"-y",
			"-framerate",
			str(args.fps),
			"-i",
			str(tmp / "frame_%04d.png"),
		]
		if out.suffix.lower() == ".webm":
			codec = ["-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0"]
		else:
			codec = ["-c:v", "libx264", "-pix_fmt", "yuv420p"]
		subprocess.run([*common, *codec, str(out)], check=True)


if __name__ == "__main__":
	main()
