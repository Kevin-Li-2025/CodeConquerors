#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import os
import time
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image, ImageDraw
from sklearn.metrics import average_precision_score, f1_score, roc_auc_score


RAMPNET_DATASET = "projectsidewalk/rampnet-dataset"
RAMPNET_MODEL = "projectsidewalk/rampnet-model"
CITY_RANGES = {
    "nyc": ((40.35, 40.95), (-74.35, -73.55)),
    "portland": ((45.25, 45.75), (-123.05, -122.25)),
    "bend": ((43.95, 44.25), (-121.55, -121.10)),
}


@dataclass(frozen=True)
class Detection:
    image_id: int
    x: float
    y: float
    score: float


@dataclass(frozen=True)
class GroundTruth:
    image_id: int
    x: float
    y: float


@dataclass
class ScoredExample:
    image_id: int
    city: str
    detections: list[Detection]
    ground_truth: list[GroundTruth]
    latency_ms: float
    max_score: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate the official RampNet-style curb-ramp heatmap detector on Project Sidewalk panoramas."
    )
    parser.add_argument("--dataset", default=RAMPNET_DATASET)
    parser.add_argument("--model", default=RAMPNET_MODEL)
    parser.add_argument("--split", default="validation")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--max-examples", type=int, default=128)
    parser.add_argument("--max-examples-per-city", type=int, default=0)
    parser.add_argument("--include-cities", default="", help="Comma-separated city filter, for example nyc,portland,bend.")
    parser.add_argument("--exclude-cities", default="")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--input-height", type=int, default=2048)
    parser.add_argument("--input-width", type=int, default=4096)
    parser.add_argument("--peak-threshold", type=float, default=0.5)
    parser.add_argument("--ap-peak-threshold", type=float, default=0.05)
    parser.add_argument("--image-threshold", type=float, default=0.5)
    parser.add_argument("--min-peak-distance", type=int, default=10)
    parser.add_argument("--max-peaks-per-image", type=int, default=64)
    parser.add_argument("--match-radius-px", type=float, default=28.0)
    parser.add_argument("--calibration-bins", type=int, default=10)
    parser.add_argument("--hf-token", default=os.getenv("HF_TOKEN"))
    parser.add_argument("--synthetic-smoke", action="store_true")
    return parser.parse_args()


def parse_city_filter(raw: str) -> set[str]:
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def infer_rampnet_city(pano_coord: list[float] | tuple[float, float] | None) -> str:
    if not pano_coord or len(pano_coord) < 2:
        return "unknown"
    lat = float(pano_coord[0])
    lon = float(pano_coord[1])
    for city, (lat_range, lon_range) in CITY_RANGES.items():
        if lat_range[0] <= lat <= lat_range[1] and lon_range[0] <= lon <= lon_range[1]:
            return city
    return "unknown"


def preprocess_image(image: Image.Image, input_height: int, input_width: int) -> torch.Tensor:
    resized = image.convert("RGB").resize((input_width, input_height), Image.Resampling.BILINEAR)
    array = np.asarray(resized, dtype=np.float32) / 255.0
    tensor = torch.from_numpy(array).permute(2, 0, 1)
    mean = torch.tensor([0.485, 0.456, 0.406], dtype=torch.float32).view(3, 1, 1)
    std = torch.tensor([0.229, 0.224, 0.225], dtype=torch.float32).view(3, 1, 1)
    return (tensor - mean) / std


def local_peaks(
    heatmap: np.ndarray,
    threshold: float,
    min_distance: int,
    max_peaks: int,
) -> list[tuple[int, int, float]]:
    heatmap_tensor = torch.from_numpy(np.asarray(heatmap, dtype=np.float32)).view(1, 1, *heatmap.shape)
    kernel = max(1, min_distance * 2 + 1)
    pooled = F.max_pool2d(heatmap_tensor, kernel_size=kernel, stride=1, padding=min_distance)
    mask = (heatmap_tensor == pooled) & (heatmap_tensor >= float(threshold))
    rows, cols = torch.where(mask[0, 0])
    peaks = [(int(row), int(col), float(heatmap[row, col])) for row, col in zip(rows.tolist(), cols.tolist(), strict=True)]
    peaks.sort(key=lambda item: item[2], reverse=True)
    return peaks[:max_peaks]


