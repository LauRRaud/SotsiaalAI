import assert from "node:assert/strict"
import test from "node:test"

import { buildIntentSignature, mintIntentKey, resolveIntentKey } from "../../lib/usage/intentKey.js"

// SOL-DOC-01, kliendi pool. Ilma stabiilse võtmeta oli iga korduskatse serveri jaoks uus
// kavatsus: uus reservatsioon, uus tasu, uus mustand. Siin mõõdetakse ainult seda, MILLAL
// võti jääb samaks ja millal tekib uus.

function mintSequence() {
  let index = 0
  return () => {
    index += 1
    return `key_${index}`
  }
}

test("allkiri ei sõltu väljade järjekorrast", () => {
  const a = buildIntentSignature({ type: "LETTER_DRAFT", documentIds: ["d1", "d2"], length: "standard" })
  const b = buildIntentSignature({ length: "standard", documentIds: ["d1", "d2"], type: "LETTER_DRAFT" })
  assert.equal(a, b)
})

test("allkiri sõltub massiivi järjekorrast, sest see on sisend, mitte vorming", () => {
  const a = buildIntentSignature({ documentIds: ["d1", "d2"] })
  const b = buildIntentSignature({ documentIds: ["d2", "d1"] })
  assert.notEqual(a, b)
})

test("undefined väli ei muuda allkirja, sest JSON viskab ta niikuinii minema", () => {
  const withUndefined = buildIntentSignature({ type: "LETTER_DRAFT", templateId: undefined })
  const without = buildIntentSignature({ type: "LETTER_DRAFT" })
  assert.equal(withUndefined, without)
})

test("tühja väärtusega väli on omaette sisend", () => {
  assert.notEqual(buildIntentSignature({ templateId: "" }), buildIntentSignature({}))
  assert.notEqual(buildIntentSignature({ templateId: null }), buildIntentSignature({}))
})

test("sama sisendiga kordus kannab sama võtit", () => {
  const mint = mintSequence()
  const signature = buildIntentSignature({ instruction: "tee kokkuvõte" })

  const first = resolveIntentKey(null, signature, mint)
  const retry = resolveIntentKey(first, signature, mint)

  assert.equal(first.key, "key_1")
  assert.equal(retry.key, "key_1")
  assert.equal(retry, first)
})

test("muutunud sisend on uus kavatsus ja saab uue võtme", () => {
  const mint = mintSequence()
  const first = resolveIntentKey(null, buildIntentSignature({ instruction: "a" }), mint)
  const second = resolveIntentKey(first, buildIntentSignature({ instruction: "b" }), mint)

  assert.equal(first.key, "key_1")
  assert.equal(second.key, "key_2")
})

test("lahendatud kavatsuse järel (ref tühjendatud) on sama sisend aus uus töö", () => {
  const mint = mintSequence()
  const signature = buildIntentSignature({ instruction: "a" })

  const first = resolveIntentKey(null, signature, mint)
  // Klient nullib ref'i serveri kindla vastuse peale.
  const afterSuccess = resolveIntentKey(null, signature, mint)

  assert.equal(first.key, "key_1")
  assert.equal(afterSuccess.key, "key_2")
})

test("katkine eelmine olek ei jäta võtit puudu", () => {
  const mint = mintSequence()
  const signature = buildIntentSignature({ instruction: "a" })
  const resolved = resolveIntentKey({ signature, key: "" }, signature, mint)
  assert.equal(resolved.key, "key_1")
})

test("vaikimisi võtmeloome annab iga kord erineva väärtuse", () => {
  assert.notEqual(mintIntentKey(), mintIntentKey())
})
