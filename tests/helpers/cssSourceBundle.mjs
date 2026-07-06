import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const IMPORT_RE = /@import\s+(?:url\()?["']([^"']+)["']\)?\s*([^;]*);/g;

function readCssFile(fileUrl, seen) {
  const filePath = fileURLToPath(fileUrl);
  const key = path.normalize(filePath);
  if (seen.has(key)) return "";
  seen.add(key);

  const source = readFileSync(fileUrl).toString("utf8");
  const dir = path.dirname(filePath);

  return source.replace(IMPORT_RE, (full, specifier, media) => {
    if (/^(?:[a-z]+:)?\/\//i.test(specifier) || specifier.startsWith("data:")) {
      return full;
    }

    const importedPath = path.resolve(dir, specifier);
    const imported = readCssFile(pathToFileURL(importedPath), seen);
    const condition = String(media || "").trim();
    return condition ? `@media ${condition} {\n${imported}\n}` : imported;
  });
}

export function readCssSourceBundle(repoRelativePath) {
  return readCssFile(new URL(`../../${repoRelativePath}`, import.meta.url), new Set());
}

export const readCssBundle = readCssSourceBundle;