def ground_truth_points(example: dict[str, Any], image_id: int, width: int, height: int) -> list[GroundTruth]:
    points = example.get("curb_ramp_points_normalized") or []
    ground_truth: list[GroundTruth] = []
    for point in points:
        if len(point) < 2:
            continue
        x = min(max(float(point[0]), 0.0), 1.0) * width
        y = min(max(float(point[1]), 0.0), 1.0) * height
        ground_truth.append(GroundTruth(image_id=image_id, x=x, y=y))
    return ground_truth


def detections_from_heatmap(
    heatmap: np.ndarray,
    image_id: int,
    image_width: int,
    image_height: int,
    peak_threshold: float,
    min_distance: int,
    max_peaks: int,
) -> list[Detection]:
    peaks = local_peaks(np.clip(heatmap, 0.0, 1.0), peak_threshold, min_distance, max_peaks)
    heatmap_height, heatmap_width = heatmap.shape
    scale_x = image_width / max(float(heatmap_width), 1.0)
    scale_y = image_height / max(float(heatmap_height), 1.0)
    return [
        Detection(image_id=image_id, x=(col + 0.5) * scale_x, y=(row + 0.5) * scale_y, score=score)
        for row, col, score in peaks
    ]


def distance_px(detection: Detection, ground_truth: GroundTruth) -> float:
    return math.hypot(detection.x - ground_truth.x, detection.y - ground_truth.y)


def match_counts(
    detections: list[Detection],
    ground_truth: list[GroundTruth],
    radius_px: float,
    score_threshold: float,
) -> tuple[int, int, int]:
    kept = [detection for detection in detections if detection.score >= score_threshold]
    kept.sort(key=lambda item: item.score, reverse=True)
    unmatched = set(range(len(ground_truth)))
    tp = 0
    fp = 0
    for detection in kept:
        candidates = [
            (distance_px(detection, ground_truth[index]), index)
            for index in unmatched
            if detection.image_id == ground_truth[index].image_id
        ]
        candidates = [item for item in candidates if item[0] <= radius_px]
        if candidates:
            _distance, matched_index = min(candidates, key=lambda item: item[0])
            unmatched.remove(matched_index)
            tp += 1
        else:
            fp += 1
    fn = len(unmatched)
    return tp, fp, fn


def detection_average_precision(
    detections: list[Detection],
    ground_truth: list[GroundTruth],
    radius_px: float,
) -> float:
    if not ground_truth:
        return 0.0
    detections = sorted(detections, key=lambda item: item.score, reverse=True)
    gt_by_image: dict[int, list[GroundTruth]] = defaultdict(list)
    for item in ground_truth:
        gt_by_image[item.image_id].append(item)
    matched_by_image: dict[int, set[int]] = defaultdict(set)
    tp_values: list[int] = []
    fp_values: list[int] = []

    for detection in detections:
        candidates = []
        for index, gt in enumerate(gt_by_image.get(detection.image_id, [])):
            if index in matched_by_image[detection.image_id]:
                continue
            distance = distance_px(detection, gt)
            if distance <= radius_px:
                candidates.append((distance, index))
        if candidates:
            _distance, matched_index = min(candidates, key=lambda item: item[0])
            matched_by_image[detection.image_id].add(matched_index)
            tp_values.append(1)
            fp_values.append(0)
        else:
            tp_values.append(0)
            fp_values.append(1)

    if not tp_values:
        return 0.0
    tp_cum = np.cumsum(tp_values)
    fp_cum = np.cumsum(fp_values)
    recalls = tp_cum / max(len(ground_truth), 1)
    precisions = tp_cum / np.maximum(tp_cum + fp_cum, 1)
    mrec = np.concatenate(([0.0], recalls, [1.0]))
    mpre = np.concatenate(([1.0], precisions, [0.0]))
    for index in range(len(mpre) - 2, -1, -1):
        mpre[index] = max(mpre[index], mpre[index + 1])
    changing = np.where(mrec[1:] != mrec[:-1])[0]
    return float(np.sum((mrec[changing + 1] - mrec[changing]) * mpre[changing + 1]))


