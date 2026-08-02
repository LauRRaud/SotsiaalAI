/**
 * TEENUSPÄEVIK-V1 — marsruudi värav keskvaras (`proxy.js`).
 *
 * MIKS SEE ON OMAETTE VÄRAV: lehe enda `notFound()` annab küll 404-SISU, aga
 * mitte 404-STAATUST. Mõõdetud päris production-build'iga: `/teenuspaevik`
 * väljas lipuga vastas 200-ga, olematu marsruut 404-ga. Sisu oli mõlemal 404,
 * aga staatus reetis, et pind on olemas — täpselt see, mida DoD 7 keelab.
 *
 * Põhjus ei ole teenuspäevikus: sama kehtib platvormi teiste `notFound()`
 * lehtede kohta (nt `/org/<tundmatu>/audit` → samuti 200), sest juurpaigutus
 * on juba voogedastatud, kui `notFound()` jõuab mõjuda. Keskvara on viimane
 * koht, kus staatust saab veel muuta.
 *
 * Test kutsub `proxy`-t päriselt, mitte ei kontrolli lähtekoodi regexiga —
 * sama õppetund, mis `flags.test.js`-is: regexi-test jäi magama, kui värav
 * nihkus valesse kohta.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy, config } from "../../proxy.js";

const FLAG = "SERVICE_LOG_ENABLED";

/* `NextRequest`, mitte tavaline `Request`: proxy loeb `req.nextUrl`-i, mida
   ainult NextRequest annab. Sama lõks nagu access.js-i küpsiseallikaga. */
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

/* `x-middleware-rewrite` on see päis, millega NextResponse.rewrite oma sihtkoha
   edasi annab — tema olemasolu ON ümberkirjutus. */
function rewriteTarget(response) {
  const raw = response?.headers?.get?.("x-middleware-rewrite");
  return raw ? new URL(raw).pathname : null;
}

test("väljas lipuga kirjutatakse /teenuspaevik olematule teele", async () => {
  for (const value of [undefined, "0", "false", ""]) {
    const response = await proxyFor("/teenuspaevik", value);
    const target = rewriteTarget(response);
    assert.ok(target, `lipuga "${value}" peab värav sulguma`);
    assert.notEqual(target, "/teenuspaevik", "ümberkirjutus ei tohi jääda samale teele");
  }
});

test("sees lipuga proxy ei sekku", async () => {
  const response = await proxyFor("/teenuspaevik", "1");
  assert.equal(rewriteTarget(response), null);
});

/* Värav ei tohi lekkida naabritele: /teenuspaevikud, /teenuspaevik-vana vms
   ei ole see marsruut ja proxy ei tohi neid kinni panna. */
test("värav puudutab AINULT täpset teed", async () => {
  for (const path of ["/teenuspaevikud", "/teenuspaevik/alam", "/valitoo"]) {
    const response = await proxyFor(path, "0");
    assert.equal(rewriteTarget(response), null, `${path} ei ole teenuspäeviku marsruut`);
  }
});

/* Ilma matcher-kirjeta ei jookseks proxy sellel teel üldse ja kõik ülaltoodu
   oleks tühi tõestus: käsitleja käitub õigesti, aga teda ei kutsuta kunagi. */
test("matcher sisaldab /teenuspaevik", () => {
  assert.ok(
    (config?.matcher || []).includes("/teenuspaevik"),
    "proxy config.matcher peab /teenuspaevik-i sisaldama"
  );
});
