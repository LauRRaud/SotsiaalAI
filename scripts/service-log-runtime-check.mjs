#!/usr/bin/env node
/**
 * TEENUSPÄEVIK-V1 E2 — sünteetiline runtime-kontroll.
 *
 *   node --import ./scripts/register-node-test-loader.mjs scripts/service-log-runtime-check.mjs
 *
 * MIKS SEE OLEMAS ON. Ühiktestid katavad puhtaid funktsioone. Kontrolli kolm
 * P1-leidu elasid aga täpselt seal, kuhu puhas funktsioon ei ulatu: suunamise
 * terviklikkus, elutsükkel ja parandusjälg käivad DB-päringute ja tehingute
 * kaudu. „Parandatud" ilma selle skriptita tähendaks „parandatud, aga
 * tõendamata" — ja just seda vahet see fail sulgeb.
 *
 * Andmed: ainult `@teenuspaevik-test.invalid` sünteetilised kontod; skript
 * koristab lõpus ja loeb jäägid üle.
 */

import prisma from "../lib/prisma.js";
import {
  createEntry,
  deleteEntry,
  finalizeEntry,
  getEntryDefaults,
  listEntries,
  listEntryCorrections,
  updateEntry,
  voidEntry
} from "../lib/serviceLog/entries.js";
import {
  endReferral,
  getReferralBalance,
  listReferrals,
  updateReferral
} from "../lib/serviceLog/referrals.js";

const ENV_ON = { SERVICE_LOG_ENABLED: "1", SERVICE_LOG_LOCATION_STAMP: "1" };
const ENV_NO_LOCATION = { SERVICE_LOG_ENABLED: "1" };
const ENV_OFF = {};

const SUFFIX = "@teenuspaevik-test.invalid";
const MARK = "Teenuspäeviku proov (sünteetiline)";

let passed = 0;
let failed = 0;
const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

async function expectReject(label, promise, predicate) {
  try {
    await promise;
    bad(label, "ootasin tõrget, sain õnnestumise");
  } catch (error) {
    if (predicate && !predicate(error)) {
      return bad(label, error?.messageKey || error?.status || error?.message);
    }
    ok(label);
  }
}

const messageKeyIs = (key) => (error) => error?.messageKey === key;
const statusIs = (status) => (error) => error?.status === status;

