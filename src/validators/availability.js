import { createIssue } from "../utils/issue.js";

export function validateAvailability(product) {
  const raw = product.raw ?? {};
  const variants = Array.isArray(raw.variants) ? raw.variants : [];

  if (variants.length === 0) {
    return [];
  }

  const hasAvailableVariant = variants.some((variant) => variant.available === true);

  if (raw.available === true && !hasAvailableVariant) {
    return [
      createIssue({
        locale: product.locale,
        productUrl: product.productUrl ?? product.url,
        productId: raw.id,
        field: "raw.available",
        issue: "AVAILABILITY_MISMATCH",
        severity: "high",
        value: raw.available,
        expected: "At least one available variant",
        message: `${product.locale.toUpperCase()} product is available but no variants are available.`
      })
    ];
  }

  if (raw.available === false && hasAvailableVariant) {
    return [
      createIssue({
        locale: product.locale,
        productUrl: product.productUrl ?? product.url,
        productId: raw.id,
        field: "raw.available",
        issue: "AVAILABILITY_MISMATCH",
        severity: "high",
        value: raw.available,
        expected: "Unavailable only when all variants are unavailable",
        message: `${product.locale.toUpperCase()} product is unavailable but at least one variant is available.`
      })
    ];
  }

  return [];
}
