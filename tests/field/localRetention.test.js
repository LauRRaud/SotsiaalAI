import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  acknowledgeFieldWarning,
  confirmFieldPurge,
  runFieldLocalRetention
} from "../../lib/field/localRetention.js";
import { FIELD_ITEM_STATE } from "../../lib/field/constants.js";

/**
 * SOL-FIELD-01 — SAATMATA SISU EI KAO VAIKSELT.
 *
 * Leping: 30. päeval püsiv hoiatus, kustutamine alles 37. päeval pärast KOLME
 * selget hoiatust. Vana kood täitis loendurit TAUSTAKÄIGUGA, mida keegi ei
 * kuvanud — „kolm hoiatust" tähendas päriselt „rakendus avati kolmel eri
 * päeval". Olemasolev ühiktest sisestas `warnCount: 3` käsitsi ja kontrollis
 * ainult puhast otsust, seega ta ei näinud sellest midagi.
 *
 * Need testid jooksutavad PÄRIS säilituskäiku päris otsustega, ainult ajaga
 * mängides. Fake-hoidla on IndexedDB asemel — kontrollitav on poliitika, mitte
 * brauseri salvestuskiht.
 */

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-01-01T09:00:00.000Z");
const at = (days, hours = 0) => new Date(T0.getTime() + days * DAY + hours * 3600 * 1000);

function fakeStore(items = []) {
  const rows = new Map(items.map((item) => [item.clientItemId, { ...item }]));
  return {
    rows,
    listItems: async () => [...rows.values()].map((row) => ({ ...row })),
    getItem: async (id) => (rows.has(id) ? { ...rows.get(id) } : null),
    putItem: async (item) => { rows.set(item.clientItemId, { ...item }); },
    deleteItem: async (id) => { rows.delete(id); }
  };
}

const unsent = (overrides = {}) => ({
  clientItemId: "fld_unsent",
  state: FIELD_ITEM_STATE.DEVICE_ONLY,
  createdAt: T0.toISOString(),
  payload: { body: "Saatmata märge" },
  ...overrides
});

/** SEE ON LEID ISE: pelk rakenduse avamine ei tohi sisu kustutada. */
test("kolm taustakäiku EI kustuta saatmata sisu, ka mitte 40. päeval", async () => {
  const store = fakeStore([unsent()]);
  for (const day of [30, 31, 32, 33, 38, 39, 40]) {
    const outcome = await runFieldLocalRetention({ store, now: at(day) });
    assert.deepEqual(outcome.purged, [], `päev ${day}: sisu kustus taustal`);
  }
  assert.equal(store.rows.size, 1, "kirje peab alles olema");
  assert.equal(store.rows.get("fld_unsent").warnCount, undefined, "taustakäik ei tohi loendurit kasvatada");
});

test("taustakäik NIMETAB, keda hoiatada — alates 30. päevast", async () => {
  const store = fakeStore([unsent()]);
  assert.deepEqual((await runFieldLocalRetention({ store, now: at(29) })).warned, []);
  const warned = (await runFieldLocalRetention({ store, now: at(30) })).warned;
  assert.equal(warned.length, 1);
  assert.equal(warned[0].clientItemId, "fld_unsent");
});

test("hoiatuse loeb kinnitus, mitte käik — ja kaks kinnitust ei mahu ühte päeva", async () => {
  const store = fakeStore([unsent()]);
  await acknowledgeFieldWarning({ store, clientItemId: "fld_unsent", now: at(30) });
  assert.equal(store.rows.get("fld_unsent").warnCount, 1);

  /* Sama päev, teine vajutus: leping ütleb hoiatus PÄEVAS, mitte vajutuses. */
  await acknowledgeFieldWarning({ store, clientItemId: "fld_unsent", now: at(30, 1) });
  assert.equal(store.rows.get("fld_unsent").warnCount, 1, "kaks vajutust ühel päeval ei ole kaks hoiatust");

  await acknowledgeFieldWarning({ store, clientItemId: "fld_unsent", now: at(31) });
  await acknowledgeFieldWarning({ store, clientItemId: "fld_unsent", now: at(32) });
  assert.equal(store.rows.get("fld_unsent").warnCount, 3);

  /* Kolm on lepingu arv — neljandat ei koguta. */
  await acknowledgeFieldWarning({ store, clientItemId: "fld_unsent", now: at(33) });
  assert.equal(store.rows.get("fld_unsent").warnCount, 3);
});

test("kolm kinnitatud hoiatust EI OLE veel kustutusluba", async () => {
  const store = fakeStore([unsent()]);
  for (const day of [30, 31, 32]) {
    await acknowledgeFieldWarning({ store, clientItemId: "fld_unsent", now: at(day) });
  }
  const outcome = await runFieldLocalRetention({ store, now: at(38) });
  assert.deepEqual(outcome.purged, [], "ilma kinnituseta ei tohi kustutada");
  assert.equal(outcome.awaitingConfirmation.length, 1, "kirje peab ootama viimast luba");
  assert.equal(store.rows.size, 1);
});

