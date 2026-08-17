/**
 * Enumerate JD series and variants in an already-authorized browser tab.
 * Import this module from the Agent browser runtime. It never reads cookies,
 * local storage, account data, or non-product pages.
 */

const SERIES_SELECTOR = ".specification-series-item";
const VARIANT_SELECTOR = ".specification-item-sku";
const SELECTED_SERIES_SELECTOR = ".specification-series-item--selected";
const SELECTED_VARIANT_SELECTOR = ".specification-item-sku--selected";

/** Classify a JD landing URL without accessing browser credentials. */
export function classifyJDPage(rawURL) {
  try {
    const url = new URL(rawURL);
    if (url.protocol === "https:" && url.hostname === "item.jd.com" && /^\/\d+\.html$/.test(url.pathname)) return "product";
    if (url.protocol === "https:" && url.hostname === "item.m.jd.com" && (url.pathname === "/ware/view.action" || /^\/product\/[^/]+\.html$/.test(url.pathname))) return "mobile_product";
    if (url.protocol === "https:" && url.hostname === "pro.m.jd.com" && url.pathname.startsWith("/mall/active/")) return "coupon";
    if (url.protocol === "https:" && (url.hostname === "plogin.m.jd.com" || url.hostname === "passport.jd.com")) return "login";
    if (url.protocol === "https:" && url.hostname === "pc-frequent-pro.pf.jd.com") return "rate_limited";
  } catch {
    // Keep waiting while the browser is changing URLs.
  }
  return "other";
}

/** Convert a JD mobile product URL to its equivalent desktop product URL. */
export function desktopProductURLFromMobile(rawURL) {
  try {
    const url = new URL(rawURL);
    if (url.protocol !== "https:" || url.hostname !== "item.m.jd.com") return null;
    const sku = url.pathname === "/ware/view.action"
      ? url.searchParams.get("wareId") || ""
      : url.pathname.match(/^\/product\/(\d+)\.html$/)?.[1] || "";
    return /^\d+$/.test(sku) ? `https://item.jd.com/${sku}.html` : null;
  } catch {
    return null;
  }
}

/** Execute in coupon page scope: click only when exactly one visible claim button exists. */
export function clickJDClaimButton() {
  const candidates = [...document.querySelectorAll("body *")].filter((element) => {
    if (element.children.length !== 0 || element.textContent?.trim() !== "一键领取") return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  });
  if (candidates.length === 0) return { status: "missing" };
  if (candidates.length !== 1) return { status: "ambiguous" };
  candidates[0].click();
  return { status: "clicked" };
}

/** Execute in page scope; do not capture Node-side functions. */
function inspectJdPage({ mode, index }) {
  const text = (element) => element?.textContent?.replace(/\s+/g, " ").trim() || "";
  const absolute = (value) => {
    if (!value) return null;
    if (value.startsWith("//")) return `https:${value}`;
    try { return new URL(value, location.href).href; } catch { return null; }
  };
  const image = (element) => element?.getAttribute("data-origin") || element?.getAttribute("data-url") || element?.getAttribute("data-lazy-img") || element?.currentSrc || element?.getAttribute("src") || null;
  const highResolution = (url) => url?.replace(/\/s\d+x\d+_jfs\//, "/jfs/") || null;
  const currentSKU = () => location.pathname.match(/\/(\d+)\.html/)?.[1] || "";
  const uniqueURLs = (values) => [...new Set(values.map(absolute).filter(Boolean))];

  if (mode === "state") {
    const selectedSeries = document.querySelector(SELECTED_SERIES_SELECTOR);
    return {
      series_count: document.querySelectorAll(SERIES_SELECTOR).length,
      variant_count: document.querySelectorAll(VARIANT_SELECTOR).length,
      selected_series_label: text(selectedSeries) || "默认系列",
      selected_series_index: [...document.querySelectorAll(SERIES_SELECTOR)].indexOf(selectedSeries),
    };
  }

  if (mode === "variant") {
    const element = document.querySelectorAll(VARIANT_SELECTOR)[index];
    if (!element) return null;
    const unavailable = element.classList.contains("lack") || element.classList.contains("specification-item-sku--lack") || Boolean(element.closest(".lack,.specification-item-sku--lack")) || element.getAttribute("aria-disabled") === "true" || /无货/.test(element.getAttribute("title") || "");
    const thumbnail = absolute(image(element.querySelector("img")));
    return { label: text(element), unavailable, thumbnail_url: thumbnail, high_resolution_image_url: highResolution(thumbnail) };
  }

  const sku = currentSKU();
  if (!sku) return { error: "当前 URL 不含京东 SKU", resolved_url: location.href };
  const summary = {};
  for (const row of document.querySelectorAll(".page-content-left.preview-wrap #spec-n1 .item")) {
    const name = text(row.querySelector(".desc"));
    const value = text(row.querySelector(".value"));
    if (name && value) summary[name] = value;
  }
  const parameters = {};
  for (const row of document.querySelectorAll(".page-content-left.preview-wrap .list .item")) {
    const name = text(row.querySelector(".label"));
    const valueNode = row.querySelector(".value");
    const value = valueNode?.getAttribute("title")?.trim() || text(valueNode);
    if (name && value) parameters[name] = value;
  }
  const detailHTML = document.querySelector("#detail-main")?.innerHTML || "";
  const detail = uniqueURLs([...detailHTML.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)].map((match) => match[1]).filter((url) => url.includes("360buyimg.com/sku/")));
  const variantMain = highResolution(absolute(image(document.querySelector(`${SELECTED_VARIANT_SELECTOR} img`))));
  const selectedSeries = document.querySelector(SELECTED_SERIES_SELECTOR);
  return {
    sku,
    title: text(document.querySelector(".sku-title-name")),
    resolved_url: location.href,
    price: text(document.querySelector(".product-price--main")),
    availability: "available",
    series_label: text(selectedSeries) || "默认系列",
    series_ordinal: Math.max(0, [...document.querySelectorAll(SERIES_SELECTOR)].indexOf(selectedSeries)),
    variant_label: text(document.querySelector(SELECTED_VARIANT_SELECTOR)),
    summary,
    parameters,
    images: { main: [], variant_main: variantMain ? [variantMain] : [], detail },
  };
}

