#!/usr/bin/env node
/**
 * SOL-XFUNC-01/-02 authenticated runtime fixture and PostgreSQL proof.
 *
 * The fixture contains two local synthetic identities and is written only to
 * the explicitly supplied temporary path. The script never prints PINs or
 * connection credentials. `--cleanup` drops only its validated temporary DB.
 */

import { spawnSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcrypt";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";

const args = new Map(
  process.argv.slice(2).map(argument => {
    const [key, ...rest] = argument.split("=");
    return [key, rest.join("=")];
  })
);
const fixturePath = String(args.get("--fixture") || "").trim();
const mode = args.has("--prepare")
  ? "prepare"
  : args.has("--verify")
    ? "verify"
    : args.has("--cleanup")
      ? "cleanup"
      : "";

if (!fixturePath || !mode) {
  throw new Error("Kasuta --prepare|--verify|--cleanup --fixture=<ajutine fail>");
}

function localDatabaseUrl(value) {
  const url = new URL(String(value || ""));
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error("XFUNC sond kasutab ainult localhosti PostgreSQL-i");
  }
  return url;
}

function validatedDatabaseName(value) {
  const name = String(value || "");
  if (!/^sotsiaal_ai_xfunc_probe_\d+$/.test(name)) {
    throw new Error("Ajutise XFUNC andmebaasi nimi ei ole lubatud");
  }
  return name;
}

function adminUrlFor(source) {
  const url = new URL(source);
  url.pathname = "/postgres";
  url.search = "";
  return url;
}

function runPrisma(databaseUrl) {
  const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`prisma migrate deploy kukkus koodiga ${result.status}`);
}

async function prepare() {
  if (existsSync(fixturePath)) throw new Error("Ajutine fixture-fail on juba olemas");
  const envPath = `${fixturePath}.env`;
  if (existsSync(envPath)) throw new Error("Ajutine env-fail on juba olemas");
  const source = localDatabaseUrl(process.env.DATABASE_URL);
  const databaseName = validatedDatabaseName(`sotsiaal_ai_xfunc_probe_${Date.now()}`);
  const databaseUrl = new URL(source);
  databaseUrl.pathname = `/${databaseName}`;
  databaseUrl.search = "";

  const admin = new pg.Client({ connectionString: adminUrlFor(source).toString() });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await admin.end();
  }

  runPrisma(databaseUrl.toString());
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl.toString() }),
    log: []
  });
  try {
    const suffix = databaseName.replace("sotsiaal_ai_xfunc_probe_", "");
    const pin = String(randomInt(100000, 1000000));
    const passwordHash = await hash(pin, 12);
    const now = new Date();
    const adminUser = await db.user.create({
      data: {
        email: `xfunc-admin-${suffix}@synthetic.invalid`,
        role: "ADMIN",
        isAdmin: true,
        ragAdminCapability: "PLATFORM_ADMIN",
        emailVerified: now,
        passwordHash
      }
    });
    const memberUser = await db.user.create({
      data: {
        email: `xfunc-member-${suffix}@synthetic.invalid`,
        role: "SOCIAL_WORKER",
        emailVerified: now,
        passwordHash,
        subscriptions: {
          create: {
            status: "ACTIVE",
            plan: "xfunc-pro",
            planDefinition: {
              create: {
                key: "xfunc-pro",
                name: "XFUNC synthetic runtime",
                role: "SOCIAL_WORKER",
                price: 0
              }
            },
            validUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000)
          }
        }
      }
    });

    const makeRoom = ({ title, originType, archivedAt = null, memberRole = "MEMBER" }) =>
      db.room.create({
        data: {
          ownerId: adminUser.id,
          title,
          description: "Sünteetiline XFUNC brauseritõend",
          originType,
          archivedAt,
          members: {
            create: [
              { userId: adminUser.id, role: "OWNER" },
              { userId: memberUser.id, role: memberRole }
            ]
          }
        }
      });

    const manual = await makeRoom({ title: "XFUNC käsitsi", originType: "MANUAL_INVITE" });
    const preInquiry = await makeRoom({ title: "XFUNC eelpöördumine", originType: "PRE_INQUIRY", memberRole: "MODERATOR" });
    const helpMatch = await makeRoom({ title: "XFUNC abisobitus", originType: "HELP_MATCH" });
    const archived = await makeRoom({ title: "XFUNC arhiveeritud", originType: "PRE_INQUIRY", archivedAt: now });

    writeFileSync(fixturePath, JSON.stringify({
      databaseName,
      databaseUrl: databaseUrl.toString(),
      pin,
      accounts: {
        admin: { id: adminUser.id, email: adminUser.email },
        member: { id: memberUser.id, email: memberUser.email }
      },
      rooms: {
        manual: manual.id,
        preInquiry: preInquiry.id,
        helpMatch: helpMatch.id,
        archived: archived.id
      }
    }), { encoding: "utf8", mode: 0o600, flag: "wx" });
    writeFileSync(envPath, [
      `DATABASE_URL=${databaseUrl.toString()}`,
      "NEXTAUTH_URL=http://localhost:3000",
      "AUTH_URL=http://localhost:3000",
      "AUTH_SECRET=xfunc-local-runtime-only-not-production-20260813",
      "LOGIN_ALLOW_DIRECT_PIN=true",
      `LOGIN_OTP_BYPASS_EMAILS=${memberUser.email}`,
      "U1_OUTBOX_ENABLED=false",
      ""
    ].join("\n"), { encoding: "utf8", mode: 0o600, flag: "wx" });
    process.stdout.write("PROBE_READY accounts=2 rooms=4\n");
  } finally {
    await db.$disconnect();
  }
}

