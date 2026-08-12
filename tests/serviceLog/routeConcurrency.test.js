import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../lib/serviceLog/dayRoute.js", import.meta.url), "utf8");
const probe = await readFile(
  new URL("../../scripts/service-route-concurrency-probe.mjs", import.meta.url),
  "utf8"
);

test("külastuse siire ja päeva sulgemine kasutavad sama ServiceWorkRoute FOR UPDATE lukku", () => {
  assert.match(source, /function withLockedRoute[\s\S]*?FROM "ServiceWorkRoute"[\s\S]*?FOR UPDATE/);
  assert.match(source, /transitionVisit[\s\S]*?return withLockedRoute\(db, visit\.routeId/);
  assert.match(source, /closeRoute[\s\S]*?return withLockedRoute\(db, route\.id/);
});

test("siire loeb luku järel külastuse ja route'i uuesti ning nõuab OPEN seisu", () => {
  assert.match(
    source,
    /withLockedRoute\(db, visit\.routeId[\s\S]*?tx\.serviceVisit\.findFirst[\s\S]*?tx\.serviceWorkRoute\.findFirst[\s\S]*?route\.status !== ROUTE_STATUS\.OPEN/
  );
});

test("aktiivse külastuse kontroll ja kirjutus kasutavad lukustatud transaction-clienti", () => {
  assert.match(
    source,
    /isActiveVisit\(verdict\.status\)[\s\S]*?tx\.serviceVisit\.findFirst[\s\S]*?tx\.serviceVisit\.update/
  );
});

test("päris-DB sond võistleb kahe eri visiidi, close-depart ja close-arrive toiminguid", () => {
  assert.match(probe, /transitionVisit\(owner\.id, first\.id, "depart"/);
  assert.match(probe, /transitionVisit\(owner\.id, second\.id, "depart"/);
  assert.match(probe, /"close\/depart"/);
  assert.match(probe, /"close\/arrive"/);
  assert.match(probe, /rejected\[0\]\.reason\?\.status === 409/);
});
