import assert from "node:assert/strict";
import test from "node:test";

import { estimateMaxAudioSecondsFromBytes } from "../../lib/audio/duration.js";

// SOL-MEET-05. `readAudioDurationSecondsFromBuffer()` tagastab iga parse-vea korral `null` ja
// marsruut pani selle asemele fikseeritud 60 sekundit — sõltumata sellest, et fail võis olla kuni
// 12 MB. See ei olnud konservatiivne oletus vaid süsteemne möödapääs `STT_SECONDS` kuulimiidist.
//
// Ainus asi, mida tundmatu kestuse korral TEAME, on failimaht. Madalam eeldatav bitikiirus annab
// PIKEMA kestuse, seega on ta ohutu suund.

test("hinnang kasvab failimahuga ja on vaikimisi 32 kbps järgi", () => {
  // 32 kbps = 4000 baiti sekundis.
  assert.equal(estimateMaxAudioSecondsFromBytes(4000), 1);
  assert.equal(estimateMaxAudioSecondsFromBytes(40_000), 10);
  assert.equal(estimateMaxAudioSecondsFromBytes(400_000), 100);
});

test("12 MB fail annab ohutu ülempiiri, mitte 60 sekundit", () => {
  const seconds = estimateMaxAudioSecondsFromBytes(12 * 1024 * 1024);
  assert.ok(seconds > 3000, `12 MB peab andma üle 3000 s, sai ${seconds}`);
  assert.notEqual(seconds, 60);
});

test("madalam eeldatav bitikiirus annab PIKEMA kestuse — see on ohutu suund", () => {
  const at32 = estimateMaxAudioSecondsFromBytes(1_000_000, { minBitrateKbps: 32 });
  const at16 = estimateMaxAudioSecondsFromBytes(1_000_000, { minBitrateKbps: 16 });
  assert.ok(at16 > at32, "poole madalam bitikiirus peab andma pikema kestuse");
  assert.equal(at16, at32 * 2);
});

test("ümardatakse ÜLES: osaline sekund on ikka sekund", () => {
  assert.equal(estimateMaxAudioSecondsFromBytes(4001), 2);
});

test("mõttetu sisend ei anna mõttetut arvu, vaid null", () => {
  assert.equal(estimateMaxAudioSecondsFromBytes(0), null);
  assert.equal(estimateMaxAudioSecondsFromBytes(-5), null);
  assert.equal(estimateMaxAudioSecondsFromBytes(null), null);
  assert.equal(estimateMaxAudioSecondsFromBytes("mitte arv"), null);
});

test("vigane seadistus ei tohi hinnangut lõhkuda", () => {
  assert.equal(
    estimateMaxAudioSecondsFromBytes(40_000, { minBitrateKbps: 0 }),
    estimateMaxAudioSecondsFromBytes(40_000),
    "null-bitikiirus peab langema tagasi vaikeväärtusele, mitte andma Infinity"
  );
  assert.equal(
    estimateMaxAudioSecondsFromBytes(40_000, { minBitrateKbps: "jama" }),
    estimateMaxAudioSecondsFromBytes(40_000)
  );
});