async function verify() {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  const dbUrl = localDatabaseUrl(fixture.databaseUrl).toString();
  validatedDatabaseName(fixture.databaseName);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }), log: [] });
  try {
    const [manual, preInquiry, helpMatch, archived, accountCount] = await Promise.all([
      db.room.findUnique({ where: { id: fixture.rooms.manual }, select: { id: true } }),
      db.room.findUnique({ where: { id: fixture.rooms.preInquiry }, select: { archivedAt: true } }),
      db.room.findUnique({ where: { id: fixture.rooms.helpMatch }, select: { archivedAt: true } }),
      db.room.findUnique({ where: { id: fixture.rooms.archived }, select: { archivedAt: true } }),
      db.user.count({ where: { id: { in: [fixture.accounts.admin.id, fixture.accounts.member.id] } } })
    ]);
    if (manual !== null) throw new Error("MANUAL_INVITE ruum jäi pärast kustutamist alles");
    if (!preInquiry?.archivedAt) throw new Error("PRE_INQUIRY ruum ei arhiveerunud");
    if (helpMatch?.archivedAt) throw new Error("HELP_MATCH negatiivkontroll muutis ruumi");
    if (!archived?.archivedAt) throw new Error("algselt arhiveeritud ruum kaotas seisu");
    if (accountCount !== 2) throw new Error("kahe sünteetilise konto tõend ei püsinud");
    process.stdout.write("PROBE_OK accounts=2 delete=1 archive=1 unchanged=2\n");
  } finally {
    await db.$disconnect();
  }
}

async function cleanup() {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  const databaseUrl = localDatabaseUrl(fixture.databaseUrl);
  const databaseName = validatedDatabaseName(fixture.databaseName);
  const admin = new pg.Client({ connectionString: adminUrlFor(databaseUrl).toString() });
  await admin.connect();
  try {
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [databaseName]);
    await admin.query(`DROP DATABASE "${databaseName}"`);
  } finally {
    await admin.end();
  }
  unlinkSync(fixturePath);
  const envPath = `${fixturePath}.env`;
  if (existsSync(envPath)) unlinkSync(envPath);
  process.stdout.write("PROBE_CLEAN\n");
}

if (mode === "prepare") await prepare();
if (mode === "verify") await verify();
if (mode === "cleanup") await cleanup();
