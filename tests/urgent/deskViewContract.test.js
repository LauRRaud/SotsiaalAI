import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source() {
  return readFile(new URL("../../components/urgent/UrgentDeskView.jsx", import.meta.url), "utf8");
}

test("verbatim ja AI mustand on KAKS eraldi plokki, mõlemad märgistatud", async () => {
  const s = await source();
  const detail = s.slice(s.indexOf("function RequestDetail("), s.indexOf("export default function"));
  assert.match(detail, /request\.situationVerbatim/);
  assert.match(detail, /request\.assistantStructured/);
  assert.match(detail, /urgent\.desk_queue\.request\.verbatim_note/);
  assert.match(detail, /urgent\.desk_queue\.request\.assistant_note/);
  // Verbatim seisab EES: mustand ei tohi kunagi olla see, mida vastuvõtja
  // esimesena loeb.
  assert.ok(
    detail.indexOf("request.situationVerbatim") < detail.indexOf("request.assistantStructured"),
    "inimese enda sõnad peavad olema enne masina mustandit"
  );
});

test("„loetud“ on nupp, mitte kuvamise kõrvalmõju", async () => {
  const s = await source();
  // Kui `read` kutsutaks detailvaate avamisel, täituks lugemisaja lubadus
  // ilma, et keegi teksti loeks.
  const openDetail = s.slice(s.indexOf("async function openDetail("), s.indexOf("async function act("));
  assert.doesNotMatch(openDetail, /\/read/);
  assert.match(s, /onAction\(request\.id, "read"\)/);
});

test("järjekorra tabelis ei ole sisu ega telefoninumbrit", async () => {
  const s = await source();
  const table = s.slice(s.indexOf("{queue?.items?.length ? ("), s.indexOf("<RequestDetail"));
  assert.doesNotMatch(table, /situationVerbatim|assistantStructured|contactPhone/);
});

test("tühi lugemisaja lahter jääb tühjaks, mitte ei täideta teise rea omaga", async () => {
  const s = await source();
  assert.match(s, /\{item\.readingTimePromise \|\| ""\}/);
});

test("laua vaade ei kanna ühtegi järjestamise mõõdikut", async () => {
  const s = await source();
  assert.doesNotMatch(s, /priority|urgencyLevel|riskScore|sortBySeverity/i);
});

test("üleandmise kinnitamine on saaja toiming, mitte üleandja oma", async () => {
  const s = await source();
  const handovers = s.slice(s.indexOf("queue?.incomingHandovers?.length"), s.indexOf("{queue?.items?.length"));
  assert.match(handovers, /handover-accept/);
});