def expected_calibration_error(labels: list[int], scores: list[float], bins: int) -> float | None:
    if not labels:
        return None
    y_true = np.asarray(labels, dtype=np.float32)
    y_score = np.asarray(scores, dtype=np.float32)
    edges = np.linspace(0.0, 1.0, bins + 1)
    ece = 0.0
    for index in range(bins):
        lower = edges[index]
        upper = edges[index + 1]
        selected = (y_score >= lower) & (y_score < upper if index < bins - 1 else y_score <= upper)
        if not selected.any():
            continue
        ece += float(selected.mean()) * abs(float(y_score[selected].mean()) - float(y_true[selected].mean()))
    return ece


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    return float(np.percentile(np.asarray(values, dtype=np.float32), pct))


def summarize_examples(examples: list[ScoredExample], args: argparse.Namespace) -> dict[str, Any]:
    detections = [detection for example in examples for detection in example.detections]
    ground_truth = [gt for example in examples for gt in example.ground_truth]
    tp, fp, fn = match_counts(detections, ground_truth, args.match_radius_px, args.peak_threshold)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    labels = [1 if example.ground_truth else 0 for example in examples]
    scores = [example.max_score for example in examples]
    try:
        auroc = float(roc_auc_score(labels, scores)) if len(set(labels)) > 1 else None
    except ValueError:
        auroc = None
    try:
        image_ap = float(average_precision_score(labels, scores)) if len(set(labels)) > 1 else None
    except ValueError:
        image_ap = None
    image_predictions = [1 if score >= args.image_threshold else 0 for score in scores]
    image_f1 = float(f1_score(labels, image_predictions, zero_division=0)) if labels else 0.0
    latency = [example.latency_ms for example in examples]
    return {
        "examples": len(examples),
        "positiveImages": int(sum(labels)),
        "groundTruthPoints": len(ground_truth),
        "predictedPointsAtThreshold": int(sum(1 for detection in detections if detection.score >= args.peak_threshold)),
        "pointDetection": {
            "matchRadiusPx": args.match_radius_px,
            "threshold": args.peak_threshold,
            "averagePrecision": detection_average_precision(detections, ground_truth, args.match_radius_px),
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "confusion": {"tp": tp, "fp": fp, "fn": fn},
        },
        "imageLevel": {
            "threshold": args.image_threshold,
            "averagePrecision": image_ap,
            "auroc": auroc,
            "f1": image_f1,
            "ece": expected_calibration_error(labels, scores, args.calibration_bins),
        },
        "latencyMs": {
            "mean": float(np.mean(latency)) if latency else 0.0,
            "p50": percentile(latency, 50),
            "p95": percentile(latency, 95),
            "p99": percentile(latency, 99),
        },
    }


def synthetic_examples(args: argparse.Namespace) -> list[ScoredExample]:
    rng = np.random.default_rng(20260526)
    examples: list[ScoredExample] = []
    for image_id in range(24):
        width = 1024
        height = 512
        city = ["nyc", "portland", "bend"][image_id % 3]
        positive = image_id % 4 != 0
        gt_points = []
        detections = []
        if positive:
            x = float(rng.uniform(120, width - 120))
            y = float(rng.uniform(120, height - 90))
            gt_points.append(GroundTruth(image_id=image_id, x=x, y=y))
            detections.append(
                Detection(
                    image_id=image_id,
                    x=float(x + rng.normal(0, 8)),
                    y=float(y + rng.normal(0, 8)),
                    score=float(rng.uniform(0.68, 0.96)),
                )
            )
        if image_id % 5 == 0:
            detections.append(
                Detection(
                    image_id=image_id,
                    x=float(rng.uniform(0, width)),
                    y=float(rng.uniform(0, height)),
                    score=float(rng.uniform(0.20, 0.62)),
                )
            )
        examples.append(
            ScoredExample(
                image_id=image_id,
                city=city,
                detections=detections,
                ground_truth=gt_points,
                latency_ms=float(rng.uniform(12, 40)),
                max_score=max([detection.score for detection in detections], default=float(rng.uniform(0.02, 0.25))),
            )
        )
    return examples


