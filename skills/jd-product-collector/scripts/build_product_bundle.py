#!/usr/bin/env python3
"""Write a normalized JD product bundle from browser-collected JSON."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen


IMAGE_GROUPS = ("main", "variant_main", "detail")
DEFAULT_OUTPUT_ROOT = Path.home() / "Documents" / "JD商品采集"


def load_capture(input_path: str) -> dict[str, Any]:
    raw = sys.stdin.read() if input_path == "-" else Path(input_path).read_text(encoding="utf-8")
    data = json.loads(raw)
    if not isinstance(data, dict) or not isinstance(data.get("root_sku"), str):
        raise ValueError("capture JSON must contain string root_sku")
    if not isinstance(data.get("products"), list) or not data["products"]:
        raise ValueError("capture JSON must contain at least one product")
    return data


def high_resolution_url(url: str) -> str:
    return re.sub(r"/s\\d+x\\d+_jfs/", "/jfs/", url)


def image_extension(url: str) -> str:
    suffixes = Path(urlparse(url).path).suffixes
    suffix = suffixes[-1].lower() if suffixes else ".bin"
    return suffix if re.fullmatch(r"\\.[a-z0-9]{1,5}", suffix) else ".bin"


def download(url: str, target: Path) -> tuple[str, int]:
    if urlparse(url).scheme not in {"http", "https"}:
        raise ValueError(f"unsupported image URL: {url}")
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30) as response:
        content = response.read()
    target.write_bytes(content)
    return hashlib.sha256(content).hexdigest(), len(content)


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def default_collection_id(capture: dict[str, Any]) -> str:
    """Create a collision-resistant directory name when the agent supplies no batch ID."""
    source = str(capture.get("source_url", ""))
    source_hash = hashlib.sha256(source.encode("utf-8")).hexdigest()[:8]
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"{timestamp}-jd-{capture['root_sku']}-{source_hash}"


def validate_collection_id(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,79}", value):
        raise ValueError("collection ID must be 1-80 letters, digits, hyphens, or underscores")
    return value


def write_product(product: dict[str, Any], bundle_dir: Path, dry_run: bool) -> dict[str, Any]:
    sku = product.get("sku")
    if not isinstance(sku, str) or not sku:
        raise ValueError("every product must contain a string sku")
    images = product.get("images", {})
    if not isinstance(images, dict):
        raise ValueError(f"images for SKU {sku} must be an object")

    artifact = dict(product)
    artifact["images"] = {}
    manifests: list[dict[str, Any]] = []
    product_dir = bundle_dir / "products" / sku

    for group in IMAGE_GROUPS:
        urls = images.get(group, [])
        if not isinstance(urls, list):
            raise ValueError(f"images.{group} for SKU {sku} must be a list")
        artifact["images"][group] = []
        for index, source_url in enumerate(urls, start=1):
            if not isinstance(source_url, str):
                raise ValueError(f"image URL for SKU {sku} must be a string")
            resolved_url = high_resolution_url(source_url)
            relative = Path("images") / group / f"{index:02d}{image_extension(resolved_url)}"
            record: dict[str, Any] = {
                "group": group,
                "source_url": source_url,
                "resolved_url": resolved_url,
                "file": relative.as_posix(),
            }
            if dry_run:
                record["status"] = "planned"
            else:
                target = product_dir / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                try:
                    digest, size = download(resolved_url, target)
                    record.update(status="downloaded", sha256=digest, bytes=size)
                except Exception as error:  # Keep the source URL for retry.
                    record.update(status="failed", error=str(error))
            manifests.append(record)
            artifact["images"][group].append(record["file"])

    if not dry_run:
        product_dir.mkdir(parents=True, exist_ok=True)
        write_json(product_dir / "product.json", artifact)
        write_json(product_dir / "specifications.json", {
            "sku": sku,
            "summary": product.get("summary", {}),
            "parameters": product.get("parameters", {}),
        })
        write_json(product_dir / "image-manifest.json", manifests)
    return {"sku": sku, "title": product.get("title"), "image_count": len(manifests)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="capture JSON path or - for stdin")
    parser.add_argument(
        "--output-root",
        default=str(DEFAULT_OUTPUT_ROOT),
        help=f"fixed collection root (default: {DEFAULT_OUTPUT_ROOT})",
    )
    parser.add_argument(
        "--collection-id",
        help="shared ID for all links in one user request; defaults to a unique ID for this capture",
    )
    parser.add_argument("--overwrite", action="store_true", help="replace an existing target bundle")
    parser.add_argument("--dry-run", action="store_true", help="validate and print the intended output without writing files")
    args = parser.parse_args()

    capture = load_capture(args.input)
    collection_id = validate_collection_id(args.collection_id or default_collection_id(capture))
    bundle_dir = Path(args.output_root) / collection_id / f"jd_{capture['root_sku']}"
    if bundle_dir.exists() and not args.dry_run:
        if not args.overwrite:
            raise FileExistsError(f"target exists: {bundle_dir}; pass --overwrite to replace it")
        shutil.rmtree(bundle_dir)

    products = [write_product(product, bundle_dir, args.dry_run) for product in capture["products"]]
    result = {
        "source_url": capture.get("source_url"),
        "root_sku": capture["root_sku"],
        "collection_id": collection_id,
        "products": products,
        "unresolved_variants": capture.get("unresolved_variants", []),
    }
    if args.dry_run:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        write_json(bundle_dir / "product-index.json", result)
        print(bundle_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

