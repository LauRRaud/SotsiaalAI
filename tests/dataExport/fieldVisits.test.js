import test from "node:test";
import assert from "node:assert/strict";

import { DATA_EXPORT_REGISTRY } from "../../lib/dataExport/registry.js";
import { buildPortableZip } from "../../lib/dataExport/zip.js";

const at = new Date("2026-08-13T18:00:00.000Z");

test("field visit export is owner-scoped, versioned and omits storage paths", async () => {
  const calls = [];
  const db = {
    fieldVisit: {
      async findMany(query) {
        calls.push(query);
        return [{
          id: "visit-owner",
          status: "CLOSED",
          version: 3,
          goal: "Omaniku eesmärk",
          locationText: "Kliendi kirjeldatud asukoht",
          safetyEscalationStatus: "SENT",
          safetyResolvedNoticeStatus: "SENT",
          safetyEscalatedAt: at,
          safetyResolvedNotifiedAt: at,
          notes: [
            { clientItemId: "note-1", revision: 2, kind: "note", provenance: "KLIENDI_OELDUD", body: "Oma töötekst", conflictState: "OPEN", conflictRevision: 3, conflictBody: "Kõrvalversioon", conflictProvenance: "TOOTAJA_TAHELEPANEK", createdAt: at, updatedAt: at },
            { clientItemId: "consent-1", revision: 1, kind: "consent", provenance: "KLIENDI_KINNITATUD", body: "Nõusolek", consentKind: "photo", consentSubject: "Klient", consentForm: "suuline", consentWithdrawnAt: at, createdAt: at, updatedAt: at }
          ],
          attachments: [{
            clientItemId: "photo-1",
            role: "photo",
            documentId: "doc-1",
            consentClientItemId: "consent-1",
            captureBasis: "CONSENT",
            storageStatus: "ACTIVE",
            document: { kind: "FIELD_PHOTO", mime: "image/png", size: 20, sha256: "a".repeat(64), storagePath: "uploads/secret.png" },
            createdAt: at
          }],
          handovers: [{ id: "handover-1", clientActionId: "action-1", requestSha256: "b".repeat(64), targetStates: { artifact: { status: "DONE", id: "artifact-1" } }, createdAt: at, updatedAt: at }],
          createdAt: at,
          updatedAt: at
        }];
      }
    }
  };
  const surface = DATA_EXPORT_REGISTRY.find(entry => entry.name === "field_visits");
  const entries = await surface.collect({ db, userId: "owner" });
  assert.deepEqual(calls[0].where, { ownerUserId: "owner" });
  const archiveText = buildPortableZip(entries, at).toString("utf8");
  assert.match(archiveText, /"schemaVersion":1/u);
  assert.match(archiveText, /Oma töötekst|Kõrvalversioon/u);
  assert.match(archiveText, /"withdrawnAt":"2026-08-13T18:00:00.000Z"/u);
  assert.match(archiveText, /"captureBasis":"CONSENT"/u);
  assert.match(archiveText, /"artifact":\{"status":"DONE"/u);
  assert.match(archiveText, /owner_authored_professional_record_may_describe_third_parties/u);
  assert.doesNotMatch(archiveText, /uploads\/secret\.png|other-owner/u);
  assert.equal(surface.version, "1.0");
  assert.equal(entries[0].count, 1);
});
