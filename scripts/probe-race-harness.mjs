/**
 * SONDIDE VÕISTLUSRIIST — deterministlik, mitte „mahtusid ühte sekundisse".
 *
 * Neli sondi (`org:seat`, `org:sponsor`, `org:inbox`, `net:share`) mõõdavad kõik
 * sama asja: mis juhtub, kui kaks kirjutajat lähevad korraga sama rea kallale.
 * Retsept on igal pool sama ja tema kordamine neljas failis tähendaks, et üks
 * koopia jääb ükskord parandamata — ja vigane võistlusriist annab ROHELISE
 * tulemuse, mitte punase. Seepärast on ta siin ühes kohas.
 *
 * RETSEPT:
 *   1. kolmas tehing võtab võistlusaluse rea luku ja HOIAB seda;
 *   2. mõlemad võistlejad käivitatakse ja MÕÕDETAKSE, et nad ootavad;
 *   3. lukk lastakse lahti — Postgres annab ta ootejärjekorra järjekorras,
 *      seega võistlejate järjekord on see, mille meie valisime;
 *   4. mõõdetakse lõppseisu.
 *
 * `Promise.all` üksi tõendaks ainult seda, et kaks asja mahtusid ühte sekundisse.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Hoiab tehingut lahti, kuni `release()` kutsutakse. */
export function holdOpen(prisma, work) {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const done = prisma.$transaction(async (tx) => {
    const value = await work(tx);
    await held;
    return value;
  }, { timeout: 30000 });
  return { release: () => release(), done };
}

/** Käivitab lubaduse ja ütleb igal hetkel, kas ta on juba lõppenud. */
export function watch(promise) {
  const state = { settled: false, value: null, error: null };
  const wrapped = promise.then(
    (value) => { state.settled = true; state.value = value; return state; },
    (error) => { state.settled = true; state.error = error; return state; }
  );
  return { state, wrapped };
}

/**
 * Jooksutab kaks võistlejat valitud lukujärjekorras.
 *
 * `lockRow` peab võtma võistlusaluse rea luku antud tehingus. Ootamise kontroll
 * EI OLE dekoratsioon: kui kumbki võistleja lukku ei taotle, ei ole see test
 * võistlus, vaid kaks järjestikust kutset — ja siis ei tõendaks ta midagi.
 *
 * @returns `{ resultA, resultB }`, kummalgi `{ settled, value, error }`
 */
export async function raceOnLockedRow({ prisma, lockRow, first, second, label, expect }) {
  const holder = holdOpen(prisma, lockRow);
  await sleep(80);

  const a = watch(first());
  await sleep(120);
  const b = watch(second());
  await sleep(120);

  expect(`${label}: esimene võistleja OOTAB rea lukku`, a.state.settled === false);
  expect(`${label}: teine võistleja OOTAB rea lukku`, b.state.settled === false);

  holder.release();
  await holder.done;
  const [resultA, resultB] = await Promise.all([a.wrapped, b.wrapped]);
  return { resultA, resultB };
}

/** Täpselt üks võistleja tohib võita. */
export function expectExactlyOneWinner(expect, label, resultA, resultB) {
  const winners = [resultA, resultB].filter((result) => !result.error).length;
  expect(`${label}: täpselt üks võistleja võidab`, winners === 1, `võitjaid ${winners}`);
}
