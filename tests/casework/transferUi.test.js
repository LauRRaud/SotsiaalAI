/**
 * JTA-V1 (E6) — ülekandepinna leping.
 *
 * KANDEV ASI ON JÄRJEKORD (L16) ja teda ei saa tõendada serveris: server ei tea
 * kunagi, kas lõikelauale kirjutus õnnestus. Just seepärast elab järjekord
 * `transferFlow.js`-is puhta funktsioonina — ja need testid kutsuvad teda
 * PÄRISELT, mitte ei loe koodi kuju.
 *
 * Kolm asja, mis katkevad vaikselt:
 *   - audit kirjutatakse ENNE lõikelauda → auditis seisab tegu, mida ei toimunud
 *   - lõikelaua tõrge läheb kaduma       → kasutaja arvab, et tekst on kopeeritud
 *   - korduskatse teeb UUE võtme         → üks kopeerimine loetakse kaheks (L22)
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  COPY_PHASE,
  flushPendingAudits,
  queuePendingAudit,
  runCopyForStar2
} from "../../components/casework/transferFlow.js";
import { TRANSFER_EVENT_KIND } from "../../lib/casework/caseWorkTransfer.js";

const UI = "../../components/casework/TransferPanel.jsx";
const ACTION_KEY = "3f6d1c2a-1111-4222-8333-444455556666";

async function read(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

async function readCode(relative) {
  return (await read(relative)).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/.*$/gm, "$1");
}

async function readMessages(locale) {
  return JSON.parse(await readFile(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"));
}

function lookup(dictionary, key) {
  let current = dictionary;
  for (const part of key.split(".")) {
    if (!current || !Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    current = current[part];
  }
  return current;
}

/** Sammud, mis kirjutavad oma kutse ühte logisse — järjekord ON tulemus. */
function steps({ block = { text: "HOIATUS\n\nEESMARK: tekst", fieldKeys: ["EESMARK"] }, clipboard = true, audit = true } = {}) {
  const log = [];
  const calls = { record: [] };
  return {
    log,
    calls,
    flow: {
      createActionKey: () => {
        log.push("key");
        return ACTION_KEY;
      },
      loadBlock: async () => {
        log.push("block");
        if (block instanceof Error) throw block;
        return block;
      },
      writeClipboard: async () => {
        log.push("clipboard");
        return clipboard;
      },
      recordCopy: async (input) => {
        log.push("audit");
        calls.record.push(input);
        if (!audit) throw Object.assign(new Error("fail"), { messageKey: "casework.errors.unexpected" });
        return { ok: true };
      }
    }
  };
}

/* ── L16 järjekord ──────────────────────────────────────────────────────── */

test("L16: võti → plokk → lõikelaud → audit, TÄPSELT selles järjekorras", async () => {
  const { log, flow } = steps();
  const result = await runCopyForStar2(flow);

  assert.deepEqual(log, ["key", "block", "clipboard", "audit"]);
  assert.equal(result.phase, COPY_PHASE.COPIED);
  assert.equal(result.pendingAudit, null);
});

test("L16: lõikelaua tõrge EI KIRJUTA auditit ja plokk jääb alles", async () => {
  /* SEE ON KOGU L16 MÕTE. Vale järjekorra (audit enne lõikelauda) korral oleks
     logis „audit" ja auditis seisaks kopeerimine, mida ei toimunud. */
  const { log, calls, flow } = steps({ clipboard: false });
  const result = await runCopyForStar2(flow);

  assert.deepEqual(log, ["key", "block", "clipboard"]);
  assert.equal(calls.record.length, 0, "audit kirjutati ilma kopeerimiseta");
  assert.equal(result.phase, COPY_PHASE.CLIPBOARD_FAILED);
  /* Plokk jääb ekraanile, et inimene saaks ta käsitsi valida. */
  assert.ok(result.block?.text?.length);
});

test("lõikelaud õnnestus, audit ei — kasutaja saab ERI teate ja võti jääb alles", async () => {
  const { log, flow } = steps({ audit: false });
  const result = await runCopyForStar2(flow);

  assert.deepEqual(log, ["key", "block", "clipboard", "audit"]);
  assert.equal(result.phase, COPY_PHASE.AUDIT_FAILED);
  assert.deepEqual(result.pendingAudit, { fieldKeys: ["EESMARK"], clientActionId: ACTION_KEY });
});

test("L22: korduskatse kannab SAMA võtit, mitte uut", async () => {
  /* Uus võti tähendaks andmebaasi jaoks teist tegu ja unikaalne indeks ei
     kaitseks millegi eest — audit loeks ühe kopeerimise kaheks. */
  const first = steps({ audit: false });
  const failed = await runCopyForStar2(first.flow);

  const retry = steps();
  await retry.flow.recordCopy(failed.pendingAudit);

  assert.equal(retry.calls.record[0].clientActionId, first.calls.record[0].clientActionId);
});

/* ── SOL-CW-05: ootel auditite järjekord ────────────────────────────────── */

