#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = path.resolve(__dirname, "..", "messages");
const BASE_LOCALE = "et";

const isObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value);

const flattenKeys = (node, prefix = "") => {
  const result = new Set();
  for (const [key, value] of Object.entries(node)) {
    const current = prefix ? `${prefix}.${key}` : key;
    if (isObject(value)) {
      for (const nested of flattenKeys(value, current)) {
        result.add(nested);
      }
    } else {
      result.add(current);
    }
  }
  return result;
};

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error.message}`);
  }
};

const formatList = (items, limit = 20) => {
  if (items.length <= limit) return items.join(", ");
  const head = items.slice(0, limit).join(", ");
  return `${head}, ... (+${items.length - limit} more)`;
};

async function main() {
  const files = (await fs.readdir(MESSAGES_DIR)).filter((file) => {
    if (!file.endsWith(".json")) return false;
    return !file.endsWith(".backup.json");
  });

  const basePath = path.join(MESSAGES_DIR, `${BASE_LOCALE}.json`);
  if (!files.includes(`${BASE_LOCALE}.json`)) {
    throw new Error(`Base locale file ${basePath} is missing.`);
  }

  const baseData = await readJson(basePath);
  if (!isObject(baseData)) {
    throw new Error(
      `Base locale ${basePath} must contain a JSON object at the root.`,
    );
  }

  const baseKeys = flattenKeys(baseData);
  const issues = [];

  for (const file of files) {
    const locale = path.basename(file, ".json");
    if (locale === BASE_LOCALE) continue;

    const localePath = path.join(MESSAGES_DIR, file);
    const data = await readJson(localePath);
    if (!isObject(data)) {
      issues.push({
        locale,
        type: "invalid",
        message: "Root JSON value must be an object.",
      });
      continue;
    }

    const localeKeys = flattenKeys(data);
    const missing = [...baseKeys].filter((key) => !localeKeys.has(key)).sort();
    const extra = [...localeKeys].filter((key) => !baseKeys.has(key)).sort();

    if (missing.length || extra.length) {
      const details = [];
      if (missing.length) {
        details.push(`missing ${missing.length}: ${formatList(missing)}`);
      }
      if (extra.length) {
        details.push(`extra ${extra.length}: ${formatList(extra)}`);
      }
      issues.push({ locale, type: "diff", message: details.join(" | ") });
    } else {
      console.log(`[i18n:check] ${locale}: OK`);
    }
  }

  if (issues.length) {
    console.error("[i18n:check] Issues found:");
    for (const issue of issues) {
      console.error(`  - ${issue.locale}: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(`[i18n:check] All locales match ${BASE_LOCALE}.`);
}

main().catch((error) => {
  console.error("[i18n:check] Failed:", error.message);
  process.exit(1);
});