test("viimane kinnitus lubab kustutada — ja alles siis kaob sisu", async () => {
  const store = fakeStore([unsent()]);
  for (const day of [30, 31, 32]) {
    await acknowledgeFieldWarning({ store, clientItemId: "fld_unsent", now: at(day) });
  }
  await confirmFieldPurge({ store, clientItemId: "fld_unsent", now: at(38) });
  const outcome = await runFieldLocalRetention({ store, now: at(38, 1) });
  assert.deepEqual(outcome.purged, ["fld_unsent"]);
  assert.equal(store.rows.size, 0);
});

/* Kinnitus ENNE kolme hoiatust ei tohi midagi teha — muidu oleks „kolm
   hoiatust" ainult soovitus. */
test("kustutusluba enne kolme hoiatust ei kehti", async () => {
  const store = fakeStore([unsent()]);
  await acknowledgeFieldWarning({ store, clientItemId: "fld_unsent", now: at(30) });
  await confirmFieldPurge({ store, clientItemId: "fld_unsent", now: at(38) });
  assert.equal(store.rows.get("fld_unsent").purgeConfirmedAt, undefined);
  const outcome = await runFieldLocalRetention({ store, now: at(39) });
  assert.deepEqual(outcome.purged, []);
});

/* Kustutusluba enne 37. päeva ei kehti ka siis, kui hoiatused on olemas:
   luba käib SELLE kustutuse kohta, mitte igavesti ette. */
test("kustutusluba enne 37. päeva ei kehti", async () => {
  const store = fakeStore([unsent()]);
  for (const day of [30, 31, 32]) {
    await acknowledgeFieldWarning({ store, clientItemId: "fld_unsent", now: at(day) });
  }
  await confirmFieldPurge({ store, clientItemId: "fld_unsent", now: at(35) });
  assert.equal(store.rows.get("fld_unsent").purgeConfirmedAt, undefined);
});

/* NEGATIIVKONTROLL: sünkroonitud koopia kaob taustal ja PEABKI kaduma —
   parandus ei tohi kogu säilitust seisma panna. */
test("sünkroonitud koopia kaob taustal 7 päeva pärast, ilma hoiatuseta", async () => {
  const store = fakeStore([
    {
      clientItemId: "fld_synced",
      state: FIELD_ITEM_STATE.SYNCED,
      createdAt: T0.toISOString(),
      syncedAt: T0.toISOString()
    }
  ]);
  assert.deepEqual((await runFieldLocalRetention({ store, now: at(6) })).purged, []);
  assert.deepEqual((await runFieldLocalRetention({ store, now: at(8) })).purged, ["fld_synced"]);
});

test("hoidlata käik ei kuku ega tee midagi", async () => {
  const outcome = await runFieldLocalRetention({ store: null, now: at(40) });
  assert.deepEqual(outcome, { purged: [], warned: [], awaitingConfirmation: [] });
  assert.equal(await acknowledgeFieldWarning({ store: null, clientItemId: "x" }), null);
  assert.equal(await confirmFieldPurge({ store: null, clientItemId: "x" }), null);
});

/**
 * SOL-FIELD-01 lõppnõue: hoiatus peab olema KASUTAJALE NÄHTAV.
 *
 * Poliitika on nüüd testitav ilma Reactita, aga just see teeb võimalikuks vea,
 * mis leidu üldse tekitas: loogika töötab ja liides ei kuva teda. Seda ei saa
 * selles projektis ühiktestiga renderdada (testisviit on `node:test` ilma
 * DOM-ita), seega hoiab siin kesta ja hoogi SIDET staatiline leping — ta kukub,
 * kui keegi bänneri või tegevuse eemaldab.
 */
test("kest kuvab mõlemad hoiatusloendid ja pakub mõlemat tegevust", () => {
  const shell = readFileSync(new URL("../../components/field/FieldShell.jsx", import.meta.url), "utf8");
  for (const needle of [
    "sync.retentionWarnings",
    "sync.retentionAwaitingConfirmation",
    "sync.acknowledgeWarning",
    "sync.confirmPurge",
    "field.retention.warnTitle",
    "field.retention.confirmTitle"
  ]) {
    assert.ok(shell.includes(needle), `FieldShell peab kandma: ${needle}`);
  }

  const hook = readFileSync(new URL("../../components/field/useFieldSync.js", import.meta.url), "utf8");
  assert.ok(hook.includes("runFieldLocalRetention"), "hook peab kasutama jagatud säilituskäiku");
  assert.equal(
    /warnCount:\s*Number\(item\.warnCount\s*\|\|\s*0\)\s*\+\s*1/.test(hook),
    false,
    "taustakäik ei tohi enam ise hoiatuste loendurit kasvatada"
  );

  for (const locale of ["et", "en", "ru"]) {
    const messages = JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"));
    for (const key of ["warnTitle", "warnBody", "warnCount", "acknowledge", "confirmTitle", "confirmBody", "confirmDelete"]) {
      assert.equal(typeof messages.field?.retention?.[key], "string", `${locale}: field.retention.${key}`);
    }
  }
});