def iter_dataset_rows(args: argparse.Namespace) -> Iterable[dict[str, Any]]:
    from datasets import load_dataset

    dataset = load_dataset(args.dataset, split=args.split, streaming=True, token=args.hf_token)
    include_cities = parse_city_filter(args.include_cities)
    exclude_cities = parse_city_filter(args.exclude_cities)
    city_counts: dict[str, int] = defaultdict(int)
    yielded = 0
    for row in dataset:
        city = infer_rampnet_city(row.get("pano_coord"))
        if include_cities and city not in include_cities:
            continue
        if city in exclude_cities:
            continue
        if args.max_examples_per_city > 0 and city_counts[city] >= args.max_examples_per_city:
            continue
        row["_city"] = city
        city_counts[city] += 1
        yielded += 1
        yield row
        if args.max_examples > 0 and yielded >= args.max_examples:
            break


@torch.inference_mode()
def score_rampnet_examples(args: argparse.Namespace) -> list[ScoredExample]:
    from transformers import AutoModel

    device = torch.device(args.device if args.device != "auto" else ("cuda" if torch.cuda.is_available() else "cpu"))
    model = AutoModel.from_pretrained(args.model, trust_remote_code=True).to(device).eval()
    examples: list[ScoredExample] = []
    for image_id, row in enumerate(iter_dataset_rows(args)):
        image = row["image"]
        if not isinstance(image, Image.Image):
            image = Image.open(image).convert("RGB")
        width, height = image.size
        tensor = preprocess_image(image, args.input_height, args.input_width).unsqueeze(0).to(device)
        started = time.perf_counter()
        heatmap = model(tensor).squeeze().detach().float().cpu().numpy()
        latency_ms = (time.perf_counter() - started) * 1000
        if heatmap.ndim != 2:
            heatmap = np.squeeze(heatmap)
        if heatmap.ndim != 2:
            raise RuntimeError(f"Expected a 2D heatmap, got shape {heatmap.shape}.")
        detections = detections_from_heatmap(
            heatmap,
            image_id=image_id,
            image_width=width,
            image_height=height,
            peak_threshold=args.ap_peak_threshold,
            min_distance=args.min_peak_distance,
            max_peaks=args.max_peaks_per_image,
        )
        examples.append(
            ScoredExample(
                image_id=image_id,
                city=row.get("_city", "unknown"),
                detections=detections,
                ground_truth=ground_truth_points(row, image_id, width, height),
                latency_ms=latency_ms,
                max_score=max([detection.score for detection in detections], default=0.0),
            )
        )
    return examples


def write_visual_smoke(output_dir: Path) -> None:
    image = Image.new("RGB", (640, 360), (224, 234, 228))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 235, 640, 360), fill=(154, 154, 148))
    draw.ellipse((300, 215, 330, 245), fill=(20, 150, 95))
    draw.text((24, 24), "Synthetic RampNet detection smoke", fill=(15, 25, 35))
    image.save(output_dir / "synthetic_smoke.jpg", quality=90)


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    if args.synthetic_smoke:
        examples = synthetic_examples(args)
        write_visual_smoke(args.output_dir)
    else:
        examples = score_rampnet_examples(args)

    result = {
        "dataset": args.dataset,
        "model": args.model,
        "split": args.split,
        "inputSize": {"height": args.input_height, "width": args.input_width},
        "overall": summarize_examples(examples, args),
        "byCity": {
            city: summarize_examples([example for example in examples if example.city == city], args)
            for city in sorted({example.city for example in examples})
        },
    }
    (args.output_dir / "rampnet_detection_metrics.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result["overall"], indent=2))


if __name__ == "__main__":
    main()
