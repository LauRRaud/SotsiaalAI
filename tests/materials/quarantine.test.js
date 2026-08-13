import test from "node:test"
import assert from "node:assert/strict"

import { createClamdScanner } from "../../lib/materials/clamd.js"
import { quarantineMaterialUpload } from "../../lib/materials/quarantine.js"

function fakeDb() {
  const receipts = new Map()
  const jobs = []
  const audits = []
  let sequence = 0
  const apply = (row, data) => {
    for (const [key, value] of Object.entries(data)) {
      row[key] = value && typeof value === "object" && "increment" in value
        ? Number(row[key] || 0) + value.increment
        : value
    }
    return { ...row }
  }
  const db = {
    receipts,
    jobs,
    audits,
    materialUploadQuarantine: {
      async create({ data }) {
        const row = { id: `receipt-${++sequence}`, ...data }
        receipts.set(row.id, row)
        return { ...row }
      },
      async findUnique({ where }) {
        const row = receipts.get(where.id)
        return row ? { ...row } : null
      },
      async update({ where, data }) {
        return apply(receipts.get(where.id), data)
      },
      async updateMany({ where, data }) {
        const row = receipts.get(where.id)
        if (!row) return { count: 0 }
        apply(row, data)
        return { count: 1 }
      }
    },
    dataDeletionJob: {
      async create({ data }) {
        const row = { id: `job-${++sequence}`, ...data }
        jobs.push(row)
        return { ...row }
      },
      async findFirst({ where }) {
        return jobs.find(job => job.action === where.action && job.resourceId === where.resourceId) || null
      },
      async update({ where, data }) {
        return apply(jobs.find(job => job.id === where.id), data)
      }
    },
    async $transaction(write) { return write(db) }
  }
  return db
}

function fileOps(events) {
  return {
    async write(buffer, storagePath) { events.push(`write:${storagePath.split("/")[0]}`); assert.ok(Buffer.isBuffer(buffer)) },
    async remove(storagePath) { events.push(`remove:${storagePath.split("/")[0]}`) }
  }
}

async function audit({ db, action, meta }) {
  db.audits.push({ action, meta })
}

test("quarantine write and CLEAN scan happen before the parser", async () => {
  const db = fakeDb()
  const events = []
  const result = await quarantineMaterialUpload(
    { userId: "owner-1", originalName: "safe.pdf", mime: "application/pdf", buffer: Buffer.from("safe") },
    {
      db,
      files: fileOps(events),
      scanner: { async scan() { events.push("scan"); return {
        state: "CLEAN", engine: "ClamAV", engineVersion: "1", signatureVersion: "2", signatureUpdatedAt: new Date()
      } } },
      validate: async () => { events.push("parse") },
      sanitizer: { async sanitize() { events.push("sanitize"); return {
        buffer: Buffer.from("safe text\n"), mime: "text/plain; charset=utf-8", sha256: "b".repeat(64), version: "test-v1"
      } } },
      audit
    }
  )
  assert.deepEqual(events, ["write:quarantine", "scan", "parse", "sanitize"])
  assert.equal(result.scanState, "CLEAN")
  assert.equal(result.validationState, "VALIDATED")
  assert.equal(db.receipts.get(result.quarantineReceiptId).quarantinePath.includes("safe.pdf"), false)
})

for (const code of ["scanner_unavailable", "scanner_timeout", "scanner_unknown_result", "scanner_signatures_stale"]) {
  test(`${code} fails closed without invoking the parser`, async () => {
    const db = fakeDb()
    let parsed = false
    await assert.rejects(quarantineMaterialUpload(
      { userId: "owner-1", originalName: "unsafe.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from("PK") },
      {
        db,
        files: fileOps([]),
        scanner: { async scan() { const error = new Error(code); error.code = code; throw error } },
        validate: async () => { parsed = true },
        audit
      }
    ), new RegExp(code))
    assert.equal(parsed, false)
    assert.equal([...db.receipts.values()][0].scanState, "FAILED")
    assert.equal([...db.receipts.values()][0].storageState, "QUARANTINED")
  })
}

test("EICAR/infected bytes are never parsed and get an audited deletion tombstone", async () => {
  const db = fakeDb()
  const events = []
  const eicar = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*")
  let parsed = false
  await assert.rejects(quarantineMaterialUpload(
    { userId: "owner-1", originalName: "invoice.pdf", mime: "application/pdf", buffer: eicar },
    {
      db,
      files: fileOps(events),
      scanner: { async scan(buffer) { return { state: buffer.includes("EICAR") ? "INFECTED" : "CLEAN" } } },
      validate: async () => { parsed = true },
      audit
    }
  ), /malware_detected/)
  assert.equal(parsed, false)
  assert.deepEqual(events, ["write:quarantine", "remove:quarantine"])
  assert.equal(db.jobs[0].action, "MATERIAL_QUARANTINE_DELETE")
  assert.equal(db.jobs[0].status, "done")
  assert.equal(db.audits[0].action, "MATERIAL_MALWARE_REJECTED")
  assert.equal("storagePath" in db.audits[0].meta, false)
})

test("clamd adapter rejects stale signatures before sending INSTREAM bytes", async () => {
  const requests = []
  const scanner = createClamdScanner({
    environment: { MATERIALS_CLAMD_SOCKET: "/synthetic/clamd.sock", MATERIALS_CLAMD_SIGNATURE_MAX_AGE_MS: "1000" },
    now: () => new Date("2026-08-13T12:00:00Z"),
    request: async chunks => {
      requests.push(chunks)
      return "ClamAV 1.4.2/27000/Wed Aug 12 10:00:00 2026"
    }
  })
  await assert.rejects(scanner.scan(Buffer.from("must-not-stream")), /scanner_signatures_stale/)
  assert.equal(requests.length, 1)
  assert.equal(requests[0][0].toString("ascii"), "zVERSION\0")
})
