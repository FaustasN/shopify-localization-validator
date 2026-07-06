import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchProducts, saveProducts } from "./scraper/fetchProducts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

async function readConfig() {
  const configPath = path.join(appRoot, "config", "locales.json");
  const rawConfig = await readFile(configPath, "utf8");
  return JSON.parse(rawConfig);
}

async function main() {
  const config = await readConfig();
  const localeConfigs = Array.isArray(config.locales) ? config.locales : [config];

  for (const localeConfig of localeConfigs) {
    const outputPath = path.join(appRoot, "data", `products.${localeConfig.locale}.json`);
    const products = await fetchProducts(localeConfig);

    await saveProducts(products, outputPath);

    console.log(`Fetched ${products.length} ${localeConfig.locale.toUpperCase()} products.`);
    console.log(`Saved ${path.relative(appRoot, outputPath)}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
