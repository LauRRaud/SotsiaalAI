/**
 * SOL-CW-09 ja SOL-CW-10 — juhtumiloendi URL-i ja lehitsemise leping.
 *
 * Mõlemad otsused elavad JSX-ist väljas (`caseListState.js`), sest JSX-failis
 * elavat otsust ei saa selle projekti testijooksjaga tõendada.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CASE_PARAM,
  caseUrlWithCase,
  mergeCaseRows,
  planCaseNavigation,
  readCaseIdFromSearch
} from "../../components/casework/caseListState.js";

const SHELL = "../../components/casework/CaseWorkShell.jsx";
const LIST_URL = "https://sotsiaal.ai/juhtumid";

async function readShellCode() {
  const source = await readFile(new URL(SHELL, import.meta.url), "utf8");
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/.*$/gm, "$1");
}

/* ── SOL-CW-09: URL ja ajalugu ──────────────────────────────────────────── */

test("SOL-CW-09: valik loetakse URL-ist ja kirjutatakse URL-i", () => {
  assert.equal(readCaseIdFromSearch("?juhtum=case_1"), "case_1");
  assert.equal(readCaseIdFromSearch("?juhtum="), null);
  assert.equal(readCaseIdFromSearch("?juhtum=%20%20"), null);
  assert.equal(readCaseIdFromSearch(""), null);
  assert.equal(readCaseIdFromSearch("?muu=1"), null);

  assert.equal(caseUrlWithCase(LIST_URL, "case_1"), `${LIST_URL}?${CASE_PARAM}=case_1`);
  assert.equal(caseUrlWithCase(`${LIST_URL}?${CASE_PARAM}=case_1`, null), LIST_URL);
});

test("SOL-CW-09: juhtumi avamine LISAB ajalookirje, ei kirjuta loendi oma üle", () => {
  /* `replaceState` kirjutas loendi ajalookirje üle: Back viis eelmisele
     LEHELE, mitte juhtumiloendisse. */
  const plan = planCaseNavigation({ href: LIST_URL, currentId: null, nextId: "case_1", pushedDepth: 0 });
  assert.equal(plan.action, "push");
  assert.equal(plan.url, `${LIST_URL}?${CASE_PARAM}=case_1`);
});

test("SOL-CW-09: loend → detail → Back → loend → Forward → sama detail", () => {
  /* Ajaloopinu simulatsioon. Kandev asi on, et Back ei tekita uut kirjet ja
     Forward toob TÄPSELT sama juhtumi tagasi. */
  const stack = [LIST_URL];
  let index = 0;
  let pushedDepth = 0;
  let selected = readCaseIdFromSearch(new URL(stack[index]).search);

  const apply = (nextId) => {
    const plan = planCaseNavigation({ href: stack[index], currentId: selected, nextId, pushedDepth });
    if (plan.action === "push") {
      stack.length = index + 1;
      stack.push(plan.url);
      index += 1;
      pushedDepth += 1;
      selected = nextId;
    } else if (plan.action === "back") {
      index -= 1;
      pushedDepth = Math.max(0, pushedDepth - 1);
      selected = readCaseIdFromSearch(new URL(stack[index]).search);
    } else if (plan.action === "replace") {
      stack[index] = plan.url;
      selected = nextId;
    }
    return plan.action;
  };

  assert.equal(apply("case_1"), "push");
  assert.equal(selected, "case_1");
  assert.equal(stack.length, 2);

  // Brauseri Back
  index -= 1;
  pushedDepth = Math.max(0, pushedDepth - 1);
  selected = readCaseIdFromSearch(new URL(stack[index]).search);
  assert.equal(selected, null, "Back ei viinud juhtumiloendisse");

  // Brauseri Forward
  index += 1;
  selected = readCaseIdFromSearch(new URL(stack[index]).search);
  assert.equal(selected, "case_1", "Forward ei toonud sama juhtumit tagasi");
});

test("SOL-CW-09: detaili sulgemine kasutab Back-i, mitte kolmandat kirjet", () => {
  const plan = planCaseNavigation({ href: `${LIST_URL}?${CASE_PARAM}=case_1`, currentId: "case_1", nextId: null, pushedDepth: 1 });
  assert.equal(plan.action, "back", "sulgemine lisas ajalukku kolmanda kirje");
});

