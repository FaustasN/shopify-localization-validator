# Shopify Localization Validator

Small V1 scanner for Shopify-like localized product data.

## First Slice

The first slice discovers configured locale products from the Shopify products endpoint, opens each rendered product page with Playwright, and saves visible product data into `data/products.<locale>.json`.

## Run

```bash
npm run scan
npm run validate
npm run dashboard
```

Dashboard runs at `http://127.0.0.1:4177`.

## Current Scope

- Fetches configured LT, LV, and EE locales
- Uses each locale's `/products.json?limit=250` endpoint to discover product handles
- Uses the rendered product page as the validation source for customer-facing text
- Extracts visible data from the main product card/purchase area, not the whole page
- Saves visible data for each product
- Adds scraper metadata around each product
- Runs validators against `data/products.<locale>.json`
- Creates a combined `data/issues.json`
- Checks only the current V1 color-variant language rule:
  - obvious English color keywords in visible option names, selected values, and option values, for example `Black`, `White`, and `Grey`
- Locale color constants live in `src/validators/language.js` so future color terms can be added in one place.
- Compares configured locale product files by product position using the first locale as the baseline.
- Comparison checks:
  - `translation missing` / `undefined` text
  - option count mismatch
  - empty customer-facing fields
  - product count mismatch across locale product lists
  - price difference where each product's numeric price should match across all locales
  - discount difference where discount state and compare-at prices should match across all locales
  - availability state mismatch, where blank means normal in-stock and visible stock text means a stock notice such as low stock or sold out
