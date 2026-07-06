#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const boolTrue = new Set(["1", "true", "yes", "on"]);

function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const out = {};
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#")) continue;

    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = normalized.indexOf("=");
    if (eq <= 0) continue;

    const key = normalized.slice(0, eq).trim();
    let value = normalized.slice(eq + 1).trim();
    if (!key) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }
  return out;
}

function pickEnvSource(argPath) {
  if (argPath) {
    const full = path.isAbsolute(argPath) ? argPath : path.resolve(rootDir, argPath);
    if (!fs.existsSync(full)) {
      throw new Error(`Env file not found: ${full}`);
    }
    return full;
  }

  const candidates = [".env.production", "production.env", ".env.local", ".env"];
  for (const rel of candidates) {
    const full = path.resolve(rootDir, rel);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function isNonEmpty(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isLocalhostHost(host) {
  const value = String(host || "").trim().toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "::1" || value === "[::1]";
}

function isHttpsRequiredUrl(key) {
  return ["NEXT_PUBLIC_SITE_URL", "APP_URL", "NEXTAUTH_URL"].includes(key);
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map(part => part.trim().toLowerCase())
    .filter(Boolean);
}

function toNumber(value, fallback = NaN) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function main() {
  const explicitArg = String(process.argv[2] || "").trim();
  const sourceFile = pickEnvSource(explicitArg);
  const fileVars = sourceFile ? parseEnvFile(sourceFile) : {};
  const env = { ...fileVars, ...process.env };

  const errors = [];
  const warnings = [];

  const requiredKeys = [
    "NEXT_PUBLIC_SITE_URL",
    "APP_URL",
    "NEXTAUTH_URL",
    "NEXTAUTH_SECRET",
    "DATABASE_URL",
    "OPENAI_API_KEY",
    "RAG_SERVICE_API_KEY",
    "RAG_INTERNAL_HOST",
    "RAG_API_BASE",
    "EMAIL_FROM"
  ];

  for (const key of requiredKeys) {
    if (!isNonEmpty(env[key])) errors.push(`Missing required key: ${key}`);
  }

  const placeholderPattern = /<[^>]+>/;
  for (const [key, value] of Object.entries(env)) {
    if (!isNonEmpty(value)) continue;
    if (placeholderPattern.test(value)) {
      errors.push(`Placeholder value detected in ${key}`);
    }
  }

  for (const key of ["NEXT_PUBLIC_SITE_URL", "APP_URL", "NEXTAUTH_URL", "RAG_API_BASE"]) {
    const value = String(env[key] || "").trim();
    if (!value) continue;
    let url;
    try {
      url = new URL(value);
    } catch {
      errors.push(`Invalid URL in ${key}: ${value}`);
      continue;
    }

    if (isHttpsRequiredUrl(key) && url.protocol !== "https:" && !isLocalhostHost(url.hostname)) {
      errors.push(`${key} must use https in production (got: ${value})`);
    }
  }

  const dbUrlRaw = String(env.DATABASE_URL || "").trim();
  if (dbUrlRaw) {
    try {
      const dbUrl = new URL(dbUrlRaw);
      const localDb = isLocalhostHost(dbUrl.hostname);
      const sslmode = String(dbUrl.searchParams.get("sslmode") || "").toLowerCase();
      if (!localDb && sslmode !== "verify-full") {
        errors.push("DATABASE_URL for external DB must include sslmode=verify-full");
      }
    } catch {
      errors.push("DATABASE_URL is not a valid URL");
    }
  }

  const authSecret = String(env.AUTH_SECRET || "").trim();
  const nextAuthSecret = String(env.NEXTAUTH_SECRET || "").trim();
  if (authSecret && nextAuthSecret && authSecret !== nextAuthSecret) {
    errors.push("AUTH_SECRET and NEXTAUTH_SECRET are both set but differ");
  }

  for (const [key, valueRaw] of Object.entries(env)) {
    if (!key.startsWith("NEXT_PUBLIC_")) continue;
    const value = String(valueRaw || "");
    if (/(SECRET|PASSWORD|PASS|TOKEN|PRIVATE|API_KEY)/i.test(key)) {
      errors.push(`Sensitive-looking NEXT_PUBLIC key detected: ${key}`);
    }
    if (/sk-[a-zA-Z0-9_-]{20,}/.test(value) || /-----BEGIN [A-Z ]+-----/.test(value)) {
      errors.push(`Sensitive-looking value leaked into ${key}`);
    }
  }

  const chunkModeRaw = String(env.RAG_CHUNK_MODE || "").trim().toLowerCase();
  const chunkMode = chunkModeRaw || "tokens";
  const hasTokenChunk = isNonEmpty(env.RAG_CHUNK_TOKENS) || isNonEmpty(env.RAG_CHUNK_TOKENS_OVERLAP);
  const hasCharChunk = isNonEmpty(env.RAG_CHUNK_SIZE) || isNonEmpty(env.RAG_CHUNK_OVERLAP);

  if (chunkModeRaw && !["tokens", "chars"].includes(chunkMode)) {
    errors.push(`Invalid RAG_CHUNK_MODE: ${chunkMode}`);
  } else if (chunkModeRaw) {
    if (chunkMode === "tokens") {
      if (!hasTokenChunk) errors.push("RAG_CHUNK_MODE=tokens requires RAG_CHUNK_TOKENS and RAG_CHUNK_TOKENS_OVERLAP");
      if (hasCharChunk) errors.push("RAG_CHUNK_MODE=tokens should not set RAG_CHUNK_SIZE/RAG_CHUNK_OVERLAP");
    } else if (chunkMode === "chars") {
      if (!hasCharChunk) errors.push("RAG_CHUNK_MODE=chars requires RAG_CHUNK_SIZE and RAG_CHUNK_OVERLAP");
      if (hasTokenChunk) errors.push("RAG_CHUNK_MODE=chars should not set RAG_CHUNK_TOKENS/RAG_CHUNK_TOKENS_OVERLAP");
    }
  } else if (hasTokenChunk && hasCharChunk) {
    errors.push("Set only one chunking style: token-based or char-based");
  }

  const allowedMime = parseCsv(env.RAG_ALLOWED_MIME || env.NEXT_PUBLIC_RAG_ALLOWED_MIME);
  if (allowedMime.includes("text/html")) {
    errors.push("RAG_ALLOWED_MIME should not include text/html in production hardening profile");
  }
  if (allowedMime.includes("application/msword")) {
    errors.push("RAG_ALLOWED_MIME should not include application/msword in production hardening profile");
  }

  const serverMaxMb = toNumber(
    env.RAG_SERVER_MAX_MB || env.RAG_MAX_UPLOAD_MB || env.NEXT_PUBLIC_RAG_MAX_UPLOAD_MB,
    25
  );
  if (serverMaxMb > 25) {
    errors.push(`Upload limit is too high for hardened profile (${serverMaxMb}MB > 25MB)`);
  }
  const publicMaxMb = toNumber(env.NEXT_PUBLIC_RAG_MAX_UPLOAD_MB, serverMaxMb);
  if (serverMaxMb !== publicMaxMb) {
    warnings.push(`RAG server/public max upload mismatch (${serverMaxMb}MB vs ${publicMaxMb}MB)`);
  }

  const smtpSecure = boolTrue.has(String(env.SMTP_SECURE || "").trim().toLowerCase());
  const smtpRequireTls = boolTrue.has(String(env.SMTP_REQUIRE_TLS || "").trim().toLowerCase());
  if (!smtpSecure && !smtpRequireTls) {
    warnings.push("SMTP is not implicit TLS and SMTP_REQUIRE_TLS is not enabled");
  }

  const returnUrl = String(env.MAKSEKESKUS_RETURN_URL || "").trim();
  const cancelUrl = String(env.MAKSEKESKUS_CANCEL_URL || "").trim();
  if (returnUrl.includes("status=") || cancelUrl.includes("status=")) {
    warnings.push("Payment callback status query params are UI hints only; webhook must remain source of truth");
  }

  const recurringEnabled = boolTrue.has(String(env.SUBSCRIPTION_RECURRING_ENABLED || "").trim().toLowerCase());
  if (recurringEnabled && !isNonEmpty(env.MAKSEKESKUS_PUBLIC_KEY)) {
    errors.push("SUBSCRIPTION_RECURRING_ENABLED=1 requires MAKSEKESKUS_PUBLIC_KEY");
  }

  const retentionKeys = [
    "DATA_RETENTION_DAYS",
    "CONVERSATION_TTL_DAYS",
    "PAYMENT_RETENTION_DAYS",
    "PAYMENT_RAW_RETENTION_DAYS",
    "LOG_RETENTION_DAYS"
  ];

  for (const key of retentionKeys) {
    if (isNonEmpty(env[key]) && toNumber(env[key], 0) <= 0) {
      errors.push(`${key} must be a positive number of days`);
    }
  }
  if (env.NODE_ENV === "production") {
    for (const key of retentionKeys) {
      if (!isNonEmpty(env[key])) {
        warnings.push(`${key} is not set; production will use application defaults`);
      }
    }
  }

  const ragDeleteFlag = String(env.RAG_DELETE_ON_DOCUMENT_DELETE || "").trim().toLowerCase();
  if (ragDeleteFlag && !["1", "0", "true", "false", "yes", "no", "on", "off"].includes(ragDeleteFlag)) {
    errors.push("RAG_DELETE_ON_DOCUMENT_DELETE must be a boolean-like value");
  }
  if (env.NODE_ENV === "production" && !ragDeleteFlag) {
    warnings.push("RAG_DELETE_ON_DOCUMENT_DELETE is not set; document deletes will leave RAG cleanup marked as skipped");
  }

  if (isNonEmpty(env.BACKUP_RETENTION_DAYS)) {
    warnings.push("BACKUP_RETENTION_DAYS is documentation/ops policy only; the app does not enforce backup deletion");
  }

  if (sourceFile) {
    console.log(`[env:check] Source: ${path.relative(rootDir, sourceFile)}`);
  } else {
    console.log("[env:check] Source: process.env only");
  }

  if (warnings.length) {
    console.log("[env:check] Warnings:");
    for (const warning of warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (errors.length) {
    console.error("[env:check] FAILED:");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log("[env:check] OK");
}

try {
  main();
} catch (error) {
  console.error("[env:check] Failed:", error?.message || String(error));
  process.exit(1);
}
