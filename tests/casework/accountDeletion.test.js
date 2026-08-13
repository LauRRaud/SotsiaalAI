import assert from "node:assert/strict";
import test from "node:test";

import { DATA_EXPORT_REGISTRY } from "../../lib/dataExport/registry.js";
import {
  PERSONAL_DATA_EXPORT_DECISIONS,
  PRISMA_USER_RELATION_CLASSIFICATIONS
} from "../../lib/dataExport/personalDataSurfaceRegistry.js";

test("SOL-CW-19: töötaja isiklik juhtumitöö on enne konto kustutamist tema andmekoopias", () => {
  const surface = DATA_EXPORT_REGISTRY.find((item) => item.name === "casework");
  const owned = PRISMA_USER_RELATION_CLASSIFICATIONS.find((item) => item.relation === "caseWorkAssistsOwned");
  const client = PRISMA_USER_RELATION_CLASSIFICATIONS.find((item) => item.relation === "caseWorkAssistsAsClient");

  assert.ok(surface, "casework ekspordipind puudub");
  assert.equal(owned?.exportDecision, PERSONAL_DATA_EXPORT_DECISIONS.EXPORTED);
  assert.deepEqual(owned?.manifestSurfaces, ["casework"]);
  assert.equal(client?.exportDecision, PERSONAL_DATA_EXPORT_DECISIONS.THIRD_PARTY_EXCLUDED);
});

test("SOL-CW-19: juhtumitöö andmekoopia on omaniku piiriga ja eemaldab konto- ning tegija-ID-d", async () => {
  const at = new Date("2026-08-13T18:00:00.000Z");
  let query;
  const db = {
    caseWorkAssist: {
      async findMany(value) {
        query = value;
        return [{
          id: "case-own",
          clientDisplayName: "Klient K.",
          clientExternalRef: "isiklik viide",
          clientUserId: "client-account-must-not-export",
          ownerUserId: "owner-must-not-export",
          preInquiryId: "source-must-not-export",
          retentionState: "READ_ONLY",
          createdAt: at,
          updatedAt: at,
          meetingPreps: [],
          meetingNotes: [{
            id: "note-1",
            meetingAt: at,
            createdAt: at,
            updatedAt: at,
            entries: [{
              id: "entry-1",
              layer: "KOKKULEPE",
              text: "Järgmine kohtumine septembris",
              provenance: "WORKER",
              ordinal: 0,
              revision: 2,
              createdAt: at,
              updatedAt: at,
              revisions: [{
                id: "revision-1",
                kind: "CORRECTION",
                layer: "KOKKULEPE",
                text: "Eelmine kokkulepe",
                provenance: "WORKER",
                ordinal: 0,
                revision: 1,
                reason: "Täpsustus",
                actorUserId: "actor-must-not-export",
                createdAt: at
              }]
            }]
          }],
          drafts: [{
            id: "draft-1",
            draftType: "EESMARGI_SONASTUS",
            transferState: "ULE_KANTUD",
            transferredAt: at,
            createdAt: at,
            updatedAt: at,
            fields: [{ id: "field-1", fieldKey: "EESMARK", text: "Töötekst", provenance: "WORKER", createdAt: at, updatedAt: at }]
          }],
          transferEvents: [{
            id: "transfer-1",
            draftId: "draft-1",
            kind: "MARKED_AS_TRANSFERRED",
            draftType: "EESMARGI_SONASTUS",
            transferStateAtEvent: "VALMIS_ULEKANDEKS",
            fieldKeys: [],
            actorUserId: "actor-must-not-export",
            ownerUserId: "owner-must-not-export",
            createdAt: at
          }],
          retentionAudit: [{ id: "retention-1", fromState: "ACTIVE", toState: "READ_ONLY", reason: "Töö lõpetatud", actorUserId: "actor-must-not-export", createdAt: at }],
          erasureAudit: [],
          items: [],
          missingInfo: []
        }];
      }
    }
  };

  const surface = DATA_EXPORT_REGISTRY.find((item) => item.name === "casework");
  const [entry] = await surface.collect({ db, userId: "worker-owner" });
  const text = entry.content.toString("utf8");

  assert.deepEqual(query.where, { ownerUserId: "worker-owner" });
  assert.equal(query.select.clientUserId, undefined);
  assert.equal(query.select.ownerUserId, undefined);
  assert.equal(query.select.preInquiryId, undefined);
  assert.equal(query.select.transferEvents.select.actorUserId, undefined);
  assert.equal(query.select.retentionAudit.select.actorUserId, undefined);
  assert.match(text, /Järgmine kohtumine septembris|Eelmine kokkulepe|Töötekst|transfer-1|retention-1/u);
  assert.doesNotMatch(text, /must-not-export/u);
  assert.match(text, /"createdAt":"2026-08-13T18:00:00.000Z"/u);
  assert.equal(entry.count, 1);
});
