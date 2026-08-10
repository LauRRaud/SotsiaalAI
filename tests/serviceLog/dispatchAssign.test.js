/**
 * TEENUSPÄEVIK E10 — tööde määramine ja asendus.
 *
 * See on ainus koht kogu teenuspäevikus, kus üks inimene kirjutab TEISE
 * inimese päevikusse. Testid hoiavad kolme piiri, mis seetõttu ei tohi
 * nihkuda: kahekordne õigus, plaan ei ole tehtud töö, alustatud tööd ei
 * liigutata.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { assertCanAssign } from "../../lib/serviceLog/dispatchAssign.js";

const NOW = new Date("2026-08-03T09:00:00.000Z");

/**
 * Minimaalne fake, mis matkib AINULT seda, mida `assertCanAssign` puudutab:
 * organisatsiooni oleku, aktiivsed moodulid, juhi capability-load ja
 * sihttöötaja liikmesuse.
 *
 * ORGANISATSIOON JA MOODULID ON SIIN ALATES SOL-ORG-02-st. `WORK_ASSIGNER` on
 * seotud `KOV_INTAKE`-iga, seega ilma moodulireata EI OLE tal enam õigust — ja
 * see ongi parandus. Mudeleid ei valvata `?.`-ga: puuduv mudel peab kukutama,
 * mitte muutuma vaikseks nulliks.
 */
function makeDb({
  grants = [],
  workerFound = true,
  orgStatus = "ACTIVE",
  modules = ["KOV_INTAKE", "SERVICE_DELIVERY"]
} = {}) {
  const seen = [];
  return {
    seen,
    organization: {
      findUnique: async () => (orgStatus ? { id: "org-1", status: orgStatus } : null)
    },
    organizationModule: {
      findMany: async () => modules.map((moduleKey) => ({ moduleKey }))
    },
    organizationMembership: {
      findFirst: async ({ where, select }) => {
        /* Salvestame MÕLEMAD: õiguse kehtivus elab `select`-i sees (seotud
           päring), skoop `where`-is. */
        seen.push({ where, select });
        /* Esimene kutse (`select.capabilityGrants`) on JUHI oma. */
        if (select?.capabilityGrants) {
          return grants.length ? { id: "m-juht", capabilityGrants: grants } : { id: "m-juht", capabilityGrants: [] };
        }
        /* Teine on SIHTTÖÖTAJA oma — `where` kannab üksusepiirangut. */
        return workerFound ? { id: "m-tootaja", userId: "worker-1" } : null;
      }
    }
  };
}

const unitGrant = { capability: "WORK_ASSIGNER", scopeType: "UNIT", scopeUnitId: "unit-1" };
const orgGrant = { capability: "ORG_OWNER", scopeType: "ORGANIZATION", scopeUnitId: null };

/* KAKS TINGIMUST, MITTE ÜKS. Capability annab õiguse üldse määrata; üksuse
   kattuvus ütleb, KELLELE. */
test("üksuse juht saab määrata oma üksuse töötajale", async () => {
  const db = makeDb({ grants: [unitGrant] });
  const worker = await assertCanAssign("manager-1", "org-1", "worker-1", { db, now: NOW });
  assert.equal(worker.userId, "worker-1");

  /* Sihttöötaja päring PEAB kandma üksusepiirangut — ilma selleta saaks üksuse
     juht määrata tööd terve organisatsiooni peale. */
  const workerQuery = db.seen[1].where;
  assert.ok(workerQuery.units?.some?.unitId?.in?.includes("unit-1"), "üksusepiirang puudub päringust");
  assert.equal(workerQuery.status, "ACTIVE", "lahkunud liikmele ei määrata tööd");
});

test("organisatsiooni omanikul ei ole üksusepiirangut", async () => {
  const db = makeDb({ grants: [orgGrant] });
  await assertCanAssign("manager-1", "org-1", "worker-1", { db, now: NOW });
  assert.equal(db.seen[1].where.units, undefined, "org-skoop katab kõik üksused");
});

/* ILMA CAPABILITY'ta EI OLE ÕIGUST. Org-liikmesus üksi ei anna kellelegi
   tööd määrata — muidu saaks iga kolleeg teise päeva täita. */
