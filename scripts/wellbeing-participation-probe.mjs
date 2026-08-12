#!/usr/bin/env node
/**
 * SOL-WB-01 ja SOL-WB-02 — sama rollirühm kahes majas, üks koond.
 *
 *   npm run wb:pilot:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Ühiktestid annavad koondile ette
 * valmis massiivi ja vaatavad, mida ta sellega teeb — nad EI SAA öelda, kas
 * päris PostgreSQL-i WHERE filtreerib samamoodi, kas osalus jõuab kirjeni,
 * kas ta pärandub parandusele ja kas teda saab hiljem üle kirjutada.
 * Fake-prisma ei valideeri; seda õppetundi on selles projektis juba makstud.
 *
 * Kriteeriumid sõna-sõnalt:
 *   WB-01: „Integratsioonitest peab looma sama rollirühma kahes organisatsioonis
 *          ning tõendama, et kummagi vaataja valimis pole teise asutuse ridu."
 *   WB-02: „Negatiivne HTTP-test peab proovima võõrast rollirühma."
 *
 * NEGATIIVKONTROLLID (ilma nendeta tõendaks sond ainult iseennast): iga positiivse
 * väite kõrval jookseb VANA reegel samade ridade peal ja peab LEKKIMA.
 *
 * Andmed: ainult `@sol-wb.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { buildWellbeingAggregateDataset } from "../lib/wellbeing/aggregate.js";
import { resolveWellbeingParticipation } from "../lib/wellbeing/participation.js";
import {
  createQuickCheckRecordForUser,
  createWellbeingRecordCorrectionForUser
} from "../lib/wellbeing/records.js";

const SUFFIX = "@sol-wb.invalid";
const MARK = "(wb-sünteetiline)";
const NOW = new Date();
const AGG = { prisma, env: { WELLBEING_MIN_GROUP_SIZE: "3" } };

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

/* Roheline: kõik madal, ühtegi riskimarkerit ei teki. */
const CALM = Object.freeze({
  workloadLevel: "low",
  caseComplexityLevel: "routine",
  emotionalLoad: "low",
  documentationLoad: "low",
  interruptionsLevel: "low",
  recoveryLevel: "sufficient",
  afterHoursImpact: "none",
  decisionControl: "high",
  priorityClarity: "clear",
  supportAvailability: "available",
  covisionNeed: false,
  workBoundaryClarity: "clear",
  difficultCaseMarker: false,
  supportNeed: false
});

/* Punane: kriitiline koormus + puuduv taastumine annab nii `red` signaali kui
   riskimarkeri. See on see sisu, mida teise maja vaataja EI TOHI näha. */
const STRAINED = Object.freeze({
  ...CALM,
  workloadLevel: "critical",
  recoveryLevel: "none",
  emotionalLoad: "very_high",
  difficultCaseMarker: true
});

async function makeUser(local) {
  return prisma.user.create({
    data: { email: `${local}${SUFFIX}`, role: "SOCIAL_WORKER", emailVerified: NOW }
  });
}

async function makeMunicipality(slug, name) {
  return prisma.municipality.create({
    data: { slug: `${slug}-sol-wb`, baseName: name, type: "VALD", displayName: `${name} ${MARK}` }
  });
}

async function makeOrg(name, municipalityId) {
  return prisma.organization.create({
    data: {
      displayName: `${name} ${MARK}`,
      legalKind: "COMPANY",
      status: "ACTIVE",
      /* DB CHECK: `ACTIVE` nõuab kinnitust — sond sünnib samadest reeglitest,
         mille all päris organisatsioon elab. */
      verifiedAt: NOW,
      activatedAt: NOW,
      municipalityId
    }
  });
}

async function addMember(org, user, seatRole = "SOCIAL_WORKER") {
  return prisma.organizationMembership.create({
    data: { organizationId: org.id, userId: user.id, status: "ACTIVE", seatRole }
  });
}

async function quickCheck(user, standardizedFields, roleGroupClaim = "SOCIAL_WORKER") {
  const { record } = await createQuickCheckRecordForUser(
    user.id,
    { roleGroup: roleGroupClaim, standardizedFields },
    { prisma }
  );
  return record;
}

function metric(dataset, key) {
  return dataset.metrics?.find((row) => row.metricKey === key)?.metricValue ?? null;
}

/** VANA reegel, sõna-sõnalt: kirje enda `roleGroup` veerg, ilma osaluseta. */
function legacyWhere(ids, roleGroup) {
  return {
    id: { in: ids },
    aggregationEligible: true,
    visibility: "private",
    roleGroup
  };
}

async function purge() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: SUFFIX } },
    select: { id: true }
  });
  const userIds = users.map((row) => row.id);
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.organization.deleteMany({ where: { displayName: { contains: MARK } } });
  await prisma.municipality.deleteMany({ where: { displayName: { contains: MARK } } });
}

