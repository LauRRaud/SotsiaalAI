/**
 * TEENUSPÄEVIK — läbivad stsenaariumid PRODUKTSIOONI andmebaasi vastu.
 *
 * MIKS SERVERIS: lipud, migratsioonid ja Prisma klient on siin päris. Kohalik
 * roheline sviit ei tõenda neist ühtegi — see õppetund on juba korra makstud
 * (fake-prisma ei valideeri välju).
 *
 * OHUTUS: kõik andmed käivad ÜHE märgistatud QA-kasutaja alt ja kustutatakse
 * lõpus. Skript loeb ridade arvu enne ja pärast ning ütleb jäägi välja.
 */

import prisma from "../lib/prisma.js";
import { createEntry, finalizeEntry, updateEntry, listEntries } from "../lib/serviceLog/entries.js";
import { getEntryDraftFromVisit } from "../lib/serviceLog/fieldBridge.js";
import { computeReferralBalance } from "../lib/serviceLog/saldo.js";
import { buildServiceLogExport, exportToCsv, exportFileName } from "../lib/serviceLog/exportService.js";
import { exportToDocx } from "../lib/serviceLog/export/docx.js";
import { exportToPdf } from "../lib/serviceLog/export/pdf.js";
import { buildStarPayload } from "../lib/serviceLog/export/star.js";
import { getMonthlyReport } from "../lib/serviceLog/monthReport.js";
import { getNarrativeSeed, upsertNarrative } from "../lib/serviceLog/narratives.js";
import { readClientMonth, confirmClientMonth } from "../lib/serviceLog/clientView.js";
import { recordSample, readBaseline, purgeExpiredSamples } from "../lib/serviceLog/timeSamples.js";
import { readServiceLogFlags } from "../lib/serviceLog/flags.js";
import { SAMPLE_KIND } from "../lib/serviceLog/measurement.js";

const QA_PROVIDER = "qa.teenuspaevik.provider@sotsiaal.ai";
const QA_CLIENT = "qa.teenuspaevik.client@sotsiaal.ai";
const MARK = "QA-TEENUSPAEVIK";

