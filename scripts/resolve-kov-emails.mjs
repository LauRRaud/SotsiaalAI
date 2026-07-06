#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

import {
  ensureParentDir,
  findProblemEmailFields,
  findQueueEmailFields,
  parseSelection,
  readJson,
  resolveEmailFromHtml,
  setValueAtPath,
  writeJson
} from "./lib/kov-email-resolver.mjs";

function usage() {
  return [
    "Usage:",
    "  node scripts/resolve-kov-emails.mjs --input KOV/Kodeerimine/kov_sotsiaalhoolekande_kontaktid_01_05.json --apply",
    "  node scripts/resolve-kov-emails.mjs --input-dir KOV/Kodeerimine --apply",
    "  node scripts/resolve-kov-emails.mjs --slug tartu-linn --report logs/tartu-email-report.json",
    "  node scripts/resolve-kov-emails.mjs --slug tartu-linn --only 1-3 --apply",
    "  node scripts/resolve-kov-emails.mjs --root KOV --limit 5 --apply",
    "",
    "Options:",
    "  --root <path>       KOV root folder. Defaults to KOV",
    "  --input <path>      Process a Kodeerimine queue JSON file. Can be repeated",
    "  --input-dir <path>  Process all JSON files from a queue folder",
    "  --slug <slug>       Process one KOV slug. Can be repeated",
    "  --only <list>       Process report indices, e.g. 1-5,9",
    "  --limit <number>    Process only first N unresolved candidates after filtering",
    "  --report <path>     Write JSON report. Defaults to logs/kov-email-resolution-report.json",
    "  --apply             Update JSON files. Without this, only reports planned changes",
    "  --min-confidence    high|medium. Defaults to high",
    "",
    "Queue mode updates email or emailToFill in the given Kodeerimine JSON files.",
    "KOV mode ignores KOV/KOV kontaktid.json and only reads KOV/<slug>/<slug>.json."
  ].join("\n");
}

