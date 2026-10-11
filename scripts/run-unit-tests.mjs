#!/usr/bin/env node
// `npm test`: kõik `tests/*.test.mjs` failid. Neid on meelega vähe (omaniku otsus 11.10.2026,
// `AGENTS.md` jaotis „Kontrollid“): ainult testid, mille viga tähendaks päris kahju.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const testsDir = path.resolve("tests");
const files = fs
  .readdirSync(testsDir)
  .filter(name => name.endsWith(".test.mjs"))
  .filter(name => !name.endsWith(".integration.test.mjs"))
  .sort()
  .map(name => path.join("tests", name));

if (files.length === 0) {
  console.error("[test] No unit test files found");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--import", "./scripts/register-node-source-loader.mjs", "--test", ...files],
  /* BUSINESS_REGISTER_LIVE=off: ükski test ei küsi äriregistrit võrgust (lib/businessRegisterNameCheck.js);
     otsepäringu testid annavad võltspäringu ise ette. */
  { stdio: "inherit", env: { ...process.env, TZ: "UTC", BUSINESS_REGISTER_LIVE: "off" } }
);

if (result.error) {
  console.error(`[test] ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
