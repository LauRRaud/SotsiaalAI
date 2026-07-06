// Sweep runner: loops auto-loop.mjs over a config of {file, route, auth,
// selectors, props}. Each entry is independent — auto-loop gates and reverts on
// red, auto-commits on green (with the autostrip contract pre-filter). Safe to
// run unattended: worst case an entry strips nothing or self-reverts. Public
// routes only by default (auth routes are unattended-untrustworthy: a stale
// session silently renders the login page → captures nothing → 0 strips, which
// is safe, just useless).
//
// Usage: SNAPSHOT_SESSION=... node scripts/css-cleanup/sweep.mjs --config <json> [--no-commit]
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
let config = "reports/css-cleanup/state/sweep-config.json";
let commit = true;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--config") config = argv[++i];
  else if (argv[i] === "--no-commit") commit = false;
}
const entries = JSON.parse(readFileSync(config, "utf8"));
const results = [];
for (const e of entries) {
  const a = ["scripts/css-cleanup/auto-loop.mjs", "--file", e.file, "--route", e.route,
    "--selectors", e.selectors.join(","), "--props", e.props.join(",")];
  if (e.auth) a.push("--auth");
  if (commit) a.push("--commit");
  console.log(`\n${"#".repeat(60)}\n# ${e.file}  (${e.route})\n${"#".repeat(60)}`);
  const r = spawnSync("node", a, { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
  results.push({ file: e.file, code: r.status });
}
console.log(`\n${"=".repeat(60)}\nSWEEP DONE`);
for (const r of results) console.log(`  ${r.code === 0 ? "🟢" : "·"}  exit=${r.code}  ${r.file}`);