async function waitForSelection(tab, selector, index) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    await tab.playwright.waitForTimeout(200);
    const selected = await tab.playwright.evaluate(({ selectedSelector, selectedIndex, baseSelector }) => {
      const element = document.querySelector(selectedSelector);
      return Boolean(element && [...document.querySelectorAll(baseSelector)].indexOf(element) === selectedIndex);
    }, { selectedSelector: selector, selectedIndex: index, baseSelector: selector.replace("--selected", "") });
    if (selected) return;
  }
  throw new Error("京东页面未能完成系列品或款式切换");
}

async function dismissSimilarProductDialog(tab) {
  await tab.playwright.evaluate(() => {
    for (const button of document.querySelectorAll("button,.btn,.dialog-button")) {
      if (/取消|关闭/.test(button.textContent?.replace(/\s+/g, " ").trim() || "")) button.click();
    }
  });
}

/**
 * Return one build_product_bundle.py input object for the current JD product.
 * `captureAllSKUs` defaults to false: only capture the link's selected SKU.
 */
export async function collectJdVariants(tab, { sourceUrl, captureAllSKUs = false, delayMs = 500 } = {}) {
  const sourceURL = sourceUrl || await tab.url();
  const initialProduct = await tab.playwright.evaluate(inspectJdPage, { mode: "product" });
  if (initialProduct.error || !initialProduct.sku) throw new Error(initialProduct.error || "当前 URL 不含京东 SKU");
  if (!captureAllSKUs) return { source_url: sourceURL, root_sku: initialProduct.sku, products: [initialProduct], unresolved_variants: [] };

  const products = [];
  const unresolvedVariants = [];
  const initialState = await tab.playwright.evaluate(inspectJdPage, { mode: "state" });
  const seriesCount = initialState.series_count || 1;
  for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex += 1) {
    if (initialState.series_count) {
      const currentState = await tab.playwright.evaluate(inspectJdPage, { mode: "state" });
      if (currentState.selected_series_index !== seriesIndex) {
        await tab.playwright.locator(SERIES_SELECTOR).nth(seriesIndex).click({ timeoutMs: 10_000 });
        await waitForSelection(tab, SELECTED_SERIES_SELECTOR, seriesIndex);
      }
    }
    const state = await tab.playwright.evaluate(inspectJdPage, { mode: "state" });
    for (let variantIndex = 0; variantIndex < state.variant_count; variantIndex += 1) {
      const descriptor = await tab.playwright.evaluate(inspectJdPage, { mode: "variant", index: variantIndex });
      if (!descriptor?.label && !descriptor?.thumbnail_url) continue;
      if (descriptor.unavailable) {
        unresolvedVariants.push({ ...descriptor, availability: "unavailable", series_label: state.selected_series_label, series_ordinal: Math.max(0, state.selected_series_index) });
        continue;
      }
      await tab.playwright.locator(VARIANT_SELECTOR).nth(variantIndex).click({ timeoutMs: 10_000 });
      await waitForSelection(tab, SELECTED_VARIANT_SELECTOR, variantIndex);
      await dismissSimilarProductDialog(tab);
      await tab.playwright.waitForTimeout(delayMs);
      const product = await tab.playwright.evaluate(inspectJdPage, { mode: "product" });
      if (product.error) throw new Error(product.error);
      products.push(product);
    }
  }
  if (!products.length) throw new Error("未采集到可售 SKU");
  return { source_url: sourceURL, root_sku: initialProduct.sku, products, unresolved_variants: unresolvedVariants };
}

/** Write the browser result as UTF-8 JSON for build_product_bundle.py. */
export async function writeCaptureJson(filePath, capture) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(filePath, `${JSON.stringify(capture, null, 2)}\n`, "utf8");
  return filePath;
}
