import assert from "node:assert/strict"
import test from "node:test"

import { buildDocumentAuditRecord, isMappedAuditEvent } from "../../lib/documents/auditShared.js"
import { writeDocumentAudit } from "../../lib/documents/audit.js"

// SOL-DOC-09. Leid oli VAIKNE: kutse oli koodis olemas, aga sündmust ei olnud auditikaardis, seega
// ei jäänud ühtki rida. Siin mõõdetakse kaardistust ja kohustusliku tee käitumist; päris rida
// päris andmebaasis tõendab `npm run analysis:audit:probe`.

test("analüüsi sündmused on auditikaardis", () => {
  assert.equal(isMappedAuditEvent("analysis.saved"), true)
  assert.equal(isMappedAuditEvent("analysis.deleted"), true)
})

test("salvestuse kirje kannab oma action'it ja sündmuse nime", () => {
  const record = buildDocumentAuditRecord("analysis.saved", {
    userId: "user_1",
    analysisId: "analysis_1",
    title: "Pealkiri",
    sourceCount: 2
  })

  assert.equal(record.action, "ANALYSIS_SAVE")
  assert.equal(record.ownerId, "user_1")
  assert.equal(record.meta.event, "analysis.saved")
  assert.equal(record.meta.analysisId, "analysis_1")
  assert.equal(record.meta.sourceCount, 2)
})

test("kustutuse kirje on eristatav salvestusest", () => {
  const record = buildDocumentAuditRecord("analysis.deleted", { userId: "user_1", analysisId: "analysis_1" })
  assert.equal(record.action, "ANALYSIS_DELETE")
  assert.equal(record.meta.event, "analysis.deleted")
})

test("kaardistamata sündmus ei anna kirjet ja teab ise, et ta ei ole kaardis", () => {
  assert.equal(isMappedAuditEvent("analysis.invented_event"), false)
  assert.equal(buildDocumentAuditRecord("analysis.invented_event", { userId: "user_1" }), null)
})

test("kohustuslik tee kirjutab rea süstitud kliendiga", async () => {
  const written = []
  const db = {
    documentAudit: {
      async create({ data }) {
        written.push(data)
        return { id: "audit_1", ...data }
      }
    }
  }

  const row = await writeDocumentAudit("analysis.saved", { userId: "user_1", analysisId: "a1" }, { db })

  assert.equal(row.id, "audit_1")
  assert.equal(written.length, 1)
  assert.equal(written[0].action, "ANALYSIS_SAVE")
})

test("kohustuslik tee KUKUB kaardistamata sündmuse peale, mitte ei teeskle edu", async () => {
  const db = {
    documentAudit: {
      async create() {
        throw new Error("ei tohi jõuda siia")
      }
    }
  }

  await assert.rejects(
    () => writeDocumentAudit("analysis.invented_event", { userId: "user_1" }, { db }),
    (error) => error.code === "DOCUMENTS_AUDIT_UNMAPPED"
  )
})

test("kohustuslik tee KUKUB ka omanikuta kirje peale", async () => {
  await assert.rejects(
    () => writeDocumentAudit("analysis.saved", {}, { db: { documentAudit: { async create() { return {} } } } }),
    (error) => error.code === "DOCUMENTS_AUDIT_UNMAPPED"
  )
})
