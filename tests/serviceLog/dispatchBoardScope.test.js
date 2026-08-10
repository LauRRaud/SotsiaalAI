/**
 * SOL-ORG-02 — graafiku skoop möödus peatatud organisatsiooni ja mooduli väravast.
 *
 * `resolveBoardScope` tuletab skoobi ISE, otse liikmesusest ja raw grantidest,
 * ega käi `resolveOrgAccessContext`-i kaudu. Seepärast ei kehtinud tema jaoks
 * kaks organisatsioonilepingu tingimust, mis kehtivad igal pool mujal:
 * organisatsioon peab olema nähtav ja capability nõutav moodul aktiivne.
 *
 * LUGEMINE JA KIRJUTAMINE ON ERI KÜSIMUSED ja neid mõõdetakse siin eraldi:
 * peatatud maja jääb LOETAVAKS (juht peab nägema, mis pooleli jäi), aga
 * kirjutamine lõpeb. Kirjutuse pool on `dispatchAssign.test.js`-is.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { resolveBoardScope } from "../../lib/serviceLog/dispatchBoard.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");

const ORG_GRANT = { capability: "ORG_OWNER", scopeType: "ORGANIZATION", scopeUnitId: null };
const ASSIGNER_GRANT = { capability: "WORK_ASSIGNER", scopeType: "UNIT", scopeUnitId: "unit-1" };
const UNIT_LEAD_GRANT = { capability: "UNIT_LEAD", scopeType: "UNIT", scopeUnitId: "unit-2" };

/**
 * Üksuste puu (SOL-ORG-04). `unit-1` all on `unit-1a`, `unit-2` on tema ÕDE ja
 * `unit-parent` on mõlema VANEM. Kriteerium nõuab kõike nelja katmist.
 */
const UNIT_TREE = [
  { id: "unit-parent", parentUnitId: null },
  { id: "unit-1", parentUnitId: "unit-parent" },
  { id: "unit-1a", parentUnitId: "unit-1" },
  { id: "unit-2", parentUnitId: "unit-parent" }
];

function makeDb({
  orgStatus = "ACTIVE",
  grants = [ORG_GRANT],
  modules = ["KOV_INTAKE"],
  units = UNIT_TREE
} = {}) {
  const queries = { modules: 0, units: 0 };
  return {
    queries,
    organization: {
      findUnique: async () => (orgStatus ? { id: "org-1", status: orgStatus } : null)
    },
    organizationUnit: {
      findMany: async () => {
        queries.units += 1;
        return units;
      }
    },
    organizationMembership: {
      findFirst: async () => (grants ? { id: "m-1", capabilityGrants: grants } : null)
    },
    organizationModule: {
      findMany: async (args) => {
        queries.modules += 1;
        queries.moduleWhere = args?.where;
        return modules.map((moduleKey) => ({ moduleKey }));
      }
    }
  };
}

const scope = (options) => resolveBoardScope("manager-1", "org-1", { db: makeDb(options), now: NOW });

test("aktiivne maja: skoop kehtib ja lubab kirjutada", async () => {
  const result = await scope();
  assert.equal(result.allowed, true);
  assert.equal(result.writable, true);
  assert.equal(result.wholeOrg, true);
});

/* PEATATUD MAJA ON LOETAV, MITTE KIRJUTATAV. Juht peab nägema, mis pooleli
   jäi — vastasel korral kaoks peatamise hetkel ka ülevaade käimasolevast
   tööst, mille keegi peab lõpetama. */
test("peatatud maja: tahvel on loetav, kirjutamine mitte", async () => {
  const result = await scope({ orgStatus: "SUSPENDED" });
  assert.equal(result.allowed, true, "peatatud maja tahvel peab jääma loetavaks");
  assert.equal(result.writable, false, "peatatud majas ei tohi tööd määrata");
});

test("arhiveeritud maja ei ole tööruum — skoopi ei ole", async () => {
  const result = await scope({ orgStatus: "ARCHIVED" });
  assert.equal(result.allowed, false);
  assert.equal(result.writable, false);
});

test("olematu organisatsioon ei anna skoopi", async () => {
  const result = await scope({ orgStatus: null });
  assert.equal(result.allowed, false);
});

