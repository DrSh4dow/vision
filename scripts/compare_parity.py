#!/usr/bin/env python3
"""Compare Vision metrics against Ink/Stitch baseline metrics."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare Vision parity metrics against Ink/Stitch baselines.")
    parser.add_argument("--vision-dir", required=True, help="Directory with Vision *.metrics.json files")
    parser.add_argument("--inkstitch-dir", required=True, help="Directory with Ink/Stitch *.metrics.json files")
    parser.add_argument("--max-stitch-delta-pct", type=float, default=20.0)
    parser.add_argument("--max-jump-ratio", type=float, default=1.15)
    parser.add_argument("--max-trim-ratio", type=float, default=1.15)
    parser.add_argument("--max-travel-ratio", type=float, default=1.10)
    parser.add_argument("--max-density-error-mm", type=float, default=0.20)
    parser.add_argument("--max-angle-error-deg", type=float, default=20.0)
    parser.add_argument("--max-coverage-error-pct", type=float, default=3.0)
    parser.add_argument("--min-fixtures", type=int, default=3)
    return parser.parse_args()


def read_metrics(path: Path) -> dict[str, float]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    quality = payload.get("quality", payload)
    return {
        "stitch_count": float(quality.get("stitch_count", 0)),
        "jump_count": float(quality.get("jump_count", 0)),
        "trim_count": float(quality.get("trim_count", 0)),
        "travel_distance_mm": float(quality.get("travel_distance_mm", 0)),
        "density_error_mm": float(quality.get("density_error_mm", 0)),
        "angle_error_deg": float(quality.get("angle_error_deg", 0)),
        "coverage_error_pct": float(quality.get("coverage_error_pct", 0)),
    }


def safe_ratio(num: float, den: float) -> float:
    if den <= 0:
        return 0.0 if num <= 0 else math.inf
    return num / den


def main() -> int:
    args = parse_args()
    vision_dir = Path(args.vision_dir).resolve()
    inkstitch_dir = Path(args.inkstitch_dir).resolve()

    if not vision_dir.exists():
        print(f"Vision metrics dir not found: {vision_dir}", file=sys.stderr)
        return 1
    if not inkstitch_dir.exists():
        print(f"Ink/Stitch metrics dir not found: {inkstitch_dir}", file=sys.stderr)
        return 1

    baseline_files = sorted(inkstitch_dir.glob("*.metrics.json"))
    if not baseline_files:
        print(f"No baseline files in {inkstitch_dir}", file=sys.stderr)
        return 1

    failures: list[str] = []
    compared = 0
    for baseline in baseline_files:
        vision = vision_dir / baseline.name
        if not vision.exists():
            failures.append(f"{baseline.name}: missing Vision metrics file")
            continue
        compared += 1

        i = read_metrics(baseline)
        v = read_metrics(vision)
        stitch_delta_pct = abs(v["stitch_count"] - i["stitch_count"]) / max(i["stitch_count"], 1.0) * 100.0
        jump_ratio = safe_ratio(v["jump_count"], i["jump_count"])
        trim_ratio = safe_ratio(v["trim_count"], i["trim_count"])
        travel_ratio = safe_ratio(v["travel_distance_mm"], i["travel_distance_mm"])

        violated = []
        if stitch_delta_pct > args.max_stitch_delta_pct:
            violated.append(f"stitch_delta_pct={stitch_delta_pct:.2f}")
        if jump_ratio > args.max_jump_ratio:
            violated.append(f"jump_ratio={jump_ratio:.2f}")
        if trim_ratio > args.max_trim_ratio:
            violated.append(f"trim_ratio={trim_ratio:.2f}")
        if travel_ratio > args.max_travel_ratio:
            violated.append(f"travel_ratio={travel_ratio:.2f}")
        density_over = v["density_error_mm"] - i["density_error_mm"]
        angle_over = v["angle_error_deg"] - i["angle_error_deg"]
        coverage_over = v["coverage_error_pct"] - i["coverage_error_pct"]
        if density_over > args.max_density_error_mm:
            violated.append(f"density_over_mm={density_over:.3f}")
        if angle_over > args.max_angle_error_deg:
            violated.append(f"angle_over_deg={angle_over:.2f}")
        if coverage_over > args.max_coverage_error_pct:
            violated.append(f"coverage_over_pct={coverage_over:.2f}")

        if violated:
            failures.append(f"{baseline.name}: " + ", ".join(violated))

        print(
            f"{baseline.name}: "
            f"stitchΔ={stitch_delta_pct:.2f}% "
            f"jump×={jump_ratio:.2f} trim×={trim_ratio:.2f} travel×={travel_ratio:.2f} "
            f"densityΔ={density_over:.3f} angleΔ={angle_over:.2f} "
            f"coverageΔ={coverage_over:.2f}"
        )

    if failures:
        print("\nParity check failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    if compared < args.min_fixtures:
        print(
            f"\nParity check failed: only {compared} fixture(s) compared, need at least {args.min_fixtures}.",
            file=sys.stderr,
        )
        return 1

    print("\nParity check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
