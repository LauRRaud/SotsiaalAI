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

import { assertCanAssign, assignVisit, reassignVisit } from "../../lib/serviceLog/dispatchAssign.js";

const NOW = new Date("2026-08-03T09:00:00.000Z");
const ENV = { SERVICE_LOG_ENABLED: "1" };

/* Üksuste puu: `unit-1` all on `unit-1a`, `unit-2` on tema ÕDE. Üksuse skoop
   katab alampuu, aga õeüksusesse ei leki (SOL-ORG-04). */
const UNIT_TREE = [
  { id: "unit-parent", parentUnitId: null },
  { id: "unit-1", parentUnitId: "unit-parent" },
  { id: "unit-1a", parentUnitId: "unit-1" },
  { id: "unit-2", parentUnitId: "unit-parent" }
];

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
  modules = ["KOV_INTAKE", "SERVICE_DELIVERY"],
  units = UNIT_TREE
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
    organizationUnit: {
      findMany: async () => units
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

/* SOL-ORG-04 — sama capability katab mujal alampuud, siin ei katnud. Viga oli
   KITSENDAV (osakonnajuht ei näinud allüksust), aga kaks skoobimõistet ühes
   tootes on ise oht. */
test("üksuse skoop katab alampuu, aga mitte õde ega vanemat", async () => {
  const db = makeDb({ grants: [unitGrant] });
  await assertCanAssign("manager-1", "org-1", "worker-1", { db, now: NOW });
  const scoped = db.seen[1].where.units.some.unitId.in;
  assert.deepEqual([...scoped].sort(), ["unit-1", "unit-1a"], "alampuu peab olema sees, õde ja vanem mitte");
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

/**
 * SOL-ORG-03 — auditijälg peab olema PÕHIMUUDATUSEGA SAMAS TEHINGUS.
 *
 * Varem oli `writeOrgAudit` `.catch(() => {})` taga: töö liikus ühelt inimeselt
 * teisele ja „kes selle ära viis" võis vaikselt puududa. SOL-SLOG-18 viis ta
 * tehingusse; need testid hoiavad, et ta sealt tagasi ei liiguks.
 *
 * MIDA NEED TESTID KATAVAD JA MIDA MITTE. Nad tõendavad, et viga EI NEELATA ja
 * et audit kirjutatakse TEHINGU KÄEPIDEMEGA (`tx`), mitte välise kliendiga —
 * viimane tähendaks, et auditirida jääks alles ka siis, kui põhimuudatus
 * tagasi keritakse. Päris TAGASIKERIMIST nad ei tõenda: see on PostgreSQL-i
 * käitumine, mitte meie oma, ja teda mõõdab `npm run slog:org:probe`.
 */
function makeWriteDb({ visit = null } = {}) {
  const tx = {
    serviceVisit: {
      create: async ({ data }) => ({ id: "visit-uus", ...data }),
      update: async ({ where, data }) => ({ id: where.id, ...visit, ...data })
    }
  };
  return {
    tx,
    organization: { findUnique: async () => ({ id: "org-1", status: "ACTIVE" }) },
    organizationModule: { findMany: async () => [{ moduleKey: "KOV_INTAKE" }] },
    organizationMembership: {
      findFirst: async ({ select }) =>
        select?.capabilityGrants
          ? { id: "m-juht", capabilityGrants: [orgGrant] }
          : { id: "m-tootaja", userId: "worker-1" }
    },
    serviceProviderProfile: { findFirst: async () => ({ id: "profile-1", ownershipMode: "SOLO" }) },
    serviceWorkRoute: {
      findFirst: async () => ({ id: "route-1", providerProfileId: "profile-1", workerUserId: "worker-1" })
    },
    serviceVisit: {
      findFirst: async () => (visit ? { ...visit } : { sortOrder: 0 })
    },
    $transaction: async (fn) => fn(tx)
  };
}

const failingAudit = async () => {
  throw new Error("auditirida ei õnnestunud");
};

test("auditi viga ei neelata ära — MÄÄRAMINE kukub", async () => {
  const db = makeWriteDb();
  await assert.rejects(
    () =>
      assignVisit(
        "manager-1",
        { organizationId: "org-1", workerUserId: "worker-1", clientDisplayName: "Klient" },
        { db, env: ENV, now: NOW, geocodeAddress: async () => null, writeAudit: failingAudit }
      ),
    (error) => /auditirida ei õnnestunud/.test(error.message)
  );
});

test("auditi viga ei neelata ära — ÜMBERMÄÄRAMINE kukub", async () => {
  const visit = {
    id: "visit-1",
    status: "PLANNED",
    ownerUserId: "worker-0",
    assignedOrganizationId: "org-1",
    clientDisplayName: "Klient"
  };
  const db = makeWriteDb({ visit });
  db.serviceVisit.findFirst = async ({ select }) => (select?.status ? visit : { sortOrder: 0 });
  await assert.rejects(
    () =>
      reassignVisit(
        "manager-1",
        { organizationId: "org-1", visitId: "visit-1", toWorkerUserId: "worker-1" },
        { db, env: ENV, now: NOW, writeAudit: failingAudit }
      ),
    (error) => /auditirida ei õnnestunud/.test(error.message)
  );
});

test("samale töötajale ümbermääramine ei avalda tahvlilt peidetud külastuse sisu", async () => {
  const visit = {
    id: "visit-1",
    status: "PLANNED",
    ownerUserId: "worker-1",
    assignedOrganizationId: "org-1",
    clientDisplayName: "Klient",
    clientExternalRef: "SALAJANE-4872",
    address: "Varjatud kodune aadress",
    addressLat: 58.3776,
    addressLng: 26.729,
    note: "Tundlik hooldusmärge"
  };
  const db = makeWriteDb({ visit });
  let visitSelect;
  db.serviceVisit.findFirst = async ({ select }) => {
    visitSelect = select;
    return visit;
  };

  const result = await reassignVisit(
    "manager-1",
    { organizationId: "org-1", visitId: "visit-1", toWorkerUserId: "worker-1" },
    { db, env: ENV, now: NOW }
  );

  assert.deepEqual(result, { id: "visit-1" }, "mutatsioonivastus peab olema minimaalne");
  for (const field of ["clientExternalRef", "address", "addressLat", "addressLng", "addressAdsId", "note"]) {
    assert.equal(visitSelect[field], undefined, `${field} ei tohi ümbermääramise lugemisse kuuluda`);
  }
});

/* Audit peab saama TEHINGU käepideme. Välise kliendiga kirjutatud rida jääks
   alles ka siis, kui põhimuudatus tagasi keritakse — ja siis oleks meil jälg
   tööst, mida ei ole. */
test("audit kirjutatakse tehingu käepidemega, mitte välise kliendiga", async () => {
  const db = makeWriteDb();
  const handles = [];
  await assignVisit(
    "manager-1",
    { organizationId: "org-1", workerUserId: "worker-1", clientDisplayName: "Klient" },
    {
      db,
      env: ENV,
      now: NOW,
      geocodeAddress: async () => null,
      writeAudit: async (handle) => {
        handles.push(handle);
        return { id: "audit-1" };
      }
    }
  );
  assert.equal(handles.length, 1);
  assert.equal(handles[0], db.tx, "audit ei tohi käia tehingust mööda");
});