test("organisatsiooni ID-ta ei küsita andmebaasist midagi", async () => {
  const db = makeDb();
  const result = await resolveBoardScope("manager-1", "", { db, now: NOW });
  assert.equal(result.allowed, false);
  assert.equal(db.queries.modules, 0);
});

/* MOODULI VÄLJALÜLITAMINE PEAB VÕTMA ÕIGUSE. `WORK_ASSIGNER` on seotud
   `KOV_INTAKE`-iga; ilma selleta oli toote väljalülitamine ainult UI-otsus. */
test("moodulita WORK_ASSIGNER ei anna tahvlit", async () => {
  const result = await scope({ grants: [ASSIGNER_GRANT], modules: [] });
  assert.equal(result.allowed, false);
});

test("moodulita jääb moodulinõudeta UNIT_LEAD alles", async () => {
  const result = await scope({ grants: [UNIT_LEAD_GRANT], modules: [] });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.unitIds, ["unit-2"]);
  assert.equal(result.wholeOrg, false);
});

/**
 * SOL-ORG-04 — üksuse capability peab katma ALAMPUU.
 *
 * Leping on igal pool sama: „org-skoop katab kõik üksused; üksuse skoop katab
 * valitud üksuse ja selle alampuu" — õeüksusesse ei leki. Graafiku resolver
 * luges varem ainult grantis nimetatud üksust: osakonnajuht ei näinud oma
 * allüksuste töötajaid. Kriteerium nõuab nelja juhtumit: valitud, laps, õde,
 * vanem.
 */
test("üksuse skoop katab valitud üksuse ja lapse, mitte õde ega vanemat", async () => {
  const result = await scope({ grants: [{ ...UNIT_LEAD_GRANT, scopeUnitId: "unit-1" }] });
  assert.deepEqual([...result.unitIds].sort(), ["unit-1", "unit-1a"]);
  assert.equal(result.unitIds.includes("unit-2"), false, "õeüksusesse ei tohi lekkida");
  assert.equal(result.unitIds.includes("unit-parent"), false, "vanemasse ei tohi lekkida");
});

test("juurüksuse skoop katab kogu haru", async () => {
  const result = await scope({ grants: [{ ...UNIT_LEAD_GRANT, scopeUnitId: "unit-parent" }] });
  assert.deepEqual([...result.unitIds].sort(), ["unit-1", "unit-1a", "unit-2", "unit-parent"]);
  assert.equal(result.wholeOrg, false, "üksuse skoop ei muutu org-skoobiks");
});

test("leht-üksuse skoop jääb üheks üksuseks", async () => {
  const result = await scope({ grants: [{ ...UNIT_LEAD_GRANT, scopeUnitId: "unit-1a" }] });
  assert.deepEqual(result.unitIds, ["unit-1a"]);
});

/* Org-skoobiga juht katab niikuinii kõik — puud ei ole vaja lugeda. */
test("org-skoop ei küsi üksuste puud", async () => {
  const db = makeDb();
  const result = await resolveBoardScope("manager-1", "org-1", { db, now: NOW });
  assert.equal(result.wholeOrg, true);
  assert.equal(db.queries.units, 0);
});

/* SEGAJUHTUM: kui moodulita capability kaob, ei tohi tema üksus jääda skoopi
   „teise grandi varju". Vale liitmine annaks vaikselt laiema vaate. */
test("moodulita capability üksus kaob skoobist, teine jääb", async () => {
  const result = await scope({ grants: [ASSIGNER_GRANT, UNIT_LEAD_GRANT], modules: [] });
  assert.deepEqual(result.unitIds, ["unit-2"]);
});

test("moodulipäring küsib AINULT aktiivseid ja kehtivaid mooduleid", async () => {
  const db = makeDb();
  await resolveBoardScope("manager-1", "org-1", { db, now: NOW });
  assert.equal(db.queries.moduleWhere.status, "ACTIVE");
  assert.ok(db.queries.moduleWhere.validFrom?.lte, "tuleviku moodul ei tohi veel kehtida");
  assert.ok(Array.isArray(db.queries.moduleWhere.OR), "lõppenud moodul ei tohi enam kehtida");
});

test("liikmesuseta või õiguseta inimene ei saa skoopi", async () => {
  assert.equal((await scope({ grants: null })).allowed, false);
  assert.equal((await scope({ grants: [] })).allowed, false);
});
