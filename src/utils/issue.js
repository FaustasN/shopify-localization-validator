function slug(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createIssue({
  locale,
  productUrl,
  productId,
  sku = null,
  field,
  issue,
  severity,
  value,
  expected,
  message
}) {
  const issueId = [
    locale,
    productId ?? productUrl,
    sku,
    field,
    issue,
    slug(String(value ?? ""))
  ]
    .filter(Boolean)
    .map(slug)
    .join("-");

  const result = {
    issueId,
    locale,
    productUrl,
    productId: productId == null ? null : String(productId),
    sku,
    field,
    issue,
    severity,
    value,
    message
  };

  if (expected !== undefined) {
    result.expected = expected;
  }

  return result;
}
