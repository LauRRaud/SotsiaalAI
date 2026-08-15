import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  acknowledgeFieldWarning,
  applyFieldVisitStatusToPack,
  confirmFieldPurge,
  runFieldLocalRetention
} from "../../lib/field/localRetention.js";
import { FIELD_ITEM_STATE, FIELD_VISIT_STATUS } from "../../lib/field/constants.js";

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

function fakeStore(items = [], packs = []) {
  const rows = new Map(items.map((item) => [item.clientItemId, { ...item }]));
  const packRows = new Map(packs.map((pack) => [String(pack.visitId), { ...pack }]));
  return {
    rows,
    packRows,
    listItems: async () => [...rows.values()].map((row) => ({ ...row })),
    getItem: async (id) => (rows.has(id) ? { ...rows.get(id) } : null),
    putItem: async (item) => { rows.set(item.clientItemId, { ...item }); },
    deleteItem: async (id) => { rows.delete(id); },
    /* Päris hoidla EI anna `listPacks()`-ist krüptitud sisu — ainult metaandmed.
       Fake teeb sama, muidu jääks märkamata, kui otsus hakkaks sõltuma väljast,
       mida säilituskäigul päriselt käes ei ole. */
    listPacks: async () => [...packRows.values()].map(({ payload: _payload, ...meta }) => ({ ...meta })),
    getPack: async (id) => (packRows.has(String(id)) ? { ...packRows.get(String(id)) } : null),
    putPack: async (pack) => { packRows.set(String(pack.visitId), { ...pack }); },
    deletePack: async (id) => { packRows.delete(String(id)); }
  };
}

const pack = (overrides = {}) => ({
  visitId: "vis_1",
  takenAt: T0.toISOString(),
  plannedEndAt: null,
  status: FIELD_VISIT_STATUS.PLANNED,
  payload: { goal: "Kodukülastus", safety: { contactEmail: "x@y.z" } },
  ...overrides
});

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
  assert.deepEqual(outcome, { purged: [], warned: [], awaitingConfirmation: [], packsPurged: [] });
  assert.equal(await acknowledgeFieldWarning({ store: null, clientItemId: "x" }), null);
  assert.equal(await confirmFieldPurge({ store: null, clientItemId: "x" }), null);
  assert.equal(await applyFieldVisitStatusToPack({ store: null, visit: { id: "vis_1" } }), null);
});

/**
 * SOL-FIELD-02 — KÜLASTUSPAKETT EI JÄÄ SEADMESSE IGAVESEKS.
 *
 * `fieldPackPurgeDue()` oli koodis olemas ja õige, aga teda kutsus ainult
 * ühiktest: rakenduse ainus automaatne säilituskäik luges `items`, mitte pakke.
 * Eesmärki, asukohta, ajakava ja OHUTUSINFOT kandev pakett kadus seadmest ainult
 * siis, kui keegi vajutas „Eemalda pakett".
 */

/* SEE ON LEID ISE: käik peab pakid üldse ette võtma. */
test("säilituskäik kustutab paketi 72 h pärast planeeritud akent", async () => {
  const store = fakeStore([], [pack({ plannedEndAt: at(1).toISOString() })]);

  assert.deepEqual((await runFieldLocalRetention({ store, now: at(3, 23) })).packsPurged, []);
  assert.equal(store.packRows.size, 1, "72 h ei ole veel täis — pakett peab alles olema");

  const outcome = await runFieldLocalRetention({ store, now: at(4, 1) });
  assert.deepEqual(outcome.packsPurged, ["vis_1"]);
  assert.equal(store.packRows.size, 0);
});

test("planeeritud aknata pakett kaob 7 päeva pärast seadmesse võtmist", async () => {
  const store = fakeStore([], [pack({ status: FIELD_VISIT_STATUS.DRAFT })]);

  assert.deepEqual((await runFieldLocalRetention({ store, now: at(6) })).packsPurged, []);
  assert.deepEqual((await runFieldLocalRetention({ store, now: at(8) })).packsPurged, ["vis_1"]);
});

