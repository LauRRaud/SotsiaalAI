#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const kovRoot = path.join(repoRoot, "KOV");
const EXCLUDED_DIRS = new Set(["Kodeerimine", "kov_rt"]);
const CONTACT_FIELD_KEYS = new Set([
  "email",
  "emails",
  "eMail",
  "e-mail",
  "e_post",
  "ePost",
  "contactEmail",
  "contact_email",
  "phone",
  "phones",
  "telephone",
  "tel",
  "mobile",
  "alternatePhone",
  "contactPhone",
  "contact_phone"
]);

const EMAIL_PATTERN =
  /[A-Z0-9._%+-]+(?:\s*(?:@|\{at\}|\{ätt\}|\[at\]|\[ät\]|\(at\)| at )\s*)[A-Z0-9.-]+\.[A-Z]{2,}/giu;
const PROTECTED_EMAIL_PATTERN = /(?:\*protected email\*|\[email protected\]|email protected|protected email)/giu;
const PHONE_PATTERNS = [
  /\+372[\s.-]*(?:\d[\s.-]*){6,9}/gu,
  /(?<![\dA-Za-z])(?:116\s*111|116\s*006|112|1247)(?![\dA-Za-z])/gu,
  /(?<![\dA-Za-z])(?:[3-8]\d{2,3}[\s.-]?\d{3,4}|[3-8]\d[\s.-]?\d{3}[\s.-]?\d{3}|[3-8]\d{6,7})(?![\dA-Za-z])/gu
];

function normalizeArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run")
  };
}

function looksLikeMunicipalityDir(name) {
  return !EXCLUDED_DIRS.has(name) && !name.startsWith(".");
}

function sanitizeContactText(value) {
  let next = String(value ?? "");
  next = next.replace(EMAIL_PATTERN, "");
  next = next.replace(PROTECTED_EMAIL_PATTERN, "");
  for (const pattern of PHONE_PATTERNS) {
    next = next.replace(pattern, "");
  }
  next = next
    .replace(/\b(?:tel\.?|telefon|e-post|e-mail)\b\s*[:;,-]*/giu, "")
    .replace(/\(\s*(?:[,;|]\s*)*\)/gu, "")
    .replace(/(?:^|[\s;|,])(?:tel\.?|telefon|e-post|e-mail)(?=$|[\s;|,])/giu, " ")
    .replace(/\s+([,;:.])/gu, "$1")
    .replace(/([;|,]\s*){2,}/gu, "; ")
    .replace(/([(|])\s*([)|])/gu, "")
    .replace(/[ \t]{2,}/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  return next;
}

function sanitizeJsonValue(value, stats) {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJsonValue(entry, stats));
  }
  if (value && typeof value === "object") {
    const next = {};
    for (const [key, child] of Object.entries(value)) {
      if (CONTACT_FIELD_KEYS.has(key)) {
        stats.removedJsonFields += 1;
        continue;
      }
      next[key] = sanitizeJsonValue(child, stats);
    }
    return next;
  }
  if (typeof value === "string") {
    const sanitized = sanitizeContactText(value);
    if (sanitized !== value) stats.sanitizedJsonStrings += 1;
    return sanitized;
  }
  return value;
}

function isContactLine(line) {
  return /^\s*(?:[•*-]\s*)?(?:Kontakt|Telefon|Tel\.?|E-post|E-mail|Mobiil)\s*:/iu.test(line);
}

function isContactContinuation(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (EMAIL_PATTERN.test(trimmed) || PROTECTED_EMAIL_PATTERN.test(trimmed)) return true;
  EMAIL_PATTERN.lastIndex = 0;
  PROTECTED_EMAIL_PATTERN.lastIndex = 0;
  if (PHONE_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(trimmed);
  })) return true;
  return /^[),;|]+/u.test(trimmed);
}

function sanitizeMarkdown(text, stats) {
  const lines = String(text || "").split(/\r?\n/u);
  const next = [];
  let skippingContactBlock = false;

  for (const line of lines) {
    if (isContactLine(line)) {
      stats.removedMarkdownContactLines += 1;
      skippingContactBlock = true;
      continue;
    }

    if (skippingContactBlock && isContactContinuation(line)) {
      stats.removedMarkdownContactLines += 1;
      continue;
    }
    skippingContactBlock = false;

    const sanitized = sanitizeContactText(line);
    if (sanitized !== line.trim()) stats.sanitizedMarkdownLines += 1;
    next.push(sanitized);
  }

  return next.join("\n").replace(/\n{3,}/gu, "\n\n").trimEnd() + "\n";
}

async function listMunicipalityFiles() {
  const entries = await fs.readdir(kovRoot, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !looksLikeMunicipalityDir(entry.name)) continue;
    const dir = path.join(kovRoot, entry.name);
    const nested = await fs.readdir(dir, { withFileTypes: true });
    for (const file of nested) {
      if (!file.isFile()) continue;
      if (!file.name.endsWith(".json") && !file.name.endsWith(".md")) continue;
      files.push(path.join(dir, file.name));
    }
  }
  return files.sort((left, right) => left.localeCompare(right, "et"));
}

async function main() {
  const args = normalizeArgs(process.argv.slice(2));
  const files = await listMunicipalityFiles();
  const stats = {
    filesScanned: files.length,
    filesChanged: 0,
    jsonFilesChanged: 0,
    markdownFilesChanged: 0,
    removedJsonFields: 0,
    sanitizedJsonStrings: 0,
    removedMarkdownContactLines: 0,
    sanitizedMarkdownLines: 0
  };

  for (const filePath of files) {
    const before = await fs.readFile(filePath, "utf8");
    let after = before;
    if (filePath.endsWith(".json")) {
      const parsed = JSON.parse(before);
      after = JSON.stringify(sanitizeJsonValue(parsed, stats), null, 2) + "\n";
    } else if (filePath.endsWith(".md")) {
      after = sanitizeMarkdown(before, stats);
    }

    if (after !== before) {
      stats.filesChanged += 1;
      if (filePath.endsWith(".json")) stats.jsonFilesChanged += 1;
      if (filePath.endsWith(".md")) stats.markdownFilesChanged += 1;
      if (!args.dryRun) await fs.writeFile(filePath, after, "utf8");
    }
  }

  console.log(JSON.stringify({ mode: args.dryRun ? "dry-run" : "write", ...stats }, null, 2));
}

main().catch((error) => {
  console.error("[sanitize-kov-folder-contact-data] failed", error);
  process.exitCode = 1;
});
