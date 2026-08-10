import assert from "node:assert/strict"
import test from "node:test"

import {
  STT_MIN_SPEECH_BITRATE_BPS,
  STT_UNKNOWN_FALLBACK_SECONDS,
  resolveSttCommittedSeconds,
  resolveSttReservationSeconds
} from "../../lib/usage/sttDuration.js"

// SOL-DOC-02. Reservatsioon tehakse ENNE kutset, seega ilma vastuseta — tema ainus õige
// omadus on olla ÜLEMPIIR. Lõplik arvestus tehakse pärast kutset, seega tema õige omadus on
// olla TÄPNE. Need kaks ei tohi kokku sulada: ülempiiri arvestamine üle küsiks liiga palju,
// täpse väärtuse reserveerimine laseks piirist mööda.

test("teadaolev kestus on tugevaim allikas", () => {
  assert.equal(
    resolveSttReservationSeconds({ knownSeconds: 120, measuredSeconds: 5, sizeBytes: 50_000_000 }),
    120
  )
})

test("mõõdetud kestus võidab suuruse, kui teadaolevat ei ole", () => {
  assert.equal(resolveSttReservationSeconds({ measuredSeconds: 42, sizeBytes: 50_000_000 }), 42)
})

test("murdosa sekundist ümardatakse ÜLES, mitte alla", () => {
  assert.equal(resolveSttReservationSeconds({ measuredSeconds: 12.1 }), 13)
  assert.equal(resolveSttReservationSeconds({ knownSeconds: 0.2 }), 1)
})

test("kestuseta fail annab baitidest tuletatud ülempiiri", () => {
  // 1 MB kõne madalaimal usutaval bitikiirusel = 1000 s. Ülempiir, mitte hinnang.
  assert.equal(resolveSttReservationSeconds({ sizeBytes: 1_000_000 }), 1000)
  assert.equal(STT_MIN_SPEECH_BITRATE_BPS, 8000)
})

test("madalam bitikiirus annab pikema lubatud kestuse — süstitav", () => {
  const strict = resolveSttReservationSeconds({ sizeBytes: 1_000_000, minBitrateBps: 4000 })
  const loose = resolveSttReservationSeconds({ sizeBytes: 1_000_000, minBitrateBps: 16_000 })
  assert.equal(strict, 2000)
  assert.equal(loose, 500)
  assert.ok(strict > loose, "madalam bitikiirus = konservatiivsem ülempiir")
})

test("täiesti tundmatu sisend ei anna nulli, vaid põranda", () => {
  assert.equal(resolveSttReservationSeconds(), STT_UNKNOWN_FALLBACK_SECONDS)
  assert.equal(resolveSttReservationSeconds({ sizeBytes: 0 }), STT_UNKNOWN_FALLBACK_SECONDS)
})

test("katkised väärtused ei libise ülempiiri sisse", () => {
  assert.equal(resolveSttReservationSeconds({ knownSeconds: -5, measuredSeconds: 30 }), 30)
  assert.equal(resolveSttReservationSeconds({ knownSeconds: Number.NaN, sizeBytes: 1_000_000 }), 1000)
  assert.equal(resolveSttReservationSeconds({ measuredSeconds: 0, sizeBytes: 1_000_000 }), 1000)
})

test("teenusepakkuja mõõdetud kestus on lõplikus arvestuses tugevaim", () => {
  assert.equal(
    resolveSttCommittedSeconds({
      providerUsage: { type: "duration", seconds: 37 },
      knownSeconds: 900,
      measuredSeconds: 800,
      reservedSeconds: 1000
    }),
    37
  )
})

test("tokenipõhine usage EI ole kestus", () => {
  assert.equal(
    resolveSttCommittedSeconds({
      providerUsage: { type: "tokens", input_tokens: 900 },
      measuredSeconds: 12,
      reservedSeconds: 1000
    }),
    12
  )
})

test("ilma teenusepakkuja mõõduta langetakse teadaolevale, siis mõõdetule", () => {
  assert.equal(resolveSttCommittedSeconds({ knownSeconds: 60, measuredSeconds: 12, reservedSeconds: 1000 }), 60)
  assert.equal(resolveSttCommittedSeconds({ measuredSeconds: 12, reservedSeconds: 1000 }), 12)
})

test("mõõtu ei ole üldse: tehtud töö ei jää tasuta, arvestatakse reserveeritud maht", () => {
  assert.equal(resolveSttCommittedSeconds({ reservedSeconds: 300 }), 300)
  assert.equal(resolveSttCommittedSeconds(), STT_UNKNOWN_FALLBACK_SECONDS)
})

test("arvestus ei tohi kunagi reserveeritud mahtu ületada", () => {
  // Kui teenusepakkuja ütleb rohkem, kui me ülempiiriks pidasime, oli hinnang vale — aga
  // suurem commit kukuks ämbri invariandi otsa ja annaks 500 kasutajale, kelle transkript
  // on juba olemas. Vale hinnang ei tohi muutuda kasutaja veaks.
  assert.equal(
    resolveSttCommittedSeconds({
      providerUsage: { type: "duration", seconds: 5000 },
      reservedSeconds: 1000
    }),
    1000
  )
})

test("reserveeritud mahu puudumine ei tekita piiramist ega nulli", () => {
  assert.equal(resolveSttCommittedSeconds({ providerUsage: { type: "duration", seconds: 5000 } }), 5000)
})
