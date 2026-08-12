import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { UrgentRequestError } from "../../lib/urgent/request.js";
import { statusForUrgentError } from "../../lib/urgent/routes.js";

const ROUTES = [
  "route.js",
  "availability/route.js",
  "[requestId]/route.js",
  "[requestId]/read/route.js",
  "[requestId]/take/route.js",
  "[requestId]/decline/route.js",
  "[requestId]/resolve/route.js",
  "[requestId]/recall/route.js",
  "[requestId]/handover/route.js",
  "[requestId]/handover-accept/route.js",
  "[requestId]/convert/route.js"
];

async function readRoute(name) {
  return readFile(new URL(`../../app/api/urgent-requests/${name}`, import.meta.url), "utf8");
}

test("iga marsruut nõuab sessiooni ja keeldub enne mistahes tööd", async () => {
  for (const name of ROUTES) {
    const source = await readRoute(name);
    /* SOL-URG-03/-13 järel on `/api/urgent-requests` kontroll süstitav
       (`requireUser = requireUrgentUser`), et rada saaks mõõta päris kutsena.
       Leping on sama ja mõõdetakse mõlemat poolt: PÄRIS kontroll peab olema
       vaikeväärtus, ja tulemus peab olema esimene asi, mille peale marsruut
       väljub. Ainult ühte neist mõõta ei tohi — süstitav vaikeväärtus ilma
       väljumiseta või väljumine ilma päris kontrollita on kumbki auk. */
    assert.match(
      source,
      /requireUrgentUser(\(\)|\s*[;,}])/,
      `${name}: sessioonikontroll puudub või ei ole vaikeväärtus`
    );
    assert.match(source, /const auth = await require(UrgentUser|User)\(\)/, `${name}: kontrolli tulemust ei loeta`);
    assert.match(
      source,
      /if \(!auth\.ok\) return urgentError\(auth\.message, auth\.status\)/,
      `${name}: auth-varajane väljumine puudub`
    );
  }
});

test("ükski marsruut ei võta toimingu tegijat päringu kehast", async () => {
  // Kui `userId` tuleks kehast, saaks igaüks tegutseda kellegi teise nime all
  // ja isikuline vastutusjälg oleks väärtusetu.
  for (const name of ROUTES) {
    const source = await readRoute(name);
    assert.doesNotMatch(source, /userId: body/, `${name}: tegija tuleb kehast`);
    assert.doesNotMatch(source, /authorId: body/, `${name}: autor tuleb kehast`);
  }
});

test("saatmisrada ei lase kliendil lauda valida", async () => {
  const source = await readRoute("route.js");
  // Piirkond tuleb kehast, LAUD tuletatakse serveris. Kui `deskId` tuleks
  // kehast, saaks pöördumise suunata lauale, mis teda ei oota.
  assert.doesNotMatch(source, /deskId: body/);
  assert.match(source, /authorId: auth\.userId/);
});

test("nähtavuspäring kasutab sama reeglit mis loomine", async () => {
  const source = await readRoute("availability/route.js");
  assert.match(source, /resolveUsableDesk/);
  // Suletud piirkonnas ei väljastata põhjusi — need on admini asi.
  assert.doesNotMatch(source, /reasons/);
});

test("laua vaade käib viewUrgentRequest kaudu, et vaatamine jätaks jälje", async () => {
  const source = await readRoute("[requestId]/route.js");
  assert.match(source, /viewUrgentRequest/);
});

test("eluohu vastus kannab eraldi lippu, et klient ei peaks teda tavaveaks", () => {
  const mapped = statusForUrgentError(new UrgentRequestError("urgent_request.emergency_route"));
  assert.equal(mapped.status, 409);
  assert.equal(mapped.message, "urgent_request.emergency_route");
});

test("veakoodid kaardistuvad õigetele staatustele", () => {
  const cases = [
    ["urgent_request.not_found", 404],
    ["urgent_request.forbidden", 403],
    ["urgent_request.desk_not_available", 409],
    ["urgent_request.not_recallable", 409],
    ["urgent_request.decline_reason_required", 400],
    ["urgent_request.situation_required", 400]
  ];
  for (const [code, status] of cases) {
    assert.equal(statusForUrgentError(new UrgentRequestError(code)).status, status, code);
  }
});

test("tundmatu viga ei leki kasutajale", () => {
  const mapped = statusForUrgentError(new Error("prisma kukkus"));
  assert.equal(mapped.status, 500);
  assert.equal(mapped.message, "api.common.server_error");
});
