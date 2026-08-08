/**
 * JTA-V1 (E2) — laua kuvaotsuste leping.
 *
 * OMANIKU KUUES AUDIT 08.08. Esimene teostus valis sektsiooni kuju
 * `items.length` järgi ja luges olekut ainult siis, kui ridu EI OLNUD:
 *
 *     items.length ? <ul>{read}</ul> : <p>{t(sectionStateKey(state))}</p>
 *
 * Tagajärg: `FORBIDDEN` või `TIMEOUT` koos ridadega oleks kuvanud read ja
 * oleku vaikides ära visanud. Ja tundmatu olek langes `EMPTY`-le ehk
 * kasutajale öeldi „tööd ei ole" siis, kui laud tegelikult ei teadnud.
 *
 * SIIN OLEVAD TESTID KUKUVAD VANA TEOSTUSE PEAL — see on v5 reegel: garantii
 * vajab testi, mis murrab vana koodi, mitte ainult testi, mis uuel roheline on.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { WORKBENCH_SECTIONS } from "../../lib/casework/workbench.js";
import { INVALID_VIEW, resolveSection, SECTION_VIEW, WORKBENCH_SECTION_ORDER } from "../../components/casework/workbenchView.js";

const ROW = { id: "x" };

test("pinna sektsioonide järjekord on BAIT-TÄPSELT koondlugeja oma (L12)", () => {
  assert.deepEqual([...WORKBENCH_SECTION_ORDER], [...WORKBENCH_SECTIONS]);
});

test("OK ridadega kuvab read", () => {
  const view = resolveSection({ state: "OK", items: [ROW, ROW] });
  assert.equal(view.showItems, true);
  assert.equal(view.noticeKey, null);
  assert.equal(view.items.length, 2);
});

test("EMPTY ütleb, et tööd ei ole", () => {
  const view = resolveSection({ state: "EMPTY", items: [] });
  assert.equal(view.showItems, false);
  assert.equal(view.noticeKey, "casework.workbench.state_empty");
});

test("FORBIDDEN, TIMEOUT ja ERROR EI kuva ridu ka siis, kui read on kaasas", () => {
  /* SEE ON SELLE FAILI PÕHJUS. Server hoiab neid olekuid täna tühjana, aga
     pind saab HTTP-vastuse ja ta ei tohi sõltuda sellest, et teine pool end
     korralikult üleval peab. Vana teostus kuvas siin read. */
  for (const state of ["FORBIDDEN", "TIMEOUT", "ERROR"]) {
    const view = resolveSection({ state, items: [ROW, ROW, ROW] });
    assert.equal(view.showItems, false, `${state}: read kuvatakse`);
    assert.equal(view.noticeKey, SECTION_VIEW[state].noticeKey, `${state}: vale tekst`);
  }
});

test("iga olek annab OMA teksti — neli põhjust ei tohi ühte kokku valada", () => {
  const keys = ["EMPTY", "FORBIDDEN", "TIMEOUT", "ERROR"].map((state) => resolveSection({ state, items: [] }).noticeKey);
  assert.equal(new Set(keys).size, 4, "kaks olekut jagavad sama teksti");
});

test("tundmatu olek on VIGA, mitte tühjus (fail-open lõks)", () => {
  /* Vana teostus tagastas siin `state_empty` ehk „tööd ei ole" — väljamõeldud
     vastus olukorras, kus laud tegelikult ei tea. */
  for (const state of ["UNKNOWN", "PARTIAL", "", null, undefined, 0, {}]) {
    const view = resolveSection({ state, items: [] });
    assert.equal(view.showItems, false);
    assert.equal(view.noticeKey, INVALID_VIEW.noticeKey, `${String(state)}: langes tühjusele`);
    assert.notEqual(view.noticeKey, SECTION_VIEW.EMPTY.noticeKey);
  }
});

test("terve puuduv deskriptor ei plahvata ega vaiki", () => {
  for (const data of [null, undefined, {}]) {
    const view = resolveSection(data);
    assert.equal(view.showItems, false);
    assert.equal(view.noticeKey, INVALID_VIEW.noticeKey);
    assert.deepEqual(view.items, []);
  }
});

test("OK ilma ridadeta on vastuolu, mitte tühi sektsioon", () => {
  /* `settled()` annab ridadeta juhul `EMPTY`. `OK` + 0 rida tähendab, et
     vastus ei vasta kokkulepitud kujule — ja „tööd ei ole" oleks siin
     väljamõeldud. */
  const view = resolveSection({ state: "OK", items: [] });
  assert.equal(view.showItems, false);
  assert.equal(view.noticeKey, INVALID_VIEW.noticeKey);
});

test("mitte-massiiv `items` ei jõua renderdusse", () => {
  for (const items of ["read", 3, {}, null]) {
    const view = resolveSection({ state: "OK", items });
    assert.deepEqual(view.items, []);
    assert.equal(view.showItems, false);
  }
});
