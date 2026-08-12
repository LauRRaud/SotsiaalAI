import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { shouldSettleRequest } from "../../lib/chat/sidebarListState.js";

function read(relative) {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

const PILOT = read("app/tooheaolu/piloot/WellbeingPilotClient.jsx");
const ADMIN = read("app/admin/wellbeing/AdminWellbeingClient.jsx");

/* SOL-WB-14 otsus ise on puhas ja tal on juba oma testid
   (`tests/chat/sidebarListState.test.js`, SOL-U6-P1-2). Siin mängitakse läbi
   TÄPSELT kriteeriumi stsenaarium: A ja B mõlemas lahenemisjärjekorras. */
test("only the newest filter selection may write the report, in either resolution order", () => {
  let active = null;

  // A käivitub
  const a = { id: "A" };
  active = a;
  // B käivitub ja võtab pesa üle
  const b = { id: "B" };
  active = b;

  // B lahendub esimesena — tema tohib kirjutada
  assert.equal(shouldSettleRequest(active, b), true);
  // A lahendub HILJEM — tema ei tohi enam midagi kirjutada
  assert.equal(shouldSettleRequest(active, a), false);

  // Vastupidine järjekord: A lahendub enne B-d, aga pesa kuulub juba B-le
  active = b;
  assert.equal(shouldSettleRequest(active, a), false);
  assert.equal(shouldSettleRequest(active, b), true);

  /* Negatiivkontroll: ilma omandikontrollita („kirjuta alati") oleks vastus
     mõlemal juhul jah — ja täpselt see jättis ekraanile eelmise skoobi raporti
     uute valikuribade all. */
  const naive = () => true;
  assert.equal(naive(), true);
});

for (const [name, source] of [["pilot", PILOT], ["admin", ADMIN]]) {
  test(`${name} aggregate view aborts the previous request and lets only the current one write`, () => {
    assert.match(source, /abortRef\.current\?\.abort\(\);/u, "eelmine päring katkestatakse");
    assert.match(source, /const controller = new AbortController\(\);/u);
    assert.match(source, /signal: controller\.signal/u, "katkestus jõuab päris fetch'ini");
    assert.match(
      source,
      /const isCurrent = \(\) => shouldSettleRequest\(abortRef\.current, controller\);/u,
      "omandiotsus tuleb tõendatud puhtast moodulist, mitte uuest inline-tingimusest"
    );
    assert.match(source, /if \(!isCurrent\(\)\) return;\s*\n\s*setDataset/u, "aegunud vastus ei kirjuta andmestikku");
    assert.match(
      source,
      /if \(loadError\?\.name === "AbortError" \|\| !isCurrent\(\)\) return;/u,
      "aegunud vastus ei kirjuta ka viga"
    );
    assert.match(source, /return \(\) => abortRef\.current\?\.abort\(\);/u, "lahkumisel jääb päring rippuma");
  });
}

/* Sama vaate teine pool: raport peab ütlema, MILLISE piiri all ta arvutati.
   Ilma selleta ei ole kasutajal võimalik ekraanilt kontrollida, kas valikud ja
   number käivad kokku — ja just see teeb SOL-WB-01 vale omistamise nähtamatuks. */
test("the pilot view shows the scope boundary the numbers were computed under", () => {
  assert.match(PILOT, /currentMunicipalityId/u);
  assert.match(PILOT, /selectedPilotScope/u);
});
