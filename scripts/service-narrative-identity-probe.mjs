#!/usr/bin/env node
/** SOL-SLOG-22 — sama nimega välisklientide narratiivi päris-DB sond. */

import prisma from "../lib/prisma.js";
import { getNarrativeSeed, upsertNarrative } from "../lib/serviceLog/narratives.js";

const SUFFIX = "@slog-narrative.invalid";
const MARK = "(slog-narrative-sünteetiline)";
const ENV = { SERVICE_LOG_ENABLED: "1" };
let passed = 0;
let failed = 0;

function expect(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function purge() {
  const profiles = await prisma.serviceProviderProfile.findMany({
    where: { organizationName: { contains: MARK } },
    select: { id: true }
  });
  const ids = profiles.map((row) => row.id);
  if (ids.length) {
    await prisma.serviceMonthlyNarrative.deleteMany({ where: { providerProfileId: { in: ids } } });
    await prisma.serviceEntry.deleteMany({ where: { providerProfileId: { in: ids } } });
    await prisma.serviceProviderProfile.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-SLOG-22 — narratiivi väliskliendi identiteedi päris-DB sond\n");
  await purge();
  const owner = await prisma.user.create({
    data: { email: `owner${SUFFIX}`, role: "SERVICE_PROVIDER", emailVerified: new Date() }
  });
  const profile = await prisma.serviceProviderProfile.create({
    data: {
      ownerId: owner.id,
      ownershipMode: "SOLO",
      organizationName: `Osutaja ${MARK}`,
      status: "PUBLISHED"
    }
  });
  await prisma.serviceEntry.createMany({
    data: [
      {
        providerProfileId: profile.id,
        ownerUserId: owner.id,
        clientDisplayName: "Mari",
        clientExternalRef: "external-a",
        date: new Date("2026-08-05T00:00:00.000Z"),
        unit: "HOUR",
        quantity: 1,
        status: "FINAL",
        note: "A fakt"
      },
      {
        providerProfileId: profile.id,
        ownerUserId: owner.id,
        clientDisplayName: "Mari",
        clientExternalRef: "external-b",
        date: new Date("2026-08-06T00:00:00.000Z"),
        unit: "HOUR",
        quantity: 2,
        status: "FINAL",
        note: "B fakt"
      }
    ]
  });

  const a = await upsertNarrative(
    owner.id,
    {
      clientDisplayName: "Mari",
      clientExternalRef: "external-a",
      periodYear: 2026,
      periodMonth: 8,
      bodyText: "A lugu"
    },
    { db: prisma, env: ENV }
  );
  const b = await upsertNarrative(
    owner.id,
    {
      clientDisplayName: "Mari",
      clientExternalRef: "external-b",
      periodYear: 2026,
      periodMonth: 8,
      bodyText: "B lugu"
    },
    { db: prisma, env: ENV }
  );
  const seedA = await getNarrativeSeed(
    owner.id,
    { clientDisplayName: "Mari", clientExternalRef: "external-a", periodYear: 2026, periodMonth: 8 },
    { db: prisma, env: ENV }
  );
  const seedB = await getNarrativeSeed(
    owner.id,
    { clientDisplayName: "Mari", clientExternalRef: "external-b", periodYear: 2026, periodMonth: 8 },
    { db: prisma, env: ENV }
  );
  const rows = await prisma.serviceMonthlyNarrative.findMany({
    where: { providerProfileId: profile.id },
    orderBy: { clientExternalRef: "asc" }
  });
  const indexes = await prisma.$queryRaw`
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'ServiceMonthlyNarrative_noreferral_externalref_key'
  `;

  expect("sama nimi ja eri välisviide annavad kaks eri narratiivi", a.id !== b.id && rows.length === 2);
  expect("mõlemad püsivad välisviited on andmebaasis", rows.map((row) => row.clientExternalRef).join(",") === "external-a,external-b");
  expect("A seed sisaldab ainult A fakti", seedA.entryCount === 1 && seedA.notes[0]?.note === "A fakt");
  expect("B seed sisaldab ainult B fakti", seedB.entryCount === 1 && seedB.notes[0]?.note === "B fakt");
  expect("osaline unikaalindeks kasutab externalRef-i, mitte nime", /clientExternalRef/.test(indexes[0]?.indexdef || ""));

  await purge();
  const leftovers = await prisma.user.count({ where: { email: { endsWith: SUFFIX } } });
  expect("cleanup users=0", leftovers === 0, String(leftovers));
  console.log(`\n${passed}/${passed + failed} kontrolli läbis.`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await purge().catch(() => {});
    await prisma.$disconnect();
  });
