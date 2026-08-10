---
name: jd-product-collector
description: Collect product data from JD.com links using the user's explicitly authorized Chrome session. Use when a user provides JD short links or item links and asks for product images, detail long images, SKU-specific specifications, or an export folder. Resolve every selectable SKU separately, preserve unavailable variants without fabricating data, and produce a local product bundle with the included script.
---

# JD Product Collector

Use Chrome only when the user has explicitly authorized their Chrome session. Do not read or export cookies, account data, orders, cart contents, precise delivery addresses, or unrelated recommendations. Do not add items to cart or buy anything.

## Workflow

1. Load the Chrome-control skill and use the user's authorized Chrome browser.
2. Open each supplied JD short link in a new agent tab. Wait for the final `item.jd.com/<SKU>.html` URL; record the short link and resolved URL.
3. Collect the current SKU's visible title, current price, shop, availability, and current main image. Do not use legacy JD selectors such as `#name` or `#jd-price`.
4. Read selectable variants from `.specification-item-sku`.
   - For each available variant, click it, wait for the item URL to change or settle, then collect a fresh SKU, price, main image, and specification table.
   - Do not force-click an unavailable variant. Keep its displayed label and unavailable status. If its thumbnail URL contains `/s<width>x<height>_jfs/`, derive a high-resolution image URL by replacing that segment with `/jfs/`; label the result as image-only, with no inferred SKU or specifications.
5. Read the specification table for every resolved SKU using the DOM rows, never by slicing the whole page text. See [capture-schema.md](references/capture-schema.md).
6. Extract detail long-image URLs only from CSS `url(...)` values in `#detail-main` that point to `360buyimg.com/sku/`. Do not collect `continuous-product-card` or recommendation images.
7. Build a capture JSON object in the schema reference, then run the bundled script to download images and write the product folders.

## Fixed save location

Save every collection under `C:\Users\yaokai\Documents\JD商品采集`; never write its artifacts into the active workspace or a previous collection folder.

At the start of one user request, create one collection ID in the form `YYYYMMDD-HHMMSS-brief-label` (for example, `20260808-143000-haier-washers`). Pass the same ID for every supplied link in that request. The resulting layout is:

```text
C:\Users\yaokai\Documents\JD商品采集\
  20260808-143000-haier-washers\
    jd_100327335468\
    jd_...\
```

Use a new collection ID for every new user request. Do not reuse or overwrite an existing collection; report the final collection directory to the user.

## Write the bundle

Run:

```powershell
python "C:\Users\yaokai\.codex\skills\jd-product-collector\scripts\build_product_bundle.py" `
  --input capture.json `
  --collection-id "20260808-143000-haier-washers"
```

Use `--input -` to read the JSON from standard input. The default output root is the fixed location above; only use `--output-root` when the user explicitly asks for another location. The script refuses to overwrite an existing `jd_<root_sku>` directory unless `--overwrite` is passed explicitly.

## Required quality checks

- `product-index.json` must list every resolved SKU and every unresolved unavailable variant.
- Each resolved SKU must have its own `product.json` and its own `specifications.json`.
- Never copy specifications from another SKU.
- Validate that the specification values do not contain CSS, HTML, or `ssd-module` text.
- Keep image manifests with source URL, resolved URL, local file, SHA-256, and byte size.

## Failure handling

- If Chrome is signed out or a CAPTCHA appears, stop and ask the user to handle it in Chrome. Do not bypass it.
- If a selector is absent, save the field as unavailable with a reason; do not guess from a similar product.
- If a detail image fails to download, keep its URL and record the failure in the manifest.