async function main() {
  console.log("SOL-WB-01/-02 — sama rollirühm kahes majas, üks koond\n");
  await purge();

  const kovA = await makeMunicipality("a-kov", "A vald");
  const kovB = await makeMunicipality("b-kov", "B vald");
  const orgA = await makeOrg("A maja", kovA.id);
  const orgB = await makeOrg("B maja", kovB.id);

  const teamA = [];
  const teamB = [];
  for (let index = 0; index < 3; index += 1) {
    const memberA = await makeUser(`a-${index}`);
    const memberB = await makeUser(`b-${index}`);
    await addMember(orgA, memberA);
    await addMember(orgB, memberB);
    teamA.push(await quickCheck(memberA, CALM));
    teamB.push(await quickCheck(memberB, STRAINED));
  }

  /* WB-02 pahatahtlik klient: tema TÕENDATUD istmeroll on SERVICE_PROVIDER,
     aga ta väidab payload'is end sotsiaaltöötajaks — täpselt see kutse, mille
     vastu liides kaitset ei anna. */
  const impostor = await makeUser("impostor");
  await addMember(orgA, impostor, "SERVICE_PROVIDER");
  const impostorRecord = await quickCheck(impostor, STRAINED, "SOCIAL_WORKER");

  /* Kaks aktiivset liikmesust: kumma maja koormus see oli, ei ütle keegi. */
  const twoHats = await makeUser("two-hats");
  await addMember(orgA, twoHats);
  await addMember(orgB, twoHats);
  const twoHatsRecord = await quickCheck(twoHats, STRAINED);

  /* Ilma liikmesuseta konto: tema kirje on tema oma ja mitte kellegi koond. */
  const solo = await makeUser("solo");
  const soloRecord = await quickCheck(solo, STRAINED);

  const allIds = [...teamA, ...teamB, impostorRecord, twoHatsRecord, soloRecord].map((row) => row.id);

  // === 1. OSALUS SÜNNIB KIRJEGA JA AINULT SIIS, KUI TA ON TÕENDATUD ========
  const participationA = await prisma.wellbeingParticipation.findUnique({
    where: { recordId: teamA[0].id }
  });
  expect("kirje saab sünniga osaluse", Boolean(participationA));
  expect("osalus kannab organisatsiooni", participationA?.organizationId === orgA.id);
  expect("osalus kannab KOV-i samast hetkest", participationA?.municipalityId === kovA.id);
  expect(
    "osaluse rollirühm tuleb istmerollist, mitte payload'ist",
    participationA?.roleGroup === "SOCIAL_WORKER",
    String(participationA?.roleGroup)
  );

  const impostorParticipation = await prisma.wellbeingParticipation.findUnique({
    where: { recordId: impostorRecord.id }
  });
  expect(
    "võõras rollirühm payload'is ei muuda osalust",
    impostorParticipation?.roleGroup === "SERVICE_PROVIDER",
    String(impostorParticipation?.roleGroup)
  );
  expect(
    "kirje enda veerg kannab endiselt kasutaja väidet (väli ei kadunud)",
    impostorRecord.roleGroup === "SOCIAL_WORKER"
  );

  expect(
    "kahe liikmesusega kontol osalust ei ole",
    (await prisma.wellbeingParticipation.findUnique({ where: { recordId: twoHatsRecord.id } })) === null
  );
  expect(
    "liikmesuseta kontol osalust ei ole",
    (await prisma.wellbeingParticipation.findUnique({ where: { recordId: soloRecord.id } })) === null
  );
  expect(
    "tuletus ise ütleb kahe liikmesuse peale null",
    (await resolveWellbeingParticipation(twoHats.id, { prisma })) === null
  );

  // === 2. KUMMAGI VAATAJA VALIMIS EI OLE TEISE MAJA RIDU (WB-01) ===========
  const datasetA = await buildWellbeingAggregateDataset(
    { organizationId: orgA.id, roleGroup: "SOCIAL_WORKER" },
    AGG
  );
  const datasetB = await buildWellbeingAggregateDataset(
    { organizationId: orgB.id, roleGroup: "SOCIAL_WORKER" },
    AGG
  );

  expect("A maja valim on kolm inimest ja kolm kirjet", datasetA.sampleSize === 3 && datasetA.recordCount === 3, `${datasetA.sampleSize}/${datasetA.recordCount}`);
  expect("B maja valim on kolm inimest ja kolm kirjet", datasetB.sampleSize === 3 && datasetB.recordCount === 3, `${datasetB.sampleSize}/${datasetB.recordCount}`);
  expect("kumbki valim ei ole künnisega summutatud", datasetA.suppressed === false && datasetB.suppressed === false);
  expect("A maja koondis ei ole ühtegi punast signaali", metric(datasetA, "signal.red.count") === 0);
  expect("B maja koondis on kolm punast signaali", metric(datasetB, "signal.red.count") === 3);
  expect(
    "B maja riskimarker EI ILMU A maja koondisse",
    metric(datasetA, "risk_event.risk.difficult_case.count") === null
      && metric(datasetB, "risk_event.risk.difficult_case.count") === 3
  );
  expect(
    "vastus ütleb välja, millise piiriga ta arvutati",
    datasetA.filters.organizationId === orgA.id && datasetA.filters.municipalityId === null
  );

  const datasetKovA = await buildWellbeingAggregateDataset(
    { municipalityId: kovA.id, roleGroup: "SOCIAL_WORKER" },
    AGG
  );
  expect("KOV-piir annab sama valimi mis tema ainus maja", datasetKovA.recordCount === 3 && metric(datasetKovA, "signal.red.count") === 0);

  // === 3. NEGATIIVKONTROLL: VANA REEGEL LEKIB SAMADE RIDADE PEAL ===========
  const legacyCount = await prisma.wellbeingRecord.count({
    where: legacyWhere(allIds, "SOCIAL_WORKER")
  });
  expect(
    "vana reegel loeb ühte rollirühma KÕIK üheksa rida — kuus kahest majast, teeskleja ja kaks tõendamata kontot",
    legacyCount === 9,
    `sai ${legacyCount}`
  );

  const scopedCount = await prisma.wellbeingRecord.count({
    where: {
      id: { in: allIds },
      aggregationEligible: true,
      visibility: "private",
      participation: { is: { organizationId: orgA.id, roleGroup: "SOCIAL_WORKER" } }
    }
  });
  expect("uus reegel loeb samadest ridadest ainult A maja kolm", scopedCount === 3, `sai ${scopedCount}`);

  // === 4. PARANDUS PÄRIB OSALUSE, EI TULETA UUESTI =========================
  const mover = await prisma.user.findUnique({ where: { email: `a-0${SUFFIX}` } });
  await prisma.organizationMembership.updateMany({
    where: { userId: mover.id, organizationId: orgA.id },
    data: { status: "ENDED", endedAt: NOW }
  });
  await addMember(orgB, mover);
  expect(
    "negatiivkontroll: uuesti tuletades ANNAKS parandus nüüd B maja",
    (await resolveWellbeingParticipation(mover.id, { prisma }))?.organizationId === orgB.id
  );

  const { record: correction } = await createWellbeingRecordCorrectionForUser(
    mover.id,
    teamA[0].id,
    { standardizedFields: { ...CALM, documentationLoad: "high" } },
    { prisma }
  );
  const correctionParticipation = await prisma.wellbeingParticipation.findUnique({
    where: { recordId: correction.id }
  });
  expect(
    "parandus jääb sinna majja, kus töö tehti",
    correctionParticipation?.organizationId === orgA.id,
    String(correctionParticipation?.organizationId)
  );
  expect("parandus kannab ka sama KOV-i", correctionParticipation?.municipalityId === kovA.id);

  const datasetAfter = await buildWellbeingAggregateDataset(
    { organizationId: orgA.id, roleGroup: "SOCIAL_WORKER" },
    AGG
  );
  expect(
    "parandus ei topeltloe: vana kirje kukkus koondist, uus tuli asemele",
    datasetAfter.recordCount === 3 && datasetAfter.sampleSize === 3,
    `${datasetAfter.recordCount}/${datasetAfter.sampleSize}`
  );
  const datasetBAfter = await buildWellbeingAggregateDataset(
    { organizationId: orgB.id, roleGroup: "SOCIAL_WORKER" },
    AGG
  );
  expect("töökohavahetus ei kolinud vana koormust uude majja", datasetBAfter.recordCount === 3);

  // === 5. OSALUS ON KÜLMUTATUD — ANDMEBAAS, MITTE LUBADUS ==================
  let frozen = false;
  try {
    await prisma.wellbeingParticipation.update({
      where: { recordId: teamA[1].id },
      data: { organizationId: orgB.id }
    });
  } catch (error) {
    frozen = /frozen at creation/u.test(String(error?.message || ""));
  }
  expect("osaluse ümberkirjutamine kukub andmebaasi tasemel", frozen);

  let roleFrozen = false;
  try {
    await prisma.wellbeingParticipation.update({
      where: { recordId: teamA[1].id },
      data: { roleGroup: "SERVICE_PROVIDER" }
    });
  } catch (error) {
    roleFrozen = /frozen at creation/u.test(String(error?.message || ""));
  }
  expect("ka rollirühma ei saa tagantjärele vahetada", roleFrozen);

  // === 6. KUSTUTUS VIIB OSALUSE KAASA =====================================
  await prisma.wellbeingRecord.delete({ where: { id: teamB[2].id } });
  expect(
    "kirje kustutus kustutab ka tema osaluse",
    (await prisma.wellbeingParticipation.findUnique({ where: { recordId: teamB[2].id } })) === null
  );

  await purge();
  expect("koristus viis sünteetilised read ära", (await prisma.wellbeingParticipation.count({ where: { organizationId: { in: [orgA.id, orgB.id] } } })) === 0);

  console.log(`\n${failed === 0 ? "PROBE_OK" : "PROBE_FAIL"} ${passed}/${passed + failed}`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
    await purge().catch(() => {});
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