let pass = 0;
let fail = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    pass += 1;
    console.log(`  OK   ${name}`);
  } else {
    fail += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  VIGA ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function expectError(name, fn, expectedStatus, expectedKey = null) {
  try {
    await fn();
    check(name, false, "viga jäi tulemata");
  } catch (error) {
    const okStatus = error?.status === expectedStatus;
    const okKey = !expectedKey || error?.messageKey === expectedKey;
    check(name, okStatus && okKey, `sai status=${error?.status} key=${error?.messageKey}`);
  }
}

async function purge() {
  const provider = await prisma.user.findUnique({ where: { email: QA_PROVIDER }, select: { id: true } });
  const client = await prisma.user.findUnique({ where: { email: QA_CLIENT }, select: { id: true } });
  if (provider) {
    const profile = await prisma.serviceProviderProfile.findFirst({
      where: { ownerId: provider.id },
      select: { id: true }
    });
    if (profile) {
      await prisma.serviceLogTimeSample.deleteMany({ where: { providerProfileId: profile.id } });
      await prisma.serviceEntryCorrection.deleteMany({
        where: { entry: { providerProfileId: profile.id } }
      });
      await prisma.serviceEntry.deleteMany({ where: { providerProfileId: profile.id } });
      await prisma.serviceMonthlyNarrative.deleteMany({ where: { providerProfileId: profile.id } });
      await prisma.serviceReferral.deleteMany({ where: { providerProfileId: profile.id } });
      await prisma.serviceProviderProfile.delete({ where: { id: profile.id } });
    }
    await prisma.fieldVisit.deleteMany({ where: { ownerUserId: provider.id } });
    await prisma.user.delete({ where: { id: provider.id } });
  }
  if (client) await prisma.user.delete({ where: { id: client.id } });
}

async function main() {
  console.log("=== TEENUSPÄEVIK: läbivad stsenaariumid (PRODUKTSIOON) ===\n");

  const flags = readServiceLogFlags(process.env);
  console.log("Lipud serveris:", JSON.stringify(flags), "\n");

  const before = {
    entries: await prisma.serviceEntry.count(),
    referrals: await prisma.serviceReferral.count(),
    samples: await prisma.serviceLogTimeSample.count(),
    users: await prisma.user.count()
  };
  console.log("Ridu enne:", JSON.stringify(before), "\n");

  await purge(); // eelmise katkenud jooksu jäägid

  // --- ETTEVALMISTUS ---
  const provider = await prisma.user.create({
    data: { email: QA_PROVIDER, role: "SERVICE_PROVIDER" },
    select: { id: true }
  });
  const client = await prisma.user.create({
    data: { email: QA_CLIENT, role: "CLIENT" },
    select: { id: true }
  });
  const profile = await prisma.serviceProviderProfile.create({
    data: {
      owner: { connect: { id: provider.id } },
      ownershipMode: "SOLO",
      organizationName: `${MARK} OÜ`,
      registryCode: "10000000"
    },
    select: { id: true }
  });
  const tartu = await prisma.serviceReferral.create({
    data: {
      providerProfileId: profile.id,
      kovName: "QA Tartu",
      referralNumber: "T-1",
      clientUserId: client.id,
      unit: "HOUR",
      allocatedQuantity: 4,
      allocationPeriod: "MONTH",
      status: "ACTIVE",
      goalsText: "Säilitada iseseisev toimetulek kodus"
    },
    select: { id: true }
  });
  const parnu = await prisma.serviceReferral.create({
    data: {
      providerProfileId: profile.id,
      kovName: "QA Pärnu",
      referralNumber: "P-1",
      clientDisplayName: "Мария Иванова",
      unit: "HOUR",
      allocatedQuantity: 10,
      allocationPeriod: "MONTH",
      status: "ACTIVE"
    },
    select: { id: true }
  });
  console.log("Ettevalmistus tehtud.\n");

  const U = provider.id;
  const MONTH = "2026-08";

  // === S1: OSUTAJA PÄEV ===
  console.log("S1 — osutaja päev: templid, kestuse tuletus, kinnitamine");
  const e1 = await createEntry(U, {
    clientUserId: client.id,
    referralId: tartu.id,
    date: "2026-08-03",
    unit: "HOUR",
    arrivedAt: "2026-08-03T09:00:00.000Z",
    leftAt: "2026-08-03T11:30:00.000Z",
    note: "Käisin kohal, kõik korras.",
    noteProvenance: "TOOTAJA_TAHELEPANEK"
  });
  check("kestus tuletati templitest (2,5 h)", Number(e1.quantity) === 2.5, `sai ${e1.quantity}`);
  check("kirje sünnib mustandina", e1.status === "DRAFT", e1.status);
  const e1f = await finalizeEntry(U, e1.id);
  check("kinnitamine viib FINAL-isse", e1f.status === "FINAL", e1f.status);
  check("säilitusankur on olemas", Boolean(e1f.retentionEndsAt));
  await expectError("teistkordne kinnitamine keeldub", () => finalizeEntry(U, e1.id), 409);

  // === S2: VÕRGUTA KORDUSSAATMINE ===
  console.log("\nS2 — võrguta kordussaatmine (idempotentsus)");
  const payload = {
    clientDisplayName: "QA Kordus",
    date: "2026-08-04",
    unit: "HOUR",
    quantity: "1",
    clientRequestId: `${MARK}-req-1`
  };
  const r1 = await createEntry(U, payload);
  const r2 = await createEntry(U, payload);
  check("sama võti annab sama kirje", r1.id === r2.id, `${r1.id} vs ${r2.id}`);
  check("kordus on märgistatud", r2.replayed === true);

  // === S3: VÄLITÖÖ SILD ===
  console.log("\nS3 — Välitöö sild");
  const visit = await prisma.fieldVisit.create({
    data: {
      ownerUserId: U,
      status: "CLOSED",
      goal: MARK,
      locationText: "QA tänav 5",
      arrivedConfirmedAt: new Date("2026-08-05T10:00:00.000Z"),
      departedConfirmedAt: new Date("2026-08-05T11:00:00.000Z"),
      closedAt: new Date("2026-08-05T11:05:00.000Z")
    },
    select: { id: true }
  });
  const draft = await getEntryDraftFromVisit(U, visit.id);
  check("eeltäide annab kestuse", Number(draft.quantity) === 1, `sai ${draft.quantity}`);
  check("eeltäide kannab koha kaasa", draft.locationText === "QA tänav 5");
  const fromVisit = await createEntry(U, {
    clientDisplayName: "QA Külastus",
    date: draft.date,
    unit: draft.unit,
    quantity: String(draft.quantity),
    sourceFieldVisitId: visit.id
  });
  check("lähtekülastus salvestus", fromVisit.sourceFieldVisitId === visit.id);
  await expectError(
    "teine kirje samast külastusest keeldub",
    () =>
      createEntry(U, {
        clientDisplayName: "QA Külastus 2",
        date: draft.date,
        unit: "HOUR",
        quantity: "1",
        sourceFieldVisitId: visit.id
      }),
    409,
    "service_log.errors.visit_already_used"
  );
  await expectError("võõras külastus on olematu", () => getEntryDraftFromVisit(U, "ei-ole"), 404);

  // === S4: SALDO JA ÜLETUS ===
  console.log("\nS4 — suunamise jääk ja ületuse hoiatus");
  const over = await createEntry(U, {
    clientUserId: client.id,
    referralId: tartu.id,
    date: "2026-08-06",
    unit: "HOUR",
    quantity: "3"
  });
  check("ületus ei blokeeri salvestust", Boolean(over.id));
  check("ületus hoiatab", over.overrun?.warn === true, JSON.stringify(over.overrun));
  const entriesForBalance = await listEntries(U, { take: 200 });
  const balance = computeReferralBalance(
    { id: tartu.id, unit: "HOUR", allocatedQuantity: 4, allocationPeriod: "MONTH" },
    entriesForBalance.filter((e) => e.referralId === tartu.id),
    { date: new Date("2026-08-06") }
  );
  check("jääk on negatiivne (4 h eraldatud, 5,5 h tehtud)", Number(balance.remaining) < 0, JSON.stringify(balance));

  // === S5: MITME KOV-i ERALDATUS ===
  console.log("\nS5 — mitme KOV-i eraldatus");
  await createEntry(U, {
    clientDisplayName: "Мария Иванова",
    referralId: parnu.id,
    date: "2026-08-07",
    unit: "HOUR",
    quantity: "2"
  });
  const tartuExport = await buildServiceLogExport(U, {
    month: MONTH,
    template: "A_TIMESHEET",
    kovName: "QA Tartu",
    includeDrafts: true
  });
  const tartuRows = JSON.stringify(tartuExport.document.rows);
  check("Tartu eksport ei sisalda Pärnu klienti", !tartuRows.includes("Мария"), tartuRows.slice(0, 120));
  const allExport = await buildServiceLogExport(U, {
    month: MONTH,
    template: "A_TIMESHEET",
    includeDrafts: true
  });
  check(
    "saajata eksport kannab hoiatust",
    (allExport.document.warnings || []).some((w) => w.code === "not_submittable_all_recipients"),
    JSON.stringify(allExport.document.warnings)
  );

  // === S6: VORMINGUD ===
  console.log("\nS6 — väljundvormingud");
  const csv = exportToCsv(tartuExport.document);
  check("CSV algab BOM-iga", csv.startsWith("﻿"));
  check("CSV failinimi on .csv", exportFileName({ month: MONTH, template: "A_TIMESHEET", kovName: "QA Tartu" }).endsWith(".csv"));
  const docx = exportToDocx(allExport.document);
  check("DOCX on zip", docx[0] === 0x50 && docx[1] === 0x4b);
  check("DOCX kannab kirillitsat", docx.length > 2000);
  const pdfAll = exportToPdf(allExport.document);
  check("PDF keeldub kirillitsast", pdfAll.ok === false && pdfAll.reason === "unsupported_characters");
  const pdfTartu = exportToPdf(tartuExport.document);
  check("PDF õnnestub ilma kirillitsata", pdfTartu.ok === true && pdfTartu.buffer.subarray(0, 4).toString("latin1") === "%PDF");
  const stats = await buildServiceLogExport(U, { month: MONTH, template: "D_STATISTICS", includeDrafts: true });
  const star = buildStarPayload(stats.document, { provider: stats.provider, period: stats.period });
  check("STAR ütleb kaardistuse seisu ausalt", star.mappingStatus === "unverified");
  check("STAR-is ei ole isikuandmeid", !JSON.stringify(star).includes("Мария"));

  // === S7: GPS ===
  console.log("\nS7 — asukohatempel");
  const gps = await createEntry(U, {
    clientDisplayName: "QA GPS",
    date: "2026-08-08",
    unit: "HOUR",
    quantity: "1",
    arrivedAt: "2026-08-08T09:00:00.000Z",
    locationStamps: {
      arrivedAt: { lat: 58.38, lng: 26.72, acc: 11, at: "2026-08-08T09:00:05.000Z" },
      leftAt: { lat: 1, lng: 1 }
    }
  });
  check(
    "punkt salvestus ainult saabumise juures",
    gps.locationStampedAt.length === 1 && gps.locationStampedAt[0] === "arrivedAt",
    JSON.stringify(gps.locationStampedAt)
  );
  const gpsRow = await prisma.serviceEntry.findUnique({
    where: { id: gps.id },
    select: { locationStamps: true }
  });
  const point = gpsRow.locationStamps?.arrivedAt || {};
  check(
    "punktis on ainult lubatud väljad",
    Object.keys(point).sort().join(",") === "acc,at,lat,lng",
    Object.keys(point).join(",")
  );

  // === S8: KLIENDI VAADE JA KINNITUS ===
  console.log("\nS8 — kliendi vaade ja kinnitus");
  const clientMonth = await readClientMonth(client.id, { month: MONTH });
  check("klient näeb ainult kinnitatud kirjeid", clientMonth.entries.length === 1, `nägi ${clientMonth.entries.length}`);
  check("kliendile ei lekita märkust", !JSON.stringify(clientMonth).includes("kõik korras"));
  check("tühi/kinnitamata kuu ei ole kinnitatud", clientMonth.confirmed === false);
  const conf1 = await confirmClientMonth(client.id, { month: MONTH });
  const conf2 = await confirmClientMonth(client.id, { month: MONTH });
  check("kinnitamine märgib kirjed", conf1.confirmedNow === 1, `sai ${conf1.confirmedNow}`);
  check("korduskinnitus ei muuda midagi", conf2.confirmedNow === 0);

  // === S9: PABERKINNITUS LÕPLIKUL KIRJEL ===
  console.log("\nS9 — paberkinnitus lõplikul kirjel");
  const manual = await updateEntry(U, e1.id, { confirmedManually: true });
  check("paberkinnitus ilma põhjuseta õnnestub", manual.confirmedManually === true);
  await expectError(
    "koguse muutmine nõuab endiselt põhjust",
    () => updateEntry(U, e1.id, { quantity: "9" }),
    400,
    "service_log.errors.reason_required"
  );

  // === S10: MÕÕTMINE ===
  console.log("\nS10 — piloodimõõtmine");
  const stored = await recordSample(U, { kind: SAMPLE_KIND.ENTRY_INPUT, seconds: 22 });
  check("proov salvestub, kui lipp on sees", stored === true);
  const junk = await recordSample(U, { kind: SAMPLE_KIND.ENTRY_INPUT, seconds: 99999 });
  check("ebausutav proov ei salvestu", junk === false);
  const baseline = await readBaseline(U);
  check("baasjoon arvutub", baseline.entryInput?.count === 1, JSON.stringify(baseline.entryInput));
  const purged = await purgeExpiredSamples({ retentionDays: 0 });
  check("kustutamistähtaeg töötab", purged >= 1, `kustutas ${purged}`);

  // === S11: KUUVAADE JA NARRATIIV ===
  console.log("\nS11 — kuuvaade ja sisuline aruanne");
  const report = await getMonthlyReport(U, { month: MONTH });
  check("kuuvaade annab koondi", report.month === MONTH && Array.isArray(report.referrals));
  const seed = await getNarrativeSeed(U, { referralId: tartu.id, periodYear: 2026, periodMonth: 8 });
  check("koond leiab kirjed", seed.entryCount >= 2, `sai ${seed.entryCount}`);
  check("koond kannab eesmärke", Boolean(seed.goalsText));
  check("koond kannab märget koos päritoluga", seed.notes.some((n) => n.provenance === "TOOTAJA_TAHELEPANEK"));
  const narrative = await upsertNarrative(U, {
    referralId: tartu.id,
    periodYear: 2026,
    periodMonth: 8,
    bodyText: `${MARK} sisuline aruanne.`,
    proposal: "CONTINUE",
    draftSource: "AI_MUSTAND"
  });
  check("narratiiv salvestub koos päritoluga", narrative.draftSource === "AI_MUSTAND", narrative.draftSource);

  // --- KORISTUS ---
  console.log("\n=== KORISTUS ===");
  await purge();
  const after = {
    entries: await prisma.serviceEntry.count(),
    referrals: await prisma.serviceReferral.count(),
    samples: await prisma.serviceLogTimeSample.count(),
    users: await prisma.user.count()
  };
  console.log("Ridu pärast:", JSON.stringify(after));
  check("kirjeid ei jäänud", after.entries === before.entries, `${before.entries} -> ${after.entries}`);
  check("suunamisi ei jäänud", after.referrals === before.referrals, `${before.referrals} -> ${after.referrals}`);
  check("proove ei jäänud", after.samples === before.samples, `${before.samples} -> ${after.samples}`);
  check("kasutajaid ei jäänud", after.users === before.users, `${before.users} -> ${after.users}`);

  console.log(`\n=== KOKKU: ${pass} OK, ${fail} VIGA ===`);
  if (failures.length) {
    console.log("\nVEAD:");
    for (const f of failures) console.log(" -", f);
  }
  process.exit(fail ? 1 : 0);
}

main().catch(async (error) => {
  console.error("\nSKRIPT KUKKUS:", error?.message || error);
  console.error(error?.stack?.split("\n").slice(0, 6).join("\n"));
  try {
    await purge();
    console.log("Koristus tehtud.");
  } catch (purgeError) {
    console.error("KORISTUS KUKKUS — jäägid jäid:", purgeError?.message);
  }
  process.exit(1);
});
