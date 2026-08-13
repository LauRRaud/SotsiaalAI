#!/usr/bin/env node
/**
 * SOL-PRE-12…14 — real PostgreSQL proof for organization recipients.
 *
 * Creates a temporary local database, deploys the existing migrations, and
 * proves recipient projection, PATCH preservation/racing, correction delivery,
 * retry idempotency, both-side visibility, and transaction rollback.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import {
  createPreInquiry,
  getVisiblePreInquiry,
  listPreInquiryOrganizationRecipients,
  sendPreInquiryCorrection,
  updatePreInquiry
} from "../lib/preInquiries.js";
import { getInboxItem } from "../lib/org/inbox.js";
import { preInquiryRoomLockKey } from "../lib/rooms/preInquiryRoom.js";
import { holdOpen, watch } from "./probe-race-harness.mjs";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)
    && process.env.PRE_ORGANIZATION_PROBE_ALLOW_REMOTE !== "true") {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname || "tundmatu"})`);
}

const databaseName = `sotsiaal_ai_pre_organization_probe_${Date.now()}`;
if (!/^sotsiaal_ai_pre_organization_probe_\d+$/.test(databaseName)) {
  throw new Error("Ebaturvaline ajutise andmebaasi nimi");
}
const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;

const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const clients = Array.from({ length: 3 }, () => new PrismaClient({
  adapter: new PrismaPg({ connectionString: probeUrl.toString() }),
  log: []
}));
const [dbA, dbB, lockDb] = clients;

let failures = 0;
function expect(label, condition, detail = "") {
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures += 1;
}

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    stdio: "pipe",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(" ")} kukkus koodiga ${result.status}: ${result.stderr?.toString() || ""}`);
  }
}

async function raceBehindHeldLock(inquiryId, first, second) {
  const holder = holdOpen(lockDb, (tx) =>
    tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${preInquiryRoomLockKey(inquiryId)}))`
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  const a = watch(first());
  await new Promise((resolve) => setTimeout(resolve, 100));
  const b = watch(second());
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect("kaks PATCH-i ootavad sama rea lukku", !a.state.settled && !b.state.settled);
  holder.release();
  await holder.done;
  return Promise.all([a.wrapped, b.wrapped]);
}

function correctionInput(row, marker) {
  return {
    expectedUpdatedAt: row.updatedAt.toISOString(),
    topic: "Sünteetiline parandustest",
    situation: `Sünteetiline parandatud olukord ${marker}.`,
    correctionText: `Sünteetiline parandatud pöördumine ${marker}.`
  };
}

process.env.ORG_WORKSPACE_ENABLED = "1";
process.env.ORG_INBOX_ENABLED = "1";

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  console.log(`SOL-PRE-12…14 — ajutine PostgreSQL ${databaseName}\n`);
  runPrisma(["migrate", "deploy"]);

  const municipality = await dbA.municipality.create({
    data: {
      slug: "pre-org-probe",
      baseName: "Sünteetiline vald",
      displayName: "Sünteetiline vald",
      type: "VALD",
      county: "Testi maakond"
    }
  });
  const organization = await dbA.organization.create({
    data: {
      displayName: "Sünteetiline vastuvõtutiim",
      legalKind: "MUNICIPALITY",
      status: "ACTIVE",
      verifiedAt: new Date(),
      activatedAt: new Date(),
      municipalityId: municipality.id,
      modules: { create: { moduleKey: "KOV_INTAKE", status: "ACTIVE" } }
    }
  });
  const author = await dbA.user.create({ data: { email: `pre-org-author-${Date.now()}@sotsiaalai.invalid` } });
  const person = await dbA.user.create({
    data: {
      email: `pre-org-person-${Date.now()}@sotsiaalai.invalid`,
      role: "SOCIAL_WORKER",
      acceptsPreInquiries: true
    }
  });

  const projection = await listPreInquiryOrganizationRecipients({ db: dbA });
  const publicOrganization = projection.find((entry) => entry.recipientOrganizationId === organization.id);
  expect("PRE-12 avalik projektsioon väljastab serveri postkasti-ID", publicOrganization?.id === `organization-inbox:${organization.id}`);
  expect("PRE-12 projektsioon ei leki sisemisi välju", publicOrganization
    && Object.keys(publicOrganization).sort().join(",") === [
      "county", "deliveryChannel", "id", "legalKind", "municipalityName",
      "recipientOrganizationId", "title", "type"
    ].sort().join(","));

  const draft = await createPreInquiry(author.id, {
    recipientOrganizationId: organization.id,
    recipientType: "ORGANIZATION_INBOX",
    selectedRecipientName: "Kliendi võltsnimi",
    topic: "Eluase",
    situation: "Sünteetiline olukord organisatsiooni PATCH-sondiks.",
    status: "DRAFT"
  }, { db: dbA });
  expect("PRE-12 server säilitab autoriteetse organisatsiooni nime", draft.selectedRecipientName === organization.displayName);

  const contentOnly = await updatePreInquiry(author.id, draft.id, {
    expectedUpdatedAt: draft.updatedAt.toISOString(),
    topic: "Uuendatud teema"
  }, { db: dbA });
  expect("PRE-13 sisumuudatus säilitab organisatsiooni", contentOnly.recipientOrganizationId === organization.id);

  const gateBefore = process.env.ORG_INBOX_ENABLED;
  process.env.ORG_INBOX_ENABLED = "0";
  const gateError = await updatePreInquiry(author.id, draft.id, {
    expectedUpdatedAt: contentOnly.updatedAt.toISOString(),
    topic: "Ei tohi salvestuda"
  }, { db: dbA }).then(() => null, (error) => error);
  process.env.ORG_INBOX_ENABLED = gateBefore;
  expect("PRE-13 suletud lipp failib 409-ga", gateError?.status === 409);
  const afterGate = await dbA.preInquiry.findUnique({ where: { id: draft.id } });
  expect("PRE-13 suletud lipp ei kaota adressaati ega kirjuta sisu", afterGate.recipientOrganizationId === organization.id && afterGate.topic === "Uuendatud teema");

  const raceDraft = await createPreInquiry(author.id, {
    recipientOrganizationId: organization.id,
    recipientType: "ORGANIZATION_INBOX",
    situation: "Sünteetiline kahe kliendi võistlus.",
    topic: "Algne võistlusteema",
    status: "DRAFT"
  }, { db: dbA });
  const expectedUpdatedAt = raceDraft.updatedAt.toISOString();
  const race = await raceBehindHeldLock(
    raceDraft.id,
    () => updatePreInquiry(author.id, raceDraft.id, {
      expectedUpdatedAt,
      topic: "Sisu võitis"
    }, { db: dbA }),
    () => updatePreInquiry(author.id, raceDraft.id, {
      expectedUpdatedAt,
      recipientOrganizationId: null,
      recipientEntryId: null,
      recipientType: "KOV_CONTACT",
      selectedRecipientName: "Isiklik vastuvõtja",
      selectedRecipientEmail: person.email
    }, { db: dbB })
  );
  expect("PRE-13 täpselt üks aegunud klient võidab", race.filter((result) => !result.error).length === 1);
  expect("PRE-13 kaotaja saab 409", race.filter((result) => result.error?.status === 409).length === 1);
  const afterRace = await dbA.preInquiry.findUnique({ where: { id: raceDraft.id } });
  const contentWon = afterRace.topic === "Sisu võitis"
    && afterRace.recipientOrganizationId === organization.id
    && afterRace.recipientOwnerId === null;
  const personWon = afterRace.topic === "Algne võistlusteema"
    && afterRace.recipientOrganizationId === null
    && afterRace.recipientOwnerId === person.id;
  expect("PRE-13 lõppseis ei sega kahe kliendi sisu ja adressaati", contentWon || personWon);

  const personOriginal = await dbA.preInquiry.create({
    data: {
      authorId: author.id,
      recipientOwnerId: person.id,
      recipientType: "KOV_CONTACT",
      deliveryChannel: "INTERNAL",
      selectedRecipientName: "Isiklik vastuvõtja",
      selectedRecipientEmail: person.email,
      situation: "Sünteetiline isikuparanduse algtekst.",
      userEditedDraft: "Sünteetiline isikuparanduse mustand.",
      status: "SENT",
      sentAt: new Date(),
      openedAt: new Date()
    }
  });
  const personCorrection = await sendPreInquiryCorrection(
    author.id,
    personOriginal.id,
    correctionInput(personOriginal, "isik"),
    { db: dbA }
  );
  expect("PRE-14 isikuparandus säilitab isikliku adressaadi", personCorrection.created
    && personCorrection.inquiry.recipientOwnerId === person.id
    && personCorrection.inquiry.recipientOrganizationId === null);

  const orgOriginal = await createPreInquiry(author.id, {
    recipientOrganizationId: organization.id,
    recipientType: "ORGANIZATION_INBOX",
    topic: "Organisatsiooni algne pöördumine",
    situation: "Sünteetiline organisatsiooni paranduse algtekst.",
    userEditedDraft: "Sünteetiline organisatsiooni paranduse mustand.",
    status: "SENT"
  }, { db: dbA });
  const openedOriginal = await dbA.preInquiry.update({
    where: { id: orgOriginal.id },
    data: { openedAt: new Date() }
  });
  const orgCorrection = await sendPreInquiryCorrection(
    author.id,
    openedOriginal.id,
    correctionInput(openedOriginal, "organisatsioon"),
    { db: dbA }
  );
  const correctionInbox = await dbA.organizationInboxItem.findMany({
    where: { organizationId: organization.id, sourceId: orgCorrection.inquiry.id }
  });
  expect("PRE-14 organisatsiooni parandusel on sama adressaat ja avalik nimi", orgCorrection.created
    && orgCorrection.inquiry.recipientOrganizationId === organization.id
    && orgCorrection.inquiry.selectedRecipientName === organization.displayName);
  expect("PRE-14 paranduse postkastikirje tekib täpselt üks kord", correctionInbox.length === 1);

  const retry = await sendPreInquiryCorrection(
    author.id,
    openedOriginal.id,
    { ...correctionInput(openedOriginal, "kordus"), expectedUpdatedAt: "2000-01-01T00:00:00.000Z" },
    { db: dbA }
  );
  const retryInboxCount = await dbA.organizationInboxItem.count({
    where: { organizationId: organization.id, sourceId: orgCorrection.inquiry.id }
  });
  expect("PRE-14 kordus on idempotentne", !retry.created && retry.inquiry.id === orgCorrection.inquiry.id && retryInboxCount === 1);

  const authorView = await getVisiblePreInquiry(author.id, orgCorrection.inquiry.id, { db: dbA });
  const organizationView = await getInboxItem({
    kind: "organization",
    organization: { id: organization.id },
    membership: null,
    capabilities: [{ capability: "INBOX_COORDINATOR", scopeType: "ORGANIZATION", scopeUnitId: null }],
    activeModules: ["KOV_INTAKE"],
    _unitTree: []
  }, correctionInbox[0].id, { db: dbA });
  expect("PRE-14 autor näeb parandust ja organisatsioon näeb sama paketti", authorView?.id === orgCorrection.inquiry.id
    && organizationView.source?.id === orgCorrection.inquiry.id
    && organizationView.source?.userEditedDraft === orgCorrection.inquiry.userEditedDraft);

  const rollbackOriginal = await createPreInquiry(author.id, {
    recipientOrganizationId: organization.id,
    recipientType: "ORGANIZATION_INBOX",
    situation: "Sünteetiline rollback-algtekst.",
    userEditedDraft: "Sünteetiline rollback-algmustand.",
    status: "SENT"
  }, { db: dbA });
  const rollbackOpened = await dbA.preInquiry.update({ where: { id: rollbackOriginal.id }, data: { openedAt: new Date() } });
  const beforeRollbackCount = await dbA.preInquiry.count({ where: { authorId: author.id } });
  await dbA.$executeRawUnsafe(`
    CREATE FUNCTION pre_org_probe_fail_inbox() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM "PreInquiry"
         WHERE "id" = NEW."sourceId"
           AND "userEditedDraft" LIKE '%rollback-marker%'
      ) THEN
        RAISE EXCEPTION 'synthetic inbox failure';
      END IF;
      RETURN NEW;
    END $$`);
  await dbA.$executeRawUnsafe(`
    CREATE TRIGGER pre_org_probe_fail_inbox_trigger
    BEFORE INSERT ON "OrganizationInboxItem"
    FOR EACH ROW EXECUTE FUNCTION pre_org_probe_fail_inbox()`);
  const rollbackError = await sendPreInquiryCorrection(author.id, rollbackOpened.id, {
    expectedUpdatedAt: rollbackOpened.updatedAt.toISOString(),
    situation: "Sünteetiline rollback-marker olukord.",
    correctionText: "Sünteetiline rollback-marker parandatud pöördumine."
  }, { db: dbA }).then(() => null, (error) => error);
  const afterRollbackCount = await dbA.preInquiry.count({ where: { authorId: author.id } });
  const rollbackAfter = await dbA.preInquiry.findUnique({ where: { id: rollbackOpened.id } });
  expect("PRE-14 postkasti tõrge jõuab kutsujani", Boolean(rollbackError));
  expect("PRE-14 postkasti tõrge pöörab tagasi paranduse ja supersession-lingi", beforeRollbackCount === afterRollbackCount
    && rollbackAfter.supersededById === null);
} finally {
  await Promise.allSettled(clients.map((client) => client.$disconnect()));
  try {
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]);
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  } finally {
    await admin.end();
  }
}

if (failures) {
  console.error(`\nSOL-PRE-12…14 sond: ${failures} viga`);
  process.exitCode = 1;
} else {
  console.log("\nSOL-PRE-12…14 sond: kõik PostgreSQL invariandid tõendatud; ajutine andmebaas eemaldatud.");
}
