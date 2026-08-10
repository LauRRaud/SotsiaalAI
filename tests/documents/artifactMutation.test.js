import assert from "node:assert/strict"
import test from "node:test"

import {
  approveArtifact,
  parseExpectedVersion,
  updateDraftArtifact
} from "../../lib/documents/artifactMutation.js"

// SOL-DOC-03. Siin mõõdetakse OTSUST: millise seisu peale tuleb 409, millise peale 404 ja
// millise peale edu. Võistlust ennast — rea lukku ja kahte samaaegset kirjutust — see fake
// ei modelleeri ega teeskle; selle tõendab `npm run artifact:race:probe` päris PostgreSQL-is.

const V1 = new Date("2026-08-11T10:00:00.000Z")

function createFakeDb(row) {
  const state = { row: row ? { ...row } : null, updateManyCalls: [] }

  function matches(where) {
    const current = state.row
    if (!current) return false
    if (where.id !== current.id) return false
    if (where.ownerId !== current.ownerId) return false
    if (where.status && where.status !== current.status) return false
    if (where.updatedAt && where.updatedAt.getTime() !== current.updatedAt.getTime()) return false
    return true
  }

  return {
    state,
    agentArtifact: {
      async updateMany({ where, data }) {
        state.updateManyCalls.push(where)
        if (!matches(where)) return { count: 0 }
        Object.assign(state.row, data, { updatedAt: new Date(state.row.updatedAt.getTime() + 1000) })
        return { count: 1 }
      },
      async findFirst({ where }) {
        const current = state.row
        if (!current || where.id !== current.id || where.ownerId !== current.ownerId) return null
        return { ...current }
      }
    }
  }
}

function draft(overrides = {}) {
  return {
    id: "artifact_1",
    ownerId: "user_1",
    status: "DRAFT",
    title: "Mustand",
    content: "vana sisu",
    templateId: null,
    approvedAt: null,
    updatedAt: V1,
    ...overrides
  }
}

test("muutmine õnnestub, kui rida on veel sama omaniku draft ja sama versioon", async () => {
  const db = createFakeDb(draft())
  const updated = await updateDraftArtifact(
    { artifactId: "artifact_1", ownerId: "user_1", expectedUpdatedAt: V1, content: "uus sisu" },
    { db }
  )

  assert.equal(updated.content, "uus sisu")
  // Tingimus peab kandma KÕIKE, mis kirjutamise hetkel kehtima peab.
  const where = db.state.updateManyCalls[0]
  assert.equal(where.ownerId, "user_1")
  assert.equal(where.status, "DRAFT")
  assert.equal(where.updatedAt, V1)
})

test("vananenud versiooni peale kirjutamine annab 409, mitte vaikset ülekirjutust", async () => {
  const db = createFakeDb(draft({ updatedAt: new Date(V1.getTime() + 5000) }))
  await assert.rejects(
    () => updateDraftArtifact(
      { artifactId: "artifact_1", ownerId: "user_1", expectedUpdatedAt: V1, content: "uus sisu" },
      { db }
    ),
    (error) => {
      assert.equal(error.status, 409)
      assert.equal(error.message, "documents.artifacts.errors.version_conflict")
      return true
    }
  )
  assert.equal(db.state.row.content, "vana sisu", "kaotaja ei tohi sisu puutuda")
})

test("KINNITATUD rida ei ole enam muudetav — see on leid ise", async () => {
  const db = createFakeDb(draft({ status: "FINAL", content: "kinnitatud sisu" }))
  await assert.rejects(
    () => updateDraftArtifact(
      { artifactId: "artifact_1", ownerId: "user_1", expectedUpdatedAt: V1, content: "hiline muudatus" },
      { db }
    ),
    (error) => {
      assert.equal(error.status, 409)
      assert.equal(error.message, "documents.artifacts.errors.final_read_only")
      return true
    }
  )
  assert.equal(db.state.row.content, "kinnitatud sisu")
})