async function purge() {
  await prisma.serviceEntry.deleteMany({ where: { providerProfile: { organizationName: MARK } } });
  await prisma.serviceReferral.deleteMany({ where: { providerProfile: { organizationName: MARK } } });
  await prisma.serviceProviderService.deleteMany({ where: { providerProfile: { organizationName: MARK } } });
  await prisma.serviceProviderProfile.deleteMany({ where: { organizationName: MARK } });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("TEENUSPÄEVIK-V1 E2 synthetic runtime\n");
  await purge();

  // --- Alus ------------------------------------------------------------
  const provider = await prisma.user.create({
    data: { email: `provider${SUFFIX}`, role: "SERVICE_PROVIDER", emailVerified: new Date() }
  });
  const rival = await prisma.user.create({
    data: { email: `rival${SUFFIX}`, role: "SERVICE_PROVIDER", emailVerified: new Date() }
  });
  const clientA = await prisma.user.create({
    data: { email: `client-a${SUFFIX}`, role: "CLIENT", emailVerified: new Date() }
  });

  const profile = await prisma.serviceProviderProfile.create({
    data: { ownerId: provider.id, organizationName: MARK }
  });
  const rivalProfile = await prisma.serviceProviderProfile.create({
    data: { ownerId: rival.id, organizationName: MARK }
  });

  const hourly = await prisma.serviceProviderService.create({
    data: {
      providerProfileId: profile.id,
      name: "Tugiisikuteenus",
      defaultUnit: "HOUR",
      activityCatalog: ["saatmine", "asjaajamine"]
    }
  });
  const sessionService = await prisma.serviceProviderService.create({
    data: { providerProfileId: profile.id, name: "Koduvisiit", defaultUnit: "SESSION" }
  });

  const refA = await prisma.serviceReferral.create({
    data: {
      providerProfileId: profile.id,
      serviceId: hourly.id,
      kovName: "X vald",
      clientUserId: clientA.id,
      unit: "HOUR",
      status: "ACTIVE",
      periodStart: new Date("2026-08-01T00:00:00Z"),
      periodEnd: new Date("2026-08-31T00:00:00Z")
    }
  });
  const refEnded = await prisma.serviceReferral.create({
    data: {
      providerProfileId: profile.id,
      serviceId: hourly.id,
      kovName: "X vald",
      clientDisplayName: "Väline klient",
      unit: "HOUR",
      status: "ENDED"
    }
  });

  const base = {
    clientUserId: clientA.id,
    date: "2026-08-10",
    unit: "HOUR",
    quantity: 2,
    serviceId: hourly.id,
    referralId: refA.id
  };

  // --- 1. Suunamise terviklikkus (P1) ----------------------------------
  const happy = await createEntry(provider.id, base, { env: ENV_ON });
  expect("kehtiv kirje salvestub", Boolean(happy?.id));
  expect("uus kirje sünnib MUSTANDINA", happy.status === "DRAFT", happy.status);

  await expectReject(
    "VÕÕRA KLIENDI suunamine on keelatud — see oli P1-leid",
    createEntry(provider.id, { ...base, clientUserId: null, clientDisplayName: "client-b" }, { env: ENV_ON }),
    messageKeyIs("service_log.errors.referral_client_mismatch")
  );
  await expectReject(
    "lõppenud suunamise alla ei saa mahtu kirjutada",
    createEntry(
      provider.id,
      { ...base, clientUserId: null, clientDisplayName: "Väline klient", referralId: refEnded.id },
      { env: ENV_ON }
    ),
    messageKeyIs("service_log.errors.referral_not_active")
  );
  await expectReject(
    "suunamise perioodist väljas kuupäev on keelatud",
    createEntry(provider.id, { ...base, date: "2026-09-15" }, { env: ENV_ON }),
    messageKeyIs("service_log.errors.referral_date_outside_period")
  );
  await expectReject(
    "teine teenus kui suunamisel on keelatud",
    createEntry(provider.id, { ...base, serviceId: sessionService.id }, { env: ENV_ON }),
    messageKeyIs("service_log.errors.referral_service_mismatch")
  );
  await expectReject(
    "teine ühik kui suunamisel on keelatud",
    createEntry(provider.id, { ...base, unit: "SESSION", quantity: 1 }, { env: ENV_ON }),
    messageKeyIs("service_log.errors.referral_unit_mismatch")
  );

  // --- 2. Asukohatemplid (P1) ------------------------------------------
  const withTrail = await createEntry(
    provider.id,
    {
      ...base,
      locationStamps: {
        arrivedAt: { lat: 59.4, lng: 24.7, speed: 42, deviceId: "x" },
        leftAt: [{ lat: 59.5, lng: 24.8 }, { lat: 59.6, lng: 24.9 }],
        trail: [{ lat: 59.1, lng: 24.1 }]
      }
    },
    { env: ENV_ON }
  );
  const storedTrail = await prisma.serviceEntry.findUnique({
    where: { id: withTrail.id },
    select: { locationStamps: true }
  });
  expect(
    "asukohajada EI jõua andmebaasi — ainult üksikud punktid",
    JSON.stringify(storedTrail.locationStamps) === JSON.stringify({ arrivedAt: { lat: 59.4, lng: 24.7 } }),
    JSON.stringify(storedTrail.locationStamps)
  );

  const withoutFlag = await createEntry(
    provider.id,
    { ...base, locationStamps: { arrivedAt: { lat: 59.4, lng: 24.7 } } },
    { env: ENV_NO_LOCATION }
  );
  const storedNone = await prisma.serviceEntry.findUnique({
    where: { id: withoutFlag.id },
    select: { locationStamps: true }
  });
  expect("väljas lipuga ei salvestata asukohta üldse", storedNone.locationStamps === null);

  // PATCH väljas lipuga EI TOHI olemasolevaid templeid kustutada.
  await updateEntry(provider.id, withTrail.id, { note: "märge" }, { env: ENV_NO_LOCATION });
  const afterPatch = await prisma.serviceEntry.findUnique({
    where: { id: withTrail.id },
    select: { locationStamps: true }
  });
  expect(
    "väljas lipuga PATCH EI KUSTUTA olemasolevaid templeid — see oli vaikne andmekadu",
    afterPatch.locationStamps !== null,
    JSON.stringify(afterPatch.locationStamps)
  );

  // --- 3. Elutsükkel ja säilitus (P1) ----------------------------------
  expect("MUSTANDI saab kustutada", (await deleteEntry(provider.id, withoutFlag.id, { env: ENV_ON })).deleted);

  const finalized = await finalizeEntry(provider.id, happy.id, {
    env: ENV_ON,
    now: new Date("2027-01-15T10:00:00Z")
  });
  expect("kinnitamine viib kirje FINAL-isse", finalized.status === "FINAL");
  const finalRow = await prisma.serviceEntry.findUnique({
    where: { id: happy.id },
    select: { recordedFiscalYear: true }
  });
  expect(
    "kirjendamise majandusaasta salvestub KINNITAMISE, mitte teenuse kuupäeva järgi",
    finalRow.recordedFiscalYear === 2027,
    String(finalRow.recordedFiscalYear)
  );
  expect(
    "säilitustähtaeg arvutatakse majandusaasta lõpust (2027 -> 2035-01-01)",
    finalized.retentionEndsAt?.slice(0, 10) === "2035-01-01",
    finalized.retentionEndsAt
  );
  await expectReject(
    "kinnitatud kirjet ei saa kustutada",
    deleteEntry(provider.id, happy.id, { env: ENV_ON }),
    statusIs(409)
  );

  // --- 4. Parandusjälg (P1, RPS § 10) ----------------------------------
  await expectReject(
    "kinnitatud kirje muutmine ILMA PÕHJUSETA on keelatud",
    updateEntry(provider.id, happy.id, { quantity: 3 }, { env: ENV_ON }),
    messageKeyIs("service_log.errors.reason_required")
  );

  const corrected = await updateEntry(
    provider.id,
    happy.id,
    { quantity: 3, reason: "Kohtumine algas varem kui nupp vajutati." },
    { env: ENV_ON }
  );
  expect("põhjusega parandus läheb läbi", corrected.quantity === 3);

  const corrections = await listEntryCorrections(provider.id, happy.id, { env: ENV_ON });
  expect("parandus jättis jälje", corrections.length === 1);
  expect(
    "jälg kannab EELMIST väärtust, mitte ainult uut",
    String(corrections[0]?.previousValues?.quantity) === "2",
    JSON.stringify(corrections[0]?.previousValues)
  );
  expect("jälg kannab põhjust", Boolean(corrections[0]?.reason));
  expect("jälg kannab tegijat", corrections[0]?.actorUserId === provider.id);
  expect("jälg nimetab muutunud välja", corrections[0]?.changedFields?.includes("quantity"));

  // --- 5. Tühistamine ---------------------------------------------------
  await expectReject(
    "tühistamine ilma põhjuseta on keelatud",
    voidEntry(provider.id, happy.id, { env: ENV_ON }),
    messageKeyIs("service_log.errors.reason_required")
  );
  const voided = await voidEntry(provider.id, happy.id, { reason: "Topeltkirje.", env: ENV_ON });
  expect("tühistatud kirje jääb alles ja kannab põhjust", voided.status === "VOID" && Boolean(voided.voidReason));
  await expectReject(
    "tühistatud kirjet ei muudeta enam",
    updateEntry(provider.id, happy.id, { quantity: 9, reason: "x" }, { env: ENV_ON }),
    messageKeyIs("service_log.errors.already_void")
  );

  // --- 6. Sisendivalideerimine (P2) -------------------------------------
  const sloppy = await createEntry(
    provider.id,
    {
      ...base,
      confirmedManually: "false",
      activities: ["saatmine", "väljamõeldud tegevus", 42],
      moneyAmount: "12.345"
    },
    { env: ENV_ON }
  );
  expect('string "false" EI muuda kinnitust tõeseks', sloppy.confirmedManually === false);
  expect(
    "kataloogiväline tegevus jäetakse välja",
    JSON.stringify(sloppy.activities) === JSON.stringify(["saatmine"]),
    JSON.stringify(sloppy.activities)
  );
  expect("rahasumma ümardatakse sendini", sloppy.moneyAmount === 12.35 || sloppy.moneyAmount === 12.34, String(sloppy.moneyAmount));
  await expectReject(
    "negatiivne rahasumma peatatakse",
    createEntry(provider.id, { ...base, moneyAmount: -5 }, { env: ENV_ON }),
    messageKeyIs("service_log.errors.money_invalid")
  );

  // --- 7. Ühik ei muutu vaikimisi HOUR-iks (P1) -------------------------
  const sessionDefaults = await getEntryDefaults(
    provider.id,
    { clientDisplayName: "Keegi uus" },
    { env: ENV_ON }
  );
  expect(
    "mitme teenusega osutajal ei teki vaikeühikut HOUR",
    sessionDefaults.unit === null && sessionDefaults.askUnit === true,
    `${sessionDefaults.unit} / ${sessionDefaults.askUnit}`
  );

  // --- 8. Skoop ja värav -------------------------------------------------
  await expectReject(
    "võõra osutaja kirje annab 404, mitte 403",
    updateEntry(rival.id, sloppy.id, { note: "x" }, { env: ENV_ON }),
    statusIs(404)
  );
  await expectReject(
    "suletud värav annab 404 ka teenuskihis",
    listEntries(provider.id, {}, { env: ENV_OFF }),
    statusIs(404)
  );
  const rivalEntries = await listEntries(rival.id, {}, { env: ENV_ON });
  expect("teine osutaja ei näe võõraid kirjeid", rivalEntries.length === 0);

  // --- 9. E3: suunamise jääk ja ületamise hoiatus ------------------------
  const refBalance = await prisma.serviceReferral.create({
    data: {
      providerProfileId: profile.id,
      serviceId: hourly.id,
      kovName: "Y vald",
      clientDisplayName: "Saldo-klient",
      unit: "HOUR",
      status: "ACTIVE",
      allocatedQuantity: 20,
      allocationPeriod: "MONTH"
    }
  });
  const saldoBase = {
    clientDisplayName: "Saldo-klient",
    date: "2026-08-05",
    unit: "HOUR",
    serviceId: hourly.id,
    referralId: refBalance.id
  };

  const first = await createEntry(provider.id, { ...saldoBase, quantity: 8 }, { env: ENV_ON });
  expect("mahu sees olev kirje ei tekita hoiatust", first.overrun === null);

  const second = await createEntry(provider.id, { ...saldoBase, quantity: 15 }, { env: ENV_ON });
  expect(
    "ületav kirje HOIATAB, aga salvestub siiski",
    Boolean(second.id) && second.overrun?.warn === true,
    JSON.stringify(second.overrun)
  );
  expect("hoiatus ütleb, mitu ühikut üle läheb", second.overrun?.overBy === 3, String(second.overrun?.overBy));

  const listed = await listReferrals(provider.id, { month: "2026-08" }, { env: ENV_ON });
  const balanceRow = listed.find((row) => row.id === refBalance.id);
  expect("suunamiste loend kannab jääki KAASA", balanceRow?.balance !== null && balanceRow?.balance !== undefined);
  expect(
    "jääk näitab ületust õige numbriga",
    balanceRow?.balance?.remaining === -3 && balanceRow?.balance?.overrun === true,
    JSON.stringify(balanceRow?.balance)
  );
  expect(
    "mustandid on jäägis eraldi nähtavad",
    balanceRow?.balance?.pending === 23 && balanceRow?.balance?.used === 0,
    JSON.stringify(balanceRow?.balance)
  );

  await voidEntry(provider.id, second.id, { reason: "Topelt.", env: ENV_ON });
  const afterVoid = await getReferralBalance(provider.id, refBalance.id, { month: "2026-08" }, { env: ENV_ON });
  expect(
    "tühistatud kirje vabastab kvoodi",
    afterVoid.remaining === 12 && afterVoid.overrun === false,
    JSON.stringify(afterVoid)
  );

  await expectReject(
    "ühikut ei saa muuta, kui suunamise all on juba kirjeid",
    updateReferral(provider.id, refBalance.id, { unit: "SESSION" }, { env: ENV_ON }),
    messageKeyIs("service_log.errors.referral_locked_by_entries")
  );
  const enlarged = await updateReferral(
    provider.id,
    refBalance.id,
    { allocatedQuantity: 40 },
    { env: ENV_ON }
  );
  expect("mahu suurendamine on lubatud", Number(enlarged.allocatedQuantity) === 40);

  const ended = await endReferral(provider.id, refBalance.id, { env: ENV_ON });
  expect("lõpetamine viib suunamise ENDED-isse", ended.status === "ENDED");
  const entriesAfterEnd = await prisma.serviceEntry.count({ where: { referralId: refBalance.id } });
  expect("lõpetamine EI KUSTUTA olemasolevaid kirjeid", entriesAfterEnd === 2, String(entriesAfterEnd));
  await expectReject(
    "lõpetatud suunamise alla ei saa uut mahtu",
    createEntry(provider.id, { ...saldoBase, quantity: 1 }, { env: ENV_ON }),
    messageKeyIs("service_log.errors.referral_not_active")
  );

  // --- Koristus ----------------------------------------------------------
  console.log("\ncleanup");
  const beforeCorrections = await prisma.serviceEntryCorrection.count({
    where: { entry: { providerProfile: { organizationName: MARK } } }
  });
  await purge();
  const leftovers = {
    entries: await prisma.serviceEntry.count({ where: { providerProfile: { organizationName: MARK } } }),
    corrections: await prisma.serviceEntryCorrection.count({ where: { reason: { contains: "Topeltkirje" } } }),
    profiles: await prisma.serviceProviderProfile.count({ where: { organizationName: MARK } }),
    users: await prisma.user.count({ where: { email: { endsWith: SUFFIX } } })
  };
  console.log(`  parandusjälgi enne koristust: ${beforeCorrections}`);
  expect(
    "koristus ei jätnud jääke",
    Object.values(leftovers).every((count) => count === 0),
    JSON.stringify(leftovers)
  );
  expect(
    "parandusjälg kadus koos kirjega (Cascade)",
    leftovers.corrections === 0 && beforeCorrections > 0,
    `enne ${beforeCorrections}, pärast ${leftovers.corrections}`
  );

  // rivalProfile ja refEnded on samas MARK-is, seega purge katab nad ka.
  void rivalProfile;
  void refEnded;

  console.log(`\n${passed} passed, ${failed} failed`);
  return failed === 0 ? 0 : 1;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (error) => {
    console.error("RUNTIME KUKKUS:", error?.message || error);
    console.error(error?.stack || "");
    await purge().catch(() => {});
    await prisma.$disconnect().catch(() => {});
    process.exit(2);
  });
