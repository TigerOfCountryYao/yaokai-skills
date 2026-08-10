/**
 * Enumerate JD variants inside an already-authorized browser tab.
 *
 * Import this module from the agent's persistent browser runtime and call
 * collectJdVariants(tab, { sourceUrl }). It deliberately never reads cookies,
 * local storage, account data, or any non-product page.
 */

const VARIANT_SELECTORS = [
  ".specification-item-sku li",
  ".specification-item-sku [role='button']",
  ".specification-item-sku .item",
];

/** Execute entirely in the page scope; do not capture Node-side functions. */
function readJdPage({ mode, selector, index }) {
  const text = (element) => element?.textContent?.replace(/\s+/g, " ").trim() || "";
  const absoluteUrl = (value) => {
    if (!value) return null;
    if (value.startsWith("//")) return `https:${value}`;
    try {
      return new URL(value, location.href).href;
    } catch {
      return null;
    }
  };
  const uniqueUrls = (values) => [...new Set(values.map(absoluteUrl).filter(Boolean))];
  const firstUrl = (element) => element?.currentSrc
    || element?.getAttribute("src")
    || element?.getAttribute("data-origin")
    || element?.getAttribute("data-url")
    || element?.getAttribute("data-lazy-img")
    || null;

  if (mode === "variant") {
    const element = [...document.querySelectorAll(selector)][index];
    if (!element) return null;
    const unavailable = element.classList.contains("lack")
      || element.closest(".lack") !== null
      || element.getAttribute("aria-disabled") === "true";
    return {
      label: text(element),
      unavailable,
      thumbnail_url: firstUrl(element.querySelector("img")),
    };
  }

  const sku = location.pathname.match(/\/(\d+)\.html/)?.[1] || null;
  if (!sku) return { error: "Current URL does not contain a JD SKU", resolved_url: location.href };

  const summary = {};
  for (const card of document.querySelectorAll(".page-content-left.preview-wrap #spec-n1 .item")) {
    const label = text(card.querySelector(".desc"));
    const value = text(card.querySelector(".value"));
    if (label && value) summary[label] = value;
  }

  const parameters = {};
  for (const row of document.querySelectorAll(".page-content-left.preview-wrap .list .item")) {
    const label = text(row.querySelector(".label"));
    const valueNode = row.querySelector(".value");
    const value = valueNode?.getAttribute("title")?.trim() || text(valueNode);
    if (label && value) parameters[label] = value;
  }

  const detailHtml = document.querySelector("#detail-main")?.innerHTML || "";
  const detail = uniqueUrls([...detailHtml.matchAll(/url\(\s*['"]?([^)'"]+)['"]?\s*\)/g)]
    .map((match) => match[1])
    .filter((url) => url.includes("360buyimg.com/sku/")));
  const main = uniqueUrls([...document.querySelectorAll(
    ".page-content-left.preview-wrap img, #jdImage img, .preview-wrap img"
  )].map(firstUrl));
  const selectedVariantImage = document.querySelector(
    ".specification-item-sku .selected img, .specification-item-sku .active img"
  );

  return {
    sku,
    title: text(document.querySelector(".sku-title-name")),
    resolved_url: location.href,
    price: text(document.querySelector(".product-price--main")),
    availability: "available",
    summary,
    parameters,
    images: {
      main,
      variant_main: uniqueUrls([firstUrl(selectedVariantImage)]),
      detail,
    },
  };
}

async function selectVariant(tab, selector, index, delayMs) {
  await tab.playwright.locator(selector).nth(index).click({ timeoutMs: 10_000 });
  await tab.playwright.waitForTimeout(delayMs);
}

/**
 * Return one build_product_bundle.py input object for the current JD product.
 * The function performs the complete variant loop in this one browser call.
 */
export async function collectJdVariants(tab, { sourceUrl, delayMs = 900 } = {}) {
  const originalUrl = sourceUrl || await tab.url();
  let selector = null;

  for (const candidate of VARIANT_SELECTORS) {
    if (await tab.playwright.locator(candidate).count()) {
      selector = candidate;
      break;
    }
  }

  const products = [];
  const unresolvedVariants = [];
  const seenSkus = new Set();

  if (selector) {
    const count = await tab.playwright.locator(selector).count();
    for (let index = 0; index < count; index += 1) {
      const descriptor = await tab.playwright.evaluate(readJdPage, {
        mode: "variant", selector, index,
      });
      if (!descriptor?.label && !descriptor?.thumbnail_url) continue;

      if (descriptor.unavailable) {
        unresolvedVariants.push({
          label: descriptor.label,
          availability: "unavailable",
          thumbnail_url: descriptor.thumbnail_url,
          high_resolution_image_url: descriptor.thumbnail_url?.replace(/\/s\\d+x\\d+_jfs\//, "/jfs/") || null,
        });
        continue;
      }

      await selectVariant(tab, selector, index, delayMs);
      const product = await tab.playwright.evaluate(readJdPage, { mode: "product" });
      if (product.error) throw new Error(product.error);
      if (!seenSkus.has(product.sku)) {
        products.push(product);
        seenSkus.add(product.sku);
      }
    }
  }

  if (!products.length) {
    const product = await tab.playwright.evaluate(readJdPage, { mode: "product" });
    if (product.error) throw new Error(product.error);
    products.push(product);
  }

  return {
    source_url: originalUrl,
    root_sku: products[0].sku,
    products,
    unresolved_variants: unresolvedVariants,
  };
}

/** Write the browser result as UTF-8 JSON for build_product_bundle.py. */
export async function writeCaptureJson(filePath, capture) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(filePath, `${JSON.stringify(capture, null, 2)}\n`, "utf8");
  return filePath;
}
