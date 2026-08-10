import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { stageStoredText } from "../../lib/documents/storageStaging.js"
import { updateDocumentWithStagedText } from "../../lib/documents/transcriptContent.js"

// SOL-DOC-04. Ketas on siin PÄRIS (ajutine kaust), sest kogu leid ON ketta ja andmebaasi
// järjekorra kohta — võltsitud failisüsteemi all oleks ka vana kood roheline.

async function withTempDir(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sol-doc-04-"))
  const resolvePath = (storagePath) => path.join(dir, String(storagePath).replace(/[\\/]/g, "_"))
  try {
    return await run({ dir, resolvePath })
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

async function readOr(resolvePath, storagePath, fallback = null) {
  try {
    return await fs.readFile(resolvePath(storagePath), "utf8")
  } catch (error) {
    if (error?.code === "ENOENT") return fallback
    throw error
  }
}

async function leftovers(dir) {
  const entries = await fs.readdir(dir)
  return entries.filter((name) => name.includes(".staged-") || name.includes(".prev-"))
}

test("ajutine kirjutus ei puuduta veel päris faili", async () => {
  await withTempDir(async ({ dir, resolvePath }) => {
    await fs.writeFile(resolvePath("uploads/a.txt"), "vana sisu", "utf8")

    const staged = await stageStoredText("uus sisu", "uploads/a.txt", { resolvePath })

    assert.equal(await readOr(resolvePath, "uploads/a.txt"), "vana sisu")
    assert.equal(staged.size, Buffer.byteLength("uus sisu", "utf8"))
    assert.equal((await leftovers(dir)).length, 1, "ajutine fail on olemas")
  })
})

test("avaldamine vahetab sisu ja koristus ei jäta ajutist ega varukoopiat", async () => {
  await withTempDir(async ({ dir, resolvePath }) => {
    await fs.writeFile(resolvePath("uploads/a.txt"), "vana sisu", "utf8")

    const staged = await stageStoredText("uus sisu", "uploads/a.txt", { resolvePath })
    await staged.publish()
    await staged.cleanup()

    assert.equal(await readOr(resolvePath, "uploads/a.txt"), "uus sisu")
    assert.deepEqual(await leftovers(dir), [])
  })
})

test("avaldamise JÄREL tagasipööramine toob vana sisu tagasi", async () => {
  // Just see on leid: vana kood kirjutas vana faili peale ja DB-vea korral ei taastanud teda
  // keegi — allalaadimine luges uut, API ja AI-kokkuvõte vana teksti.
  await withTempDir(async ({ dir, resolvePath }) => {
    await fs.writeFile(resolvePath("uploads/a.txt"), "vana sisu", "utf8")

    const staged = await stageStoredText("uus sisu", "uploads/a.txt", { resolvePath })
    await staged.publish()
    await staged.rollback()

    assert.equal(await readOr(resolvePath, "uploads/a.txt"), "vana sisu")
    assert.deepEqual(await leftovers(dir), [])
  })
})

test("avaldamata tagasipööramine jätab päris faili puutumata", async () => {
  await withTempDir(async ({ dir, resolvePath }) => {
    await fs.writeFile(resolvePath("uploads/a.txt"), "vana sisu", "utf8")

    const staged = await stageStoredText("uus sisu", "uploads/a.txt", { resolvePath })
    await staged.rollback()

    assert.equal(await readOr(resolvePath, "uploads/a.txt"), "vana sisu")
    assert.deepEqual(await leftovers(dir), [])
  })
})

test("uue faili puhul tähendab tagasipööramine, et faili EI JÄÄ", async () => {
  // Orbfail: vana kood kirjutas uue transkripti faili enne rea loomist ja catch ei teadnud teed.
  await withTempDir(async ({ dir, resolvePath }) => {
    const staged = await stageStoredText("uus transkript", "uploads/new.txt", { resolvePath })
    await staged.publish()
    await staged.rollback()

    assert.equal(await readOr(resolvePath, "uploads/new.txt"), null, "orbfaili ei tohi jääda")
    assert.deepEqual(await leftovers(dir), [])
  })
})

test("sha256 ja suurus käivad kirjutatud baitide kohta", async () => {
  await withTempDir(async ({ resolvePath }) => {
    const staged = await stageStoredText("õäöü", "uploads/a.txt", { resolvePath })
    assert.equal(staged.size, Buffer.byteLength("õäöü", "utf8"))
    assert.match(staged.sha256, /^[0-9a-f]{64}$/)
    assert.equal(await fs.readFile(resolvePath(staged.tempPath), "utf8"), "õäöü")
  })
})

test("DB-viga PÄRAST failikirjutust jätab ketta vanaks", async () => {
  await withTempDir(async ({ dir, resolvePath }) => {
    await fs.writeFile(resolvePath("uploads/a.txt"), "vana sisu", "utf8")
    const db = {
      async $transaction(run) {
        return run({
          userDocument: {
            async update() {
              throw new Error("DB update katkes")
            }
          }
        })
      }
    }

    await assert.rejects(
      () => updateDocumentWithStagedText(
        { where: { id: "doc_1" }, storagePath: "uploads/a.txt", content: "uus sisu", data: {} },
        { db, stageOptions: { resolvePath } }
      ),
      /DB update katkes/
    )

    assert.equal(await readOr(resolvePath, "uploads/a.txt"), "vana sisu", "allalaadimine peab nägema vana sisu")
    assert.deepEqual(await leftovers(dir), [], "ajutine fail peab kaduma")
  })
})

test("DB-edu järel on ketas ja rida sama sisu", async () => {
  await withTempDir(async ({ dir, resolvePath }) => {
    await fs.writeFile(resolvePath("uploads/a.txt"), "vana sisu", "utf8")
    const written = []
    const db = {
      async $transaction(run) {
        return run({
          userDocument: {
            async update({ data }) {
              written.push(data)
              return { id: "doc_1", content: data.content, size: data.size, sha256: data.sha256 }
            }
          }
        })
      }
    }

    const row = await updateDocumentWithStagedText(
      { where: { id: "doc_1" }, storagePath: "uploads/a.txt", content: "uus sisu", data: { title: "T" } },
      { db, stageOptions: { resolvePath } }
    )

    assert.equal(row.content, "uus sisu")
    assert.equal(await readOr(resolvePath, "uploads/a.txt"), "uus sisu")
    assert.equal(written[0].size, Buffer.byteLength("uus sisu", "utf8"))
    assert.equal(written[0].title, "T")
    assert.deepEqual(await leftovers(dir), [])
  })
})
