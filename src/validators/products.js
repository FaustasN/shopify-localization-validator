import { createIssue } from "../utils/issue.js";
import { findEnglishColor } from "./language.js";

function isBlank(value) {
  return value == null || String(value).trim().length === 0;
}

function baseContext(product) {
  return {
    locale: product.locale,
    productUrl: product.url,
    productId: null
  };
}

function missingTextIssue(product, field, value) {
  return createIssue({
    ...baseContext(product),
    field,
    issue: "MISSING_TEXT",
    severity: "medium",
    value: value ?? null,
    message: `${product.locale.toUpperCase()} ${field} text is missing.`
  });
}

export function validateProductText(product) {
  const issues = [];

  [
    "title",
    "price",
    "description",
    "addToCartText",
    "visibleText"
  ].forEach((field) => {
    if (isBlank(product[field])) {
      issues.push(missingTextIssue(product, field, product[field]));
    }
  });

  const options = Array.isArray(product.options) ? product.options : [];
  options.forEach((option, optionIndex) => {
    if (isBlank(option?.name)) {
      issues.push(missingTextIssue(product, `options[${optionIndex}].name`, option?.name));
    }

    if (isBlank(option?.selected)) {
      issues.push(missingTextIssue(product, `options[${optionIndex}].selected`, option?.selected));
    }

    if (!Array.isArray(option?.values) || option.values.length === 0) {
      issues.push(missingTextIssue(product, `options[${optionIndex}].values`, option?.values));
    }
  });

  return issues;
}

export function validateProductColors(product) {
  const issues = [];
  const options = Array.isArray(product.options) ? product.options : [];

  options.forEach((option, optionIndex) => {
    [
      ["name", option?.name],
      ["selected", option?.selected]
    ].forEach(([fieldName, value]) => {
      const match = findEnglishColor(product.locale, value);
      if (match) {
        issues.push(
          createIssue({
            ...baseContext(product),
            field: `options[${optionIndex}].${fieldName}`,
            issue: "ENGLISH_COLOR",
            severity: "medium",
            value,
            expected: match.expectedTerm,
            message: `${product.locale.toUpperCase()} option ${fieldName} contains an English color name.`
          })
        );
      }
    });

    const values = Array.isArray(option?.values) ? option.values : [];
    values.forEach((value, valueIndex) => {
      const match = findEnglishColor(product.locale, value);
      if (match) {
        issues.push(
          createIssue({
            ...baseContext(product),
            field: `options[${optionIndex}].values[${valueIndex}]`,
            issue: "ENGLISH_COLOR",
            severity: "medium",
            value,
            expected: match.expectedTerm,
            message: `${product.locale.toUpperCase()} option value contains an English color name.`
          })
        );
      }
    });
  });

  return issues;
}
