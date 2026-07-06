import { createIssue } from "../utils/issue.js";

const CUSTOMER_TEXT_FIELDS = [
  "title",
  "price",
  "description",
  "addToCartText",
  "visibleText"
];

const BROKEN_TRANSLATION_PATTERN = /\b(?:translation missing|undefined)\b/i;
const AVAILABILITY_STATES = [
  {
    state: "out_of_stock",
    pattern: /\b(?:out of stock|sold out|išparduota|izpārdots|nav noliktavā|välja müüdud|laost otsas)\b/i
  },
  {
    state: "low_stock",
    pattern: /\b(?:low stock|limited stock|few left|mažas likutis|neliels preču daudzums|väike laoseis)\b/i
  }
];

function isBlank(value) {
  return value == null || String(value).trim().length === 0;
}

function productContext(product, fallbackLocale, productIndex) {
  return {
    locale: product?.locale ?? fallbackLocale,
    productUrl: product?.productUrl ?? product?.url ?? null,
    productId: null,
    sku: `product-${productIndex + 1}`
  };
}

function parsePrice(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const price = Number.parseFloat(normalized);

  return Number.isFinite(price) ? price : null;
}

function normalizeAvailabilityState(value) {
  if (isBlank(value)) {
    return "in_stock";
  }

  for (const { state, pattern } of AVAILABILITY_STATES) {
    if (pattern.test(value)) {
      return state;
    }
  }

  return "stock_notice";
}

function collectOptionFields(product) {
  const fields = [];
  const options = Array.isArray(product?.options) ? product.options : [];

  options.forEach((option, optionIndex) => {
    fields.push([`options[${optionIndex}].name`, option?.name]);
    fields.push([`options[${optionIndex}].selected`, option?.selected]);

    const values = Array.isArray(option?.values) ? option.values : [];
    values.forEach((value, valueIndex) => {
      fields.push([`options[${optionIndex}].values[${valueIndex}]`, value]);
    });
  });

  return fields;
}

function validateFieldPresence(productsByLocale, localeOrder, productIndex) {
  const issues = [];

  CUSTOMER_TEXT_FIELDS.forEach((field) => {
    const presences = localeOrder.map((locale) => {
      const product = productsByLocale[locale]?.[productIndex];
      return {
        locale,
        product,
        isPresent: !isBlank(product?.[field])
      };
    });
    const expectedPresence = presences.some((presence) => presence.isPresent);

    if (presences.every((presence) => presence.isPresent === expectedPresence)) {
      return;
    }

    presences
      .filter((presence) => presence.isPresent !== expectedPresence)
      .forEach(({ locale, product, isPresent }) => {
        issues.push(
          createIssue({
            ...productContext(product, locale, productIndex),
            field,
            issue: "EMPTY_FIELD",
            severity: "medium",
            value: product?.[field] ?? null,
            expected: expectedPresence ? "present" : "empty",
            message: `${locale.toUpperCase()} ${field} presence differs from the other locales.`
          })
        );
      });
  });

  return issues;
}

function validateOptionFieldPresence(productsByLocale, localeOrder, productIndex) {
  const issues = [];
  const fieldNames = new Set();

  localeOrder.forEach((locale) => {
    const product = productsByLocale[locale]?.[productIndex];
    collectOptionFields(product).forEach(([field]) => fieldNames.add(field));
  });

  fieldNames.forEach((field) => {
    const presences = localeOrder.map((locale) => {
      const product = productsByLocale[locale]?.[productIndex];
      const optionField = collectOptionFields(product).find(([candidateField]) => candidateField === field);
      const value = optionField?.[1];

      return {
        locale,
        product,
        value,
        isPresent: !isBlank(value)
      };
    });
    const expectedPresence = presences.some((presence) => presence.isPresent);

    if (presences.every((presence) => presence.isPresent === expectedPresence)) {
      return;
    }

    presences
      .filter((presence) => presence.isPresent !== expectedPresence)
      .forEach(({ locale, product, value }) => {
      issues.push(
        createIssue({
          ...productContext(product, locale, productIndex),
          field,
          issue: "EMPTY_FIELD",
          severity: "medium",
          value: value ?? null,
          expected: expectedPresence ? "present" : "empty",
          message: `${locale.toUpperCase()} ${field} presence differs from the other locales.`
        })
      );
    });
  });

  return issues;
}

