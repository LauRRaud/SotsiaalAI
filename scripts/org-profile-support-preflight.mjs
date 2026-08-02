#!/usr/bin/env node
/**
 * T25 viil C (`20260802090000_org_profile_support_v1`) — ROLLBACK'i PREFLIGHT.
 *
 *   node --import ./scripts/register-node-test-loader.mjs scripts/org-profile-support-preflight.mjs
 *
 * MIKS SEE SKRIPT OLEMAS ON. Migratsioonis oli rollback'i värav kommentaarina
 * ja ta luges AINULT ORGANIZATION-režiimi profiile. Sellest ei piisa: rollback
 * sisaldab sammu
 *
 *   ALTER TABLE "ServiceProviderProfile" ALTER COLUMN "ownerId" SET NOT NULL;
 *
 * ja see kukub iga rea peal, mille `ownerId` on NULL. Selliseid ridu TEKIB
 * tavakasutuses: viil C muutis omanikuseose `SetNull`-iks just selleks, et
 * konto kustutamine ei hävitaks profiili. Migratsioon ise ütleb seda välja
 * (osa 2 kommentaar: „konto kustutamisel jääb `ownerId` NULL-iks").
 *
 * Kommentaarist ei piisa ka sellepärast, et teda ei jookse keegi. Preflight
 * jookseb: ta väljub koodiga 1, kui rollback ei ole ohutu, ja ütleb täpselt,
 * mitu rida ja millist sorti teel ees on.
 *
 * Väljundkoodid:  0 = rollback on ohutu · 1 = EI OLE ohutu · 2 = kontroll ise kukkus.
 */

import prisma from "../lib/prisma.js";

const GATES = [
  {
    key: "organization_profiles",
    label: "ORGANIZATION-režiimi profiile",
    why:
      "Rollback taastaks `ownerId` Cascade-seose ja seoks organisatsiooni profiili\n" +
      "    uuesti ühe inimese konto külge. Enne rollback'i tuleb need profiilid\n" +
      "    tagasi SOLO-režiimi viia või teadlikult kustutada.",
    count: () =>
      prisma.serviceProviderProfile.count({ where: { ownershipMode: "ORGANIZATION" } })
  },
  {
    key: "null_owner_profiles",
    label: "profiile, mille `ownerId` on NULL",
    why:
      "Rollback'i samm `ALTER COLUMN \"ownerId\" SET NOT NULL` kukub nende ridade\n" +
      "    peal. Need on profiilid, mille looja konto on kustutatud — viil C jättis\n" +
      "    profiili teadlikult alles. Enne rollback'i tuleb neile määrata uus omanik\n" +
      "    või nad kustutada.",
    count: () => prisma.serviceProviderProfile.count({ where: { ownerId: null } })
  },
  {
    key: "duplicate_owner_profiles",
    label: "omanikke, kellel on rohkem kui üks profiil",
    why:
      "Rollback taastab `CREATE UNIQUE INDEX \"ServiceProviderProfile_ownerId_key\"`,\n" +
      "    mis on TÄIELIK unikaalsus. Viil C osaline indeks lubab samal inimesel olla\n" +
      "    ühe org-profiili päritolu JA omada uut solo-profiili — need read põrkaksid.",
    count: async () => {
      const rows = await prisma.serviceProviderProfile.groupBy({
        by: ["ownerId"],
        where: { ownerId: { not: null } },
        _count: { ownerId: true },
        having: { ownerId: { _count: { gt: 1 } } }
      });
      return rows.length;
    }
  }
];

async function main() {
  console.log("T25 viil C — rollback preflight\n");

  const results = [];
  for (const gate of GATES) {
    const value = await gate.count();
    results.push({ ...gate, value });
    const verdict = value === 0 ? "OK  " : "STOP";
    console.log(`  ${verdict}  ${gate.label}: ${value}`);
  }

  const blockers = results.filter((row) => row.value !== 0);
  console.log("");

  if (!blockers.length) {
    console.log("ROLLBACK ON OHUTU.");
    console.log("Käsud: ops/runbooks/org-profile-support-rollback.md ptk 4.");
    console.log("NB võta ENNE rollback'i DB-varukoopia — preflight ei asenda backup'i.");
    return 0;
  }

  console.log("ROLLBACK EI OLE OHUTU. Takistused:\n");
  for (const blocker of blockers) {
    console.log(`  - ${blocker.label}: ${blocker.value}`);
    console.log(`    ${blocker.why}\n`);
  }
  console.log("Vt ops/runbooks/org-profile-support-rollback.md ptk 3 (takistuste lahendamine).");
  return 1;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (error) => {
    console.error("PREFLIGHT KUKKUS — kontroll ise ei jooksnud lõpuni:");
    console.error(error?.message || error);
    console.error("\nEbaselge tulemus EI OLE roheline tuli. Ära tee rollback'i.");
    await prisma.$disconnect().catch(() => {});
    process.exit(2);
  });
