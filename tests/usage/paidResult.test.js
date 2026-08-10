import assert from "node:assert/strict"
import test from "node:test"

import { PAID_RESULT_STAGES, runPaidResult } from "../../lib/usage/paidResult.js"

// SOL-DOC-01. Mõõdetav väide on üksainus: KAS arvestatud ühiku ja leitava tulemuse vahel
// saab tekkida vahe. Iga test siin süstib vea täpselt ühte sammu ja loeb kaks asja —
// millised sammud jõudsid käia ja mis juhtus reservatsiooniga.

function createHarness({ produce, persist, commit, release } = {}) {
  const steps = []
  const handle = { idempotencyKey: "documents.generate:intent_1" }

  const options = {
    reserve: () => {
      steps.push("reserve")
      return handle
    },
    produce: async () => {
      steps.push("produce")
      if (produce) return produce()
      return { content: "sisu" }
    },
    persist: async (produced) => {
      steps.push("persist")
      if (persist) return persist(produced)
      return { artifact: { id: "artifact_1", content: produced.content } }
    },
    commit: commit === null ? null : async () => {
      steps.push("commit")
      if (commit) return commit()
      return undefined
    },
    release: async (_handle, reason) => {
      steps.push(`release:${reason}`)
      if (release) return release()
      return undefined
    },
    onReleaseError: (error, reason) => {
      steps.push(`release_failed:${reason}:${error.message}`)
    }
  }

  return { steps, handle, options }
}

test("tasu võetakse alles pärast püsivat tulemust", async () => {
  const { steps, options } = createHarness()

  const result = await runPaidResult(options)

  assert.deepEqual(steps, ["reserve", "produce", "persist", "commit"])
  assert.equal(result.persisted.artifact.id, "artifact_1")
})

test("üle kvoodi jäänud sisu vabastab reservatsiooni ega võta tasu", async () => {
  const quotaError = new Error("documents.errors.storage_quota_exceeded")
  quotaError.status = 413
  const { steps, options } = createHarness({
    persist: () => {
      throw quotaError
    }
  })

  await assert.rejects(() => runPaidResult(options), (error) => {
    assert.equal(error, quotaError)
    assert.equal(error.status, 413)
    assert.equal(error.paidResultStage, PAID_RESULT_STAGES.PERSIST)
    return true
  })

  assert.deepEqual(steps, ["reserve", "produce", "persist", "release:paid_result_not_durable"])
  assert.ok(!steps.includes("commit"), "413 ei tohi jõuda tasuni")
})

test("mustandi loomise viga vabastab reservatsiooni", async () => {
  const { steps, options } = createHarness({
    persist: () => {
      throw new Error("draft create failed")
    }
  })

  await assert.rejects(() => runPaidResult(options), /draft create failed/)

  assert.deepEqual(steps, ["reserve", "produce", "persist", "release:paid_result_not_durable"])
})

test("mudelikutse viga vabastab reservatsiooni ega jõua püsiva sammuni", async () => {
  const { steps, options } = createHarness({
    produce: () => {
      throw new Error("provider timeout")
    }
  })

  await assert.rejects(() => runPaidResult(options), (error) => {
    assert.equal(error.paidResultStage, PAID_RESULT_STAGES.PRODUCE)
    return true
  })

  assert.deepEqual(steps, ["reserve", "produce", "release:paid_work_failed"])
})

test("commit'i viga EI vabasta juba püsivat tulemust", async () => {
  const { steps, options } = createHarness({
    commit: () => {
      throw new Error("commit failed")
    }
  })

  await assert.rejects(() => runPaidResult(options), (error) => {
    assert.equal(error.paidResultStage, PAID_RESULT_STAGES.COMMIT)
    return true
  })

  // Püsiv mustand on juba omaniku oma. Vabastus annaks talle tasulise tulemuse tasuta ja
  // teeks arvelduse tulemusest lahknevaks; reservatsioon jääb RESERVED-iks, mille sama
  // võtmega korduskatse parandab või mille aegumise järel reaper tagastab.
  assert.deepEqual(steps, ["reserve", "produce", "persist", "commit"])
  assert.ok(!steps.some((step) => step.startsWith("release")), "commit'i viga ei tohi vabastada")
})

test("vabastuse enda viga ei varja algset viga", async () => {
  const original = new Error("draft create failed")
  const { steps, options } = createHarness({
    persist: () => {
      throw original
    },
    release: () => {
      throw new Error("release unreachable")
    }
  })

  await assert.rejects(() => runPaidResult(options), (error) => {
    assert.equal(error, original)
    return true
  })

  assert.deepEqual(steps, [
    "reserve",
    "produce",
    "persist",
    "release:paid_result_not_durable",
    "release_failed:paid_result_not_durable:release unreachable"
  ])
})

test("ise arveldav püsiv samm ei vaja eraldi commit'i", async () => {
  // Refine'i kuju: auditirida ja tasu on ühes tehingus, seega eraldi commit-sammu ei ole.
  const { steps, options } = createHarness({ commit: null })

  const result = await runPaidResult(options)

  assert.deepEqual(steps, ["reserve", "produce", "persist"])
  assert.equal(result.persisted.artifact.id, "artifact_1")
})

test("ise arveldava sammu viga vabastab samamoodi", async () => {
  const { steps, options } = createHarness({
    commit: null,
    persist: () => {
      throw new Error("audit row failed")
    }
  })

  await assert.rejects(() => runPaidResult(options), /audit row failed/)

  assert.deepEqual(steps, ["reserve", "produce", "persist", "release:paid_result_not_durable"])
})

test("puuduv kohustuslik samm on programmeerimisviga, mitte vaikiv möödaminek", async () => {
  await assert.rejects(() => runPaidResult({ reserve: () => ({}), produce: () => ({}) }), TypeError)
  await assert.rejects(() => runPaidResult({ produce: () => ({}), persist: () => ({}) }), TypeError)
})