function parseArgs(argv = []) {
  const args = {
    root: "KOV",
    inputs: [],
    inputDir: "",
    slugs: [],
    only: null,
    limit: 0,
    report: path.join("logs", "kov-email-resolution-report.json"),
    apply: false,
    minConfidence: "high",
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--root") args.root = argv[++index] || args.root;
    else if (arg === "--input") args.inputs.push(argv[++index] || "");
    else if (arg === "--input-dir") args.inputDir = argv[++index] || "";
    else if (arg === "--slug") args.slugs.push(argv[++index] || "");
    else if (arg === "--only") args.only = parseSelection(argv[++index] || "");
    else if (arg === "--limit") args.limit = Number.parseInt(argv[++index] || "0", 10) || 0;
    else if (arg === "--report") args.report = argv[++index] || args.report;
    else if (arg === "--apply") args.apply = true;
    else if (arg === "--min-confidence") args.minConfidence = argv[++index] || args.minConfidence;
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (!["high", "medium"].includes(args.minConfidence)) {
    throw new Error("--min-confidence must be high or medium");
  }
  args.slugs = args.slugs.map(slug => slug.trim()).filter(Boolean);
  args.inputs = args.inputs.map(input => input.trim()).filter(Boolean);
  return args;
}

async function listSlugs(root, requestedSlugs = []) {
  if (requestedSlugs.length) return requestedSlugs;
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(slug => slug !== "kov_rt")
    .sort((a, b) => a.localeCompare(b));
}

async function fetchHtml(url, cache) {
  if (!url) return "";
  if (cache.has(url)) return cache.get(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "SotsiaalAI KOV email resolver (+local data maintenance)"
      }
    });
    const html = response.ok ? await response.text() : "";
    cache.set(url, html);
    return html;
  } catch {
    cache.set(url, "");
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function confidenceAllowed(confidence, minConfidence) {
  if (minConfidence === "medium") return confidence === "medium" || confidence === "high";
  return confidence === "high";
}

async function collectCandidates(args) {
  if (args.inputs.length || args.inputDir) {
    const inputFiles = [...args.inputs];
    if (args.inputDir) {
      const entries = await fs.readdir(args.inputDir, { withFileTypes: true });
      inputFiles.push(...entries
        .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
        .map(entry => path.join(args.inputDir, entry.name))
        .sort((a, b) => a.localeCompare(b)));
    }

    const rows = [];
    for (const file of [...new Set(inputFiles)]) {
      try {
        const data = await readJson(file);
        rows.push(...findQueueEmailFields(data, { file }));
      } catch (error) {
        rows.push({
          slug: "",
          file,
          path: "",
          currentEmail: null,
          name: "",
          officialUrl: "",
          error: error?.message || String(error)
        });
      }
    }
    return rows.map((row, index) => ({ index: index + 1, ...row }));
  }

  const slugs = await listSlugs(args.root, args.slugs);
  const rows = [];
  for (const slug of slugs) {
    const file = path.join(args.root, slug, `${slug}.json`);
    try {
      const data = await readJson(file);
      rows.push(...findProblemEmailFields(data, { slug, file }));
    } catch (error) {
      rows.push({
        slug,
        file,
        path: "",
        currentEmail: null,
        name: "",
        officialUrl: "",
        error: error?.message || String(error)
      });
    }
  }
  return rows.map((row, index) => ({ index: index + 1, ...row }));
}

async function resolveCandidates(candidates, args) {
  const htmlByUrl = new Map();
  const selected = args.only;
  let rows = candidates.filter(row => !selected || selected.has(row.index));
  if (args.limit > 0) rows = rows.slice(0, args.limit);

  for (const row of rows) {
    if (row.error) continue;
    if (!row.officialUrl) {
      row.resolution = { email: "", confidence: "none", reasons: ["missing_official_url"] };
      continue;
    }
    const html = await fetchHtml(row.officialUrl, htmlByUrl);
    row.resolution = html
      ? resolveEmailFromHtml({ html, name: row.name, title: row.title, phone: row.phone })
      : { email: "", confidence: "none", reasons: ["fetch_failed"] };
    row.willApply = Boolean(
      row.resolution.email &&
      confidenceAllowed(row.resolution.confidence, args.minConfidence)
    );
  }

  return rows;
}

async function applyResolutions(rows) {
  const rowsByFile = new Map();
  for (const row of rows.filter(item => item.willApply)) {
    if (!rowsByFile.has(row.file)) rowsByFile.set(row.file, []);
    rowsByFile.get(row.file).push(row);
  }

  for (const [file, fileRows] of rowsByFile) {
    const data = await readJson(file);
    for (const row of fileRows) {
      setValueAtPath(data, row.objectPath, row.updateField || "email", row.resolution.email);
      row.applied = true;
    }
    await writeJson(file, data);
  }
}

function summarize(rows, allCandidates, args) {
  const resolved = rows.filter(row => row.resolution?.email);
  const applicable = rows.filter(row => row.willApply);
  const errors = allCandidates.filter(row => row.error);
  return {
    apply: args.apply,
    minConfidence: args.minConfidence,
    candidatesTotal: allCandidates.filter(row => !row.error).length,
    candidatesProcessed: rows.filter(row => !row.error).length,
    resolved: resolved.length,
    applicable: applicable.length,
    applied: rows.filter(row => row.applied).length,
    errors: errors.length
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const allCandidates = await collectCandidates(args);
  const rows = await resolveCandidates(allCandidates, args);
  if (args.apply) await applyResolutions(rows);

  const report = {
    generatedAt: new Date().toISOString(),
    summary: summarize(rows, allCandidates, args),
    rows
  };

  if (args.report) {
    await ensureParentDir(args.report);
    await fs.writeFile(args.report, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(report.summary, null, 2));
  if (args.report) console.log(`Report: ${args.report}`);
}

main().catch(error => {
  console.error(`[resolve-kov-emails] ${error?.message || String(error)}`);
  process.exitCode = 1;
});
