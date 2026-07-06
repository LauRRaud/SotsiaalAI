#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    root: "KOV",
    systemdEnv: "",
    dryRun: false,
    limit: 0,
    slug: "",
    excludeSlugs: ["kov_rt", "tallinn"],
    skipValidate: false,
    replaceExisting: false,
    confirmCleanup: false,
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
    else if (arg === "--skip-validate") args.skipValidate = true;
    else if (arg === "--replace-existing" || arg === "--replace-existing-web") args.replaceExisting = true;
    else if (arg === "--confirm-cleanup") args.confirmCleanup = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/ingest-kov-web-batch.mjs --root KOV --dry-run",
    "  node scripts/ingest-kov-web-batch.mjs --root KOV --systemd-env sotsiaalai-rag.service",
    "  node scripts/ingest-kov-web-batch.mjs --root KOV --slug harku-vald --systemd-env sotsiaalai-rag.service",
    "  node scripts/ingest-kov-web-batch.mjs --root KOV --slug harku-vald --replace-existing --confirm-cleanup --systemd-env sotsiaalai-rag.service"
  ].join("\n");
}

function loadSystemdEnvironment(serviceName) {
  if (!serviceName) return {};
  const env = {};
  const raw = execFileSync("systemctl", ["show", serviceName, "-p", "Environment", "--value"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
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

function listKovBundleSlugs(root) {
  const excluded = new Set(["kov_rt"]);
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(slug => !excluded.has(slug))
    .filter(slug => {
      const dir = path.join(root, slug);
      return ["sources.json", "json", "meta.json", "rag.md"].every(suffix => fs.existsSync(path.join(dir, `${slug}.${suffix}`)));
    })
    .sort();
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(usage());
    return;
  }

  const systemdEnv = loadSystemdEnvironment(args.systemdEnv);
  const env = { ...process.env, ...systemdEnv };
  if (!args.dryRun && !String(env.RAG_SERVICE_API_KEY || "").trim()) {
    throw new Error("RAG_SERVICE_API_KEY is required. Pass --systemd-env <service> or export it in the shell.");
  }
  if (args.replaceExisting && !args.dryRun && !args.confirmCleanup) {
    throw new Error("Refusing --replace-existing without --confirm-cleanup.");
  }

  let slugs = listKovBundleSlugs(args.root);
  if (args.slug) slugs = slugs.filter(slug => slug === args.slug);
  const excluded = new Set(
    args.excludeSlugs
      .filter(Boolean)
      .filter(slug => !args.slug || slug !== args.slug)
  );
  slugs = slugs.filter(slug => !excluded.has(slug));
  if (args.limit > 0) slugs = slugs.slice(0, args.limit);

  console.log(JSON.stringify({
    ok: true,
    action: args.dryRun ? "kov_web_batch_dry_run_start" : "kov_web_batch_ingest_start",
    root: args.root,
    count: slugs.length,
    excluded: [...excluded].sort()
  }, null, 2));

  const results = [];
  for (const slug of slugs) {
    const childArgs = ["scripts/ingest-kov-rag.mjs", path.join(args.root, slug)];
    if (args.skipValidate) childArgs.push("--skip-validate");
    if (args.dryRun) childArgs.push("--dry-run");
    if (args.replaceExisting) childArgs.push("--replace-existing");
    if (args.confirmCleanup) childArgs.push("--confirm-cleanup");
    const child = spawnSync(process.execPath, childArgs, {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 8
    });
    const stdout = String(child.stdout || "");
    const stderr = String(child.stderr || "");
    if (child.status === 0) {
      const itemDocs = (stdout.match(/item docs:\s*(\d+)/i) || [])[1] || null;
      const chunks = (stdout.match(/inserted chunks:\s*(\d+)/i) || [])[1] || null;
      console.log(`[ok] ${slug}${itemDocs ? ` items=${itemDocs}` : ""}${chunks ? ` chunks=${chunks}` : ""}`);
      results.push({ slug, ok: true, itemDocs, chunks });
      continue;
    }
    console.error(`[fail] ${slug} status=${child.status}`);
    if (stdout.trim()) console.error(stdout.trim().slice(-3000));
    if (stderr.trim()) console.error(stderr.trim().slice(-3000));
    results.push({ slug, ok: false, status: child.status });
    break;
  }

  const failed = results.filter(result => !result.ok);
  console.log(JSON.stringify({
    ok: failed.length === 0,
    action: args.dryRun ? "kov_web_batch_dry_run_done" : "kov_web_batch_ingest_done",
    attempted: results.length,
    succeeded: results.length - failed.length,
    failed
  }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(`[kov:ingest-web:batch] ${error?.message || String(error)}`);
  process.exitCode = 1;
});
