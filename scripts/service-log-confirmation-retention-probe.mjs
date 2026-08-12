#!/usr/bin/env node
/** SOL-SLOG-11…12 — kuusnapshoti ja raportisäilituse päris PostgreSQL-i sond. */

import prisma from "../lib/prisma.js";
import { confirmClientMonth, readClientMonth } from "../lib/serviceLog/clientView.js";
import {
  archiveRetainedServiceLogReportsForDeletedAccount,
  purgeExpiredServiceLogReportArchives
} from "../lib/serviceLog/reportRetention.js";

const SUFFIX = "@slog-retention.invalid";
const MARK = "slog-retention-synthetic";
const ENV = { SERVICE_LOG_ENABLED: "1", SERVICE_LOG_CLIENT_VIEW: "1" };
let passed = 0;
let failed = 0;

function expect(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}`);
  }
}

async function purge() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const userIds = users.map((row) => row.id);
  const profiles = await prisma.serviceProviderProfile.findMany({
    where: { organizationName: { contains: MARK } },
    select: { id: true }
  });
  const profileIds = profiles.map((row) => row.id);
  if (profileIds.length) {
    await prisma.serviceEntry.deleteMany({ where: { providerProfileId: { in: profileIds } } });
    await prisma.serviceProviderProfile.deleteMany({ where: { id: { in: profileIds } } });
  }
  await prisma.serviceLogReportLegalArchive.deleteMany({
    where: { originalName: { contains: MARK } }
  });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function main() {
  console.log("SOL-SLOG-11…12 — kuusnapshoti ja raportisäilituse päris-DB sond\n");
  await purge();

  const owner = await prisma.user.create({
    data: { email: `owner${SUFFIX}`, role: "SERVICE_PROVIDER", emailVerified: new Date() }
  });
  const client = await prisma.user.create({
    data: { email: `client${SUFFIX}`, role: "CLIENT", emailVerified: new Date() }
  });
  const profile = await prisma.serviceProviderProfile.create({
    data: {
      ownerId: owner.id,
      ownershipMode: "SOLO",
      organizationName: `Provider ${MARK}`,
      status: "PUBLISHED"
    }
  });
  await prisma.serviceEntry.create({
    data: {
      providerProfileId: profile.id,
      ownerUserId: owner.id,
      clientUserId: client.id,
      clientDisplayName: "Synthetic client",
      date: new Date("2026-08-05T00:00:00.000Z"),
      unit: "HOUR",
      quantity: 1,
      status: "FINAL",
      finalizedAt: new Date(),
      recordedFiscalYear: 2026
    }
  });

  const shown = await readClientMonth(client.id, { month: "2026-08" }, { db: prisma, env: ENV });
  let snapshotWasRead;
  const snapshotRead = new Promise((resolve) => { snapshotWasRead = resolve; });
  const db = new Proxy(prisma, {
    get(target, property) {
      if (property !== "$transaction") return Reflect.get(target, property, target);
      return (work, options) => target.$transaction(async (tx) => {
        const txProxy = new Proxy(tx, {
          get(txTarget, txProperty) {
            if (txProperty !== "serviceEntry") return Reflect.get(txTarget, txProperty, txTarget);
            return new Proxy(txTarget.serviceEntry, {
              get(model, method) {
                if (method !== "findMany") return Reflect.get(model, method, model);
                return async (...args) => {
                  const rows = await model.findMany(...args);
                  snapshotWasRead();
                  await new Promise((resolve) => setTimeout(resolve, 75));
                  return rows;
                };
              }
            });
          }
        });
        return work(txProxy);
      }, options);
    }
  });

  const confirmation = confirmClientMonth(
    client.id,
    { month: "2026-08", snapshotToken: shown.snapshotToken },
    { db, env: ENV }
  );
  await snapshotRead;
  let insertSettled = false;
  const inserted = prisma.serviceEntry.create({
    data: {
      providerProfileId: profile.id,
      ownerUserId: owner.id,
      clientUserId: client.id,
      clientDisplayName: "Synthetic client",
      date: new Date("2026-08-06T00:00:00.000Z"),
      unit: "HOUR",
      quantity: 2,
      status: "FINAL",
      finalizedAt: new Date(),
      recordedFiscalYear: 2026
    }
  }).finally(() => { insertSettled = true; });
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect("uus FINAL-rida ootab kinnitustehingu lukku", insertSettled === false);
  const confirmed = await confirmation;
  const hidden = await inserted;
  expect("klient kinnitas ainult kuvatud rea", confirmed.confirmedNow === 1);
  const hiddenFresh = await prisma.serviceEntry.findUnique({ where: { id: hidden.id } });
  expect("kontrolli ajal lisatud rida ei saanud kinnitust", hiddenFresh.confirmedByClientAt === null);
  const stale = await confirmClientMonth(
    client.id,
    { month: "2026-08", snapshotToken: shown.snapshotToken },
    { db: prisma, env: ENV }
  ).catch((error) => error);
  expect("muutunud kuu vana snapshot saab 409", stale?.status === 409);

  const report = await prisma.userDocument.create({
    data: {
      ownerId: owner.id,
      title: "Synthetic retained report",
      originalName: `${MARK}.csv`,
      kind: "SERVICE_LOG_REPORT",
      agentAllowed: false,
      mime: "text/csv",
      size: 4,
      sha256: `sha-${MARK}`,
      storagePath: `uploads/${MARK}.csv`,
      metadata: {
        retentionEndsAt: "2033-12-31T23:59:59.999Z",
        retentionBasis: "RPS_12"
      }
    }
  });
  const archived = await archiveRetainedServiceLogReportsForDeletedAccount(owner.id, {
    db: prisma,
    protectedDocumentIds: [report.id]
  });
  expect("konto kustutuse eel teisaldati raport juriidilisse arhiivi", archived.archived === 1);
  const sourceGone = await prisma.userDocument.findUnique({ where: { id: report.id } });
  const legal = await prisma.serviceLogReportLegalArchive.findUnique({ where: { sourceDocumentId: report.id } });
  expect("omanikuga UserDocument kadus", sourceGone === null);
  expect("arhiivis pole kasutaja-ID välja", legal && !("ownerId" in legal) && !("userId" in legal));

  await prisma.serviceLogReportLegalArchive.update({
    where: { id: legal.id },
    data: { retentionEndsAt: new Date("2026-08-01T00:00:00.000Z") }
  });
  const purged = await purgeExpiredServiceLogReportArchives({
    db: prisma,
    now: new Date("2026-08-12T00:00:00.000Z"),
    deleteFile: async () => {}
  });
  expect("tähtaja järel kustusid arhiivifakt ja fail ühes koristuses", purged.purged === 1);
}

try {
  await main();
} finally {
  await purge().catch(() => {});
  await prisma.$disconnect();
}

console.log(`\n${passed} PASS, ${failed} FAIL`);
if (failed) process.exitCode = 1;