test("SOL-CW-05: kopeerimine → audit kukub → UUS kopeerimine ei kustuta esimest ootel jälge", async () => {
  /* Auditi kirjeldatud järjestus. Enne parandust hoidis pind ÜHTE
     `pendingAudit`-i ja teine kopeerimine kirjutas esimese üle — esimest tegu
     ei saanud enam kunagi tõendada ja ükski veateade ei tekkinud. */
  const first = steps({ audit: false });
  const firstResult = await runCopyForStar2(first.flow);
  assert.equal(firstResult.phase, COPY_PHASE.AUDIT_FAILED);

  let queue = queuePendingAudit([], firstResult.pendingAudit);
  assert.equal(queue.length, 1);

  const second = steps({ audit: false });
  second.flow.createActionKey = () => "9a9a9a9a-2222-4333-8444-555566667777";
  const secondResult = await runCopyForStar2(second.flow);
  queue = queuePendingAudit(queue, secondResult.pendingAudit);

  assert.equal(queue.length, 2, "teine kopeerimine kirjutas esimese ootel jälje üle");
  assert.deepEqual(
    queue.map((entry) => entry.clientActionId),
    [ACTION_KEY, "9a9a9a9a-2222-4333-8444-555566667777"],
    "järjekord peab säilitama tegude ajalise järjestuse"
  );
});

test("SOL-CW-05: korduskatse tühjendab järjekorra ja säilitab võtmed", async () => {
  const recorded = [];
  const queue = [
    { fieldKeys: ["EESMARK"], clientActionId: ACTION_KEY },
    { fieldKeys: ["OLUKORD"], clientActionId: "9a9a9a9a-2222-4333-8444-555566667777" }
  ];

  const result = await flushPendingAudits(queue, async (entry) => {
    recorded.push(entry.clientActionId);
  });

  assert.deepEqual(result.remaining, []);
  assert.equal(result.flushed, 2);
  assert.equal(result.errorKey, null);
  assert.deepEqual(recorded, [ACTION_KEY, "9a9a9a9a-2222-4333-8444-555566667777"]);
});

test("SOL-CW-05: püsivalt vigane kirje ei hoia teisi pantvangis", async () => {
  const recorded = [];
  const queue = [
    { fieldKeys: ["EESMARK"], clientActionId: "broken" },
    { fieldKeys: ["OLUKORD"], clientActionId: "healthy" }
  ];

  const result = await flushPendingAudits(queue, async (entry) => {
    recorded.push(entry.clientActionId);
    if (entry.clientActionId === "broken") {
      throw Object.assign(new Error("fail"), { messageKey: "casework.errors.unexpected" });
    }
  });

  assert.deepEqual(recorded, ["broken", "healthy"], "esimese vea peale peatuti");
  assert.equal(result.flushed, 1);
  assert.deepEqual(
    result.remaining.map((entry) => entry.clientActionId),
    ["broken"]
  );
  assert.equal(result.errorKey, "casework.errors.unexpected");
});

test("SOL-CW-05: ebaõnnestunud korduskatse ei kasvata järjekorda", async () => {
  /* Muidu kirjutaks üks tegu mitu auditirida. */
  const pending = { fieldKeys: ["EESMARK"], clientActionId: ACTION_KEY };
  const queue = queuePendingAudit(queuePendingAudit([], pending), { ...pending });
  assert.equal(queue.length, 1);
  assert.equal(queuePendingAudit(queue, null).length, 1);
});