test("SOL-CW-09: otselingiga saabunud kasutajat ei visata Back-iga platvormilt välja", () => {
  /* `pushedDepth === 0` tähendab, et me ei ole ühtki kirjet lisanud — Back
     viiks kasutaja tagasi sinna, kust ta meie juurde tuli. */
  const plan = planCaseNavigation({ href: `${LIST_URL}?${CASE_PARAM}=case_1`, currentId: "case_1", nextId: null, pushedDepth: 0 });
  assert.equal(plan.action, "replace");
  assert.equal(plan.url, LIST_URL);
});

test("SOL-CW-09: sama juhtumi uuesti avamine ei tee midagi", () => {
  const plan = planCaseNavigation({ href: LIST_URL, currentId: "case_1", nextId: "case_1", pushedDepth: 1 });
  assert.equal(plan.action, "none");
});

/* ── SOL-CW-10: „Näita rohkem" ──────────────────────────────────────────── */

test("SOL-CW-10: sama kursori kaks vastust ei tekita topeltridu", () => {
  const page = [{ id: "case_1" }, { id: "case_2" }];
  const once = mergeCaseRows([{ id: "case_0" }], page);
  const twice = mergeCaseRows(once, page);

  assert.deepEqual(
    twice.map((row) => row.id),
    ["case_0", "case_1", "case_2"]
  );
});

test("SOL-CW-10: kordumisel jääb UUEM versioon, aga rea asukoht ei hüppa", () => {
  const merged = mergeCaseRows(
    [{ id: "case_1", label: "vana" }, { id: "case_2" }],
    [{ id: "case_1", label: "uus" }]
  );
  assert.deepEqual(merged.map((row) => row.id), ["case_1", "case_2"]);
  assert.equal(merged[0].label, "uus");
});

test("SOL-CW-10: tühi või vigane leht ei riku loendit", () => {
  const base = [{ id: "case_1" }];
  assert.deepEqual(mergeCaseRows(base, []), base);
  assert.deepEqual(mergeCaseRows(base, null), base);
  assert.deepEqual(mergeCaseRows(base, [{}, { id: null }]).map((row) => row.id), ["case_1"]);
  assert.deepEqual(mergeCaseRows(null, [{ id: "case_9" }]).map((row) => row.id), ["case_9"]);
});

/* ── pind ───────────────────────────────────────────────────────────────── */

test("SOL-CW-09/10: pind kasutab pushState'i, kuulab popstate'i ja keelab nupu", async () => {
  const shell = await readShellCode();
  assert.match(shell, /history\.pushState/, "avamine ei lisa ajalookirjet");
  assert.doesNotMatch(shell, /history\.replaceState\(null, "", url\)/, "vana replaceState-rada on alles");
  assert.match(shell, /addEventListener\("popstate"/, "popstate kuulaja puudub");
  assert.match(shell, /removeEventListener\("popstate"/, "popstate kuulajat ei koristata");
  assert.match(shell, /planCaseNavigation/, "navigatsiooniotsus on JSX-i sees");
  assert.match(shell, /mergeCaseRows/, "lehe liitmine on JSX-i sees");
  assert.match(shell, /disabled=\{state === "loading"\}/, "„Näita rohkem“ ei ole laadimise ajal keelatud");
});

test("SOL-CW-12: loomisvorm saadab idempotentsusvõtme ja tühistab selle sisu muutudes", async () => {
  /* Server oskab korduse kinni püüda ainult siis, kui klient võtme SAADAB.
     Ilma selle lepinguta jääks parandus serverisse ja topeltklõps pinnal
     kaitseta — täpselt see, mida SOL-CW-12 kirjeldab. */
  const shell = await readShellCode();
  assert.match(shell, /newClientActionKey/, "loomisvorm ei kasuta jagatud võtmegeneraatorit");
  assert.match(shell, /clientActionId: actionKeyRef\.current/, "võti ei jõua päringu kehasse");
  assert.match(
    shell,
    /if \(!actionKeyRef\.current\) actionKeyRef\.current = newClientActionKey\(\);/,
    "korduskatse teeks uue võtme — siis ei ole see enam korduskatse"
  );
  assert.match(shell, /const changeField = \(setter\) =>[\s\S]*?actionKeyRef\.current = null;/, "sisu muutus ei tühista võtit");
  assert.doesNotMatch(shell, /onChange=\{\(event\) => set(DisplayName|ExternalRef|NextContact)/, "mõni väli möödub võtme tühistajast");
});
