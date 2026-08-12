import assert from "node:assert/strict";
import test from "node:test";

import {
  PAYMENT_MINIMUM_RETENTION_DAYS,
  resolvePaymentRetentionDays
} from "../../lib/retention.js";

/* Kõrvalleid SOL-PAY-09 juurest (auditis teda ei ole): makse säilitustähtaeg
   ei ole sisemine seadistus, vaid AVALDATUD lubadus. Privaatsustingimuste
   punkt 7.9 ütleb kasutajale „minimaalne makse- ja raamatupidamisalune kirje
   säilib kuni 7 aastat" ja see tekst on tootmises väljas. Põrand oli enne seda
   parandust `GENERAL_RETENTION_DAYS` (90 päeva), seega üks keskkonnamuutuja
   oleks lubaduse vaikselt tühistanud. Sama veaklass mis `WELLBEING_MIN_GROUP_SIZE=1`. */

test("the published seven-year floor cannot be lowered by configuration", () => {
  assert.equal(PAYMENT_MINIMUM_RETENTION_DAYS, 7 * 365);

  /* Just see rida on leid: 90 on `GENERAL_RETENTION_DAYS` väärtus ja vana
     põrand oleks ta läbi lasknud. */
  assert.equal(resolvePaymentRetentionDays({ env: { PAYMENT_RETENTION_DAYS: "90" } }), 2555);

  for (const attempt of ["1", "30", "365", "2554", "0", "-5"]) {
    assert.equal(
      resolvePaymentRetentionDays({ env: { PAYMENT_RETENTION_DAYS: attempt } }),
      PAYMENT_MINIMUM_RETENTION_DAYS,
      `${attempt} langetas avaldatud säilitustähtaega`
    );
  }
});

test("configuration may still raise retention above the published minimum", () => {
  /* Punkt 7.9 ütleb „või kauem, kui kohaldatav seadus seda nõuab" — tõstmine
     peab jääma võimalikuks, muidu ei saa seadusest tulenevat pikemat nõuet
     täita ilma koodimuudatuseta. */
  assert.equal(resolvePaymentRetentionDays({ env: { PAYMENT_RETENTION_DAYS: "3650" } }), 3650);
});

test("missing or unreadable configuration falls back to the published minimum", () => {
  assert.equal(resolvePaymentRetentionDays({ env: {} }), PAYMENT_MINIMUM_RETENTION_DAYS);
  assert.equal(
    resolvePaymentRetentionDays({ env: { PAYMENT_RETENTION_DAYS: "bad" } }),
    PAYMENT_MINIMUM_RETENTION_DAYS
  );
});

/* Negatiivkontroll: vana põrandaga (`GENERAL_RETENTION_DAYS`) oleks ülemine
   test roheline ainult juhuslikult — 90 oleks läbi läinud. Jäljendame vana
   avaldist siinsamas, et vahe oleks mõõdetud, mitte väidetud. */
test("the previous floor would have accepted ninety days", () => {
  const previousFloor = 90;
  const previous = Math.max(previousFloor, Number("90"));

  assert.equal(previous, 90, "vana muster laskis avaldatud lubadusest alla");
  assert.notEqual(
    previous,
    resolvePaymentRetentionDays({ env: { PAYMENT_RETENTION_DAYS: "90" } }),
    "parandus peab vana mustri tulemusest erinema"
  );
});
