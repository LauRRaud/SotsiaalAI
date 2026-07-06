import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readMessages(locale) {
  return JSON.parse(
    readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"),
  );
}

// NB (2026-07-06): avaleht ei paku enam rollivalikut (rollikaardid kadusid
// koos vana kodulehe kujundusega; home.card.* võtmed eemaldati surnud võtmete
// puhastuses). Rollisildid elavad registreerimisvoos — kontrollime neid.
test("service provider role labels stay consistent on the register screen", () => {
  const et = readMessages("et");
  const en = readMessages("en");
  const ru = readMessages("ru");

  assert.equal(et.role.provider, "Teenuse osutaja");
  assert.match(et.auth.register.role_hint, /Teenuse osutaja/);

  assert.equal(en.role.provider, "Service provider");
  assert.match(en.auth.register.role_hint, /Service provider/);

  assert.equal(ru.role.provider, "Поставщик услуг");
  assert.match(ru.auth.register.role_hint, /поставщик услуг/i);
});
