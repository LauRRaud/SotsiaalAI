import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const requiredEnv = `
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://sotsiaal.ai
APP_URL=https://sotsiaal.ai
NEXTAUTH_URL=https://sotsiaal.ai
NEXTAUTH_SECRET=test-secret
DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/sotsiaal_ai
OPENAI_API_KEY=test-openai
RAG_SERVICE_API_KEY=test-rag-service-key
RAG_INTERNAL_HOST=127.0.0.1:8000
RAG_API_BASE=http://127.0.0.1:8000
EMAIL_FROM=info@sotsiaal.ai
`;

function checkOsrmUrl(value) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sotsiaalai-osrm-env-"));
  const file = path.join(dir, ".env.production");
  fs.writeFileSync(file, `${requiredEnv}SERVICE_LOG_OSRM_URL=${value}\n`, "utf8");
  const env = { ...process.env };
  delete env.SERVICE_LOG_OSRM_URL;
  const result = spawnSync(process.execPath, ["scripts/check-env.mjs", file], {
    cwd: process.cwd(),
    encoding: "utf8",
    env
  });
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

test("production env check rejects an external OSRM endpoint", () => {
  const result = checkOsrmUrl("https://attacker.example/osrm");
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /SERVICE_LOG_OSRM_URL must be .*127\.0\.0\.1/);
});

test("production env check accepts the local OSRM endpoint", () => {
  const result = checkOsrmUrl("http://127.0.0.1:5000");
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
