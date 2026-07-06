import { validateProductColors } from "./products.js";

export function validateProducts(products) {
  const issues = [];

  for (const product of products) {
    issues.push(...validateProductColors(product));
  }

  return issues;
}