test("tavaline liige ei saa tööd määrata", async () => {
  const db = makeDb({ grants: [] });
  await assert.rejects(
    () => assertCanAssign("colleague-1", "org-1", "worker-1", { db, now: NOW }),
    (error) => error.status === 403 && error.messageKey === "service_log.errors.assign_not_allowed"
  );
});

/* Töötaja teisest üksusest ei leita — ja vastus on sama 403, mitte „ei
   leitud": kes tohib määrata ja kellele, on üks õigus, mitte kaks. */
test("teise üksuse töötajale ei saa määrata", async () => {
  const db = makeDb({ grants: [unitGrant], workerFound: false });
  await assert.rejects(
    () => assertCanAssign("manager-1", "org-1", "worker-9", { db, now: NOW }),
    (error) => error.status === 403
  );
});

/* AEGUNUD LUBA EI OLE LUBA. Kontroll käib `resolveBoardScope` kaudu, kus
   `validUntil` ja `revokedAt` on päringus — see test hoiab, et keegi ei
   asendaks teda lihtsama „kas capability rida on olemas" kontrolliga. */
test("õiguse kehtivust küsitakse päringus, mitte mälust", async () => {
  const db = makeDb({ grants: [unitGrant] });
  await assertCanAssign("manager-1", "org-1", "worker-1", { db, now: NOW });
  const grantWhere = db.seen[0].select?.capabilityGrants?.where;
  assert.equal(grantWhere.revokedAt, null, "tühistatud luba ei tohi kehtida");
  assert.ok(grantWhere.validFrom?.lte, "tuleviku luba ei tohi veel kehtida");
  assert.ok(Array.isArray(grantWhere.OR), "aegunud luba ei tohi enam kehtida");
});

/**
 * SOL-ORG-02 — kirjutusrada möödus peatatud organisatsiooni ja mooduli väravast.
 *
 * Graafiku POST oli ainus tavapärane org-konteksti kirjutusrada ilma
 * `assertWritable()`-ita; skoop tuletati otse liikmesusest ja raw grantidest.
 * Värav on nüüd teenuskihis, sest tuletamine ise on seal.
 */
test("peatatud organisatsioonis ei saa tööd määrata — 409, mitte 403", async () => {
  const db = makeDb({ grants: [orgGrant], orgStatus: "SUSPENDED" });
  await assert.rejects(
    () => assertCanAssign("manager-1", "org-1", "worker-1", { db, now: NOW }),
    (error) =>
      error.status === 409 && error.messageKey === "service_log.errors.organization_not_writable"
  );
});

/* 409 ja mitte 403 on siin sisuline vahe: õigus on juhil alles, muutunud on maja
   seis. 403 saadaks ta oma capability't otsima ja seal ei ole midagi valesti. */
test("arhiveeritud organisatsioon ei ole tööruum — õigust ei ole üldse", async () => {
  const db = makeDb({ grants: [orgGrant], orgStatus: "ARCHIVED" });
  await assert.rejects(
    () => assertCanAssign("manager-1", "org-1", "worker-1", { db, now: NOW }),
    (error) => error.status === 403
  );
});

test("olematu organisatsioon ei anna õigust", async () => {
  const db = makeDb({ grants: [orgGrant], orgStatus: null });
  await assert.rejects(
    () => assertCanAssign("manager-1", "org-1", "worker-1", { db, now: NOW }),
    (error) => error.status === 403
  );
});

/* MOODULI VÄLJALÜLITAMINE PEAB VÕTMA ÕIGUSE. Muidu on toote väljalülitamine
   ainult UI-otsus ja raw capability elab edasi. */
test("ilma KOV_INTAKE moodulita ei saa WORK_ASSIGNER tööd määrata", async () => {
  const db = makeDb({ grants: [unitGrant], modules: ["SERVICE_DELIVERY"] });
  await assert.rejects(
    () => assertCanAssign("manager-1", "org-1", "worker-1", { db, now: NOW }),
    (error) => error.status === 403
  );
});

/* NEGATIIVKONTROLL: moodulinõudeta capability ei tohi mooduli puudumise peale
   kaduda. `ORG_OWNER` ei ole ühegi mooduli taga ja tema õigus jääb. */
test("moodulinõudeta ORG_OWNER jääb ka ilma moodulita alles", async () => {
  const db = makeDb({ grants: [orgGrant], modules: [] });
  const worker = await assertCanAssign("manager-1", "org-1", "worker-1", { db, now: NOW });
  assert.equal(worker.userId, "worker-1");
});
