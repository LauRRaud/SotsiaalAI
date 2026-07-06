#!/usr/bin/env node
import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    root: "KOV",
    systemdEnv: "",
    dryRun: false,
    limit: 0,
    slug: "",
    excludeSlugs: [],
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") args.root = String(argv[++index] || "").trim();
    else if (arg === "--systemd-env") args.systemdEnv = String(argv[++index] || "").trim();
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--limit") args.limit = Number.parseInt(String(argv[++index] || "0"), 10) || 0;
    else if (arg === "--slug") args.slug = String(argv[++index] || "").trim().toLowerCase();
    else if (arg === "--exclude-slug") args.excludeSlugs.push(String(argv[++index] || "").trim().toLowerCase());
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/ingest-kov-rt-batch.mjs --root KOV --dry-run",
    "  node scripts/ingest-kov-rt-batch.mjs --root KOV --systemd-env sotsiaalai-rag.service",
    "  node scripts/ingest-kov-rt-batch.mjs --root KOV --slug jogeva-vald --systemd-env sotsiaalai-rag.service"
  ].join("\n");
}

function loadSystemdEnvironment(serviceName) {
  if (!serviceName) return {};
  const raw = execFileSync("systemctl", ["show", serviceName, "-p", "Environment", "--value"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const env = {};
  const apiKeyMatch = String(raw || "").match(/RAG_SERVICE_API_KEY=([^\s"']+)/);
  if (apiKeyMatch) env.RAG_SERVICE_API_KEY = apiKeyMatch[1];
  for (const token of String(raw || "").split(/\s+/)) {
    const match = token.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  if (!env.RAG_SERVICE_API_KEY) {
    const unit = execFileSync("systemctl", ["cat", serviceName], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const envFileMatch = String(unit || "").match(/^EnvironmentFile=([^\r\n]+)/m);
    const envFile = envFileMatch ? envFileMatch[1].replace(/^-/, "").trim() : "";
    if (envFile && fs.existsSync(envFile)) {
      const text = fs.readFileSync(envFile, "utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match) continue;
        env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  }
  return env;
}

function readManifest(root) {
  const manifestPath = `${root.replace(/[\\/]+$/, "")}/kov_rt/kov_rt_manifest.json`;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return {
    manifestPath,
    entries: Array.isArray(manifest.entries) ? manifest.entries : []
  };
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(usage());
    return;
  }

  const systemdEnv = loadSystemdEnvironment(args.systemdEnv);
  const env = {
    ...process.env,
    ...systemdEnv
  };

  if (!args.dryRun && !String(env.RAG_SERVICE_API_KEY || "").trim()) {
    throw new Error("RAG_SERVICE_API_KEY is required. Pass --systemd-env <service> or export it in the shell.");
  }

  const { manifestPath, entries } = readManifest(args.root);
  let ingestEntries = entries.filter(entry => entry?.auto_ingest === true);
  if (args.slug) ingestEntries = ingestEntries.filter(entry => String(entry.slug || "").toLowerCase() === args.slug);
  if (args.excludeSlugs.length) {
    const excluded = new Set(args.excludeSlugs);
    ingestEntries = ingestEntries.filter(entry => !excluded.has(String(entry.slug || "").toLowerCase()));
  }
  if (args.limit > 0) ingestEntries = ingestEntries.slice(0, args.limit);

  const results = [];
  console.log(JSON.stringify({
    ok: true,
    action: args.dryRun ? "kov_rt_batch_dry_run_start" : "kov_rt_batch_ingest_start",
    manifestPath,
    count: ingestEntries.length,
    deferred: entries.filter(entry => entry?.ingest_status === "deferred").map(entry => entry.slug).filter(Boolean)
  }, null, 2));

  for (const entry of ingestEntries) {
    const childArgs = ["scripts/ingest-national-rt-xml.mjs", "--kov-root", args.root, "--slug", entry.slug];
    if (args.dryRun) childArgs.push("--dry-run");
    const child = spawnSync(process.execPath, childArgs, {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 8
    });

    const stdout = String(child.stdout || "");
    const stderr = String(child.stderr || "");
    if (child.status === 0) {
      const inserted = (stdout.match(/Ingested .*?: (\d+) chunks/) || [])[1] || null;
      const docId = (stdout.match(/"doc_id":\s*"([^"]+)"/) || [])[1] || entry.rt_doc_id || null;
      console.log(`[ok] ${entry.slug}${docId ? ` doc=${docId}` : ""}${inserted ? ` chunks=${inserted}` : ""}`);
      results.push({ slug: entry.slug, ok: true, docId, inserted });
      continue;
    }

    console.error(`[fail] ${entry.slug} status=${child.status}`);
    if (stdout.trim()) console.error(stdout.trim().slice(-3000));
    if (stderr.trim()) console.error(stderr.trim().slice(-3000));
    results.push({ slug: entry.slug, ok: false, status: child.status });
    break;
  }

  const failed = results.filter(result => !result.ok);
  console.log(JSON.stringify({
    ok: failed.length === 0,
    action: args.dryRun ? "kov_rt_batch_dry_run_done" : "kov_rt_batch_ingest_done",
    attempted: results.length,
    succeeded: results.length - failed.length,
    failed
  }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(`[kov:ingest-rt:batch] ${error?.message || String(error)}`);
  process.exitCode = 1;
});