/* Vastuvõtukriteeriumi sõna „sõltumata sellest, milline külastus parasjagu
   avatud on": käik ei ole külastuse-põhine ega tohi seda kunagi olla. */
test("käik läbib KÕIK paketid, mitte ainult avatud külastuse oma", async () => {
  const store = fakeStore(
    [],
    [
      pack({ visitId: "vis_vana", plannedEndAt: at(1).toISOString() }),
      pack({ visitId: "vis_lahtine", plannedEndAt: at(9).toISOString() })
    ]
  );

  const outcome = await runFieldLocalRetention({ store, now: at(8) });
  assert.deepEqual(outcome.packsPurged, ["vis_vana"]);
  assert.deepEqual([...store.packRows.keys()], ["vis_lahtine"], "kehtiv pakett peab alles jääma");
});

/* Lepingu ESIMENE tähtaeg. Sulgemist ei saa taustakäik ise teada — ta tuleb
   serveri vastusega ja peab mõjuma KOHE, mitte 72 h pärast. */
test("külastuse sulgemine kustutab paketi kohe, ka kui tähtaeg on kaugel", async () => {
  const store = fakeStore([], [pack({ plannedEndAt: at(30).toISOString() })]);

  assert.deepEqual((await runFieldLocalRetention({ store, now: at(1) })).packsPurged, []);

  const outcome = await applyFieldVisitStatusToPack({
    store,
    visit: { id: "vis_1", status: FIELD_VISIT_STATUS.CLOSED },
    now: at(1)
  });
  assert.deepEqual(outcome, { removed: true, changed: true, status: FIELD_VISIT_STATUS.CLOSED });
  assert.equal(store.packRows.size, 0);
});

test("muutumata külastuse seis ei värskenda Reacti paketi viidet", async () => {
  const store = fakeStore([], [pack({ status: FIELD_VISIT_STATUS.IN_PROGRESS })]);
  const outcome = await applyFieldVisitStatusToPack({
    store,
    visit: { id: "vis_1", status: FIELD_VISIT_STATUS.IN_PROGRESS },
    now: at(1)
  });

  assert.deepEqual(outcome, {
    removed: false,
    changed: false,
    status: FIELD_VISIT_STATUS.IN_PROGRESS
  });

  const hook = readFileSync(new URL("../../components/field/useFieldSync.js", import.meta.url), "utf8");
  assert.match(
    hook,
    /if \(outcome\.removed\) setPack\(null\);\s*else if \(outcome\.changed\) setPack\(await store\.getPack\(visitId\)\);/,
    "muutumata paketi uus dekrüptitud objekt ei tohi käivitada uut detailipäringut"
  );
});

test("tühistatud külastus on sama piir — ja pooleliolev EI OLE", async () => {
  const store = fakeStore([], [pack({ visitId: "vis_1", plannedEndAt: at(30).toISOString() })]);
  await applyFieldVisitStatusToPack({
    store,
    visit: { id: "vis_1", status: FIELD_VISIT_STATUS.IN_PROGRESS },
    now: at(1)
  });
  assert.equal(store.packRows.size, 1, "pooleliolev külastus vajab oma paketti");
  assert.equal(
    store.packRows.get("vis_1").status,
    FIELD_VISIT_STATUS.IN_PROGRESS,
    "olek peab kirjele jõudma, muidu ei näe taustakäik hiljem sulgemist"
  );

  await applyFieldVisitStatusToPack({
    store,
    visit: { id: "vis_1", status: FIELD_VISIT_STATUS.CANCELLED },
    now: at(1)
  });
  assert.equal(store.packRows.size, 0);
});

/* „Hiljemalt" on ülempiir: lõpetamata jäänud külastus on just see, mis paketi
   muidu igaveseks alles jätaks. */
test("lõpetamata külastus ei hoia paketti 72 h piirist kauem", async () => {
  const store = fakeStore(
    [],
    [pack({ status: FIELD_VISIT_STATUS.WRAP_UP, plannedEndAt: at(1).toISOString() })]
  );
  assert.deepEqual((await runFieldLocalRetention({ store, now: at(10) })).packsPurged, ["vis_1"]);
});