test("versioonita muutmine on endiselt draft-tingimuslik", async () => {
  const db = createFakeDb(draft({ status: "FINAL" }))
  await assert.rejects(
    () => updateDraftArtifact({ artifactId: "artifact_1", ownerId: "user_1", content: "x" }, { db }),
    (error) => error.status === 409
  )
})

test("võõras rida on 404, mitte 403 — omanikuskoop ei lekita olemasolu", async () => {
  const db = createFakeDb(draft())
  await assert.rejects(
    () => updateDraftArtifact({ artifactId: "artifact_1", ownerId: "user_2", content: "x" }, { db }),
    (error) => error.status === 404
  )
})

test("kinnitamine viib draftist FINAL-i ja võtab kliendi sisu kaasa", async () => {
  const db = createFakeDb(draft())
  const now = new Date("2026-08-11T11:00:00.000Z")
  const { artifact, alreadyFinal } = await approveArtifact(
    { artifactId: "artifact_1", ownerId: "user_1", expectedUpdatedAt: V1, content: "kinnitatav sisu" },
    { db, now }
  )

  assert.equal(alreadyFinal, false)
  assert.equal(artifact.status, "FINAL")
  assert.equal(artifact.content, "kinnitatav sisu")
  assert.equal(artifact.approvedAt.getTime(), now.getTime())
  assert.equal(db.state.updateManyCalls.length, 1, "kinnitus on ÜKS tingimuslik lause")
})

test("kinnitamine vananenud versiooni peale annab 409", async () => {
  const db = createFakeDb(draft({ updatedAt: new Date(V1.getTime() + 5000) }))
  await assert.rejects(
    () => approveArtifact(
      { artifactId: "artifact_1", ownerId: "user_1", expectedUpdatedAt: V1, content: "vana vaate sisu" },
      { db }
    ),
    (error) => error.status === 409 && error.message === "documents.artifacts.errors.version_conflict"
  )
  assert.equal(db.state.row.status, "DRAFT", "kaotaja ei tohi kinnitada")
})

test("sama sisu korduskinnitus on edu, mitte viga", async () => {
  const db = createFakeDb(draft({ status: "FINAL", content: "kinnitatud sisu" }))
  const { artifact, alreadyFinal } = await approveArtifact(
    { artifactId: "artifact_1", ownerId: "user_1", expectedUpdatedAt: V1, content: "kinnitatud sisu" },
    { db }
  )
  assert.equal(alreadyFinal, true)
  assert.equal(artifact.status, "FINAL")
})

test("MUU sisu kinnitamine juba kinnitatud rea peale on konflikt", async () => {
  // Just see eristus on tähtis: „juba FINAL" ei tähenda automaatselt, et minu töö on tehtud.
  const db = createFakeDb(draft({ status: "FINAL", content: "kellegi teise kinnitatud sisu" }))
  await assert.rejects(
    () => approveArtifact(
      { artifactId: "artifact_1", ownerId: "user_1", content: "minu sisu" },
      { db }
    ),
    (error) => error.status === 409
  )
  assert.equal(db.state.row.content, "kellegi teise kinnitatud sisu")
})

test("sisuta korduskinnitus jääb idempotentseks (vana klient)", async () => {
  const db = createFakeDb(draft({ status: "FINAL", content: "kinnitatud sisu" }))
  const { alreadyFinal } = await approveArtifact({ artifactId: "artifact_1", ownerId: "user_1" }, { db })
  assert.equal(alreadyFinal, true)
})

test("versioonitunnus loetakse ISO-sõnest, tühi on 'versiooni ei antud'", () => {
  assert.equal(parseExpectedVersion(null), null)
  assert.equal(parseExpectedVersion(""), null)
  assert.equal(parseExpectedVersion(undefined), null)
  assert.equal(parseExpectedVersion("2026-08-11T10:00:00.000Z").getTime(), V1.getTime())
  assert.equal(parseExpectedVersion(V1).getTime(), V1.getTime())
})

test("katkine versioonitunnus on 400, mitte vaikne 'versiooni ei antud'", () => {
  assert.throws(
    () => parseExpectedVersion("eile"),
    (error) => error.status === 400
  )
})
