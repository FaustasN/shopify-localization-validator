import { createIssue } from "../utils/issue.js";

const MAX_REASONABLE_PRICE = 1000000;

function isBlank(value) {
  return value == null || String(value).trim().length === 0;
}

function isValidPrice(value) {
  return Number.isFinite(value) && value > 0 && value < MAX_REASONABLE_PRICE;
}

function baseContext(product, variant) {
  return {
    locale: product.locale,
    productUrl: product.productUrl ?? product.url,
    productId: product.raw?.id,
    sku: isBlank(variant?.sku) ? null : variant.sku
  };
}

export function validateVariants(product) {
  const raw = product.raw ?? {};
  const issues = [];
  const variants = Array.isArray(raw.variants) ? raw.variants : [];

  variants.forEach((variant, variantIndex) => {
    const context = baseContext(product, variant);

    if (isBlank(variant?.id)) {
      issues.push(
        createIssue({
          ...context,
          field: `raw.variants[${variantIndex}].id`,
          issue: "MISSING_FIELD",
          severity: "high",
          value: variant?.id ?? null,
          message: `${product.locale.toUpperCase()} variant id is missing.`
        })
      );
    }

    if (isBlank(variant?.sku)) {
      issues.push(
        createIssue({
          ...context,
          field: `raw.variants[${variantIndex}].sku`,
          issue: "MISSING_FIELD",
          severity: "high",
          value: variant?.sku ?? null,
          message: `${product.locale.toUpperCase()} variant SKU is missing.`
        })
      );
    }

    if (!isValidPrice(variant?.price)) {
      issues.push(
        createIssue({
          ...context,
          field: `raw.variants[${variantIndex}].price`,
          issue: "INVALID_PRICE",
          severity: "high",
          value: variant?.price ?? null,
          message: `${product.locale.toUpperCase()} variant price is invalid.`
        })
      );
    }

    if (
      variant?.compare_at_price != null &&
      variant.compare_at_price !== false &&
      isValidPrice(variant.price) &&
      variant.compare_at_price <= variant.price
    ) {
      issues.push(
        createIssue({
          ...context,
          field: `raw.variants[${variantIndex}].compare_at_price`,
          issue: "COMPARE_AT_PRICE_INVALID",
          severity: "medium",
          value: variant.compare_at_price,
          expected: `Greater than ${variant.price}`,
          message: `${product.locale.toUpperCase()} variant compare_at_price should be greater than price.`
        })
      );
    }
  });

  return issues;
}
