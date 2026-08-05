#!/usr/bin/env node
/**
 * A4 — sünteetiline runtime-sond MTR-i loakontrolli tabelitele.
 *
 * Miks ta olemas on: fake-prismaga roheline sviit ei tõenda skeemi. Uus tabel,
 * vale veerutüüp, katkine kaskaad või mitte-atomaarne kirjutus paistavad välja
 * alles päris andmebaasis — ja A4 puhul tähendaks vaikne skeemiviga valet
 * usaldusmärgist kolmanda isiku kohta.
 *
 * Mida ta tõendab:
 *   1. `LicenceCheck` + `LicenceRecord` + `LicenceRecordLocation` kirjutuvad
 *      ühe pesastatud loominguga ja loetakse tagasi samal kujul;
 *   2. kaskaadkustutus koristab NII load KUI tegevuskohad;
 *   3. teenuse ja hinnangu seos töötab MÕLEMAT pidi;
 *   4. teenuskiht läbib terve ahela ja salvestab kõik hinnangu metaandmed
 *      (`publicStatusValidUntil`, `assessmentReason`, tõendi seos);
 *   5. seisud, mis EI TULENE kontrollist, ei seostu kontrolliga;
 *   6. lahendamata identiteet ei anna kunagi positiivset seisu;
 *   7. esimene ja teine puuduv vastus käituvad poliitika järgi;
 *   8. kirje + hinnangud on ÜKS tehing — vea korral ei jää poolikut seisu.
 *
 * MTR-i ei päritа: registrivastus on sünteetiline, seega võõrast registrit
 * sond ei koorma. Andmed on sünteetilised ja sond koristab enda järelt ära.
 * Päris kasutajate sisu ta ei loe ega puutu (töökorra reegel 4).
 *
 * Käivitamine:
 *   npm run mtr:probe
 */

import { prisma } from "../lib/prisma.js";
import { LICENCE_PUBLIC_STATUS } from "../lib/mtr/assessment.js";
import { runLicenceCheck } from "../lib/mtr/licenceCheckService.js";
import {
  serviceProviderProfileRagMetadata,
  serviceProviderProfileRagText,
  upsertServiceProviderProfileForOwner
} from "../lib/serviceProviderProfiles.js";

/* TOOTMISKAITSE: sond KIRJUTAB andmebaasi. Tootmises käivitub ta ainult
   selgesõnalise loaga, ja ka siis on see teadlik otsus, mitte kogemata. */
if (process.env.NODE_ENV === "production" && process.env.ALLOW_A4_DB_PROBE !== "1") {
  console.error("A4 runtime-sond ei käivitu tootmisandmebaasis ilma ALLOW_A4_DB_PROBE=1.");
  process.exit(1);
}

/* Juhuslik jooksu-ID: paralleelsed sondid ei põrku ja sünteetilised read on
   päris andmetest eristatavad. Registrikood on TAHTLIKULT olematu vahemikust,
   et ta ei saaks kunagi kokku langeda päris ettevõttega. */
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const SYNTHETIC_CODE = `99${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
const SYNTHETIC_NAME = `A4 sond ${runId}`;

const lines = [];
let failures = 0;

function check(label, condition, detail = "") {
  if (condition) lines.push(`  OK   ${label}${detail ? ` — ${detail}` : ""}`);
  else {
    failures += 1;
    lines.push(`  VIGA ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function syntheticLicences(licences, overrides = {}) {
  return async () => ({
    status: "OK",
    reason: null,
    registryCode: SYNTHETIC_CODE,
    checksumValid: true,
    licences,
    unknownColumns: [],
    missingOrderedColumns: ["tegevusala liik"],
    attemptedAt: new Date().toISOString(),
    checkedAt: new Date().toISOString(),
    ...overrides
  });
}

function syntheticLicence(overrides = {}) {
  return {
    number: `SEH-${runId}`,
    organizationName: SYNTHETIC_NAME,
    registryCode: SYNTHETIC_CODE,
    activity: "Erihoolekandeteenus",
    activityType: "Toetatud elamise teenus",
    validFrom: "2025-10-13",
    validUntil: null,
    indefinite: true,
    valid: true,
    licensedMaxPersons: 60,
    note: null,
    locations: [{ address: `Sondi tee 1, ${runId}`, licensedMaxPersons: 60 }],
    ...overrides
  };
}

const okEntity = async () => ({ status: "OK", reason: null, found: true, name: SYNTHETIC_NAME });

let profileId = null;
let createdUserId = null;

