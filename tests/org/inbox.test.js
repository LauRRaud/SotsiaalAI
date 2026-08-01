import test from "node:test";
import assert from "node:assert/strict";

import { projectSourcePackage } from "../../lib/org/inbox.js";

/**
 * Vastuvõtu NÄHTAVUSE AHEL (arenduskava §5.7).
 *
 * Need testid katavad selle osa, mida saab tõendada ilma elava andmebaasita:
 * PROJEKTSIOONI. Skoobi- ja võistlusrajad on `scripts/org-funding-runtime-check.mjs`-is,
 * sest osalised unikaalindeksid ja tehingud vajavad päris Postgresi.
 */

/** Terve eelpöördumine, sh väljad, mida vastuvõtja EI TOHI näha. */
function fullInquiry(overrides = {}) {
  return {
    id: "pi_1",
    topic: "Eluase",
    situation: "Kirjeldus, mille pöörduja ise kirjutas.",
    generatedDraft: "AI mustand",
    userEditedDraft: "Pöörduja parandatud tekst",
    assessmentState: { step: 3 },
    status: "SENT",
    sentAt: new Date("2026-08-01T10:00:00.000Z"),
    openedAt: null,
    recalledAt: null,
    receiverNote: "",
    nextContactOn: null,
    // Need EI TOHI projektsiooni jõuda:
    authorId: "user_client",
    sourceJourneyId: "journey_1",
    receiverChecklist: { done: true },
    selectedRecipientEmail: "keegi@vald.ee",
    supersededById: null,
    ...overrides
  };
}

test("the projection carries the sender-confirmed package", () => {
  const projected = projectSourcePackage(fullInquiry());
  assert.equal(projected.topic, "Eluase");
  assert.equal(projected.situation, "Kirjeldus, mille pöörduja ise kirjutas.");
  assert.equal(projected.userEditedDraft, "Pöörduja parandatud tekst");
  assert.equal(projected.status, "SENT");
});

/* KÕIGE TÄHTSAM TEST selles failis: Teekonna viide ei tohi lekkida.
   Arenduskava §14.5: „Organisatsioon ei saa kunagi nuppu „jaga kogu Teekond"." */
test("the journey reference never reaches the organisation", () => {
  const projected = projectSourcePackage(fullInquiry());
  assert.equal(projected.sourceJourneyId, undefined);
  assert.equal(JSON.stringify(projected).includes("journey"), false);
});

test("the author identity does not reach the inbox projection", () => {
  const projected = projectSourcePackage(fullInquiry());
  assert.equal(projected.authorId, undefined);
  assert.equal(JSON.stringify(projected).includes("user_client"), false);
});

test("the projection is a whitelist — an unknown new field cannot leak through", () => {
  const projected = projectSourcePackage(
    fullInquiry({ secretNewColumn: "midagi tundlikku", internalRiskScore: 0.91 })
  );
  const serialized = JSON.stringify(projected);
  assert.equal(serialized.includes("secretNewColumn"), false);
  assert.equal(serialized.includes("midagi tundlikku"), false);
  assert.equal(serialized.includes("internalRiskScore"), false);
});

/**
 * `assessmentState` on TEADLIKULT sees: see on eelpöördumisele salvestatud
 * hetktõmmis, mille saatja ise üle vaatas ja ära saatis — ja mille näeb juba
 * täna ka ISIKLIK vastuvõtja (`serializePreInquiry`). Organisatsiooni postkast
 * ei anna rohkem kui inimesest vastuvõtja; see on pariteet, mitte laiendus.
 * Teekonna ENDA viide (`sourceJourneyId`) jääb välja — vt eraldi test.
 */
test("the projection has an exact, closed key set", () => {
  assert.deepEqual(Object.keys(projectSourcePackage(fullInquiry())).sort(), [
    "assessmentState",
    "generatedDraft",
    "id",
    "nextContactOn",
    "openedAt",
    "recalledAt",
    "receiverNote",
    "sentAt",
    "situation",
    "status",
    "topic",
    "userEditedDraft"
  ]);
});

test("no risk score, priority or triage verdict exists in the projection", () => {
  const serialized = JSON.stringify(projectSourcePackage(fullInquiry())).toLowerCase();
  for (const forbidden of ["risk", "priority", "triage", "score", "urgencyai"]) {
    assert.equal(serialized.includes(forbidden), false, `projection must not contain ${forbidden}`);
  }
});

test("a missing source yields null, never a partial object", () => {
  assert.equal(projectSourcePackage(null), null);
  assert.equal(projectSourcePackage(undefined), null);
});

test("recall and open timestamps travel so the receiver sees the honest state", () => {
  const projected = projectSourcePackage(
    fullInquiry({ openedAt: new Date("2026-08-01T11:00:00.000Z"), recalledAt: null })
  );
  assert.ok(projected.openedAt instanceof Date);
  assert.equal(projected.recalledAt, null);
});
