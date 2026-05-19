#!/usr/bin/env python3
"""
Download Bestdori standee images from a generated JSON list.

Input JSON format is produced by scripts/scan-standees.py.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Download standee images from JSON list.")
    parser.add_argument("--list", default=str(root / "data" / "bestdori-standees.json"), help="standee json list path")
    parser.add_argument("--out", default=str(root / "public" / "standees"), help="output directory")
    parser.add_argument("--concurrency", type=int, default=8, help="concurrent workers")
    parser.add_argument("--timeout", type=float, default=15.0, help="request timeout seconds")
    parser.add_argument("--retries", type=int, default=1, help="retry count on network errors")
    parser.add_argument("--force", action="store_true", help="overwrite existing files")
    return parser.parse_args()


def safe_name(name: str) -> str:
    return re.sub(r"[^0-9A-Za-z_.-]+", "_", name).strip("_")


def download_one(url: str, target: Path, timeout: float, retries: int) -> tuple[bool, str]:
    attempts = max(retries + 1, 1)
    last = ""
    for i in range(attempts):
        try:
            req = Request(
                url,
                method="GET",
                headers={
                    "User-Agent": "standee-downloader/1.0",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                },
            )
            with urlopen(req, timeout=timeout) as resp:
                code = getattr(resp, "status", 200)
                ctype = (resp.headers.get("Content-Type") or "").lower()
                if not (200 <= code < 300 and "image" in ctype):
                    return False, f"bad_response status={code} type={ctype}"
                data = resp.read()
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            return True, "ok"
        except HTTPError as e:
            return False, f"http_{e.code}"
        except URLError as e:
            last = str(e.reason)
        except TimeoutError:
            last = "timeout"
        except Exception as e:  # noqa: BLE001
            last = str(e)
        if i + 1 < attempts:
            time.sleep(0.2)
    return False, last or "request_failed"


def main() -> None:
    args = parse_args()
    list_path = Path(args.list)
    out_dir = Path(args.out)
    if not list_path.exists():
        raise SystemExit(f"list file not found: {list_path}")

    payload = json.loads(list_path.read_text(encoding="utf-8"))
    items = payload.get("items")
    if not isinstance(items, list):
        raise SystemExit("invalid list file: missing items[]")

    jobs: list[tuple[str, Path]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        resource = str(item.get("resourceSetName") or "").strip()
        url = str(item.get("url") or "").strip()
        file_name = str(item.get("file") or "trim_normal.png").strip() or "trim_normal.png"
        if not resource or not url:
            continue
        target = out_dir / f"{safe_name(resource)}_rip" / file_name
        jobs.append((url, target))

    total = len(jobs)
    if total == 0:
        raise SystemExit("no valid jobs in items[]")

    saved = 0
    skipped = 0
    failed = 0
    done = 0

    print(f"Downloading {total} standees to {out_dir} with concurrency={args.concurrency} ...")

    def run_job(url: str, target: Path) -> tuple[str, bool, str]:
        if target.exists() and not args.force:
            return str(target), True, "skipped_exists"
        ok, info = download_one(url, target, timeout=args.timeout, retries=args.retries)
        return str(target), ok, info

    with ThreadPoolExecutor(max_workers=max(args.concurrency, 1)) as pool:
        futures = [pool.submit(run_job, url, target) for (url, target) in jobs]
        for fut in as_completed(futures):
            target, ok, info = fut.result()
            done += 1
            if ok and info == "skipped_exists":
                skipped += 1
            elif ok:
                saved += 1
            else:
                failed += 1
                print(f"[FAILED] {target} -> {info}")

            if done % 100 == 0 or done == total:
                print(f"{done}/{total} saved={saved} skipped={skipped} failed={failed}")

    print(f"Done: saved={saved} skipped={skipped} failed={failed} total={total}")


if __name__ == "__main__":
    main()

