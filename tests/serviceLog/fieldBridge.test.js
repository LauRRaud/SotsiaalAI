/**
 * TEENUSPÄEVIK E2 — sild Välitöö külastuselt teenuskirjele.
 *
 * `buildEntryDraftFromFieldVisit` oli olemas juba E2-st, aga teda ei kutsunud
 * MITTE KEEGI — pool integratsiooni, mis nägi koodis välja nagu terve. Need
 * testid katavad just seda puuduvat poolt: kes tohib küsida ja mida ta saab.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { getEntryDraftFromVisit } from "../../lib/serviceLog/fieldBridge.js";

const ENV = { SERVICE_LOG_ENABLED: "1" };

function makeDb({ visits = [], hasProfile = true } = {}) {
  return {
    serviceProviderProfile: {
      findFirst: async ({ where }) =>
        hasProfile && where.ownerId === "user-1" && where.ownershipMode === "SOLO"
          ? { id: "profile-1", ownershipMode: "SOLO" }
          : null
    },
    fieldVisit: {
      findFirst: async ({ where }) =>
        visits.find((visit) => visit.id === where.id && visit.ownerUserId === where.ownerUserId) || null
    }
  };
}

const VISIT = {
  id: "visit-1",
  ownerUserId: "user-1",
  arrivedConfirmedAt: new Date("2026-08-03T09:00:00.000Z"),
  departedConfirmedAt: new Date("2026-08-03T11:00:00.000Z"),
  plannedStartAt: new Date("2026-08-03T08:30:00.000Z"),
  closedAt: new Date("2026-08-03T11:05:00.000Z"),
  locationText: "Tartu mnt 5"
};

test("oma suletud külastus annab eeltäite koos kestusega", async () => {
  const draft = await getEntryDraftFromVisit("user-1", "visit-1", {
    db: makeDb({ visits: [VISIT] }),
    env: ENV
  });
  assert.equal(draft.sourceFieldVisitId, "visit-1");
  assert.equal(draft.hasDuration, true);
  assert.equal(Number(draft.quantity), 2, "09:00–11:00 = 2 tundi");
  assert.equal(draft.locationText, "Tartu mnt 5");
  assert.equal(draft.note, null, "külastuse märkmeid EI tõsteta kirjesse");
});

/* Kinnitamata saabumine/lahkumine EI OLE viga: inimene sisestab koguse ise.
   Vaikne null-kogus oleks siin halvem — ta näeks välja nagu tasuta töö. */
test("ilma kinnitatud aegadeta tuleb eeltäide ilma koguseta", async () => {
  const visit = { ...VISIT, arrivedConfirmedAt: null, departedConfirmedAt: null };
  const draft = await getEntryDraftFromVisit("user-1", "visit-1", {
    db: makeDb({ visits: [visit] }),
    env: ENV
  });
  assert.equal(draft.hasDuration, false);
  assert.equal(draft.quantity, null);
  assert.ok(draft.date, "kuupäev tuleb siis plaanitud algusest või sulgemisest");
});

/* Võõras ja olematu külastus annavad MÕLEMAD sama vastuse: vastusest ei tohi
   järeldada, et selline külastus üldse olemas on. */
test("võõras külastus ja olematu külastus on eristamatud", async () => {
  const db = makeDb({ visits: [{ ...VISIT, ownerUserId: "keegi-teine" }] });
  const foreign = await getEntryDraftFromVisit("user-1", "visit-1", { db, env: ENV }).catch((e) => e);
  const missing = await getEntryDraftFromVisit("user-1", "puudub", { db, env: ENV }).catch((e) => e);
  assert.equal(foreign.status, 404);
  assert.equal(missing.status, 404);
  assert.equal(foreign.messageKey, missing.messageKey);
});

test("ilma teenuseprofiilita ei saa silda kasutada", async () => {
  const error = await getEntryDraftFromVisit("user-1", "visit-1", {
    db: makeDb({ visits: [VISIT], hasProfile: false }),
    env: ENV
  }).catch((e) => e);
  assert.equal(error.status, 404);
});

/* Värav on ka siin ees: suletud lipuga ei tohi sild paljastada, et teenuspäevik
   üldse olemas on. */
test("väljas lipuga annab sild 404", async () => {
  const error = await getEntryDraftFromVisit("user-1", "visit-1", {
    db: makeDb({ visits: [VISIT] }),
    env: {}
  }).catch((e) => e);
  assert.equal(error.status, 404);
});

test("tühi külastuse id ei jõua andmebaasi", async () => {
  const db = makeDb({ visits: [VISIT] });
  db.fieldVisit.findFirst = async () => {
    throw new Error("ei tohi päringut teha");
  };
  const error = await getEntryDraftFromVisit("user-1", "   ", { db, env: ENV }).catch((e) => e);
  assert.equal(error.status, 404);
});
