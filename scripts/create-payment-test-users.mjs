#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { hash } from "bcrypt";
import * as dotenv from "dotenv";

const SCRIPT = "payment-test-users";
const DEFAULT_CLIENT_EMAIL = "test-client@sotsiaal.ai";
const DEFAULT_WORKER_EMAIL = "test-social-worker@sotsiaal.ai";
const PIN_RE = /^\d{4,8}$/;

function log(message) {
  console.log(`[${SCRIPT}] ${message}`);
}

function fail(message, code = 1) {
  console.error(`[${SCRIPT}] ${message}`);
  process.exit(code);
}

function readArg(name) {
  const prefix = `--${name}=`;
  const direct = process.argv.find(arg => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length).trim();

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) {
    return process.argv[index + 1].trim();
  }
  return "";
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function env(name, fallback = "") {
  const value = process.env[name];
  if (value == null) return fallback;
  return String(value).trim();
}

function loadEnv() {
  const explicit = readArg("env-file") || env("PAYMENT_TEST_USERS_ENV_FILE");
  if (explicit) {
    const fullPath = path.resolve(process.cwd(), explicit);
    if (!fs.existsSync(fullPath)) {
      fail(`env file not found: ${explicit}`);
    }
    dotenv.config({ path: fullPath, override: false, quiet: true });
    log(`loaded env from ${explicit}`);
    return explicit;
  }

  const candidates = [".env.local", ".env", ".env.production", "production.env"];
  const loaded = [];
  for (const candidate of candidates) {
    const fullPath = path.resolve(process.cwd(), candidate);
    if (!fs.existsSync(fullPath)) continue;
    dotenv.config({ path: fullPath, override: false, quiet: true });
    loaded.push(candidate);
  }

  log(
    loaded.length
      ? `loaded env from ${loaded.join(", ")}`
      : "no env file loaded; using process environment"
  );
  return loaded[0] || "";
}

function normalizeEmail(value, label) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
    fail(`${label} email is invalid: ${email || "(empty)"}`);
  }
  return email;
}

function randomPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function resolvePin(label, specificEnvName, specificArgName, sharedPin) {
  const pin = readArg(specificArgName) || env(specificEnvName) || sharedPin;
  if (!PIN_RE.test(pin)) {
    fail(`${label} PIN must be 4-8 digits`);
  }
  return pin;
}

function planForRole(role) {
  return role === "SOCIAL_WORKER" ? "social_worker_monthly" : "client_monthly";
}

async function ensureInactiveSubscription(prisma, userId, role) {
  const latest = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      status: true,
      validUntil: true
    }
  });

  if (!latest) {
    const created = await prisma.subscription.create({
      data: {
        userId,
        status: "NONE",
        plan: planForRole(role)
      },
      select: { id: true }
    });
    return { action: "created_none", id: created.id };
  }

  const active =
    latest.status === "ACTIVE" &&
    (!latest.validUntil || new Date(latest.validUntil).getTime() > Date.now());

  if (active) {
    if (!hasFlag("reset-subscriptions")) {
      return { action: "active_left_unchanged", id: latest.id };
    }

    await prisma.subscription.updateMany({
      where: { userId, status: "ACTIVE" },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        validUntil: new Date(),
        nextBilling: null
      }
    });

    const created = await prisma.subscription.create({
      data: {
        userId,
        status: "NONE",
        plan: planForRole(role)
      },
      select: { id: true }
    });
    return { action: "canceled_active_created_none", id: created.id };
  }

  return { action: "inactive_exists", id: latest.id };
}

async function upsertUser(prisma, input) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      isAdmin: true,
      role: true
    }
  });

  if (existing?.isAdmin && !hasFlag("allow-admin-overwrite")) {
    fail(`refusing to overwrite admin account ${input.email}`);
  }

  const passwordHash = await hash(input.pin, 12);
  const now = new Date();
  const data = {
    email: input.email,
    passwordHash,
    role: input.role,
    isAdmin: false,
    emailVerified: now,
    emailVerificationSentAt: now
  };

  const user = existing
    ? await prisma.user.update({
        where: { email: input.email },
        data,
        select: { id: true, email: true, role: true }
      })
    : await prisma.user.create({
        data,
        select: { id: true, email: true, role: true }
      });

  const subscription = await ensureInactiveSubscription(prisma, user.id, input.role);
  return {
    user,
    created: !existing,
    subscription
  };
}

async function main() {
  loadEnv();

  const dryRun = hasFlag("dry-run");
  const generatedSharedPin = randomPin();
  const sharedPin = readArg("pin") || env("PAYMENT_TEST_PIN") || generatedSharedPin;

  const users = [
    {
      label: "client",
      email: normalizeEmail(
        readArg("client-email") || env("PAYMENT_TEST_CLIENT_EMAIL", DEFAULT_CLIENT_EMAIL),
        "client"
      ),
      pin: resolvePin("client", "PAYMENT_TEST_CLIENT_PIN", "client-pin", sharedPin),
      role: "CLIENT"
    },
    {
      label: "social worker",
      email: normalizeEmail(
        readArg("worker-email") || env("PAYMENT_TEST_WORKER_EMAIL", DEFAULT_WORKER_EMAIL),
        "social worker"
      ),
      pin: resolvePin("social worker", "PAYMENT_TEST_WORKER_PIN", "worker-pin", sharedPin),
      role: "SOCIAL_WORKER"
    }
  ];

  if (users[0].email === users[1].email) {
    fail("client and social worker emails must be different");
  }

  log(`client email: ${users[0].email}`);
  log(`social worker email: ${users[1].email}`);
  if (!readArg("pin") && !env("PAYMENT_TEST_PIN") && !env("PAYMENT_TEST_CLIENT_PIN") && !env("PAYMENT_TEST_WORKER_PIN")) {
    log(`generated PIN for both users: ${generatedSharedPin}`);
  }
  if (hasFlag("reset-subscriptions")) {
    log("reset-subscriptions enabled: active subscriptions for these test users will be canceled");
  }
  if (dryRun) {
    log("dry-run enabled; no database changes made");
    return;
  }

  if (!env("DATABASE_URL")) {
    fail("DATABASE_URL is missing");
  }

  const { prisma } = await import("../lib/prisma.js");

  try {
    for (const userInput of users) {
      const result = await upsertUser(prisma, userInput);
      log(
        `${result.created ? "created" : "updated"} ${userInput.label}: ${result.user.email} ` +
          `role=${result.user.role} subscription=${result.subscription.action}`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  fail(error?.stack || error?.message || String(error));
});
