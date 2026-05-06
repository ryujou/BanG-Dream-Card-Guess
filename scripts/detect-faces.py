#!/usr/bin/env python3
"""Pre-detect anime face boxes for cached BanG Dream card images.

The game server reads data/face-boxes.json at startup and uses these boxes
to avoid, prefer, or force face crops without running YOLO during gameplay.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Detect anime faces in cached card images.")
    parser.add_argument("--weights", default=str(root / "weight" / "best.pt"), help="YOLO .pt weights path")
    parser.add_argument("--cards", default=str(root / "public" / "cards"), help="cached cards directory")
    parser.add_argument("--output", default=str(root / "data" / "face-boxes.json"), help="output JSON path")
    parser.add_argument("--imgsz", type=int, default=960, help="YOLO inference image size")
    parser.add_argument("--conf", type=float, default=0.25, help="confidence threshold")
    parser.add_argument("--batch", type=int, default=16, help="batch size")
    parser.add_argument("--device", default="", help="YOLO device, for example cpu, 0, or 0,1")
    parser.add_argument("--force", action="store_true", help="redetect images already present in output")
    return parser.parse_args()


def load_existing(path: Path) -> dict:
    if not path.exists():
        return {"version": 1, "images": {}}
    with path.open("r", encoding="utf-8") as file:
        value = json.load(file)
    if not isinstance(value, dict):
        return {"version": 1, "images": {}}
    value.setdefault("version", 1)
    value.setdefault("images", {})
    return value


def image_key(cards_dir: Path, path: Path) -> str:
    return path.relative_to(cards_dir).as_posix()


def iter_images(cards_dir: Path) -> list[Path]:
    return sorted(
        path for path in cards_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def chunks(items: list[Path], size: int):
    for index in range(0, len(items), size):
        yield items[index:index + size]


def main() -> None:
    args = parse_args()
    weights = Path(args.weights)
    cards_dir = Path(args.cards)
    output = Path(args.output)

    if not weights.exists():
        raise SystemExit(f"weights not found: {weights}")
    if not cards_dir.exists():
        raise SystemExit(f"cards directory not found: {cards_dir}")

    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise SystemExit("missing dependency: pip install ultralytics") from exc

    data = load_existing(output)
    images = data["images"]
    all_paths = iter_images(cards_dir)
    pending = [
        path for path in all_paths
        if args.force or image_key(cards_dir, path) not in images
    ]

    output.parent.mkdir(parents=True, exist_ok=True)
    model = YOLO(str(weights))
    done = 0

    for batch in chunks(pending, max(1, args.batch)):
        results = model.predict(
            source=[str(path) for path in batch],
            imgsz=args.imgsz,
            conf=args.conf,
            device=args.device or None,
            verbose=False,
            stream=False,
        )

        for result in results:
            path = Path(result.path)
            key = image_key(cards_dir, path)
            height, width = result.orig_shape[:2]
            boxes = []

            if result.boxes is not None and len(result.boxes):
                xyxy = result.boxes.xyxy.cpu().tolist()
                confidences = result.boxes.conf.cpu().tolist()
                for coords, confidence in zip(xyxy, confidences):
                    x1, y1, x2, y2 = coords
                    boxes.append({
                        "x": round(float(x1), 2),
                        "y": round(float(y1), 2),
                        "w": round(float(x2 - x1), 2),
                        "h": round(float(y2 - y1), 2),
                        "conf": round(float(confidence), 4),
                    })

            images[key] = {
                "width": int(width),
                "height": int(height),
                "faces": boxes,
            }
            done += 1

        if done % 50 == 0 or done == len(pending):
            print(f"{done}/{len(pending)} detected, total images in database={len(images)}")

    data.update({
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "weights": str(weights),
        "cardsDir": str(cards_dir),
        "imgsz": args.imgsz,
        "conf": args.conf,
    })

    with output.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")

    print(f"done: scanned={len(all_paths)} detected_now={done} output={output}")


if __name__ == "__main__":
    main()
