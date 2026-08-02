/**
 * TEENUSPÄEVIK E8 — baasjoone arvutus.
 *
 * Need testid kaitsevad ühte konkreetset lubadust: „kirje sisestus alla 30
 * sekundiga (MÕÕDETUD)". Kui arvutus on lahke, muutub lubadus tõendatuks ilma,
 * et miski oleks tõendatud — ja just seda me heitsime ette konkurendi
 * metoodikata numbrile.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  ENTRY_TARGET_SECONDS,
  MAX_PLAUSIBLE_SECONDS,
  MIN_SAMPLES_FOR_CLAIM,
  SAMPLE_KIND,
  isPlausibleSample,
  isSampleKind,
  meetsEntryTarget,
  normalizeSample,
  summarize
} from "../../lib/serviceLog/measurement.js";

test("proovita ei ole baasjoont — null, mitte nullidega objekt", () => {
  assert.equal(summarize([]), null);
  assert.equal(summarize([{ seconds: 0 }]), null, "kõlbmatu ainus proov ei tee baasjoont");
});

test("mediaan ja p90 tulevad valimist, mitte keskmisest", () => {
  const summary = summarize([10, 12, 14, 16, 200]);
  assert.equal(summary.count, 5);
  assert.equal(summary.medianSeconds, 14, "mediaan ei tohi ühest aeglasest proovist nihkuda");
  assert.equal(summary.p90Seconds, 200);
  assert.equal(summary.fastestSeconds, 10);
  assert.equal(summary.slowestSeconds, 200);
});

/* Lahti unustatud vorm EI OLE sisestussessioon. Kärpimine tooks mediaani sisse
   hunniku täpselt-lävel proove ja teeskleks, et need olid päris sisestused. */
test("ebausutav proov visatakse ära, mitte ei kärbita", () => {
  assert.equal(isPlausibleSample(MAX_PLAUSIBLE_SECONDS + 1), false);
  assert.equal(isPlausibleSample(0), false);
  assert.equal(isPlausibleSample(-5), false);
  assert.equal(isPlausibleSample("ei ole number"), false);

  const summary = summarize([20, 22, 24, 100000]);
  assert.equal(summary.count, 3, "üle piiri proov ei tohi valimisse jõuda");
  assert.equal(summary.slowestSeconds, 24, "teda ei tohi ka kärbituna sisse tuua");
});

test("osakaal alla läve on see number, mille vastu DoD 1 loetakse", () => {
  const summary = summarize([10, 20, 30, 40]);
  assert.equal(summary.targetSeconds, ENTRY_TARGET_SECONDS);
  assert.equal(summary.underTargetCount, 3, "täpselt lävel olev proov loeb sisse");
  assert.equal(summary.underTargetShare, 75);
});

/* KAKS TINGIMUST. Ilma valimi nõudeta tõendaks üks kiire sisestus terve
   lubaduse ära — täpselt selline väide, mida me ise ei usuks. */
test("DoD 1 nõuab nii kiirust kui piisavat valimit", () => {
  const kiireAgaVaike = summarize([5, 6, 7]);
  assert.equal(meetsEntryTarget(kiireAgaVaike), false, "kolm proovi ei tõenda midagi");

  const suurAgaAeglane = summarize(Array.from({ length: 40 }, () => 45));
  assert.equal(meetsEntryTarget(suurAgaAeglane), false);

  const piisav = summarize(Array.from({ length: MIN_SAMPLES_FOR_CLAIM }, () => 20));
  assert.equal(meetsEntryTarget(piisav), true);

  assert.equal(meetsEntryTarget(null), false);
});

test("liik peab olema tuntud", () => {
  assert.equal(isSampleKind(SAMPLE_KIND.ENTRY_INPUT), true);
  assert.equal(isSampleKind("entry_input"), true, "väiketähed on lubatud");
  assert.equal(isSampleKind("MIDAGI_MUUD"), false);
  assert.equal(isSampleKind(""), false);
});

/* Kõlbmatu proov EI TOHI olla viga: kasutaja kirje salvestamine ei tohi kukkuda
   selle pärast, et mõõdik ei osanud oma numbrit lugeda. */
test("normalizeSample tagastab null, mitte ei viska", () => {
  assert.equal(normalizeSample({ kind: "ENTRY_INPUT", seconds: 99999 }), null);
  assert.equal(normalizeSample({ kind: "VALE", seconds: 20 }), null);
  assert.equal(normalizeSample({}), null);
  assert.deepEqual(normalizeSample({ kind: "entry_input", seconds: 20.6 }), {
    kind: "ENTRY_INPUT",
    seconds: 21
  });
});
