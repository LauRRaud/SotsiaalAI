/**
 * SOL-CW-02 — juhtumitöö suletud lehed peavad olema olematust marsruudist
 * eristamatud (leping L19).
 *
 * MIKS LEHE `notFound()` EI PIISA: mõõdetud päris production-build'iga, lehe
 * `notFound()` annab 404-SISU, aga staatuse 200 — juurpaigutus on juba
 * voogedastatud, kui `notFound()` jõuab mõjuda. Staatus reedab, et pind on
 * olemas. Keskvara on viimane koht, kus staatust saab veel muuta; sama
 * lahendus, mis Teenuspäevikul (`tests/serviceLog/proxyGate.test.js`).
 *
 * Test kutsub `proxy`-t päriselt, mitte ei kontrolli lähtekoodi regexiga.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy, config, FLAGGED_PAGE_REWRITES } from "../../proxy.js";

const FLAG = "CASEWORK_V1_ENABLED";
const CASEWORK_PAGES = ["/juhtumid", "/toolaud/juhtumitoo"];

function request(path) {
  return new NextRequest(`http://localhost${path}`);
}

async function proxyFor(path, flagValue) {
  const previous = process.env[FLAG];
  if (flagValue === undefined) delete process.env[FLAG];
  else process.env[FLAG] = flagValue;
  try {
    return await proxy(request(path));
  } finally {
    if (previous === undefined) delete process.env[FLAG];
    else process.env[FLAG] = previous;
  }
}

/** `x-middleware-rewrite` päise olemasolu ON ümberkirjutus. */
function rewriteTarget(response) {
  const raw = response?.headers?.get?.("x-middleware-rewrite");
  return raw ? new URL(raw).pathname : null;
}

test("SOL-CW-02: väljas lipuga kirjutatakse mõlemad juhtumitöö teed olematule teele", async () => {
  for (const path of CASEWORK_PAGES) {
    for (const value of [undefined, "0", "false", ""]) {
      const response = await proxyFor(path, value);
      const target = rewriteTarget(response);
      assert.ok(target, `${path}: lipuga "${value}" peab värav sulguma`);
      assert.notEqual(target, path, `${path}: ümberkirjutus ei tohi jääda samale teele`);
    }
  }
});

test("SOL-CW-02: mõlemad teed saavad TÄPSELT sama sihtkoha mis Teenuspäevik", async () => {
  /* Eri sihtkoht oleks omaette sõrmejälg: kaks suletud pinda annaksid kaks eri
     404-lehte ja nende erinevus ütleks, kumb pind on kumb. */
  const serviceLogPrevious = process.env.SERVICE_LOG_ENABLED;
  process.env.SERVICE_LOG_ENABLED = "0";
  try {
    const reference = rewriteTarget(await proxy(request("/teenuspaevik")));
    assert.ok(reference);
    for (const path of CASEWORK_PAGES) {
      assert.equal(rewriteTarget(await proxyFor(path, "0")), reference, `${path}: erinev 404-sihtkoht`);
    }
  } finally {
    if (serviceLogPrevious === undefined) delete process.env.SERVICE_LOG_ENABLED;
    else process.env.SERVICE_LOG_ENABLED = serviceLogPrevious;
  }
});

test("SOL-CW-02: sees lipuga proxy ei sekku kummalgi teel", async () => {
  for (const path of CASEWORK_PAGES) {
    assert.equal(rewriteTarget(await proxyFor(path, "1")), null, `${path}: sees lipuga ei tohi sulguda`);
  }
});

test("SOL-CW-02: värav puudutab AINULT täpseid teid", async () => {
  for (const path of ["/juhtumid/abc", "/juhtumidx", "/toolaud", "/toolaud/juhtumitoo/alam", "/valitoo"]) {
    assert.equal(rewriteTarget(await proxyFor(path, "0")), null, `${path} ei ole juhtumitöö lehe marsruut`);
  }
});

test("SOL-CW-02 juur: iga ümberkirjutatav tee peab olema ka matcher'is", () => {
  /* SEE ON LEIU JUUR: `notFound()` muster oli olemas, aga matcher ei katnud
     neid teid, seega keskvara ei jooksnud ja staatus jäi 200-ks. Uus
     ümberkirjutatav tee ilma matcher-kirjeta oleks vaikne kordus. */
  const matcher = config?.matcher || [];
  for (const entry of FLAGGED_PAGE_REWRITES) {
    assert.ok(
      matcher.includes(entry.pathname),
      `${entry.pathname} on ümberkirjutuste nimekirjas, aga puudub config.matcher'ist`
    );
    assert.equal(typeof entry.isEnabled, "function", `${entry.pathname}: lipulugeja puudub`);
  }
  for (const path of CASEWORK_PAGES) {
    assert.ok(
      FLAGGED_PAGE_REWRITES.some(entry => entry.pathname === path),
      `${path} peab olema ümberkirjutuste nimekirjas`
    );
  }
});
