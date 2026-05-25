#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import tarfile
from collections import Counter
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps


def parse_csv(value: str) -> set[str]:
    return {item.strip() for item in value.split(",") if item.strip()}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build a compact accessibility-vision dataset delta by copying rows from a larger "
            "export that are not present in an already published base dataset."
        )
    )
    parser.add_argument("--full-dataset-root", type=Path, required=True)
    parser.add_argument("--base-dataset-root", type=Path, default=None)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--tar-output", type=Path, default=None)
    parser.add_argument("--splits", default="train", help="Comma-separated splits to export. Default: train.")
    parser.add_argument("--tasks", default="", help="Optional comma-separated task allowlist.")
    parser.add_argument("--source-kinds", default="", help="Optional comma-separated source_kind allowlist.")
    parser.add_argument("--max-image-side", type=int, default=256)
    parser.add_argument("--jpeg-quality", type=int, default=76)
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args()


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, separators=(",", ":")) + "\n")


def resize_image(source: Path, destination: Path, max_image_side: int, jpeg_quality: int) -> tuple[int, int]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as raw_image:
        image = ImageOps.exif_transpose(raw_image).convert("RGB")
        if max_image_side > 0 and max(image.size) > max_image_side:
            image.thumbnail((max_image_side, max_image_side), Image.Resampling.BICUBIC)
        image.save(destination, format="JPEG", quality=jpeg_quality, optimize=True)
        return image.size


def build_delta(args: argparse.Namespace) -> dict[str, Any]:
    if args.output_dir.exists():
        if not args.overwrite:
            raise SystemExit(f"{args.output_dir} already exists; pass --overwrite to replace it.")
        shutil.rmtree(args.output_dir)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    splits = parse_csv(args.splits)
    tasks = parse_csv(args.tasks)
    source_kinds = parse_csv(args.source_kinds)
    summary: dict[str, Any] = {}

    for split in sorted(splits):
        full_rows = read_jsonl(args.full_dataset_root / f"{split}.jsonl")
        base_images = set()
        if args.base_dataset_root is not None:
            base_images = {row["image"] for row in read_jsonl(args.base_dataset_root / f"{split}.jsonl")}

        delta_rows: list[dict[str, Any]] = []
        for row in full_rows:
            if base_images and row["image"] in base_images:
                continue
            if tasks and row.get("task") not in tasks:
                continue
            if source_kinds and row.get("source_kind") not in source_kinds:
                continue

            source_image = args.full_dataset_root / row["image"]
            if not source_image.exists():
                raise SystemExit(f"Image referenced by {split}.jsonl does not exist: {source_image}")
            output_row = dict(row)
            width, height = resize_image(
                source_image,
                args.output_dir / row["image"],
                args.max_image_side,
                args.jpeg_quality,
            )
            output_row["width"] = width
            output_row["height"] = height
            output_row.setdefault("metadata", {})
            output_row["metadata"] = dict(output_row["metadata"])
            output_row["metadata"]["delta_export"] = args.output_dir.name
            delta_rows.append(output_row)

        write_jsonl(args.output_dir / f"{split}-delta.jsonl", delta_rows)
        summary[split] = {
            "rows": len(delta_rows),
            "tasks": dict(sorted(Counter(row["task"] for row in delta_rows).items())),
            "sourceKinds": dict(sorted(Counter(row.get("source_kind", "") for row in delta_rows).items())),
        }

    metadata = {
        "baseDatasetRoot": str(args.base_dataset_root) if args.base_dataset_root else None,
        "fullDatasetRoot": str(args.full_dataset_root),
        "jpegQuality": args.jpeg_quality,
        "maxImageSide": args.max_image_side,
        "splitSummary": summary,
    }
    (args.output_dir / "metadata.json").write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return metadata


def write_tar(output_dir: Path, tar_output: Path) -> None:
    tar_output.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(tar_output, "w") as archive:
        for path in sorted(output_dir.rglob("*")):
            archive.add(path, arcname=path.relative_to(output_dir))


def main() -> None:
    args = parse_args()
    metadata = build_delta(args)
    if args.tar_output:
        write_tar(args.output_dir, args.tar_output)
        metadata["tarOutput"] = str(args.tar_output)
    print(json.dumps(metadata, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
