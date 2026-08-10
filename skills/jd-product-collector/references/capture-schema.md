# Capture schema and JD DOM rules

Create one input object for `scripts/build_product_bundle.py`:

```json
{
  "source_url": "https://u.jd.com/example",
  "root_sku": "100327335468",
  "products": [
    {
      "sku": "100327335468",
      "title": "...",
      "resolved_url": "https://item.jd.com/100327335468.html",
      "price": "9597.90",
      "availability": "available",
      "summary": { "类型": "洗烘套装" },
      "parameters": { "型号": "XQG100-BLE7AD1U1" },
      "images": {
        "main": ["https://..."],
        "variant_main": ["https://..."],
        "detail": ["https://..."]
      }
    }
  ],
  "unresolved_variants": [
    {
      "label": "...",
      "availability": "unavailable",
      "thumbnail_url": "https://...",
      "high_resolution_image_url": "https://..."
    }
  ]
}
```

## Stable extraction rules

- Current title: `.sku-title-name`.
- Current price: `.product-price--main` when present; otherwise save the visible price text and its label.
- Variant options: `.specification-item-sku`; an element with a `lack` class is unavailable.
- Top specification cards: `.page-content-left.preview-wrap #spec-n1 .item`. Read `.desc` as label and `.value` as value.
- Parameter table rows: `.page-content-left.preview-wrap .list .item`. Read `.label` and the sibling `.value` (`title` attribute first, otherwise visible text).
- Packaging list: only collect it from an actual expanded parameter row. Never append content after the final parameter row; that can include `#detail-main` CSS.
- Detail long images: extract `url(...)` entries from `#detail-main.innerHTML`, normalize protocol-relative URLs to `https:`, and keep only URLs containing `360buyimg.com/sku/`.

The selected variant changes the product SKU and can change every specification. Re-read all fields after every successful variant switch.

