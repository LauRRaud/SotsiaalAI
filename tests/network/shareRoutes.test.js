import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { NetworkShareError } from "../../lib/network/share.js";
import { statusForShareError, workerProjection } from "../../lib/network/shareRoutes.js";

const ROUTES = [
  "route.js",
  "[shareId]/route.js",
  "[shareId]/submit/route.js",
  "[shareId]/decision/route.js",
  "[shareId]/attest/route.js",
  "[shareId]/send/route.js",
  "[shareId]/open/route.js",
  "[shareId]/recall/route.js"
];

async function readRoute(name) {
  return readFile(new URL(`../../app/api/network-shares/${name}`, import.meta.url), "utf8");
}

test("iga marsruut nõuab sessiooni ja keeldub enne mistahes tööd", async () => {
  for (const name of ROUTES) {
    const source = await readRoute(name);
    assert.match(source, /requireShareUser\(\)/, `${name}: sessioonikontroll puudub`);
    assert.match(source, /if \(!auth\.ok\) return shareError\(auth\.message, auth\.status\)/, `${name}: auth-varajane väljumine puudub`);
  }
});

test("kliendi otsuse rada võtab kliendi SESSIOONIST, mitte päringu kehast", async () => {
  const source = await readRoute("[shareId]/decision/route.js");
  assert.match(source, /clientUserId: auth\.userId/);
  // Kui klienti saaks kehast anda, saaks igaüks kellegi teise eest kinnitada.
  assert.doesNotMatch(source, /clientUserId: body/);
});

test("ülekandmise rada võtab töötaja SESSIOONIST, mitte päringu kehast", async () => {
  const source = await readRoute("[shareId]/attest/route.js");
  assert.match(source, /workerId: auth\.userId/);
  assert.doesNotMatch(source, /workerId: body/);
});

test("mustandi loomine annab raamlepingu kontrolli edasi — O-CO-6 värav ei jää ripakile", async () => {
  const source = await readRoute("route.js");
  assert.match(source, /hasFrameworkAcceptance/);
  assert.match(source, /workerId: auth\.userId/);
});

test("saatmine annab kaasa ruumi avamise pordi", async () => {
  const source = await readRoute("[shareId]/send/route.js");
  assert.match(source, /createRoom: createRoomPort\(\)/);
  assert.match(source, /createOutbox: createShareOutboxPort\(\)/);
  assert.match(source, /hasFrameworkAcceptance/);
});

test("välise kliendi otsuse rada annab raamlepingu korduskontrolli edasi", async () => {
  const source = await readRoute("[shareId]/attest/route.js");
  assert.match(source, /hasFrameworkAcceptance/);
});

test("saaja rajad EI kasuta kunagi töötaja täisvaadet", async () => {
  for (const name of ["[shareId]/open/route.js", "[shareId]/decision/route.js"]) {
    const source = await readRoute(name);
    assert.doesNotMatch(source, /workerProjection/, `${name}: töötaja vaade lekkis`);
  }
});

test("mitteosaline saab 404, mitte 403 — jagamise OLEMASOLU ei lekita", async () => {
  const source = await readRoute("[shareId]/route.js");
  // Viimane haru enne sulgu peab olema not_found, mitte forbidden.
  const tail = source.slice(source.indexOf("clientUserId && share.clientUserId === auth.userId"));
  assert.match(tail, /network_share\.not_found", 404/);
  assert.doesNotMatch(tail, /api\.common\.forbidden/);
});

test("veakoodid kaardistuvad õigetele HTTP-staatustele", () => {
  const cases = [
    ["network_share.not_found", 404],
    ["network_share.forbidden", 403],
    ["network_share.worker_framework_agreement_required", 403],
    ["network_share.client_must_confirm_themselves", 403],
    ["network_share.client_confirmation_required", 409],
    ["network_share.not_recallable", 409],
    ["network_share.summary_required", 400],
    ["network_share.framework_check_unavailable", 503]
  ];
  for (const [code, expected] of cases) {
    assert.equal(statusForShareError(new NetworkShareError(code)).status, expected, code);
  }
});

test("tundmatu viga ei lekita sisu — 500 ja üldine sõnum", () => {
  const mapped = statusForShareError(new Error("midagi ootamatut andmebaasist"));
  assert.equal(mapped.status, 500);
  assert.equal(mapped.message, "api.common.server_error");
});

test("töötaja vaade kannab kinnituse tõendiväärtust nähtavalt", () => {
  const view = workerProjection({
    id: "s1",
    clientUserId: null,
    clientDisplayName: "Mari M.",
    clientConfirmationMethod: "IN_PERSON",
    clientConfirmationAttestedById: "worker_1"
  });
  assert.equal(view.clientIsExternal, true);
  assert.equal(view.clientConfirmationMethod, "IN_PERSON");
  assert.equal(view.clientConfirmationAttestedById, "worker_1");
});

test("loomise marsruut EI võta klienti päringu kehast — ta tuletatakse eelpöördumisest", async () => {
  const source = await readRoute("route.js");
  assert.doesNotMatch(source, /clientUserId: body/);
  assert.match(source, /sourcePreInquiryId: body\?\.sourcePreInquiryId/);
});

// --- Saaja vaade (V4) --------------------------------------------------------

test("saaja postkast kuvab AINULT saaja-projektsiooni välju", async () => {
  const source = await readFile(
    new URL("../../components/network/NetworkShareInbox.jsx", import.meta.url),
    "utf8"
  );
  // Need väljad EI TOHI saaja ekraanile jõuda ka siis, kui keegi nad
  // kogemata API-sse lisab.
  for (const forbidden of [
    "sourcePreInquiryId",
    "clientUserId",
    "clientDisplayName",
    "clientDecisionNote",
    "clientConfirmationMethod",
    "workerId"
  ]) {
    assert.doesNotMatch(source, new RegExp(`share[.]${forbidden}`), `${forbidden} lekkis saaja vaatesse`);
  }
  // Ja jagamispiir PEAB seal olema: ta ütleb saajale, mida temaga ei jagatud.
  assert.match(source, /openedShare\.sharingBoundary/);
});

test("saaja postkast küsib ainult oma rolli nimekirja", async () => {
  const source = await readFile(
    new URL("../../components/network/NetworkShareInbox.jsx", import.meta.url),
    "utf8"
  );
  assert.match(source, /role=recipient/);
  assert.doesNotMatch(source, /role=worker/);
});

test("SOL-NET-04: postkasti laadimine ei tagasta tundlikku detaili enne avamist", async () => {
  const route = await readRoute("route.js");
  assert.match(route, /recipientInboxProjection/);
  const source = await readFile(
    new URL("../../components/network/NetworkShareInbox.jsx", import.meta.url),
    "utf8"
  );
  assert.match(source, /openedShare/);
  assert.doesNotMatch(source, /<p>\{share\.summaryText\}<\/p>/);
});

test("koostamisvorm ei saada klienti kaasa — server tuletab ta", async () => {
  const source = await readFile(
    new URL("../../components/network/NetworkShareComposer.jsx", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /clientUserId:/);
  assert.match(source, /recipientEmail: draft\.recipientEmail/);
});
