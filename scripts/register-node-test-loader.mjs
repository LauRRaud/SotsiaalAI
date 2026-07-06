import fs from "node:fs";
import path from "node:path";
import { register, syncBuiltinESMExports } from "node:module";
import { fileURLToPath } from "node:url";

register(new URL("./node-test-loader.mjs", import.meta.url), import.meta.url);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const originalReadFileSync = fs.readFileSync.bind(fs);
const importPattern = /@import\s+url\(["'](.+?)["']\);/g;
const legacyCssBundles = new Map([
  [
    path.join(repoRoot, "app", "styles", "components", "documents-mode.css"),
    [
      path.join(repoRoot, "app", "styles", "features", "documents", "workspace.css"),
      path.join(repoRoot, "app", "styles", "features", "documents", "ui.css"),
      path.join(repoRoot, "app", "styles", "features", "documents", "mobile.css"),
      path.join(repoRoot, "app", "styles", "features", "documents", "agent.css"),
      path.join(repoRoot, "app", "styles", "features", "documents", "library.css")
    ]
  ],
  [
    // Feature-owned high-contrast overrides were extracted out of hc.css;
    // tests that read hc.css keep seeing the full pre-split contract.
    path.join(repoRoot, "app", "styles", "theme", "hc.css"),
    [
      path.join(repoRoot, "app", "styles", "tokens", "theme-hc.css"),
      path.join(repoRoot, "app", "styles", "features", "chat", "hc.css"),
      path.join(repoRoot, "app", "styles", "features", "profile", "hc.css")
    ]
  ],
  [
    path.join(repoRoot, "app", "styles", "theme", "mono.css"),
    [
      path.join(repoRoot, "app", "styles", "tokens", "theme-mono.css"),
      path.join(repoRoot, "app", "styles", "features", "profile", "mono.css"),
      path.join(repoRoot, "app", "styles", "features", "home", "themes.css")
    ]
  ],
  [
    // Feature standard-theme overrides extracted to features/*/themes.css.
    path.join(repoRoot, "app", "styles", "theme", "dark.css"),
    [
      path.join(repoRoot, "app", "styles", "features", "chat", "themes.css"),
      path.join(repoRoot, "app", "styles", "features", "home", "themes.css")
    ]
  ]
]);

function shouldInlineCssImports(filePath, encoding) {
  return encoding && String(filePath).endsWith(".css");
}

function readCssWithImports(filePath, encoding, seen = new Set()) {
  const absolutePath = path.resolve(filePath);
  const source = originalReadFileSync(absolutePath, encoding);
  if (seen.has(absolutePath)) return source;

  seen.add(absolutePath);
  const bundledSources = (legacyCssBundles.get(absolutePath) || [])
    .filter(bundlePath => fs.existsSync(bundlePath))
    .map(bundlePath => readCssWithImports(bundlePath, encoding, seen));

  return [source.replace(importPattern, (statement, importPath) => {
    if (!importPath.startsWith(".")) return statement;

    const importedPath = path.resolve(path.dirname(absolutePath), importPath);
    if (!importedPath.startsWith(repoRoot) || !fs.existsSync(importedPath)) {
      return statement;
    }

    return `${statement}\n${readCssWithImports(importedPath, encoding, seen)}`;
  }), ...bundledSources].join("\n");
}

fs.readFileSync = function readFileSyncWithCssImports(filePath, options) {
  const encoding = typeof options === "string" ? options : options?.encoding;
  if (shouldInlineCssImports(filePath, encoding)) {
    return readCssWithImports(fileURLToPathSafe(filePath), options);
  }

  return originalReadFileSync(filePath, options);
};

function fileURLToPathSafe(filePath) {
  return filePath instanceof URL ? fileURLToPath(filePath) : filePath;
}

syncBuiltinESMExports();
