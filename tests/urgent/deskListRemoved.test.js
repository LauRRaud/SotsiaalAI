import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { GET } from "../../app/api/urgent-requests/route.js";
import { DESK_VISIBLE_FIELDS } from "../../lib/urgent/request.js";
import { statusForUrgentError } from "../../lib/urgent/routes.js";
import { UrgentRequestError } from "../../lib/urgent/request.js";
import { createModel, createClient } from "./fakePrisma.js";

/**
 * SOL-URG-13 — tundliku pöördumise täisloend möödus „iga vaatamine jätab jälje"
 * lepingust.
 *
 * `GET /api/urgent-requests?role=desk` tagastas kuni 200 rida `deskProjection`
 * kujul (verbatim, AI-mustand, nimi, telefon, keeldumise põhjus) ilma ühegi
 * VIEWED sündmuseta. Laual on oma sisuta endpoint ja liides kasutab juba teda,
 * seega rada oli dubleeriv — ta kandis ainult riski.
 */

function makeRequest(url) {
  return { url };
}

function context(rows = []) {
  return {
    db: createClient({ urgentRequest: createModel(rows, "req") }),
    requireUser: async () => ({ ok: true, userId: "person_1", isAdmin: false })
  };
}

const ROW = {
  id: "req_1",
  authorId: "person_1",
  status: "SENT",
  situationVerbatim: "Mul ei ole täna öösel kuhugi minna.",
  assistantStructured: "Masina mustand.",
  contactName: "Kadri Tamm",
  contactPhone: "+372 5123 4567",
  declineReason: "Ei jõua täna.",
  readingTimePromise: "Loeme läbi 2 tunni jooksul.",
  sentAt: new Date("2026-08-05T20:00:00Z"),
  expiresAt: new Date("2026-08-06T08:00:00Z")
};

test("laua täisloend on eemaldatud ja ütleb seda välja", async () => {
  const response = await GET(makeRequest("https://x/api/urgent-requests?role=desk&deskId=desk_kov"), context([ROW]));
  const payload = await response.json();

  assert.equal(response.status, 410);
  assert.equal(payload.message, "urgent_request.desk_list_removed");
  assert.equal(payload.requests, undefined, "keeldumine kandis ikkagi ridu");
});

test("keeldumine ei lekita ühtegi sisuvälja", async () => {
  const response = await GET(makeRequest("https://x/api/urgent-requests?role=desk"), context([ROW]));
  const body = JSON.stringify(await response.json());

  for (const field of ["situationVerbatim", "assistantStructured", "contactName", "contactPhone", "declineReason"]) {
    assert.doesNotMatch(body, new RegExp(field), `${field} lekkis keeldumisvastusesse`);
  }
  assert.doesNotMatch(body, /kuhugi minna|Kadri|5123/);
});

test("pöörduja enda loend töötab edasi ja ei kanna laua välju", async () => {
  const response = await GET(makeRequest("https://x/api/urgent-requests"), context([ROW]));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.requests.length, 1);
  // Autori projektsioon EI ole laua projektsioon.
  assert.equal("contactPhone" in payload.requests[0], false);
  assert.equal("assistantStructured" in payload.requests[0], false);
});

test("marsruut ei impordi enam laua projektsiooni ega järjekorravalikut", async () => {
  const source = await readFile(new URL("../../app/api/urgent-requests/route.js", import.meta.url), "utf8");
  /* Mõõdame IMPORTE, mitte kogu faili: selgitav kommentaar TOHIB nimetada seda,
     mis siit ära võeti, aga kood ei tohi teda enam käeulatuses hoida. */
  const imports = source.slice(0, source.indexOf("export const runtime"));
  assert.doesNotMatch(imports, /deskProjection/, "laua projektsioon on endiselt selle marsruudi käeulatuses");
  assert.doesNotMatch(imports, /selectDeskRequests/);
  // Sisuta järjekord elab oma marsruudil ja tema kaudu käib laua vaade.
  assert.doesNotMatch(imports, /isDeskStaff/);
});

test("410 on kaardistatud, mitte üldine 400", () => {
  const mapped = statusForUrgentError(new UrgentRequestError("urgent_request.desk_list_removed"));
  assert.equal(mapped.status, 410);
});

test("üksikvaate rada on endiselt see, mis jälje jätab", async () => {
  const source = await readFile(
    new URL("../../app/api/urgent-requests/[requestId]/route.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /viewUrgentRequest/);
  // Laua väljad on endiselt olemas — nad lihtsalt ei tule enam LOENDINA.
  assert.ok(DESK_VISIBLE_FIELDS.includes("situationVerbatim"));
});
