/**
 * T25 §D8 — saaja projektsioon on värav, mitte lootus.
 *
 * Kirjutamispoolne `sanitizeSnapshot` kaitseb ainult ridu, mis läksid läbi
 * TÄNASE koodi. Need testid kirjeldavad rida, mis on andmebaasis JUBA olemas
 * koos sisemiste analüüsiväljadega — nii nagu ta sinna satuks vanemast
 * versioonist, migratsioonist, käsitsi parandusest või homsest teisest
 * kirjutajast, kes värava unustab.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ALLOWED_SNAPSHOT_FIELDS,
  projectSnapshotForRecipient,
  toRecipientView
} from "../../lib/org/supportShare.js";

/** Rida, mis on juba andmebaasis — puhastusest MÖÖDA. */
const pollutedStoredSnapshot = {
  summary: "Vajan kahte rahulikumat nädalat.",
  needs: ["vähem õhtuseid kohtumisi"],
  proposedAgreements: ["vaatame koormuse üle"],
  periodLabel: "oktoober",
  // Sisemine tööheaolu analüüs — EI TOHI saajani jõuda.
  computedSignal: "AMBER",
  riskMarkers: ["burnout_risk", "sleep"],
  loadFactors: { caseload: 34, overtimeHours: 12 },
  // Tee lähtekirjeni — §D8 keelab.
  sourceRecordId: "wellbeing-record-1",
  sourceDraftId: "draft-9",
  ownerUserId: "user-1",
  supportContactId: "contact-1",
  // Homme lisatud tundmatu väli.
  someFutureField: "midagi, mida keegi ei osanud oodata"
};

const FORBIDDEN = [
  "computedSignal",
  "riskMarkers",
  "loadFactors",
  "sourceRecordId",
  "sourceDraftId",
  "ownerUserId",
  "supportContactId",
  "someFutureField"
];

test("juba salvestatud sisemised väljad ei jõua projektsiooni", () => {
  const projected = projectSnapshotForRecipient(pollutedStoredSnapshot);
  for (const field of FORBIDDEN) {
    assert.equal(projected[field], undefined, `${field} lekkis projektsiooni`);
  }
  assert.deepEqual(Object.keys(projected).sort(), [
    "needs",
    "periodLabel",
    "proposedAgreements",
    "summary"
  ]);
});

test("inimese enda öeldu jõuab muutmata kohale", () => {
  const projected = projectSnapshotForRecipient(pollutedStoredSnapshot);
  assert.equal(projected.summary, "Vajan kahte rahulikumat nädalat.");
  assert.deepEqual(projected.needs, ["vähem õhtuseid kohtumisi"]);
  assert.equal(projected.periodLabel, "oktoober");
});

test("toRecipientView ei anna toorest veergu edasi", () => {
  const view = toRecipientView({
    id: "share-1",
    status: "SENT",
    sentAt: new Date("2026-08-02T05:00:00Z"),
    sharedSnapshotJson: pollutedStoredSnapshot,
    snapshotSchemaVersion: 1,
    owner: { profile: { firstName: "Mari", lastName: "Maasikas" } }
  });
  for (const field of FORBIDDEN) {
    assert.equal(view.snapshot[field], undefined, `${field} lekkis saaja vaatesse`);
  }
  // Terve objekti serialiseerimine on kõige ausam kontroll: kui mõni keelatud
  // võti peitub kuskil sügavamal, jääb ta siia vahele.
  const serialized = JSON.stringify(view);
  for (const field of FORBIDDEN) {
    assert.doesNotMatch(serialized, new RegExp(field), `${field} esineb saaja vaate JSON-is`);
  }
  // Saatja jääb nimeliselt tuvastatavaks — anonüümne palve ei ole tugi.
  assert.equal(view.sender.firstName, "Mari");
});

test("katkine või tühi salvestatud snapshot ei võta saaja lehte maha", () => {
  for (const broken of [null, undefined, "string", 42, []]) {
    assert.deepEqual(projectSnapshotForRecipient(broken), {});
  }
  assert.deepEqual(projectSnapshotForRecipient({}), {});
  const view = toRecipientView({ id: "share-2", status: "SENT", sharedSnapshotJson: null });
  assert.deepEqual(view.snapshot, {});
});

test("vale tüüpi väärtus lubatud väljal ei lähe läbi", () => {
  const projected = projectSnapshotForRecipient({
    summary: { nested: "objekt" },
    needs: [{ nested: true }, "päris vajadus"],
    proposedAgreements: 42
  });
  assert.equal(projected.summary, undefined);
  assert.deepEqual(projected.needs, ["päris vajadus"]);
  assert.equal(projected.proposedAgreements, undefined);
});

test("valge nimekiri on üks ja seesama mõlemal poolel", () => {
  // Kui keegi lisab kirjutamise nimekirja välja, tuleb ta lugemisel kaasa —
  // ja vastupidi. Kaks nimekirja lahkneksid vaikselt.
  const projected = projectSnapshotForRecipient(
    Object.fromEntries(ALLOWED_SNAPSHOT_FIELDS.map((field) => [field, "väärtus"]))
  );
  assert.deepEqual(Object.keys(projected).sort(), [...ALLOWED_SNAPSHOT_FIELDS].sort());
});
