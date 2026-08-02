/**
 * TEENUSPÄEVIK-V1 — väravate lepingutestid.
 *
 * DoD punkt 7: „kõik lipu taga kuni omanik avab". Need testid tõendavad, et
 * väljas värav on VAIKIMISI olek, mitte eriharu, ja et alamlipud ei saa
 * peaväravat mööda minna.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  SERVICE_LOG_FLAG_KEYS,
  ServiceLogDisabledError,
  assertServiceLogEnabled,
  isServiceLogClientViewEnabled,
  isServiceLogEnabled,
  isServiceLogLocationStampEnabled,
  readServiceLogFlags
} from "../../lib/serviceLog/flags.js";

test("tühi keskkond tähendab VÄLJAS", () => {
  assert.equal(isServiceLogEnabled({}), false);
  assert.equal(isServiceLogLocationStampEnabled({}), false);
  assert.equal(isServiceLogClientViewEnabled({}), false);
});

test("ainult selge sisselülitus loeb — sodi on väljas", () => {
  for (const value of ["", "0", "false", "no", "off", "ei", "maybe", " ", "2"]) {
    assert.equal(
      isServiceLogEnabled({ [SERVICE_LOG_FLAG_KEYS.ENABLED]: value }),
      false,
      `"${value}" ei tohi väravat avada`
    );
  }
  for (const value of ["1", "true", "yes", "on", "TRUE", " On "]) {
    assert.equal(
      isServiceLogEnabled({ [SERVICE_LOG_FLAG_KEYS.ENABLED]: value }),
      true,
      `"${value}" peaks värava avama`
    );
  }
});

test("alamlipud ei saa peaväravat mööda minna", () => {
  // Asukohatemplit ega kliendivaadet ei ole mõtet avada, kui teenuskirjet
  // ennast luua ei saa — ja see EI TOHI olla ainult UI kokkulepe.
  const env = {
    [SERVICE_LOG_FLAG_KEYS.LOCATION_STAMP]: "1",
    [SERVICE_LOG_FLAG_KEYS.CLIENT_VIEW]: "1"
  };
  assert.equal(isServiceLogLocationStampEnabled(env), false);
  assert.equal(isServiceLogClientViewEnabled(env), false);

  const open = { ...env, [SERVICE_LOG_FLAG_KEYS.ENABLED]: "1" };
  assert.equal(isServiceLogLocationStampEnabled(open), true);
  assert.equal(isServiceLogClientViewEnabled(open), true);
});

test("lipud loetakse päringu ajal, mitte impordi hetkel", () => {
  // Mooduli-tasemel konstant külmutaks väärtuse ja test ei saaks väravat enam
  // ümber lülitada — sellest tekiks „test möödus, sest lipp jäi sisse".
  const env = {};
  assert.equal(readServiceLogFlags(env).enabled, false);
  env[SERVICE_LOG_FLAG_KEYS.ENABLED] = "1";
  assert.equal(readServiceLogFlags(env).enabled, true);
});

test("suletud värav annab 404, mitte 403", () => {
  assert.throws(
    () => assertServiceLogEnabled({}),
    (error) => {
      assert.ok(error instanceof ServiceLogDisabledError);
      assert.equal(error.status, 404);
      return true;
    }
  );
  assert.doesNotThrow(() => assertServiceLogEnabled({ [SERVICE_LOG_FLAG_KEYS.ENABLED]: "1" }));
});

test("API-marsruudid kontrollivad väravat ja piiravad rolli", () => {
  const root = process.cwd();
  for (const file of [
    path.join(root, "app", "api", "service-entries", "route.js"),
    path.join(root, "app", "api", "service-entries", "[id]", "route.js")
  ]) {
    const source = readFileSync(file, "utf8");
    // Väravaviga peab jõudma vastuseni, mitte jääma 500-ks.
    assert.match(source, /ServiceLogDisabledError/u, `${file}: väravaviga käsitlemata`);
    // Rollipiir on kitsas: ainult SERVICE_PROVIDER.
    assert.match(source, /roleFromSession\(session\) !== "SERVICE_PROVIDER"/u);
    // Admin EI tohi olla erand — ta ei kirjuta kellegi teise arve alusdokumente.
    assert.doesNotMatch(source, /isAdmin/u, `${file}: admin ei tohi olla sisestuse erand`);
    assert.match(source, /enforceChatRateLimit/u, `${file}: rate-limit puudub`);
  }
});
