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

/**
 * KATTEKONTROLL — miks ta siia lisandus.
 *
 * See skript oli PARITEEDIkontroll: ta võrdles kolme kataloogi omavahel. Kui võti puudus
 * KÕIGIST kolmest, oli pariteet korras ja värav roheline — aga kood langes tagasi
 * kõvakodeeritud eestikeelsele varuvariandile ja inglise keele valinud kasutaja nägi
 * eesti keelt. Just nii elas `components/rooms/RoomCallBar.jsx`-is 22 võtit: pool
 * kõneribast oli igas keeles eestikeelne ja ükski roheline gate seda ei näinud.
 *
 * Omanik leidis selle SILMAGA, brauserist. Seda ei tohi teist korda juhtuda.
 *
 * MIDA SEE EI PÜÜA. Dünaamiliselt koostatud võtmed (`t(`calls.${x}`)`) jäävad välja —
 * neid ei saa staatiliselt lugeda. Kontroll on seetõttu ALAHINNANG, mitte täisgarantii;
 * ta püüab kirjavead ja unustatud lisamised, mis on see klass, mis siin päriselt juhtus.
 */
const SCAN_DIRS = ["components", "app"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "generated"]);
const KEY_PATTERNS = [
  /\btext\(\s*t\s*,\s*["']([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)["']/g,
  /\bt\(\s*["']([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)["']/g
];

async function collectSourceFiles(dir, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectSourceFiles(full, out);
    else if (/\.(jsx?|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * ALAMPUU LOEB SAMUTI OLEMASOLUKS. `components/covision/CovisionLiveSession.jsx`
 * kutsub `t("covision.live")` TEADLIKULT, et saada kogu alampuu objektina
 * (`copyObject`) ja lugeda sealt hiljem välju. Lehepõhine loend seda ei sisalda, seega
 * pelk `baseKeys.has(key)` annaks vale-positiivse — ja vale-positiiv on väravale
 * surmav: esimese müra peale keegi lülitab ta välja.
 */
const resolveKeyPath = (data, key) =>
  key.split(".").reduce((node, seg) => (isObject(node) ? node[seg] : undefined), data);

async function checkKeyCoverage(baseData, rootDir) {
  const files = [];
  for (const dir of SCAN_DIRS) await collectSourceFiles(path.join(rootDir, dir), files);

  const missing = new Map();
  for (const file of files) {
    const src = await fs.readFile(file, "utf8");
    for (const pattern of KEY_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(src))) {
        const key = match[1];
        if (resolveKeyPath(baseData, key) !== undefined) continue;
        const rel = path.relative(rootDir, file);
        if (!missing.has(key)) missing.set(key, rel);
      }
    }
  }
  return missing;
}

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

  const rootDir = path.resolve(__dirname, "..");
  const uncovered = await checkKeyCoverage(baseData, rootDir);
  if (uncovered.size) {
    console.error(
      `[i18n:check] ${uncovered.size} key(s) used in code but missing from ${BASE_LOCALE}.json —`
      + " these render their hard-coded fallback in EVERY language:"
    );
    for (const [key, file] of [...uncovered].sort(([a], [b]) => a.localeCompare(b))) {
      console.error(`  - ${key}  (${file})`);
    }
    process.exit(1);
  }
  console.log("[i18n:check] Key coverage: every statically readable key exists in the catalog.");
}

main().catch((error) => {
  console.error("[i18n:check] Failed:", error.message);
  process.exit(1);
});
