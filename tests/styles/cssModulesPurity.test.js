import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/**
 * SOL-BUILD-01 regressioon.
 *
 * `next build --webpack` laadib `*.module.css` failid css-loaderiga
 * `pure`-režiimis: iga selektor peab sisaldama vähemalt üht kohalikku klassi
 * või ID-d. Turbopack on leplikum, seega jääb rikkumine vaikimisi build'is
 * märkamata kuni webpack-build'i või `analyze:webpack` katkemiseni.
 *
 * Oraakel on Next.js-i enda kaasapakitud `postcss-modules-local-by-default`
 * — sama plugin, mis build'is otsuse teeb.
 */

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "reports", "coverage", "playwright-report"]);

function collectModuleStylesheets(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectModuleStylesheets(path.join(dir, entry.name), found);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".module.css")) {
      found.push(path.join(dir, entry.name));
    }
  }
  return found;
}

function loadPureModeProcessor() {
  const postcss = require("postcss");
  const localByDefault = require("next/dist/compiled/postcss-modules-local-by-default");
  return postcss([localByDefault({ mode: "pure" })]);
}

async function purityErrorFor(processor, css, from) {
  try {
    await processor.process(css, { from });
    return null;
  } catch (error) {
    return error.message;
  }
}

test("kõik *.module.css failid läbivad webpacki pure-režiimi", async () => {
  const processor = loadPureModeProcessor();
  const files = collectModuleStylesheets(repoRoot);
  assert.ok(files.length > 0, "ühtegi *.module.css faili ei leitud — kogumislogi on katki");

  const failures = [];
  for (const file of files) {
    const css = fs.readFileSync(file, "utf8");
    const message = await purityErrorFor(processor, css, file);
    if (message) failures.push(`${path.relative(repoRoot, file)}: ${message}`);
  }

  assert.deepEqual(failures, [], `pure-režiimi rikkumised:\n${failures.join("\n")}`);
});

test("negatiivkontroll: kohaliku klassita :global selektor kukub pure-režiimis läbi", async () => {
  const processor = loadPureModeProcessor();
  const offending = ':global(html:has(main[aria-label="SotsiaalAI logo"])) { background: #000; }';
  const message = await purityErrorFor(processor, offending, path.join(repoRoot, "synthetic.module.css"));
  assert.ok(message, "oraakel ei tuvastanud teadaolevalt ebapuhast selektorit — kontroll on hambutu");
  assert.match(message, /is not pure/);
});

test("logo ekspordilava globaalsed reeglid on marsruudi stiililehes ja laaditud", () => {
  const routeCss = path.join(repoRoot, "app", "logo-eksport", "logo-export.css");
  const page = fs.readFileSync(path.join(repoRoot, "app", "logo-eksport", "page.jsx"), "utf8");
  const moduleCss = fs.readFileSync(
    path.join(repoRoot, "components", "brand", "LogoExportStage.module.css"),
    "utf8"
  );
  const globals = fs.readFileSync(routeCss, "utf8");

  assert.match(page, /import\s+"\.\/logo-export\.css";/);
  assert.match(globals, /html:has\(main\[aria-label="SotsiaalAI logo"\]\)/);
  assert.match(globals, /body:has\(main\[aria-label="SotsiaalAI logo"\]\) \.room\b/);
  assert.match(globals, /main#main:has\(main\[aria-label="SotsiaalAI logo"\]\)/);
  assert.doesNotMatch(moduleCss, /:global\(html:has/);
  assert.doesNotMatch(moduleCss, /:global\(body:has/);
  assert.doesNotMatch(moduleCss, /:global\(main#main:has/);
});
