#!/usr/bin/env node
/**
 * SOL-FIELD-02 — külastuspakett ei jää seadmesse igaveseks.
 *
 *   npm run field:pack:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Ühiktestide fake-hoidla on minu enda
 * kirjutatud ja ta võib eksida täpselt seal, kus otsus seda kõige rohkem usub:
 * `listPacks()` annab PÄRIS hoidlas ainult metaandmed, sest sisu on AES-GCM-iga
 * krüptitud. Kui säilitusotsus vajaks välja, mis elab krüptitud sisu sees, oleks
 * fake roheline ja päris seade katki. Seepärast käib see sond päris Chromiumi
 * päris IndexedDB ja päris WebCrypto vastu — `lib/field/localStore.js` ise.
 *
 * Serverit ega sisselogimist EI ole vaja: moodulid serveeritakse otse repost
 * (`page.route`) ühele https-päritolule, sest IndexedDB ja `crypto.subtle`
 * nõuavad turvalist konteksti. Aeg ei jookse — säilituskäik võtab `now` alati
 * parameetrina, seega mõõdame otsust, mitte kannatust.
 *
 * Andmed: sünteetilised, elavad brauseri ajutises profiilis ja kaovad koos temaga.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://field-pack-probe.test";

/* Ainult need failid: sond ei tohi vaikselt kogu repot brauserisse serveerida. */
const SERVED = new Set([
  "/lib/field/localStore.js",
  "/lib/field/localRetention.js",
  "/lib/field/visitMarkers.js",
  "/lib/field/syncMachine.js",
  "/lib/field/constants.js",
  "/lib/workspaces/provenance.js"
]);

/**
 * Nimeruumi-import, MITTE nimeline. Nimeline import kukuks tervikuna, kui mõni
 * funktsioon puudub — ja siis annaks sond vana koodi vastu ühe krahhi, mitte
 * loetava punaste rea. Just see loeb: sond peab ütlema, MIS täpselt puudu oli.
 */