test("SOL-CW-05: pind hoiab järjekorda, mitte üht pesa, ja hoiatus sõltub järjekorrast", async () => {
  const panel = await readCode(UI);
  assert.match(panel, /pendingAudits/, "pind hoiab endiselt üht ootel auditit");
  assert.doesNotMatch(panel, /setPendingAudit\(/, "vana ühepesaline setter on alles");
  assert.match(panel, /queuePendingAudit/, "uus kopeerimine ei lisa järjekorda");
  assert.match(panel, /flushPendingAudits/, "korduskatse ei tühjenda järjekorda");
  /* Hoiatust ei tohi juhtida viimane faas: pärast uut õnnestunud kopeerimist
     on `phase === COPIED`, aga eelmine jälg on endiselt salvestamata. */
  assert.match(panel, /\{pendingAudits\.length \?/, "hoiatuse tingimus tuleb järjekorrast");
});

test("tühi plokk ei jõua lõikelauale ega auditisse", async () => {
  const { log, flow } = steps({ block: { text: "HOIATUS", fieldKeys: [] } });
  const result = await runCopyForStar2(flow);

  assert.deepEqual(log, ["key", "block"], "tühja ploki tekst läks lõikelauale");
  assert.equal(result.phase, COPY_PHASE.EMPTY);
  assert.equal(result.errorKey, "casework.errors.transfer_field_keys_required");
});

test("ploki laadimise tõrge ei kirjuta auditit ega vaiki", async () => {
  const { log, flow } = steps({ block: Object.assign(new Error("nope"), { messageKey: "casework.errors.not_found" }) });
  const result = await runCopyForStar2(flow);

  assert.deepEqual(log, ["key", "block"]);
  assert.equal(result.phase, COPY_PHASE.LOAD_FAILED);
  assert.equal(result.errorKey, "casework.errors.not_found");
});

/* ── pind ───────────────────────────────────────────────────────────────── */

test("järjekord elab JSX-ist VÄLJAS, et teda saaks päriselt testida", async () => {
  /* Sama õppetund mis laual (omaniku kuues audit): JSX-failis elav otsus jääb
     testimata ja alles jääb regex-test, mis kontrollib kuju, mitte käitumist. */
  const panel = await readCode(UI);
  assert.match(panel, /from "\.\/transferFlow"/, "järjekord ei tule eraldi moodulist");
  assert.doesNotMatch(panel, /navigator\.clipboard[\s\S]{0,400}copy-events/, "kutsete järjekord on JSX-i sees kokku pandud");
});

test("pind ei kirjuta auditit enne lõikelauda ega genereeri võtit serveris", async () => {
  const panel = await readCode(UI);
  const clipboardIndex = panel.indexOf("navigator.clipboard");
  const auditIndex = panel.indexOf("copy-events");
  assert.ok(clipboardIndex > 0 && auditIndex > 0);
  assert.ok(clipboardIndex < auditIndex, "auditi marsruut esineb enne lõikelauda");
  /* Võti sünnib KLIENDIS (L22). Generaator ise kolis `caseWorkClient.js`-i,
     sest sama kuju ja sama varutee vajab ka juhtumi loomine (SOL-CW-12) — kaks
     koopiat tähendaks, et üks jääb parandamata. Pind peab teda kutsuma, mitte
     serverilt küsima. */
  assert.match(panel, /newClientActionKey/, "kliendipoolset võtmegeneraatorit ei kutsuta");
  assert.match(panel, /createActionKey: newClientActionKey/, "võti ei jõua kopeerimisvoogu");
});

test("SOL-CW-12: võtmegeneraator on JAGATUD ja töötab ka ilma `randomUUID`-ta", async () => {
  /* `randomUUID` puudub HTTP-lehel ja vanemas WebView-s. Ilma varuteeta jääks
     nii kopeerimine kui juhtumi loomine seal tegemata veateatega, mis räägiks
     hoopis võtme kujust. */
  const client = await readCode("../../components/casework/caseWorkClient.js");
  assert.match(client, /export function newClientActionKey/, "jagatud generaator puudub");
  assert.match(client, /randomUUID/, "generaator ei kasuta `randomUUID`-d");
  assert.match(client, /getRandomValues/, "varutee puudub — HTTP-lehel jääks tegu tegemata");

  const { newClientActionKey } = await import("../../components/casework/caseWorkClient.js");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  assert.match(newClientActionKey(), uuid, "vaiketee ei anna UUID-kuju");
  assert.notEqual(newClientActionKey(), newClientActionKey(), "kaks kutset annavad sama võtme");

  /* Varutee PÄRISELT läbi käidud, mitte ainult lähtekoodist loetud. */
  const realCrypto = globalThis.crypto;
  try {
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    assert.match(newClientActionKey(), uuid, "ilma `crypto`-ta ei sünni kehtivat võtit");
  } finally {
    Object.defineProperty(globalThis, "crypto", { value: realCrypto, configurable: true });
  }
});

test("ülekantuks märkimine on kaheastmeline ja kannab `expectedFrom`-i", async () => {
  /* `ULE_KANTUD` on terminaalne ja käivitab säilituskella — ühe vajutusega
     pöördumatu tegu on täpselt see muster, mille seitsmes audit maha võttis. */
  const panel = await readCode(UI);
  assert.match(panel, /<ConfirmButton/, "ülekantuks märkimine ei ole kaheastmeline");
  assert.match(panel, /expectedFrom: draft\.transferState/, "expectedFrom ei tule avatud elemendi seisust");
  assert.match(panel, /draft\.transferState === "VALMIS_ULEKANDEKS"/, "nupp on nähtav vales seisus");
});

test("pind ei renderda ühtegi auditi muutmis- ega kustutusnuppu", async () => {
  const panel = await readCode(UI);
  assert.doesNotMatch(panel, /method: "DELETE"/, "pinnal on auditi kustutus");
  assert.doesNotMatch(panel, /method: "PATCH"/, "pinnal on auditi uuendus");
});

test("iga kasutatud tõlkevõti on olemas KÕIGIS kolmes sõnastikus", async () => {
  const panel = await read(UI);
  const used = new Set([...panel.matchAll(/t\("(casework\.[a-zA-Z0-9_.]+)"/g)].map((match) => match[1]));

  /* Dünaamiliselt koostatud võtmed (`kind_${…}`) ei jõua regexi — nemad tulevad
     sõnastikust nimeliselt. */
  for (const kind of Object.values(TRANSFER_EVENT_KIND)) used.add(`casework.transfer.kind_${kind}`);
  used.add("casework.transfer.block_warning");

  assert.ok(used.size >= 12, "võtmeid leiti kahtlaselt vähe — kas regex vananes?");
  for (const locale of ["et", "en", "ru"]) {
    const messages = await readMessages(locale);
    for (const key of used) {
      assert.equal(typeof lookup(messages, key), "string", `${locale}: puudub võti ${key}`);
    }
  }
});