/* Käsitsi eemaldamine + kehtiva paketi säilimine ühes mõõtmises. */
test("kehtivat paketti käik ei puutu, käsitsi eemaldamine võtab ta kohe", async () => {
  const store = fakeStore([], [pack({ plannedEndAt: at(5).toISOString() })]);
  await runFieldLocalRetention({ store, now: at(2) });
  assert.equal(store.packRows.size, 1);

  await store.deletePack("vis_1");
  assert.equal(store.packRows.size, 0);
  assert.deepEqual((await runFieldLocalRetention({ store, now: at(2) })).packsPurged, []);
});

/**
 * NEGATIIVKONTROLL, mis mõõdab just SEDA leidu: hoidla ilma pakioperatsioonideta
 * on täpselt vana käigu kuju. Kui käik neid ei nõuaks, jääks test roheliseks ka
 * siis, kui pakisilmus üldse puudub.
 */
test("pakioperatsioonideta hoidla = vana käitumine: pakett jääb igaveseks alles", async () => {
  const full = fakeStore([], [pack({ plannedEndAt: at(1).toISOString() })]);
  const { listPacks: _listPacks, deletePack: _deletePack, ...withoutPackOps } = full;

  const outcome = await runFieldLocalRetention({ store: withoutPackOps, now: at(400) });
  assert.deepEqual(outcome.packsPurged, []);
  assert.equal(full.packRows.size, 1, "vana kuju ei kustuta paketti kunagi — see oligi leid");
});

/* Pakisilmus ei tohi saatmata sisu puudutada: need on kaks eri lepingut. */
test("pakikäik ei kustuta saatmata üksusi", async () => {
  const store = fakeStore([unsent()], [pack({ plannedEndAt: at(1).toISOString() })]);
  const outcome = await runFieldLocalRetention({ store, now: at(40) });
  assert.deepEqual(outcome.packsPurged, ["vis_1"]);
  assert.deepEqual(outcome.purged, []);
  assert.equal(store.rows.size, 1);
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

/**
 * SOL-FIELD-02 sama piir: poliitika on ülal päris koodirajal mõõdetud, aga
 * SULGEMISE tähtaeg jõuab kohale ainult siis, kui kest värske külastuse seisu
 * paketile edasi annab. Seda sidet ei saa siin renderdada — hoiab staatiline
 * leping, mis kukub, kui keegi kutse eemaldab.
 */
test("kest annab külastuse seisu paketile edasi ja võtab kella otsast ainult võtmisel", () => {
  const room = readFileSync(new URL("../../components/field/FieldVisitRoom.jsx", import.meta.url), "utf8");
  assert.ok(
    /await applyVisitStatus\(body\?\.visit\)/.test(room),
    "värske külastuse vastus peab paketile mõjuma — muidu jääb sulgemine seadmes nägemata"
  );
  assert.ok(
    /storePack\(updated,\s*\{\s*retake:\s*true\s*\}\)/.test(room),
    "teadlik seadmesse võtmine peab kella otsast alustama"
  );
  /* Ja ta on AINUS selline koht: markerite kirjutused ei tohi tähtaega edasi
     lükata, muidu ei jõua 7 päeva kunagi kohale. */
  assert.equal(
    (room.match(/retake:\s*true/g) || []).length,
    1,
    "säilituskella tohib otsast alustada täpselt üks rada"
  );

  const hook = readFileSync(new URL("../../components/field/useFieldSync.js", import.meta.url), "utf8");
  assert.ok(hook.includes("applyFieldVisitStatusToPack"), "hook peab kasutama jagatud olekuraja poliitikat");
  assert.ok(
    /takenAt:\s*!retake\s*&&\s*existing\?\.takenAt/.test(hook),
    "olemasolev `takenAt` peab üle elama iga kirjutuse, mis ei ole teadlik uuesti võtmine"
  );
  assert.ok(
    /status:\s*visit\.status\s*\|\|\s*existing\?\.status/.test(hook),
    "olek peab elama paketi PEALMISEL kirjel, sest säilituskäik loeb ainult metaandmeid"
  );
});
