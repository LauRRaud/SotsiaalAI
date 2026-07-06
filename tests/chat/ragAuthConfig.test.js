import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const envCheckPath = path.join(repoRoot, "scripts", "check-env.mjs");
const envExamplePath = path.join(repoRoot, ".env.example");
const selftestRoutePath = path.join(repoRoot, "app", "api", "rag", "selftest", "route.js");
const chatSettingsPath = path.join(repoRoot, "lib", "chat", "settings.js");
const ragAuthPath = path.join(repoRoot, "lib", "server", "ragAuth.js");

function writeTempEnv(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sotsiaalai-rag-auth-"));
  const file = path.join(dir, ".env.production");
  fs.writeFileSync(file, contents, "utf8");
  return { dir, file };
}

function runEnvCheck(envFile) {
  return spawnSync(process.execPath, [envCheckPath, envFile], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

test("production env check fails when RAG_SERVICE_API_KEY is missing", () => {
  const { dir, file } = writeTempEnv(`
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://sotsiaal.ai
APP_URL=https://sotsiaal.ai
NEXTAUTH_URL=https://sotsiaal.ai
NEXTAUTH_SECRET=test-secret
DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/sotsiaal_ai
OPENAI_API_KEY=test-openai
RAG_INTERNAL_HOST=127.0.0.1:8000
RAG_API_BASE=http://127.0.0.1:8000
EMAIL_FROM=info@sotsiaal.ai
RAG_ALLOWED_MIME=application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document
`);

  try {
    const result = runEnvCheck(file);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stderr, /Missing required key: RAG_SERVICE_API_KEY/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("production env check does not require legacy RAG_API_KEY", () => {
  const { dir, file } = writeTempEnv(`
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
RAG_ALLOWED_MIME=application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document
`);

  try {
    const result = runEnvCheck(file);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /RAG_API_KEY/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("RAG auth config removes legacy key references from shipped config and routes", () => {
  // .env.example kustutati 2026-07 repo-puhastuses (dd93be2a) — auditeerime
  // ainult reaalselt tarnitavaid faile.
  const selftestRoute = fs.readFileSync(selftestRoutePath, "utf8");
  const chatSettings = fs.readFileSync(chatSettingsPath, "utf8");
  const ragAuth = fs.readFileSync(ragAuthPath, "utf8");

  assert.doesNotMatch(selftestRoute, /RAG_API_KEY/);
  assert.doesNotMatch(chatSettings, /\bRAG_KEY\b/);
  assert.match(ragAuth, /process\.env\.RAG_SERVICE_API_KEY/);
});
