import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const publicRoot = path.join(appRoot, "public");
const port = Number(process.env.PORT ?? 4177);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function isLocalRequest(request) {
  const host = request.headers.host ?? "";
  const origin = request.headers.origin;
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);

  if (!localHost) {
    return false;
  }

  if (!origin) {
    return true;
  }

  try {
    const parsedOrigin = new URL(origin);
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(parsedOrigin.hostname);
  } catch {
    return false;
  }
}

async function readJson(relativePath, fallback) {
  try {
    const raw = await readFile(path.join(appRoot, relativePath), "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function runScript(scriptName) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", scriptName], {
      cwd: appRoot,
      shell: process.platform === "win32"
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code,
        output: output.trim()
      });
    });
  });
}

function getFieldValue(product, field) {
  if (!product || !field) {
    return "";
  }

  if (field === "options.length") {
    return Array.isArray(product.options) ? product.options.length : 0;
  }

  const parts = [...field.matchAll(/([^[.\]]+)|\[(\d+)\]/g)].map((match) => {
    return match[1] ?? Number(match[2]);
  });

  return parts.reduce((value, part) => {
    if (value == null) {
      return undefined;
    }

    return value[part];
  }, product);
}

function findProductIndex(productsByLocale, issue) {
  const localeProducts = productsByLocale[issue.locale] ?? [];
  const byUrl = localeProducts.findIndex((product) => {
    return product.url === issue.productUrl || product.productUrl === issue.productUrl;
  });

  if (byUrl >= 0) {
    return byUrl;
  }

  const skuMatch = String(issue.sku ?? "").match(/^product-(\d+)$/);
  if (skuMatch) {
    return Number(skuMatch[1]) - 1;
  }

  return -1;
}

function buildIssueRows({ issues, productsByLocale, localeOrder }) {
  return issues.map((issue) => {
    const productIndex = findProductIndex(productsByLocale, issue);
    const products = Object.fromEntries(
      localeOrder.map((locale) => [locale, productIndex >= 0 ? productsByLocale[locale]?.[productIndex] : null])
    );
    const comparedValues = Object.fromEntries(
      localeOrder.map((locale) => {
        const value = issue.field === "products.length"
          ? productsByLocale[locale]?.length
          : getFieldValue(products[locale], issue.field);
        return [locale, value == null ? "" : value];
      })
    );
    const productUrls = Object.fromEntries(
      localeOrder.map((locale) => [locale, products[locale]?.url ?? products[locale]?.productUrl ?? ""])
    );
    const productTitles = Object.fromEntries(
      localeOrder.map((locale) => [locale, products[locale]?.title ?? ""])
    );

    return {
      ...issue,
      productIndex,
      productTitle: issue.field === "products.length"
        ? "Product list"
        : productTitles[issue.locale] || productTitles[localeOrder[0]] || "Unknown product",
      productTitles,
      productUrls,
      comparedValues
    };
  });
}

function summarizeIssues(issues, localeOrder) {
  const bySeverity = {};
  const byLocale = Object.fromEntries(localeOrder.map((locale) => [locale, 0]));

  issues.forEach((issue) => {
    bySeverity[issue.severity] = (bySeverity[issue.severity] ?? 0) + 1;
    byLocale[issue.locale] = (byLocale[issue.locale] ?? 0) + 1;
  });

  return {
    total: issues.length,
    bySeverity,
    byLocale
  };
}

async function buildState() {
  const config = await readJson("config/locales.json", { locales: [] });
  const localeConfigs = Array.isArray(config.locales) ? config.locales : [config];
  const localeOrder = localeConfigs.map((localeConfig) => localeConfig.locale).filter(Boolean);
  const productsByLocale = {};

  for (const locale of localeOrder) {
    productsByLocale[locale] = await readJson(`data/products.${locale}.json`, []);
  }

  const issues = await readJson("data/issues.json", []);
  const rows = buildIssueRows({ issues, productsByLocale, localeOrder });

  return {
    localeOrder,
    summary: summarizeIssues(rows, localeOrder),
    rows,
    updatedAt: new Date().toISOString()
  };
}

async function serveStatic(request, response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const relativePath = requestedPath.replace(/^\/+/, "");
  const filePath = path.resolve(publicRoot, relativePath);

  if (!filePath.startsWith(publicRoot)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(filePath)] ?? "application/octet-stream"
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

async function handleApi(request, response, pathname) {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, { ok: false, error: "Local requests only" });
    return;
  }

  if (request.method === "GET" && pathname === "/api/state") {
    sendJson(response, 200, { ok: true, state: await buildState() });
    return;
  }

  if (request.method === "POST" && ["/api/scan", "/api/validate"].includes(pathname)) {
    const contentType = request.headers["content-type"] ?? "";
    if (!contentType.includes("application/json")) {
      sendJson(response, 415, { ok: false, error: "POST requests must use application/json" });
      return;
    }

    const scriptName = pathname === "/api/scan" ? "scan" : "validate";
    const result = await runScript(scriptName);
    const state = await buildState();
    sendJson(response, result.ok ? 200 : 500, { ...result, state });
    return;
  }

  sendJson(response, 404, { ok: false, error: "Unknown API route" });
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url.pathname);
      return;
    }

    await serveStatic(request, response, url.pathname);
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Dashboard running at http://127.0.0.1:${port}`);
});
