#!/usr/bin/env python3
"""Convert an embroidery file into Vision ExportDesign JSON via Ink/Stitch readers."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert embroidery file to Vision ExportDesign JSON using Ink/Stitch parser."
    )
    parser.add_argument("--input", required=True, help="Input embroidery file (dst/pes/jef/...)")
    parser.add_argument("--output", required=True, help="Output ExportDesign JSON path")
    parser.add_argument(
        "--inkstitch-root",
        default=str((Path(__file__).resolve().parents[2] / "inkstitch")),
        help="Path to local Ink/Stitch repository (default: ../inkstitch)",
    )
    return parser.parse_args()


def stitch_to_type(stitch: object) -> str:
    if bool(getattr(stitch, "trim", False)):
        return "Trim"
    if bool(getattr(stitch, "jump", False)):
        return "Jump"
    if bool(getattr(stitch, "stop", False)) or bool(getattr(stitch, "color_change", False)):
        return "ColorChange"
    return "Normal"


def read_rgb(color_block: object) -> dict[str, int]:
    color = getattr(color_block, "color", None)
    rgb = getattr(color, "rgb", (0, 0, 0))
    if not isinstance(rgb, (list, tuple)) or len(rgb) < 3:
        rgb = (0, 0, 0)
    return {"r": int(rgb[0]), "g": int(rgb[1]), "b": int(rgb[2]), "a": 255}


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    inkstitch_root = Path(args.inkstitch_root).resolve()

    if not input_path.exists():
        print(f"Input file not found: {input_path}", file=sys.stderr)
        return 1
    if not inkstitch_root.exists():
        print(f"Ink/Stitch root not found: {inkstitch_root}", file=sys.stderr)
        return 1

    try:
        sys.path.insert(0, str(inkstitch_root))
        from lib.stitch_plan.read_file import stitch_plan_from_file  # type: ignore
        from lib.svg import PIXELS_PER_MM  # type: ignore
    except Exception as exc:  # noqa: BLE001
        print(
            f"Failed importing Ink/Stitch modules from {inkstitch_root}: {exc}",
            file=sys.stderr,
        )
        return 1

    try:
        stitch_plan = stitch_plan_from_file(str(input_path))
    except Exception as exc:  # noqa: BLE001
        print(f"Failed reading embroidery file with Ink/Stitch: {exc}", file=sys.stderr)
        return 1

    stitches: list[dict[str, object]] = []
    colors: list[dict[str, int]] = []
    for color_block in stitch_plan:
        colors.append(read_rgb(color_block))
        for stitch in color_block:
            stitches.append(
                {
                    "x": float(getattr(stitch, "x", 0.0)) / float(PIXELS_PER_MM),
                    "y": float(getattr(stitch, "y", 0.0)) / float(PIXELS_PER_MM),
                    "stitch_type": stitch_to_type(stitch),
                }
            )

    if stitches:
        last = stitches[-1]
        stitches.append({"x": last["x"], "y": last["y"], "stitch_type": "End"})

    if not colors:
        colors.append({"r": 0, "g": 0, "b": 0, "a": 255})

    design = {
        "name": input_path.stem,
        "stitches": stitches,
        "colors": colors,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(design, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