function validateBrokenTranslations(product, locale, productIndex) {
  const issues = [];
  const fields = [
    ...CUSTOMER_TEXT_FIELDS.map((field) => [field, product?.[field]]),
    ["availabilityText", product?.availabilityText],
    ...collectOptionFields(product)
  ];

  fields.forEach(([field, value]) => {
    if (typeof value === "string" && BROKEN_TRANSLATION_PATTERN.test(value)) {
      issues.push(
        createIssue({
          ...productContext(product, locale, productIndex),
          field,
          issue: "BROKEN_TRANSLATION",
          severity: "high",
          value,
          expected: "Localized customer-facing text",
          message: `${locale.toUpperCase()} ${field} contains missing or undefined translation text.`
        })
      );
    }
  });

  return issues;
}

function validateOptionCounts(product, baselineProduct, locale, baselineLocale, productIndex) {
  const options = Array.isArray(product?.options) ? product.options : [];
  const baselineOptions = Array.isArray(baselineProduct?.options) ? baselineProduct.options : [];

  if (options.length === baselineOptions.length) {
    return [];
  }

  return [
    createIssue({
      ...productContext(product, locale, productIndex),
      field: "options.length",
      issue: "OPTION_COUNT_MISMATCH",
      severity: "high",
      value: options.length,
      expected: `${baselineOptions.length} (${baselineLocale.toUpperCase()} baseline)`,
      message: `${locale.toUpperCase()} product has a different option count than ${baselineLocale.toUpperCase()}.`
    })
  ];
}

function validatePriceEquality(productsByLocale, localeOrder, productIndex) {
  const priceRecords = localeOrder.map((locale) => {
    const product = productsByLocale[locale]?.[productIndex];
    return {
      locale,
      product,
      price: parsePrice(product?.price)
    };
  });

  if (priceRecords.some((record) => record.price == null)) {
    return [];
  }

  const [baselineRecord] = priceRecords;

  if (priceRecords.every((record) => record.price === baselineRecord.price)) {
    return [];
  }

  return priceRecords
    .filter((record) => record.price !== baselineRecord.price)
    .map((record) => createIssue({
      ...productContext(record.product, record.locale, productIndex),
      field: "price",
      issue: "PRICE_DIFFERENCE",
      severity: "high",
      value: record.product?.price ?? null,
      expected: `${baselineRecord.product?.price ?? baselineRecord.price} (${baselineRecord.locale.toUpperCase()} baseline)`,
      message: `${record.locale.toUpperCase()} product price differs from ${baselineRecord.locale.toUpperCase()}.`
    }));
}

function getDiscountRecord(productsByLocale, locale, productIndex) {
  const product = productsByLocale[locale]?.[productIndex];
  const price = parsePrice(product?.price);
  const oldPrice = parsePrice(product?.oldPrice);

  return {
    locale,
    product,
    price,
    oldPrice,
    hasDiscount: price != null && oldPrice != null && oldPrice > price
  };
}

function validateDiscountEquality(productsByLocale, localeOrder, productIndex) {
  const discountRecords = localeOrder.map((locale) => getDiscountRecord(productsByLocale, locale, productIndex));
  const [baselineRecord] = discountRecords;

  if (discountRecords.some((record) => !record.product)) {
    return [];
  }

  const discountStateIssues = discountRecords
    .filter((record) => record.hasDiscount !== baselineRecord.hasDiscount)
    .map((record) => createIssue({
      ...productContext(record.product, record.locale, productIndex),
      field: "oldPrice",
      issue: "DISCOUNT_STATE_DIFFERENCE",
      severity: "high",
      value: record.product?.oldPrice ?? null,
      expected: baselineRecord.hasDiscount ? "discount present" : "no discount",
      message: `${record.locale.toUpperCase()} product discount state differs from ${baselineRecord.locale.toUpperCase()}.`
    }));

  const discountedRecords = discountRecords.filter((record) => record.hasDiscount);

  if (discountedRecords.length === 0) {
    return discountStateIssues;
  }

  const [baselineDiscountRecord] = discountedRecords;
  const oldPriceIssues = discountedRecords
    .filter((record) => record.oldPrice !== baselineDiscountRecord.oldPrice)
    .map((record) => createIssue({
      ...productContext(record.product, record.locale, productIndex),
      field: "oldPrice",
      issue: "DISCOUNT_PRICE_DIFFERENCE",
      severity: "high",
      value: record.product?.oldPrice ?? null,
      expected: `${baselineDiscountRecord.product?.oldPrice ?? baselineDiscountRecord.oldPrice} (${baselineDiscountRecord.locale.toUpperCase()} baseline)`,
      message: `${record.locale.toUpperCase()} product compare-at price differs from ${baselineDiscountRecord.locale.toUpperCase()}.`
    }));

  return [...discountStateIssues, ...oldPriceIssues];
}

