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

import { COPY_PHASE, runCopyForStar2 } from "../../components/casework/transferFlow.js";
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
  /* Võti sünnib kliendis (L22) — pind peab teda ISE tegema. */
  assert.match(panel, /randomUUID/, "kliendipoolne võtmegeneraator puudub");
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
