#!/usr/bin/env node
/**
 * A4 E3 — sünteetiline runtime-sond MTR-i loakontrolli tabelitele.
 *
 * Miks ta olemas on: fake-prismaga roheline sviit ei tõenda skeemi. Uus tabel,
 * vale veerutüüp või katkine kaskaad paistavad välja alles päris andmebaasis —
 * ja A4 puhul tähendaks vaikne skeemiviga valet usaldusmärgist.
 *
 * Mida ta tõendab:
 *   1. `LicenceCheck` + `LicenceRecord` + `LicenceRecordLocation` kirjutuvad
 *      ühe pesastatud loominguga ja loetakse tagasi samal kujul;
 *   2. `ServiceProviderService.serviceKey` ja `ServiceLicenceAssessment` seos
 *      töötab mõlemat pidi (teenuselt hinnanguni ja tagasi);
 *   3. kaskaadkustutus koristab load ja kohad koos kontrolliga ära;
 *   4. teenuskiht `runLicenceCheck` läbib päris andmebaasi vastu terve ahela,
 *      MTR-i päring on asendatud sünteetilise vastusega (võõrast registrit
 *      sond ei koorma).
 *
 * Andmed on SÜNTEETILISED ja sond koristab enda järelt ära. Päris kasutajate
 * sisu ta ei loe ega puutu (töökorra reegel 4).
 *
 * Käivitamine:
 *   node --import ./scripts/register-node-test-loader.mjs scripts/mtr-licence-probe.mjs
 */

import { prisma } from "../lib/prisma.js";
import { runLicenceCheck } from "../lib/mtr/licenceCheckService.js";

const SUFFIX = "a4-probe";
const lines = [];
let failures = 0;

function check(label, condition, detail = "") {
  if (condition) lines.push(`  OK   ${label}${detail ? ` — ${detail}` : ""}`);
  else {
    failures += 1;
    lines.push(`  VIGA ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const created = { profileId: null };

try {
  const profile = await prisma.serviceProviderProfile.create({
    data: {
      organizationName: `A4 sond ${SUFFIX}`,
      registryCode: "17027241",
      status: "DRAFT",
      serviceItems: {
        create: [
          { name: "Toetatud elamine (sond)", serviceKey: "TOETATUD_ELAMINE" },
          { name: "Tugiisik (sond)", serviceKey: "TUGIISIK" },
          { name: "Sidumata teenus (sond)" }
        ]
      }
    },
    select: { id: true, serviceItems: { select: { id: true, serviceKey: true }, orderBy: { name: "asc" } } }
  });
  created.profileId = profile.id;
  lines.push(`profiil loodud: ${profile.id} (${profile.serviceItems.length} teenust)`);

  /* 1–3: tabelid, pesastatud loomine, kaskaad. */
  const direct = await prisma.licenceCheck.create({
    data: {
      providerProfileId: profile.id,
      registryCode: "17027241",
      result: "OK",
      entityResolved: true,
      entityName: "Masaan OÜ",
      checksumValid: true,
      verifiedAt: new Date(),
      unknownColumns: ["uus tulp"],
      licences: {
        create: [
          {
            licenceNumber: "SEH000598",
            registryCode: "17027241",
            activity: "Erihoolekandeteenus",
            activityType: "Toetatud elamise teenus",
            validFrom: new Date("2025-10-13T00:00:00.000Z"),
            indefinite: true,
            valid: true,
            organizationName: "Masaan OÜ",
            licensedMaxPersons: 60,
            locations: { create: [{ address: "Riia 5, Tartu", licensedMaxPersons: 60 }] }
          }
        ]
      }
    },
    select: { id: true }
  });

  const readBack = await prisma.licenceCheck.findUnique({
    where: { id: direct.id },
    include: { licences: { include: { locations: true } } }
  });
  check("pesastatud loomine ja tagasilugemine", readBack?.licences?.length === 1);
  check("tegevusala liik säilib", readBack?.licences?.[0]?.activityType === "Toetatud elamise teenus");
  check("tegevuskoht säilib", readBack?.licences?.[0]?.locations?.[0]?.address === "Riia 5, Tartu");
  check("massiivveerg säilib", JSON.stringify(readBack?.unknownColumns) === '["uus tulp"]');

  await prisma.licenceCheck.delete({ where: { id: direct.id } });
  const orphanRecords = await prisma.licenceRecord.count({ where: { checkId: direct.id } });
  check("kaskaadkustutus koristab load", orphanRecords === 0);

  /* 4: terve ahel teenuskihi kaudu, sünteetilise registrivastusega. */
  const result = await runLicenceCheck({
    providerProfileId: profile.id,
    prisma,
    resolveEntity: async () => ({ status: "OK", found: true, name: "Masaan OÜ" }),
    fetchLicences: async () => ({
      status: "OK",
      reason: null,
      registryCode: "17027241",
      checksumValid: true,
      unknownColumns: [],
      missingOrderedColumns: [],
      attemptedAt: new Date().toISOString(),
      checkedAt: new Date().toISOString(),
      licences: [
        {
          number: "SEH000598",
          organizationName: "Masaan OÜ",
          registryCode: "17027241",
          activity: "Erihoolekandeteenus",
          activityType: "Toetatud elamise teenus",
          validFrom: "2025-10-13",
          validUntil: null,
          indefinite: true,
          valid: true,
          licensedMaxPersons: 60,
          note: null,
          locations: [{ address: "Riia 5, Tartu", licensedMaxPersons: 60 }]
        }
      ]
    })
  });
  check("teenuskiht läbis ahela", result.ok === true, `checkId=${result.checkId}`);

  const rows = await prisma.serviceProviderService.findMany({
    where: { providerProfileId: profile.id },
    select: { name: true, serviceKey: true, licenceAssessment: { select: { publicStatus: true, coverage: true, catalogueVersion: true } } },
    orderBy: { name: "asc" }
  });
  const byKey = new Map(rows.map((row) => [row.serviceKey || "SIDUMATA", row.licenceAssessment]));
  check("loakohustuslik teenus sai VERIFIED", byKey.get("TOETATUD_ELAMINE")?.publicStatus === "VERIFIED");
  check("täpne liik andis EXACT_MATCH", byKey.get("TOETATUD_ELAMINE")?.coverage === "EXACT_MATCH");
  check("loakohustuseta teenus", byKey.get("TUGIISIK")?.publicStatus === "NO_SHS_LICENCE_REQUIRED");
  check("sidumata teenus", byKey.get("SIDUMATA")?.publicStatus === "SERVICE_MAPPING_REQUIRED");
  check("kataloogi versioon salvestus", Boolean(byKey.get("TOETATUD_ELAMINE")?.catalogueVersion));
} catch (error) {
  failures += 1;
  lines.push(`  VIGA sond kukkus: ${error?.message || error}`);
} finally {
  /* Koristus ei tohi esimese vea peale katkeda. */
  if (created.profileId) {
    try {
      await prisma.serviceProviderProfile.delete({ where: { id: created.profileId } });
      lines.push("koristatud: profiil ja kogu kaskaad kustutatud");
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
