import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const detailRoute = readFileSync(
  join(root, "app/api/help/listings/[kind]/[id]/route.js"),
  "utf8"
);
const listRoute = readFileSync(
  join(root, "app/api/help/listings/route.js"),
  "utf8"
);

// Eralda ühe funktsiooni keha nime järgi (lihtne sulgudeloendur).
// Parameetriloend võib sisaldada destruktureerimist ({...}) ja vaikeväärtusi
// (= {}), seega leiame KÕIGEPEALT parameetriloendi sulgeva ) ja alles siis
// keha avava { — muidu loeksime destruktureeritud parameetriobjekti kehaks.
function functionBody(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `funktsiooni ei leitud: ${signature}`);
  const parenClose = source.indexOf(")", start);
  assert.notEqual(parenClose, -1, `parameetriloendi sulgu ei leitud: ${signature}`);
  const braceStart = source.indexOf("{", parenClose);
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }
  throw new Error(`funktsiooni keha ei sulgunud: ${signature}`);
}

// ---- Detail-GET nähtavusleping ----

test("detail-GET delegeerib nähtavuslepingu teenusekihile", () => {
  assert.match(detailRoute, /loadHelpListingDetailForViewer/);
  const get = functionBody(detailRoute, "export async function GET");
  assert.match(get, /loadHelpListingDetailForViewer\(/, "GET peab kutsuma teenusekihi lepingut");
  assert.match(get, /result\.outcome !== "ok"/, "GET peab käsitlema mitte-ok tulemust");
  assert.match(get, /HELP_LISTING_NOT_FOUND/, "mitte-ok -> ühetaoline 404 sõnum");
  assert.match(get, /\b404\b/, "mitte-ok -> 404 staatus");
  assert.match(get, /isOwn: result\.isOwner/, "isOwn tuleb lepingu tulemusest");
});

test("detail-GET nõuab autentimist enne sisu (401)", () => {
  const get = functionBody(detailRoute, "export async function GET");
  assert.match(get, /if \(!auth\)/, "GET peab kontrollima autentimist");
  assert.match(get, /api\.common\.unauthorized/);
  assert.match(get, /\b401\b/);
});

test("detail-GET EI kasuta enam lekkivat omanikuprojektsiooni võõrale", () => {
  const get = functionBody(detailRoute, "export async function GET");
  // Vana lekkiv muster: tagastas toHelpListingDetailView(record) ilma
  // omaniku/staatuse kontrollita. See ei tohi GET-i kehas enam esineda.
  assert.doesNotMatch(get, /toHelpListingDetailView\(/, "GET ei tohi otse omanikuprojektsiooni serialiseerida");
  assert.doesNotMatch(get, /isOwn: record\.userId === auth\.userId/, "vana lekkiv GET-muster");
});

// ---- Omaniku mutatsioonivoog ei regressi ----

test("PATCH jääb omanikupõhiseks (403 võõrale)", () => {
  const patch = functionBody(detailRoute, "export async function PATCH");
  assert.match(patch, /existing\.userId !== auth\.userId/);
  assert.match(patch, /api\.common\.forbidden/);
});

test("DELETE jääb omanikule/adminile", () => {
  const del = functionBody(detailRoute, "export async function DELETE");
  assert.match(del, /existing\.userId !== auth\.userId && !auth\.isAdmin/);
});

// ---- Globaalse loendi OPEN-põrand ----

test("globaalne loend sunnib scope: global (OPEN-põrand) ega threadi kliendi status'it", () => {
  const globalFn = functionBody(listRoute, "async function loadGlobalListingsWithOwnPinned");
  assert.match(globalFn, /scope: "global"/, "globaalne loend peab kasutama global-skoopi");
  assert.doesNotMatch(globalFn, /statusFilter/, "globaalne loend ei tohi kliendi status'it edasi anda");
  assert.doesNotMatch(globalFn, /createStatusFilter/, "globaalne loend ei tohi kliendi status'it edasi anda");
  assert.match(globalFn, /globalOpenCountWhere/, "count peab olema OPEN-põrandaga");
});

test("mine loend kasutab scope: mine (omaniku töövoog)", () => {
  const mineFn = functionBody(listRoute, "async function loadMineListings");
  assert.match(mineFn, /scope: "mine"/);
});

test("globalOpenCountWhere põrandab count'i OPEN + aegumata kirjetele", () => {
  const countFn = functionBody(listRoute, "function globalOpenCountWhere");
  assert.match(countFn, /status: "OPEN"/);
  assert.match(countFn, /expiresAt/);
});
