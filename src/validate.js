import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateLocaleComparisons } from "./validators/comparisons.js";
import { validateProducts } from "./validators/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

async function readConfig() {
  const configPath = path.join(appRoot, "config", "locales.json");
  const rawConfig = await readFile(configPath, "utf8");
  return JSON.parse(rawConfig);
}

async function readProducts(inputPath) {
  const rawProducts = await readFile(inputPath, "utf8");
  const products = JSON.parse(rawProducts);

  if (!Array.isArray(products)) {
    throw new Error("Invalid products file: expected array");
  }

  return products;
}

async function saveIssues(issues, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(issues, null, 2)}\n`, "utf8");
}

async function main() {
  const config = await readConfig();
  const localeConfigs = Array.isArray(config.locales) ? config.locales : [config];
  const outputPath = path.join(appRoot, "data", "issues.json");
  const allIssues = [];
  const productsByLocale = {};
  const localeOrder = localeConfigs.map((localeConfig) => localeConfig.locale);

  for (const localeConfig of localeConfigs) {
    const inputPath = path.join(appRoot, "data", `products.${localeConfig.locale}.json`);
    const products = await readProducts(inputPath);
    const issues = validateProducts(products);

    productsByLocale[localeConfig.locale] = products;
    allIssues.push(...issues);

    console.log(`Validated ${products.length} ${localeConfig.locale.toUpperCase()} products.`);
    console.log(`Found ${issues.length} ${localeConfig.locale.toUpperCase()} issues.`);
  }

  const comparisonIssues = validateLocaleComparisons(productsByLocale, localeOrder);
  allIssues.push(...comparisonIssues);

  console.log(`Found ${comparisonIssues.length} comparison issues.`);

  await saveIssues(allIssues, outputPath);

  console.log(`Found ${allIssues.length} issues total.`);
  console.log(`Saved ${path.relative(appRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