const SHELL = `<!doctype html><meta charset="utf-8"><title>field pack probe</title>
<script type="module">
  import { openFieldStore } from "/lib/field/localStore.js";
  import * as retention from "/lib/field/localRetention.js";
  import * as markers from "/lib/field/visitMarkers.js";
  window.__field = { openFieldStore, retention, markers };
  window.__fieldReady = true;
</script>`;

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      return route.fulfill({ contentType: "text/html; charset=utf-8", body: SHELL });
    }
    if (!SERVED.has(pathname)) return route.fulfill({ status: 404, body: "not served" });
    const body = await readFile(path.join(repoRoot, pathname), "utf8");
    return route.fulfill({ contentType: "text/javascript; charset=utf-8", body });
  });

  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => window.__fieldReady === true, null, { timeout: 15000 });

  const results = await page.evaluate(async () => {
    const { openFieldStore, retention, markers } = window.__field;
    const out = [];
    const check = (label, cond, detail = "") => out.push({ label, pass: Boolean(cond), detail });

    const missing = (name) => async () => {
      throw new Error(`${name} puudub selles koodiversioonis`);
    };
    const runFieldLocalRetention = retention.runFieldLocalRetention || missing("runFieldLocalRetention");
    const applyFieldVisitStatusToPack =
      retention.applyFieldVisitStatusToPack || missing("applyFieldVisitStatusToPack");

    /* Iga plokk on oma tõend. Ilma piirdeta tapaks esimene viga kogu jooksu ja
       vana koodi vastu mõõtmine annaks ühe krahhi, mitte loetava punaste rea. */
    const block = async (name, fn) => {
      try {
        await fn();
      } catch (error) {
        check(`${name}: plokk kukkus`, false, String(error?.message || error));
      }
    };

    const DAY = 24 * 60 * 60 * 1000;
    const T0 = new Date("2026-03-01T09:00:00.000Z");
    const at = (days, hours = 0) => new Date(T0.getTime() + days * DAY + hours * 3600 * 1000);

    let seq = 0;
    const fresh = () => openFieldStore(`sol-field-02-probe-${(seq += 1)}`);
    const pack = (overrides) => ({
      visitId: "vis_1",
      takenAt: T0.toISOString(),
      plannedEndAt: null,
      status: "PLANNED",
      payload: { goal: "Kodukülastus", locationText: "Tabasalu", safety: { contactEmail: "a@b.test" } },
      ...overrides
    });

    /* 1. SEE ON PÕHJUS, MIKS SOND ON BRAUSERIS. Otsus loeb `status`-t ja
       `listPacks()` annab päris hoidlas ainult metaandmed — sisu on krüptitud. */
    await block("1 hoidla kuju", async () => {
      const store = await fresh();
      await store.putPack(pack({ plannedEndAt: at(1).toISOString() }));
      const listed = await store.listPacks();
      check("listPacks annab täpselt ühe kirje", listed.length === 1);
      check("listPacks EI anna krüptitud sisu", listed[0] && !("payload" in listed[0]));
      check("olek on metaandmetes, mitte krüptitud sisus", listed[0]?.status === "PLANNED");
      check("säilituskell on metaandmetes", listed[0]?.takenAt === T0.toISOString());
      const full = await store.getPack("vis_1");
      check("sisu ise on lahtikrüptitav", full?.payload?.locationText === "Tabasalu");
      store.close();
    });

    /* 2. 72 h pärast planeeritud akent. */
    await block("2 72 h akna järel", async () => {
      const store = await fresh();
      await store.putPack(pack({ plannedEndAt: at(1).toISOString() }));
      const before = await runFieldLocalRetention({ store, now: at(3, 23) });
      check("enne 72 h pakett jääb", before.packsPurged.length === 0);
      check("enne 72 h ta on ka päriselt hoidlas", (await store.getPack("vis_1")) !== null);
      const after = await runFieldLocalRetention({ store, now: at(4, 1) });
      check("pärast 72 h käik kustutab", after.packsPurged.length === 1 && after.packsPurged[0] === "vis_1");
      check("pärast 72 h teda EI OLE IndexedDB-s", (await store.getPack("vis_1")) === null);
      check("ka nimekiri on tühi", (await store.listPacks()).length === 0);
      store.close();
    });

    /* 3. Planeeritud aknata pakett (DRAFT): 7 päeva loomisest. */
    await block("3 seitse päeva mustandile", async () => {
      const store = await fresh();
      await store.putPack(pack({ status: "DRAFT" }));
      check("6. päeval jääb", (await runFieldLocalRetention({ store, now: at(6) })).packsPurged.length === 0);
      check("8. päeval kaob", (await runFieldLocalRetention({ store, now: at(8) })).packsPurged[0] === "vis_1");
      store.close();
    });

    /* 4. Käik ei ole külastuse-põhine: aegunu kaob, kehtiv jääb. */
    await block("4 kõik paketid", async () => {
      const store = await fresh();
      await store.putPack(pack({ visitId: "vis_vana", plannedEndAt: at(1).toISOString() }));
      await store.putPack(pack({ visitId: "vis_lahtine", plannedEndAt: at(9).toISOString() }));
      const outcome = await runFieldLocalRetention({ store, now: at(8) });
      check("aegunud pakett kaob", outcome.packsPurged.join(",") === "vis_vana");
      const left = (await store.listPacks()).map((row) => row.visitId);
      check("kehtiv pakett jääb puutumata", left.join(",") === "vis_lahtine");
      store.close();
    });

    /* 5. Külastuse sulgemine — lepingu ESIMENE tähtaeg, kohe. */
    await block("5 sulgemine", async () => {
      const store = await fresh();
      await store.putPack(pack({ plannedEndAt: at(30).toISOString() }));
      check(
        "kaugesse tulevikku planeeritud külastuse pakett ei aegu ajaga",
        (await runFieldLocalRetention({ store, now: at(1) })).packsPurged.length === 0
      );
      const outcome = await applyFieldVisitStatusToPack({
        store,
        visit: { id: "vis_1", status: "CLOSED" },
        now: at(1)
      });
      check("sulgemine kustutab kohe", outcome?.removed === true);
      check("sulgemise järel pole teda hoidlas", (await store.getPack("vis_1")) === null);
      store.close();
    });

    /* 6. Pooleliolev külastus hoiab paketti, aga olek jõuab kirjele — ilma
       selleta ei näeks hilisem taustakäik sulgemist üldse. */
    await block("6 pooleliolev", async () => {
      const store = await fresh();
      await store.putPack(pack({ plannedEndAt: at(30).toISOString() }));
      await applyFieldVisitStatusToPack({ store, visit: { id: "vis_1", status: "IN_PROGRESS" }, now: at(1) });
      const listed = await store.listPacks();
      check("pooleliolev külastus hoiab oma paketti", listed.length === 1);
      check("uus olek on kirjel", listed[0]?.status === "IN_PROGRESS");
      check("sisu elas ülekirjutuse üle", (await store.getPack("vis_1"))?.payload?.goal === "Kodukülastus");
      store.close();
    });

    /* 7. Käsitsi eemaldamine („Eemalda pakett") võtab kehtivagi paketi. */
    await block("7 käsitsi", async () => {
      const store = await fresh();
      await store.putPack(pack({ plannedEndAt: at(5).toISOString() }));
      await runFieldLocalRetention({ store, now: at(2) });
      check("käik ei puutu kehtivat paketti", (await store.getPack("vis_1")) !== null);
      await store.deletePack("vis_1");
      check("käsitsi eemaldamine võtab ta kohe", (await store.getPack("vis_1")) === null);
      store.close();
    });

    /* 8. Kaks eri lepingut: pakisilmus ei tohi saatmata sisu puudutada. */
    await block("8 saatmata sisu", async () => {
      const store = await fresh();
      await store.putItem({
        clientItemId: "fld_unsent",
        visitId: "vis_1",
        itemType: "note",
        state: "DEVICE_ONLY",
        createdAt: T0.toISOString(),
        payload: { body: "Saatmata märge" }
      });
      await store.putPack(pack({ plannedEndAt: at(1).toISOString() }));
      const outcome = await runFieldLocalRetention({ store, now: at(40) });
      check("pakett kaob", outcome.packsPurged.join(",") === "vis_1");
      check("saatmata märge EI kao", outcome.purged.length === 0);
      const item = await store.getItem("fld_unsent");
      check("saatmata märge on endiselt loetav", item?.payload?.body === "Saatmata märge");
      check("ja tema hoiatuste loendurit ei liigutatud", !item?.warnCount);
      store.close();
    });

    /* 9. SOL-FIELD-04: marker peab elama üle rakenduse SULGEMISE. Just seda ei
       saa fake-hoidlaga tõendada — päris IndexedDB avatakse siin uuesti. */
    await block("9 marker elab üle taasavamise", async () => {
      const applyLocalMarker = markers.applyLocalMarker || missing("applyLocalMarker");
      const readPackMarkers = markers.readPackMarkers || missing("readPackMarkers");
      const userId = `sol-field-04-probe-${(seq += 1)}`;

      const first = await openFieldStore(userId);
      await first.putPack(pack({ status: "IN_PROGRESS" }));
      const taken = await first.getPack("vis_1");
      await first.putPack({ ...taken, payload: applyLocalMarker(taken.payload, "arrival", T0) });
      first.close();

      /* Rakendus suletakse ja avatakse uuesti — sama partitsioon, uus ühendus. */
      const second = await openFieldStore(userId);
      const reopened = await second.getPack("vis_1");
      const after = readPackMarkers(reopened?.payload);
      check("marker on pärast taasavamist alles", after.arrival?.at === T0.toISOString());
      check("marker on PENDING", after.arrival?.state === "PENDING");
      check("ja paketi sisu on ka alles", reopened?.payload?.locationText === "Tabasalu");
      second.close();
    });

    /* 10. Flush päris hoidla vastu: 500 jätab alles, 200 võtab ära. */
    await block("10 flush päris hoidlaga", async () => {
      const applyLocalMarker = markers.applyLocalMarker || missing("applyLocalMarker");
      const readPackMarkers = markers.readPackMarkers || missing("readPackMarkers");
      const flushVisitMarkers = markers.flushVisitMarkers || missing("flushVisitMarkers");
      const store = await fresh();
      await store.putPack(pack({ status: "IN_PROGRESS" }));
      const taken = await store.getPack("vis_1");
      await store.putPack({ ...taken, payload: applyLocalMarker(taken.payload, "arrival", T0) });

      const scripted = (statuses) => {
        const queue = [...statuses];
        return async () => {
          const next = queue.shift();
          return { status: next.status, json: async () => next.body ?? {} };
        };
      };

      const failing = await flushVisitMarkers({
        store,
        visitId: "vis_1",
        fetchImpl: scripted([
          { status: 200, body: { visit: { id: "vis_1", version: 3, arrivedConfirmedAt: null } } },
          { status: 500, body: {} }
        ]),
        now: at(0, 1)
      });
      check("serveri viga jätab markeri alles", failing.kept.join(",") === "arrival");
      const kept = readPackMarkers((await store.getPack("vis_1")).payload).arrival;
      check("ja ta on päris IndexedDB-s FAILED-seisus", kept?.state === "FAILED" && kept?.reason === "server");
      check("aeg ei muutunud", kept?.at === T0.toISOString());

      const okRun = await flushVisitMarkers({
        store,
        visitId: "vis_1",
        fetchImpl: scripted([
          { status: 200, body: { visit: { id: "vis_1", version: 3, arrivedConfirmedAt: null } } },
          { status: 200, body: { visit: { id: "vis_1", version: 4 } } }
        ]),
        now: at(0, 2)
      });
      check("2xx võtab markeri ära", okRun.confirmed.join(",") === "arrival");
      check("ja teda ei ole enam hoidlas", !readPackMarkers((await store.getPack("vis_1")).payload).arrival);
      check("pakett ise on endiselt terve", (await store.getPack("vis_1"))?.payload?.goal === "Kodukülastus");
      store.close();
    });

    return out;
  });

  await browser.close();
  return results;
}

let results = [];
let crashed = null;
try {
  results = await main();
} catch (error) {
  crashed = error;
}

for (const row of results) {
  console.log(`  ${row.pass ? "PASS" : "FAIL"}  ${row.label}${row.detail ? ` — ${row.detail}` : ""}`);
}
const failed = results.filter((row) => !row.pass).length;
if (crashed) {
  console.error("\nUNCAUGHT", crashed);
}
console.log(`\n${results.length - failed} passed, ${failed + (crashed ? 1 : 0)} failed`);
process.exit(failed || crashed ? 1 : 0);
