#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import random
import shutil
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


TASKS = [
    "curb_ramp_present",
    "curb_ramp_absent",
    "obstacle_present",
    "surface_problem_present",
    "crosswalk_present",
]

CITY_ALIASES = {
    "sea": "seattle",
    "cdmx": "mexico_city",
    "mexico": "mexico_city",
    "nyc": "new_york",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build city-shift train/validation/test splits from an exported AccessCity vision dataset."
    )
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--train-cities", default="seattle,chicago")
    parser.add_argument("--validation-cities", default="pittsburgh,taipei")
    parser.add_argument("--test-cities", default="amsterdam,keelung,mexico_city")
    parser.add_argument("--include-unknown-in-train", action=argparse.BooleanOptionalAction, default=False)
    parser.add_argument("--seed", type=int, default=20260526)
    parser.add_argument("--train-max-per-task", type=int, default=0)
    parser.add_argument("--validation-max-per-task", type=int, default=0)
    parser.add_argument("--test-max-per-task", type=int, default=0)
    parser.add_argument(
        "--train-task-overrides",
        default="",
        help="Comma-separated task=count caps for train, for example obstacle_present=2200,surface_problem_present=2200.",
    )
    parser.add_argument("--copy-images", action=argparse.BooleanOptionalAction, default=False)
    parser.add_argument("--overwrite", action=argparse.BooleanOptionalAction, default=False)
    return parser.parse_args()


def parse_city_set(raw: str) -> set[str]:
    return {normalize_city(item.strip()) for item in raw.split(",") if item.strip()}


def parse_task_overrides(raw: str) -> dict[str, int]:
    overrides: dict[str, int] = {}
    if not raw.strip():
        return overrides
    for item in raw.split(","):
        task, value = item.split("=", 1)
        task = task.strip()
        if task not in TASKS:
            raise ValueError(f"Unknown task override {task!r}; expected one of {TASKS}.")
        overrides[task] = int(value)
    return overrides


def normalize_city(value: str) -> str:
    value = value.strip().lower().replace("-", "_")
    return CITY_ALIASES.get(value, value)


def city_from_row(row: dict[str, Any]) -> str:
    metadata = row.get("metadata") or {}
    source_path = str(metadata.get("source_path") or "")
    if source_path:
        stem = Path(source_path).name
        prefix = stem.split("_", 1)[0]
        if prefix:
            return normalize_city(prefix)
    city = metadata.get("city") or row.get("city")
    if city:
        return normalize_city(str(city))
    return "unknown"


def read_all_rows(source_root: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for split in ("train", "validation", "test"):
        split_file = source_root / f"{split}.jsonl"
        if not split_file.exists():
            continue
        with split_file.open("r", encoding="utf-8") as handle:
            for index, line in enumerate(handle):
                row = json.loads(line)
                row["_source_split"] = split
                row["_source_index"] = index
                row["_city"] = city_from_row(row)
                row["task"] = row.get("task") or TASKS[int(row["task_id"])]
                row["task_id"] = TASKS.index(row["task"])
                rows.append(row)
    return rows


def cap_rows(
    rows: list[dict[str, Any]],
    max_per_task: int,
    task_overrides: dict[str, int],
    rng: random.Random,
) -> list[dict[str, Any]]:
    if max_per_task <= 0 and not task_overrides:
        return list(rows)
    selected: list[dict[str, Any]] = []
    by_task: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_task[row["task"]].append(row)
    for task in TASKS:
        task_rows = by_task.get(task, [])
        rng.shuffle(task_rows)
        limit = task_overrides.get(task, max_per_task)
        selected.extend(task_rows[:limit] if limit > 0 else task_rows)
    rng.shuffle(selected)
    return selected


def assign_rows(args: argparse.Namespace, rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    train_cities = parse_city_set(args.train_cities)
    validation_cities = parse_city_set(args.validation_cities)
    test_cities = parse_city_set(args.test_cities)
    overlap = (train_cities & validation_cities) | (train_cities & test_cities) | (validation_cities & test_cities)
    if overlap:
        raise ValueError(f"City sets must be disjoint; overlap: {sorted(overlap)}")

    assigned: dict[str, list[dict[str, Any]]] = {"train": [], "validation": [], "test": []}
    for row in rows:
        city = row["_city"]
        if city in train_cities or (city == "unknown" and args.include_unknown_in_train):
            assigned["train"].append(row)
        elif city in validation_cities:
            assigned["validation"].append(row)
        elif city in test_cities:
            assigned["test"].append(row)

    rng = random.Random(args.seed)
    assigned["train"] = cap_rows(
        assigned["train"],
        args.train_max_per_task,
        parse_task_overrides(args.train_task_overrides),
        rng,
    )
    assigned["validation"] = cap_rows(assigned["validation"], args.validation_max_per_task, {}, rng)
    assigned["test"] = cap_rows(assigned["test"], args.test_max_per_task, {}, rng)
    for split_rows in assigned.values():
        rng.shuffle(split_rows)
    return assigned


def strip_internal_fields(row: dict[str, Any]) -> dict[str, Any]:
    cleaned = {key: value for key, value in row.items() if not key.startswith("_")}
    metadata = dict(cleaned.get("metadata") or {})
    metadata["city"] = row["_city"]
    metadata["source_split"] = row["_source_split"]
    metadata["source_index"] = row["_source_index"]
    cleaned["metadata"] = metadata
    return cleaned


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(strip_internal_fields(row), separators=(",", ":")) + "\n")


def summarize(assigned: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    for split, rows in assigned.items():
        by_city = Counter(row["_city"] for row in rows)
        by_task = Counter(row["task"] for row in rows)
        by_task_city: dict[str, dict[str, int]] = {}
        for task in TASKS:
            by_task_city[task] = dict(Counter(row["_city"] for row in rows if row["task"] == task))
        summary[split] = {
            "rows": len(rows),
            "cities": dict(sorted(by_city.items())),
            "tasks": dict(sorted(by_task.items())),
            "taskCities": by_task_city,
        }
    return summary


def prepare_images(source_root: Path, output_dir: Path, copy_images: bool, overwrite: bool) -> None:
    source_images = source_root / "images"
    target_images = output_dir / "images"
    if not source_images.exists():
        return
    if target_images.exists() or target_images.is_symlink():
        if not overwrite:
            return
        if target_images.is_symlink() or target_images.is_file():
            target_images.unlink()
        else:
            shutil.rmtree(target_images)
    if copy_images:
        shutil.copytree(source_images, target_images)
    else:
        os.symlink(source_images.resolve(), target_images, target_is_directory=True)


def main() -> None:
    args = parse_args()
    if args.output_dir.exists() and args.overwrite:
        for split in ("train", "validation", "test"):
            split_file = args.output_dir / f"{split}.jsonl"
            if split_file.exists():
                split_file.unlink()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    rows = read_all_rows(args.source_root)
    assigned = assign_rows(args, rows)
    for split, split_rows in assigned.items():
        write_jsonl(args.output_dir / f"{split}.jsonl", split_rows)
    prepare_images(args.source_root, args.output_dir, args.copy_images, args.overwrite)
    metadata = {
        "sourceRoot": str(args.source_root),
        "trainCities": sorted(parse_city_set(args.train_cities)),
        "validationCities": sorted(parse_city_set(args.validation_cities)),
        "testCities": sorted(parse_city_set(args.test_cities)),
        "includeUnknownInTrain": args.include_unknown_in_train,
        "summary": summarize(assigned),
    }
    (args.output_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps(metadata["summary"], indent=2))


if __name__ == "__main__":
    main()
