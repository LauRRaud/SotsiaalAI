#!/usr/bin/env node
/** SOL-SPROF-09…15 — real PostgreSQL limits, audit rollback and replay probe. */

import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { upsertServiceProviderProfileForOwner } from "../lib/serviceProviderProfiles.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const fallbackUrl = "postgresql://sotsiaal_user:sotsiaalai@localhost:5432/sotsiaal_ai?schema=public";
const parsed = new URL(String(process.env.DATABASE_URL || fallbackUrl).trim());
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`SPROF peatükisond loob ajutise andmebaasi ainult localhostil (host=${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_sprof_chapter_probe_${Date.now()}`;
if (!/^sotsiaal_ai_sprof_chapter_probe_\d+$/u.test(databaseName)) throw new Error("Ebaturvaline ajutise andmebaasi nimi");
const adminUrl = new URL(parsed); adminUrl.pathname = "/postgres"; adminUrl.search = "";
const probeUrl = new URL(parsed); probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const loader = new URL("./register-node-test-loader.mjs", import.meta.url).href;
const worker = fileURLToPath(new URL("./service-profile-chapter-probe-worker.mjs", import.meta.url));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });

let passed = 0;
function check(label, condition) {
  if (!condition) throw new Error(`PROBE_FAIL ${label}`);
  passed += 1;
  console.log(`  PASS  ${label}`);
}
function migrate() {
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false
  });
  if (result.status !== 0) throw new Error(`prisma migrate deploy failed (${result.status})\n${result.stderr}`);
}
function runRateWorker(userId, count) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", loader, worker, userId, "profile:write", String(count)], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: probeUrl.toString() },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`rate worker failed (${code}) ${stderr}`));
      const line = stdout.split(/\r?\n/u).find((entry) => entry.startsWith("SPROF_RATE_RESULT "));
      if (!line) return reject(new Error(`rate worker returned no result: ${stdout}`));
      resolve(JSON.parse(line.slice("SPROF_RATE_RESULT ".length)));
    });
  });
}
function inputFrom(profile, overrides = {}) {
  return {
    organizationName: profile.organizationName,
    status: profile.status,
    mapVisible: profile.mapVisible,
    assistantRecommendationAllowed: profile.assistantRecommendationAllowed,
    acceptsPlatformPreInquiries: profile.acceptsPlatformPreInquiries,
    acceptsEmailPreInquiries: profile.acceptsEmailPreInquiries,
    phone: profile.phone || "",
    expectedUpdatedAt: profile.updatedAt,
    serviceItems: (profile.serviceItems || []).map((service) => ({
      id: service.id,
      name: service.name,
      status: service.status,
      mapVisible: service.mapVisible,
      acceptsPlatformPreInquiries: service.acceptsPlatformPreInquiries
    })),
    serviceLocations: (profile.serviceLocations || []).map((location) => ({
      id: location.id,
      label: location.label,
      status: location.status,
      mapVisible: location.mapVisible
    })),
    ...overrides
  };
}
async function save(ownerId, input, idempotencyKey, correlationId = idempotencyKey) {
  return upsertServiceProviderProfileForOwner(ownerId, input, {
    db,
    syncRag: false,
    idempotencyKey,
    correlationId
  });
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  migrate();
  const owner = await db.user.create({
    data: { email: "sprof-chapter-owner@example.test", role: "SERVICE_PROVIDER", emailVerified: new Date() }
  });
  const initialInput = {
    organizationName: "SPROF peatükisond",
    status: "PUBLISHED",
    mapVisible: true,
    assistantRecommendationAllowed: true,
    acceptsPlatformPreInquiries: true,
    acceptsEmailPreInquiries: false,
    serviceItems: [
      { name: "Avalik teenus", status: "PUBLISHED", mapVisible: true, acceptsPlatformPreInquiries: true },
      { name: "Peidetud markerteenus", status: "HIDDEN", mapVisible: true, acceptsPlatformPreInquiries: true }
    ],
    serviceLocations: [
      { label: "Peidetud markerkoht", status: "HIDDEN", mapVisible: true }
    ]
  };
  const concurrentOwner = await db.user.create({
    data: { email: "sprof-chapter-concurrent@example.test", role: "SERVICE_PROVIDER", emailVerified: new Date() }
  });
  const concurrentInput = { ...initialInput, organizationName: "SPROF paralleelsond" };
  const concurrent = await Promise.all([
    save(concurrentOwner.id, concurrentInput, "sprof-probe-concurrent-save"),
    save(concurrentOwner.id, concurrentInput, "sprof-probe-concurrent-save")
  ]);
  check("SPROF-12 sama võtme samaaegsed PUT-id annavad ühe profiili, receipt'i ja RAG-töö",
    concurrent[0].id === concurrent[1].id
      && await db.serviceProviderProfile.count({ where: { ownerId: concurrentOwner.id, ownershipMode: "SOLO" } }) === 1
      && await db.serviceProviderProfileRagJob.count({ where: { profileId: concurrent[0].id } }) === 1
      && await db.domainEvent.count({ where: { sourceId: concurrent[0].id, type: "SERVICE_PROVIDER_PROFILE_SAVE_ACCEPTED" } }) === 1);
  const initial = await save(owner.id, initialInput, "sprof-probe-save-0001");
  const initialJobs = await db.serviceProviderProfileRagJob.count({ where: { profileId: initial.id } });
  const replay = await save(owner.id, initialInput, "sprof-probe-save-0001");
  check("SPROF-12 sama võti tagastab sama profiili ja loob ühe RAG-revisjoni", replay.id === initial.id
    && initialJobs === 1
    && await db.serviceProviderProfileRagJob.count({ where: { profileId: initial.id } }) === 1);
  await assertReject(
    () => save(owner.id, { ...initialInput, organizationName: "Teistsugune sisu" }, "sprof-probe-save-0001"),
    "service_provider_profile.errors.idempotency_conflict",
    "SPROF-12 sama võtme teistsugune sisu lükatakse tagasi"
  );

  const rateResults = await Promise.all([runRateWorker(owner.id, 12), runRateWorker(owner.id, 12)]);
  check("SPROF-12 kahe protsessi ühine PostgreSQL-i piiraja annab pärast 20 päringut 429 otsuse",
    rateResults.reduce((sum, result) => sum + result.allowed, 0) === 20
      && rateResults.reduce((sum, result) => sum + result.denied, 0) === 4);

  let current = await db.serviceProviderProfile.findUnique({
    where: { id: initial.id }, include: { serviceItems: true, serviceLocations: true }
  });
  const unrelated = await save(owner.id, {
    ...inputFrom(current, { phone: "+372 5555 0101" }),
    serviceItems: current.serviceItems.map((service) => ({ ...service, status: "PUBLISHED" })),
    serviceLocations: current.serviceLocations.map((location) => ({ ...location, status: "PUBLISHED" }))
  }, "sprof-probe-save-0002");
  check("SPROF-14 telefonimuutus ei ava peidetud teenust ega teeninduskohta",
    unrelated.serviceItems.find((service) => service.name === "Peidetud markerteenus")?.status === "HIDDEN"
      && unrelated.serviceLocations.find((location) => location.label === "Peidetud markerkoht")?.status === "HIDDEN");

  current = unrelated;
  const extraServices = Array.from({ length: 39 }, (_, index) => ({
    providerProfileId: current.id,
    name: index === 38 ? "CRITICAL_41ST_SERVICE_MARKER" : `Lisateenus ${index + 1}`,
    status: "HIDDEN",
    mapVisible: false
  }));
  await db.serviceProviderService.createMany({ data: extraServices });
  let rows = await db.serviceProviderService.findMany({ where: { providerProfileId: current.id }, orderBy: { name: "asc" } });
  await assertReject(
    () => save(owner.id, {
      ...inputFrom(current),
      serviceItems: rows.map((service) => ({ id: service.id, name: service.name, status: service.status, mapVisible: service.mapVisible }))
    }, "sprof-probe-over-limit-services"),
    "service_provider_profile.errors.too_many_services",
    "SPROF-09 41. teenus lükatakse tagasi"
  );
  check("SPROF-09 tagasilükkamine säilitab olemasoleva 41. kriitilise rea",
    await db.serviceProviderService.count({ where: { providerProfileId: current.id } }) === 41
      && await db.serviceProviderService.count({ where: { providerProfileId: current.id, name: "CRITICAL_41ST_SERVICE_MARKER" } }) === 1);
  await db.serviceProviderService.deleteMany({
    where: { providerProfileId: current.id, name: { startsWith: "Lisateenus" } }
  });
  await db.serviceProviderService.deleteMany({
    where: { providerProfileId: current.id, name: "CRITICAL_41ST_SERVICE_MARKER" }
  });

  const originalName = current.organizationName;
  await assertReject(
    () => save(owner.id, { ...inputFrom(current), organizationName: `${"x".repeat(996)}TAIL!` }, "sprof-probe-over-limit-text"),
    "service_provider_profile.errors.field_too_long",
    "SPROF-09 kriitilise sabamarkeriga 1001. märk lükatakse tagasi"
  );
  check("SPROF-09 teksti tagasilükkamine ei muuda varasemat väärtust",
    (await db.serviceProviderProfile.findUnique({ where: { id: current.id } })).organizationName === originalName);

  await db.serviceProviderLocation.createMany({
    data: Array.from({ length: 30 }, (_, index) => ({
      providerProfileId: current.id,
      label: index === 29 ? "CRITICAL_31ST_LOCATION_MARKER" : `Lisakoht ${index + 1}`,
      status: "HIDDEN",
      mapVisible: false
    }))
  });
  const locationRows = await db.serviceProviderLocation.findMany({
    where: { providerProfileId: current.id }, orderBy: { label: "asc" }
  });
  await assertReject(
    () => save(owner.id, {
      ...inputFrom(current),
      serviceLocations: locationRows.map((location) => ({
        id: location.id,
        label: location.label,
        status: location.status,
        mapVisible: location.mapVisible
      }))
    }, "sprof-probe-over-limit-locations"),
    "service_provider_profile.errors.too_many_locations",
    "SPROF-09 31. teeninduskoht lükatakse tagasi"
  );
  check("SPROF-09 tagasilükkamine säilitab olemasoleva 31. kriitilise tegevuskoha",
    await db.serviceProviderLocation.count({ where: { providerProfileId: current.id } }) === 31
      && await db.serviceProviderLocation.count({
        where: { providerProfileId: current.id, label: "CRITICAL_31ST_LOCATION_MARKER" }
      }) === 1);
  await db.serviceProviderLocation.deleteMany({
    where: { providerProfileId: current.id, OR: [
      { label: { startsWith: "Lisakoht" } },
      { label: "CRITICAL_31ST_LOCATION_MARKER" }
    ] }
  });

  current = await db.serviceProviderProfile.findUnique({
    where: { id: current.id }, include: { serviceItems: true, serviceLocations: true }
  });
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION fail_sprof_transition_probe() RETURNS trigger AS $$
    BEGIN
      IF NEW.type = 'SERVICE_PROVIDER_PROFILE_PUBLICATION_CONSENT_CHANGED' THEN
        RAISE EXCEPTION 'INJECTED_AUDIT_SECRET_MARKER';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER sprof_transition_probe_failure
      BEFORE INSERT ON "DomainEvent"
      FOR EACH ROW EXECUTE FUNCTION fail_sprof_transition_probe();
  `);
  const withdrawalInput = inputFrom(current, {
    status: "HIDDEN",
    mapVisible: false,
    assistantRecommendationAllowed: false,
    acceptsPlatformPreInquiries: false,
    acceptsEmailPreInquiries: false
  });
  const ragJobsBeforeFailure = await db.serviceProviderProfileRagJob.count({ where: { profileId: current.id } });
  const childrenBeforeFailure = await db.serviceProviderService.count({ where: { providerProfileId: current.id } });
  let injectedError = null;
  try {
    await save(owner.id, withdrawalInput, "sprof-probe-withdrawal", "corr-audit-secret");
  } catch (error) {
    injectedError = error;
  }
  const failedReceipts = await db.domainEvent.findMany({
    where: { sourceId: current.id, type: "SERVICE_PROVIDER_PROFILE_SAVE_ACCEPTED" }
  });
  check("SPROF-11 auditi sisestusviga veeretab profiili, lapsed, RAG-töö ja receipt'i tagasi",
    String(injectedError?.message || injectedError).includes("INJECTED_AUDIT_SECRET_MARKER")
      && (await db.serviceProviderProfile.findUnique({ where: { id: current.id } })).status === "PUBLISHED"
      && await db.serviceProviderProfileRagJob.count({ where: { profileId: current.id } }) === ragJobsBeforeFailure
      && await db.serviceProviderService.count({ where: { providerProfileId: current.id } }) === childrenBeforeFailure
      && !failedReceipts.some((event) => event.meta?.correlationId === "corr-audit-secret"));
  await db.$executeRawUnsafe(`DROP TRIGGER sprof_transition_probe_failure ON "DomainEvent"; DROP FUNCTION fail_sprof_transition_probe();`);

  const withdrawn = await save(owner.id, withdrawalInput, "sprof-probe-withdrawal", "corr-audit-secret");
  const transitionCount = await db.domainEvent.count({
    where: { sourceId: current.id, type: "SERVICE_PROVIDER_PROFILE_PUBLICATION_CONSENT_CHANGED" }
  });
  const repeated = await save(owner.id, inputFrom(withdrawn), "sprof-probe-repeat-hidden");
  const transitions = await db.domainEvent.findMany({
    where: { sourceId: current.id, type: "SERVICE_PROVIDER_PROFILE_PUBLICATION_CONSENT_CHANGED" },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }]
  });
  check("SPROF-11 tagasivõtmine kirjutab järjestatud old/new/revision auditi ja kordussalvestus ei dubleeri üleminekut",
    repeated.status === "HIDDEN"
      && transitions.length === transitionCount
      && transitions.at(-1)?.meta?.oldState?.status === "PUBLISHED"
      && transitions.at(-1)?.meta?.newState?.status === "HIDDEN"
      && Boolean(transitions.at(-1)?.meta?.revision));
  const auditText = JSON.stringify(transitions);
  check("SPROF-11 audit ei sisalda kirjeldusi, kontakte ega profiili teksti",
    !auditText.includes("Avalik teenus")
      && !auditText.includes("+372 5555 0101")
      && !auditText.includes("SPROF peatükisond"));

  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await db.$disconnect().catch(() => null);
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
  await admin.end().catch(() => null);
  console.log("CLEANUP_OK temporary_database_removed");
}

async function assertReject(action, expectedMessage, label) {
  let error = null;
  try {
    await action();
  } catch (caught) {
    error = caught;
  }
  check(label, error?.message === expectedMessage);
}