function validateAvailability(product, baselineProduct, locale, baselineLocale, productIndex) {
  const state = normalizeAvailabilityState(product?.availabilityText);
  const baselineState = normalizeAvailabilityState(baselineProduct?.availabilityText);

  if (state === baselineState) {
    return [];
  }

  return [
    createIssue({
      ...productContext(product, locale, productIndex),
      field: "availabilityText",
      issue: "AVAILABILITY_STATE_MISMATCH",
      severity: "high",
      value: product?.availabilityText || "in stock",
      expected: `${baselineProduct?.availabilityText || "in stock"} (${baselineLocale.toUpperCase()} baseline)`,
      message: `${locale.toUpperCase()} product availability state differs from ${baselineLocale.toUpperCase()}.`
    })
  ];
}

function validateProductCounts(productsByLocale, localeOrder) {
  const productCounts = localeOrder.map((locale) => ({
    locale,
    count: productsByLocale[locale]?.length ?? 0
  }));
  const [baselineRecord] = productCounts;

  if (productCounts.every((record) => record.count === baselineRecord.count)) {
    return [];
  }

  return productCounts
    .filter((record) => record.count !== baselineRecord.count)
    .map((record) => createIssue({
      locale: record.locale,
      productUrl: null,
      productId: null,
      sku: "product-list",
      field: "products.length",
      issue: "PRODUCT_COUNT_MISMATCH",
      severity: "high",
      value: record.count,
      expected: `${baselineRecord.count} (${baselineRecord.locale.toUpperCase()} baseline)`,
      message: `${record.locale.toUpperCase()} fetched ${record.count} products, but ${baselineRecord.locale.toUpperCase()} fetched ${baselineRecord.count}.`
    }));
}

export function validateLocaleComparisons(productsByLocale, localeOrder) {
  const issues = [];
  const [baselineLocale, ...comparisonLocales] = localeOrder;
  const baselineProducts = productsByLocale[baselineLocale] ?? [];
  const commonProductCount = Math.min(...localeOrder.map((locale) => productsByLocale[locale]?.length ?? 0));

  for (const locale of localeOrder) {
    const products = productsByLocale[locale] ?? [];

    products.forEach((product, productIndex) => {
      issues.push(...validateBrokenTranslations(product, locale, productIndex));
    });
  }

  issues.push(...validateProductCounts(productsByLocale, localeOrder));

  for (let productIndex = 0; productIndex < commonProductCount; productIndex += 1) {
    issues.push(...validateFieldPresence(productsByLocale, localeOrder, productIndex));
    issues.push(...validateOptionFieldPresence(productsByLocale, localeOrder, productIndex));
    issues.push(...validatePriceEquality(productsByLocale, localeOrder, productIndex));
    issues.push(...validateDiscountEquality(productsByLocale, localeOrder, productIndex));
  }

  comparisonLocales.forEach((locale) => {
    const products = productsByLocale[locale] ?? [];
    const productCount = Math.min(baselineProducts.length, products.length);

    for (let productIndex = 0; productIndex < productCount; productIndex += 1) {
      const product = products[productIndex];
      const baselineProduct = baselineProducts[productIndex];

      issues.push(...validateOptionCounts(product, baselineProduct, locale, baselineLocale, productIndex));
      issues.push(...validateAvailability(product, baselineProduct, locale, baselineLocale, productIndex));
    }
  });

  return issues;
}
