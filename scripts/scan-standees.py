#!/usr/bin/env python3
"""
Scan Bestdori standee URLs and export reachable image entries to JSON.

Default source is resource/all5_2.json (reads resourceSetName).
Default URL pattern:
  https://bestdori.com/assets/jp/characters/resourceset/{resourceSetName}_rip/trim_normal.png
"""

from __future__ import annotations

import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


BESTDORI_BASE = "https://bestdori.com/assets/jp/characters/resourceset"


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Scan available Bestdori standee images.")
    parser.add_argument("--cards", default=str(root / "resource" / "all5_2.json"), help="card json file path")
    parser.add_argument("--out", default=str(root / "data" / "bestdori-standees.json"), help="output json path")
    parser.add_argument("--base", default=BESTDORI_BASE, help="bestdori resourceset base url")
    parser.add_argument("--file", default="trim_normal.png", help="image file name in each resourceset")
    parser.add_argument("--concurrency", type=int, default=16, help="concurrent workers")
    parser.add_argument("--timeout", type=float, default=8.0, help="request timeout seconds")
    parser.add_argument("--retries", type=int, default=1, help="retry count on network errors")
    return parser.parse_args()


def read_resource_sets(cards_path: Path) -> list[str]:
    raw = json.loads(cards_path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise SystemExit(f"invalid cards file format: {cards_path}")
    seen: set[str] = set()
    ordered: list[str] = []
    for value in raw.values():
        if not isinstance(value, dict):
            continue
        name = str(value.get("resourceSetName") or "").strip()
        if not name or name in seen:
            continue
        seen.add(name)
        ordered.append(name)
    return ordered


def probe_url(url: str, timeout: float, retries: int) -> tuple[bool, int | None, str]:
    attempts = max(retries + 1, 1)
    last_err = ""
    for i in range(attempts):
        try:
            req = Request(
                url,
                method="GET",
                headers={
                    "User-Agent": "standee-scanner/1.0",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                },
            )
            with urlopen(req, timeout=timeout) as resp:
                code = getattr(resp, "status", 200)
                ctype = (resp.headers.get("Content-Type") or "").lower()
                ok = 200 <= code < 300 and "image" in ctype
                return ok, code, ctype
        except HTTPError as e:
            return False, e.code, "http_error"
        except URLError as e:
            last_err = str(e.reason)
        except TimeoutError:
            last_err = "timeout"
        except Exception as e:  # noqa: BLE001
            last_err = str(e)
        if i + 1 < attempts:
            time.sleep(0.15)
    return False, None, last_err or "request_failed"


def main() -> None:
    args = parse_args()
    cards_path = Path(args.cards)
    out_path = Path(args.out)

    if not cards_path.exists():
        raise SystemExit(f"cards file not found: {cards_path}")

    resource_sets = read_resource_sets(cards_path)
    total = len(resource_sets)
    if total == 0:
        raise SystemExit("no resourceSetName entries found")

    print(f"Scanning {total} resource sets with concurrency={args.concurrency} ...")

    valid_entries: list[dict[str, Any]] = []
    failed_entries: list[dict[str, Any]] = []
    done = 0

    def one(name: str) -> dict[str, Any]:
        url = f"{args.base}/{name}_rip/{args.file}"
        ok, status, info = probe_url(url, timeout=args.timeout, retries=args.retries)
        return {
            "resourceSetName": name,
            "url": url,
            "ok": ok,
            "status": status,
            "info": info,
        }

    with ThreadPoolExecutor(max_workers=max(args.concurrency, 1)) as pool:
        futures = [pool.submit(one, name) for name in resource_sets]
        for fut in as_completed(futures):
            result = fut.result()
            done += 1
            if result["ok"]:
                valid_entries.append(
                    {
                        "resourceSetName": result["resourceSetName"],
                        "url": result["url"],
                        "file": args.file,
                    }
                )
            else:
                failed_entries.append(result)

            if done % 100 == 0 or done == total:
                print(f"{done}/{total} ok={len(valid_entries)} fail={len(failed_entries)}")

    payload = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sourceCards": str(cards_path),
        "base": args.base,
        "file": args.file,
        "totalResourceSets": total,
        "validCount": len(valid_entries),
        "failedCount": len(failed_entries),
        "items": sorted(valid_entries, key=lambda x: x["resourceSetName"]),
        "failed": sorted(failed_entries, key=lambda x: x["resourceSetName"]),
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved: {out_path}")
    print(f"Summary: total={total} valid={len(valid_entries)} failed={len(failed_entries)}")


if __name__ == "__main__":
    main()

