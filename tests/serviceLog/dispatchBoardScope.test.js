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

function makeDb({ orgStatus = "ACTIVE", grants = [ORG_GRANT], modules = ["KOV_INTAKE"] } = {}) {
  const queries = { modules: 0 };
  return {
    queries,
    organization: {
      findUnique: async () => (orgStatus ? { id: "org-1", status: orgStatus } : null)
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