try {
  const profile = await prisma.serviceProviderProfile.create({
    data: {
      organizationName: SYNTHETIC_NAME,
      registryCode: SYNTHETIC_CODE,
      status: "DRAFT",
      serviceItems: {
        create: [
          { name: `Toetatud elamine ${runId}`, serviceKey: "TOETATUD_ELAMINE" },
          { name: `Tugiisik ${runId}`, serviceKey: "TUGIISIK" },
          { name: `Sidumata ${runId}` }
        ]
      }
    },
    select: { id: true, serviceItems: { select: { id: true, serviceKey: true } } }
  });
  profileId = profile.id;
  lines.push(`sond ${runId}: profiil ${profile.id}, ${profile.serviceItems.length} teenust, kood ${SYNTHETIC_CODE}`);

  /* 1 ja 2: pesastatud loomine, tagasilugemine ja KAHE taseme kaskaad. */
  const direct = await prisma.licenceCheck.create({
    data: {
      providerProfileId: profile.id,
      registryCode: SYNTHETIC_CODE,
      result: "OK",
      licenceSourceResult: "OK",
      entitySourceResult: "OK",
      entityResolved: true,
      entityName: SYNTHETIC_NAME,
      checksumValid: null,
      verifiedAt: new Date(),
      unknownColumns: ["uus tulp"],
      licences: {
        create: [
          {
            licenceNumber: `SEH-${runId}`,
            registryCode: SYNTHETIC_CODE,
            activity: "Erihoolekandeteenus",
            activityType: "Toetatud elamise teenus",
            validFrom: new Date("2025-10-13T00:00:00.000Z"),
            indefinite: true,
            valid: true,
            organizationName: SYNTHETIC_NAME,
            licensedMaxPersons: 60,
            locations: { create: [{ address: `Sondi tee 1, ${runId}`, licensedMaxPersons: 60 }] }
          }
        ]
      }
    },
    select: { id: true, licences: { select: { id: true, locations: { select: { id: true } } } } }
  });
  const recordId = direct.licences[0]?.id;
  const locationId = direct.licences[0]?.locations[0]?.id;

  const readBack = await prisma.licenceCheck.findUnique({
    where: { id: direct.id },
    include: { licences: { include: { locations: true } } }
  });
  check("pesastatud loomine ja tagasilugemine", readBack?.licences?.length === 1);
  check("tegevusala liik säilib", readBack?.licences?.[0]?.activityType === "Toetatud elamise teenus");
  check("tegevuskoht säilib", readBack?.licences?.[0]?.locations?.[0]?.address === `Sondi tee 1, ${runId}`);
  check("massiivveerg säilib", JSON.stringify(readBack?.unknownColumns) === '["uus tulp"]');
  check("checksumValid kannab NULL-i", readBack?.checksumValid === null, "ei saanud hinnata ei ole sama mis ei klapi");
  check(
    "kuupäev on kalendripäev",
    readBack?.licences?.[0]?.validFrom instanceof Date && readBack.licences[0].validFrom.toISOString().startsWith("2025-10-13")
  );

  await prisma.licenceCheck.delete({ where: { id: direct.id } });
  const orphanRecords = await prisma.licenceRecord.count({ where: { id: recordId } });
  const orphanLocations = await prisma.licenceRecordLocation.count({ where: { id: locationId } });
  check("kaskaad koristab load", orphanRecords === 0);
  check("kaskaad koristab TEGEVUSKOHAD", orphanLocations === 0, `locationId=${locationId}`);

  /* 4, 5 ja 6: terve ahel teenuskihi kaudu. */
  const run = await runLicenceCheck({
    providerProfileId: profile.id,
    prisma,
    resolveEntity: okEntity,
    fetchLicences: syntheticLicences([syntheticLicence()])
  });
  check("teenuskiht läbis ahela", run.completed === true && run.succeeded === true, `checkId=${run.checkId}`);

  const rows = await prisma.serviceProviderService.findMany({
    where: { providerProfileId: profile.id },
    select: {
      serviceKey: true,
      licenceAssessment: {
        select: {
          publicStatus: true,
          coverage: true,
          catalogueVersion: true,
          publicStatusValidUntil: true,
          coveringLicenceNumber: true,
          lastAttemptCheckId: true,
          statusSourceCheckId: true,
          confirmedMissCount: true
        }
      }
    }
  });
  const byKey = new Map(rows.map((row) => [row.serviceKey || "SIDUMATA", row.licenceAssessment]));

  check("loakohustuslik teenus sai VERIFIED", byKey.get("TOETATUD_ELAMINE")?.publicStatus === LICENCE_PUBLIC_STATUS.VERIFIED);
  check("täpne liik andis EXACT_MATCH", byKey.get("TOETATUD_ELAMINE")?.coverage === "EXACT_MATCH");
  check("aegumine salvestus", byKey.get("TOETATUD_ELAMINE")?.publicStatusValidUntil instanceof Date);
  check("tõendi loanumber salvestus", byKey.get("TOETATUD_ELAMINE")?.coveringLicenceNumber === `SEH-${runId}`);
  check("tõendi seos salvestus", byKey.get("TOETATUD_ELAMINE")?.statusSourceCheckId === run.checkId);
  check("kataloogi versioon salvestus", Boolean(byKey.get("TOETATUD_ELAMINE")?.catalogueVersion));
  check("missingOrderedColumns salvestus", JSON.stringify((await prisma.licenceCheck.findUnique({ where: { id: run.checkId }, select: { missingOrderedColumns: true } }))?.missingOrderedColumns) === '["tegevusala liik"]');

  check("loakohustuseta teenus", byKey.get("TUGIISIK")?.publicStatus === LICENCE_PUBLIC_STATUS.NO_SHS_LICENCE_REQUIRED);
  check("loakohustuseta teenusel EI OLE kontrolli seost", byKey.get("TUGIISIK")?.lastAttemptCheckId === null);
  check("sidumata teenus", byKey.get("SIDUMATA")?.publicStatus === LICENCE_PUBLIC_STATUS.SERVICE_MAPPING_REQUIRED);
  check("sidumata teenusel EI OLE kontrolli seost", byKey.get("SIDUMATA")?.lastAttemptCheckId === null);

  /* 3: seos mõlemat pidi. */
  const reverse = await prisma.serviceLicenceAssessment.findFirst({
    where: { serviceKey: "TOETATUD_ELAMINE", providerService: { providerProfileId: profile.id } },
    select: { providerService: { select: { name: true, providerProfileId: true } }, statusSource: { select: { registryCode: true } } }
  });
  check("hinnang → teenus seos", reverse?.providerService?.providerProfileId === profile.id);
  check("hinnang → tõendkontroll seos", reverse?.statusSource?.registryCode === SYNTHETIC_CODE);

  /* 7: esimene ja teine puuduv vastus. */
  const firstMiss = await runLicenceCheck({
    providerProfileId: profile.id,
    prisma,
    resolveEntity: okEntity,
    fetchLicences: syntheticLicences([])
  });
  const afterFirst = await prisma.serviceLicenceAssessment.findFirst({
    where: { serviceKey: "TOETATUD_ELAMINE", providerService: { providerProfileId: profile.id } },
    select: { publicStatus: true, confirmedMissCount: true, statusSourceCheckId: true }
  });
  check("esimene puudumine hoiab märgist vana tõendi najal", afterFirst?.publicStatus === LICENCE_PUBLIC_STATUS.VERIFIED);
  check("tõend jääb VANA kontrolli külge", afterFirst?.statusSourceCheckId === run.checkId, `viimane katse oli ${firstMiss.checkId}`);
  check("puudumiste loendur kasvas", afterFirst?.confirmedMissCount === 1);

  await runLicenceCheck({
    providerProfileId: profile.id,
    prisma,
    resolveEntity: okEntity,
    fetchLicences: syntheticLicences([])
  });
  const afterSecond = await prisma.serviceLicenceAssessment.findFirst({
    where: { serviceKey: "TOETATUD_ELAMINE", providerService: { providerProfileId: profile.id } },
    select: { publicStatus: true, confirmedMissCount: true }
  });
  check("teine puudumine annab NOT_FOUND", afterSecond?.publicStatus === LICENCE_PUBLIC_STATUS.NOT_FOUND);
  check("loendur jõudis kaheni", afterSecond?.confirmedMissCount === 2);

  /* 6: lahendamata identiteet ei anna positiivset seisu. */
  await runLicenceCheck({
    providerProfileId: profile.id,
    prisma,
    resolveEntity: async () => ({ status: "UNCONFIRMED", reason: "RESULT_MISMATCH", found: false, name: null }),
    fetchLicences: syntheticLicences([syntheticLicence()])
  });
  const afterUnresolved = await prisma.serviceLicenceAssessment.findFirst({
    where: { serviceKey: "TOETATUD_ELAMINE", providerService: { providerProfileId: profile.id } },
    select: { publicStatus: true }
  });
  check("lahendamata identiteet ei anna VERIFIED", afterUnresolved?.publicStatus === LICENCE_PUBLIC_STATUS.UNCONFIRMED);

  /* 9: PROFIILI SALVESTAMINE EI TOHI HINNANGUT KUSTUTADA.
     Vana `delete + create` hävitas kaskaadis kogu `ServiceLicenceAssessment`
     kirje — osutaja kaotanuks märgise iga kirjavea parandusega. */
  const owner = await prisma.user.create({
    data: { email: `a4-sond-${runId}@sotsiaalai.test`, role: "SERVICE_PROVIDER" },
    select: { id: true }
  });
  createdUserId = owner.id;
  const saved = await upsertServiceProviderProfileForOwner(owner.id, {
    organizationName: `${SYNTHETIC_NAME} salvestus`,
    registryCode: SYNTHETIC_CODE,
    serviceItems: [{ name: `Salvestuse teenus ${runId}`, description: "esimene" }]
  });
  const savedServiceId = saved.serviceItems?.[0]?.id;
  await prisma.serviceProviderService.update({ where: { id: savedServiceId }, data: { serviceKey: "TOETATUD_ELAMINE" } });
  await prisma.serviceLicenceAssessment.create({
    data: {
      providerServiceId: savedServiceId,
      serviceKey: "TOETATUD_ELAMINE",
      catalogueVersion: "sond",
      requirementAtAssessment: "REQUIRED",
      coverage: "EXACT_MATCH",
      publicStatus: "VERIFIED"
    }
  });

  await upsertServiceProviderProfileForOwner(owner.id, {
    organizationName: `${SYNTHETIC_NAME} salvestus`,
    registryCode: SYNTHETIC_CODE,
    serviceItems: [{ id: savedServiceId, name: `Salvestuse teenus ${runId}`, description: "TEINE, muudetud" }]
  });

  const afterSave = await prisma.serviceProviderService.findUnique({
    where: { id: savedServiceId },
    select: { description: true, serviceKey: true, licenceAssessment: { select: { publicStatus: true } } }
  });
  check("profiili salvestus säilitab teenuserea", Boolean(afterSave), `id=${savedServiceId}`);
  check("kirjelduse muutmine jõudis kohale", afterSave?.description === "TEINE, muudetud");
  check("serviceKey säilis", afterSave?.serviceKey === "TOETATUD_ELAMINE");
  check("HINNANG säilis salvestuse üle", afterSave?.licenceAssessment?.publicStatus === "VERIFIED");

  /* 10: RAG-DOKUMENT EI TOHI KANDA LOASEISU.
     „Kontrollitud" on väide, mis AEGUB, ja indeksisse kirjutatud tekst ei
     aegu iseenesest. Kui keegi selle kunagi dokumenti lisab, peab see
     kontroll punaseks minema — seis liidetakse soovituse ajal andmebaasist. */
  const ragProfile = {
    id: profile.id,
    organizationName: SYNTHETIC_NAME,
    serviceItems: [{ id: "s1", name: "Toetatud elamine", status: "PUBLISHED", serviceKey: "TOETATUD_ELAMINE" }],
    serviceLocations: []
  };
  const ragSerialized = `${serviceProviderProfileRagText(ragProfile)}\n${JSON.stringify(
    serviceProviderProfileRagMetadata(ragProfile, "sond")
  )}`.toLowerCase();
  const leaked = ["licence", "tegevusluba", "verified", "mtr"].filter((word) => ragSerialized.includes(word));
  check("RAG-dokument ei kanna loaseisu", leaked.length === 0, leaked.length ? `lekkis: ${leaked.join(", ")}` : "");

  /* 8: tehinguline terviklikkus. */
  const before = await prisma.licenceCheck.count({ where: { providerProfileId: profile.id } });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.licenceCheck.create({
        data: {
          providerProfileId: profile.id,
          registryCode: SYNTHETIC_CODE,
          result: "OK",
          licenceSourceResult: "OK",
          entitySourceResult: "OK"
        }
      });
      throw new Error("sunnitud katkestus");
    });
  } catch {
    /* oodatud */
  }
  const after = await prisma.licenceCheck.count({ where: { providerProfileId: profile.id } });
  check("tehing veereb vea korral tervikuna tagasi", after === before, `enne ${before}, pärast ${after}`);
} catch (error) {
  failures += 1;
  lines.push(`  VIGA sond kukkus: ${error?.message || error}`);
} finally {
  /* Koristus ei tohi esimese vea peale katkeda. */
  if (createdUserId) {
    try {
      await prisma.user.delete({ where: { id: createdUserId } });
    } catch (error) {
      failures += 1;
      lines.push(`  VIGA kasutaja koristus: ${error?.message || error}`);
    }
  }
  if (profileId) {
    try {
      await prisma.serviceProviderProfile.delete({ where: { id: profileId } });
      const leftovers = await prisma.licenceCheck.count({ where: { providerProfileId: profileId } });
      lines.push(leftovers === 0 ? "koristatud: profiil ja kogu kaskaad kustutatud" : `  VIGA koristus jättis ${leftovers} kontrolli`);
      if (leftovers !== 0) failures += 1;
    } catch (error) {
      failures += 1;
      lines.push(`  VIGA koristus: ${error?.message || error}`);
    }
  }
  await prisma.$disconnect();
  const total = lines.filter((line) => line.startsWith("  OK") || line.startsWith("  VIGA")).length;
  lines.push(failures ? `SOND KUKKUS: ${failures}/${total} viga` : `SOND OK: ${total}/${total}`);
  console.log(lines.join("\n"));
  process.exitCode = failures ? 1 : 0;
}
