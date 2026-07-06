import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function buildProductsEndpoint(baseUrl, limit) {
  const endpoint = new URL(`${trimTrailingSlash(baseUrl)}/products.json`);
  endpoint.searchParams.set("limit", String(limit));
  return endpoint.toString();
}

function buildProductUrl(baseUrl, handle) {
  return new URL(`${trimTrailingSlash(baseUrl)}/products/${handle}`).toString();
}

async function discoverProductUrls({ baseUrl, limit }) {
  const response = await fetch(buildProductsEndpoint(baseUrl, limit), {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to discover products: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.products)) {
    throw new Error("Invalid Shopify products response: expected products array");
  }

  return payload.products
    .map((product) => product.handle)
    .filter((handle) => typeof handle === "string" && handle.trim().length > 0)
    .map((handle) => buildProductUrl(baseUrl, handle));
}

async function scrapeProductPage({ page, url, locale }) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

  return page.evaluate(
    ({ url, locale }) => {
      const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
      const text = (selector, scope = document) => clean(scope.querySelector(selector)?.innerText);

      const productScope =
        document.querySelector(".product-info-section") ||
        document.querySelector(".product-card") ||
        document.querySelector("main") ||
        document.body;

      const visibleText = clean(productScope.innerText || document.body.innerText);
      const title = text("h1.product-title", productScope) || text("h1", productScope) || text("h1");
      const price = text(".current-price", productScope);
      const oldPrice = text(".original-price", productScope);
      const description =
        text(".mobile-product-subtitle", productScope) ||
        text(".omniarm-desc__text", productScope) ||
        "";
      const availabilityText =
        text(".stock-label", productScope) ||
        text(".ergonix-oos__label", productScope) ||
        text("[class*='stock']", productScope) ||
        "";
      const addToCartText =
        text(".order-btn", productScope) ||
        text("button[type='submit']", productScope) ||
        text(".add-to-cart", productScope) ||
        text("[class*='add-to-cart']", productScope) ||
        "";

      const dedupeOptions = (options) => {
        const seen = new Set();

        return options.filter((option) => {
          const key = [option.name, option.selected, option.values.join("|")].join("::").toLowerCase();
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
      };

      const omnideskContainer =
        productScope.querySelector(".omnidesk-variants:not(.omnidesk-variants--mobile)") ||
        productScope.querySelector(".omnidesk-variants");
      const omnideskOptions = [...(omnideskContainer?.querySelectorAll(".omnidesk-variant-group") ?? [])].map(
        (group) => {
          const label = text(".omnidesk-variant-label", group);
          const [namePart] = label.split(":");
          const selected = text(".omnidesk-variant-value", group);
          const values = [...group.querySelectorAll("button.omnidesk-swatch, button.omnidesk-pill")]
            .map((button) => {
              const value =
                text(".omnidesk-swatch__label", button) ||
                clean(button.getAttribute("title")) ||
                clean(button.innerText);

              return value.replace(/^Populiariausias\s+/i, "");
            })
            .filter(Boolean);

          return {
            name: clean(namePart),
            selected,
            values: [...new Set(values)]
          };
        }
      );

      const oabOptions = [...productScope.querySelectorAll(".oab-color")].map((group) => {
        const label = text(".oab-color__label", group);
        const [namePart] = label.split(":");
        const selected = text("[data-oab-colorname]", group) || clean(label.split(":")[1]);
        const values = [...group.querySelectorAll(".oab-swatch")]
          .map((button) => {
            return (
              clean(button.innerText) ||
              clean(button.getAttribute("aria-label")).replace(/^Select\s+/i, "") ||
              clean(button.getAttribute("title")) ||
              clean(button.getAttribute("data-color"))
            );
          })
          .filter(Boolean);

        return {
          name: clean(namePart),
          selected,
          values: [...new Set(values)]
        };
      });

      const colorOptions = [...productScope.querySelectorAll(".color-section, .color-selector-wrapper")].map(
        (group) => {
          const label = text(".color-label, .mobile-color-label, .color-label-row", group) || clean(group.innerText);
          const [namePart] = label.split(":");
          const selected = clean(label.split(":")[1]);
          const values = [...group.querySelectorAll(".color-dot, .color-option, .mobile-color-option")]
            .map((button) => {
              return (
                clean(button.innerText) ||
                clean(button.getAttribute("aria-label")).replace(/^Select\s+/i, "") ||
                clean(button.getAttribute("title")) ||
                clean(button.getAttribute("data-color"))
              );
            })
            .filter(Boolean);

          return {
            name: clean(namePart),
            selected,
            values: [...new Set(values)]
          };
        }
      );

      return {
        url,
        locale,
        title,
        price,
        oldPrice,
        description,
        availabilityText,
        addToCartText,
        options: dedupeOptions([...omnideskOptions, ...oabOptions, ...colorOptions]),
        visibleText
      };
    },
    { url, locale }
  );
}

export async function fetchProducts(config) {
  const locale = config.locale;
  const baseUrl = trimTrailingSlash(config.baseUrl);
  const limit = config.limit ?? 250;

  if (!locale) {
    throw new Error("Missing required config field: locale");
  }

  if (!baseUrl) {
    throw new Error("Missing required config field: baseUrl");
  }

  const productUrls = await discoverProductUrls({ baseUrl, limit });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const products = [];

  try {
    for (const url of productUrls) {
      products.push(await scrapeProductPage({ page, url, locale }));
    }
  } finally {
    await browser.close();
  }

  return products;
}

export async function saveProducts(products, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(products, null, 2)}\n`, "utf8");
}
