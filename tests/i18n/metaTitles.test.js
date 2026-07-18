import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const locales = ["et", "en", "ru"];
const appDirectory = fileURLToPath(new URL("../../app/", import.meta.url));
const metaLookupPattern = /messages\?\.meta\?\.([A-Za-z_][A-Za-z0-9_]*)/g;

function findPageFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return findPageFiles(path);
      return entry.isFile() && (entry.name === "page.js" || entry.name === "page.jsx") ? [path] : [];
    })
    .sort();
}

function readMetaKeys() {
  return [...new Set(
    findPageFiles(appDirectory)
      .flatMap((path) => [...readFileSync(path, "utf8").matchAll(metaLookupPattern)].map((match) => match[1]))
  )].sort();
}

function readMessages(locale) {
  return JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"));
}

test("page metadata lookups have non-empty title and description in every locale", () => {
  const keys = readMetaKeys();
  assert.ok(keys.length > 0, "No messages?.meta?.<key> lookups were found in app page files.");

  for (const locale of locales) {
    const messages = readMessages(locale);
    for (const key of keys) {
      for (const field of ["title", "description"]) {
        const value = messages.meta?.[key]?.[field];
        assert.equal(
          typeof value === "string" && value.trim().length > 0,
          true,
          `${locale} meta.${key}.${field} must be a non-empty string`
        );
      }
    }
  }
});
