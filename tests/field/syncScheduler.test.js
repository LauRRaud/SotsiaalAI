import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  FIELD_ITEM_STATE,
  FIELD_SYNC_BACKOFF_BASE_MS,
  FIELD_SYNC_BACKOFF_MAX_MS,
  FIELD_SYNC_MAX_AUTO_ATTEMPTS
} from "../../lib/field/constants.js";
import {
  applyFieldSyncEvent,
  FieldSyncEvent,
  nextFieldSyncWakeup,
  retryBackoffMs
} from "../../lib/field/syncMachine.js";
import { createFieldSyncScheduler } from "../../lib/field/syncScheduler.js";

/**
 * SOL-FIELD-06 — LUBATUD AUTOMAATNE KORDUS PEAB KA KÄIVITUMA.
 *
 * Backoff oli olemas ainult ARVUTUSENA: `nextAttemptAt` seati, `isUploadDue()`
 * oskas teda lugeda, aga pärast tähtaja saabumist ei küsinud teda mitte keegi.
 * Uus katse tuli ainult mount'il, `online` sündmusel või kasutaja vajutusel.
 *
 * Aeg on siin süstitud: võltskell, võltstaimerid, mitte ühtki päris ootamist.
 */

const T0 = 1_760_000_000_000;

/** Determinstlik kell + taimerijärjekord. Aeg liigub AINULT `advance` peale. */
function fakeClock() {
  let current = T0;
  let sequence = 0;
  const timers = new Map();
  return {
    now: () => current,
    setTimer: (fn, delay) => {
      const id = (sequence += 1);
      timers.set(id, { at: current + Math.max(0, Number(delay) || 0), fn });
      return id;
    },
    clearTimer: (id) => {
      timers.delete(id);
    },
    get pending() {
      return timers.size;
    },
    nextDelay() {
      const next = [...timers.values()].sort((a, b) => a.at - b.at)[0];
      return next ? next.at - current : null;
    },
    /** Liigub ajas edasi ja käivitab kõik tähtajaks küpsed taimerid. */
    async advance(ms) {
      const target = current + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, timer] = due;
        timers.delete(id);
        current = timer.at;
        await timer.fn();
      }
      current = target;
    }
  };
}

const queued = (overrides = {}) => ({
  clientItemId: "fld_one",
  visitId: "visit-1",
  state: FIELD_ITEM_STATE.QUEUED,
  attempts: 0,
  nextAttemptAt: null,
  ...overrides
});

test("varaseim tähtaeg: küps kirje annab kohe, tulevane annab oma aja", () => {
  const now = new Date(T0);
  assert.equal(nextFieldSyncWakeup([queued()], now), T0, "tähtajata QUEUED on kohe küps");

  const future = new Date(T0 + 5000).toISOString();
  assert.equal(nextFieldSyncWakeup([queued({ nextAttemptAt: future })], now), T0 + 5000);

  assert.equal(
    nextFieldSyncWakeup(
      [queued({ clientItemId: "a", nextAttemptAt: new Date(T0 + 9000).toISOString() }), queued({ clientItemId: "b", nextAttemptAt: future })],
      now
    ),
    T0 + 5000,
    "varaseim võidab"
  );
});

test("parkimine: sisselogimist ootav ja mitte-QUEUED kirje ei ärata kedagi", () => {
  const now = new Date(T0);
  assert.equal(nextFieldSyncWakeup([queued({ needsLogin: true })], now), null);
  assert.equal(nextFieldSyncWakeup([queued({ state: FIELD_ITEM_STATE.FAILED })], now), null);
  assert.equal(nextFieldSyncWakeup([queued({ state: FIELD_ITEM_STATE.SYNCED })], now), null);
  assert.equal(nextFieldSyncWakeup([], now), null);
  assert.equal(nextFieldSyncWakeup(null, now), null);
});

/**
 * SEE ON LEID ISE: viis automaatset katset, ilma et keegi midagi vajutaks.
 * Kirje läbib päris olekumasina, seega ka backoff on päris.
 */
test("viis automaatset katset kasvava vahega, ilma ühegi kasutaja tegevuseta", async () => {
  const clock = fakeClock();
  let item = queued();
  const attemptsAt = [];

  const run = async () => {
    if (item.state !== FIELD_ITEM_STATE.QUEUED) return;
    attemptsAt.push(clock.now());
    const started = applyFieldSyncEvent(item, FieldSyncEvent.UPLOAD_STARTED, { now: new Date(clock.now()) });
    item = applyFieldSyncEvent(started, FieldSyncEvent.UPLOAD_RETRYABLE_ERROR, { now: new Date(clock.now()) });
  };

  const scheduler = createFieldSyncScheduler({
    run,
    wakeupAt: () => nextFieldSyncWakeup([item], new Date(clock.now())),
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    now: clock.now
  });

  scheduler.schedule();
  await clock.advance(60 * 60 * 1000);

  assert.equal(attemptsAt.length, FIELD_SYNC_MAX_AUTO_ATTEMPTS, "kõik lubatud katsed peavad ise käivituma");
  assert.equal(item.state, FIELD_ITEM_STATE.FAILED, "ülempiiril peatub ta ausalt FAILED-seisus");

  const gaps = attemptsAt.slice(1).map((at, index) => at - attemptsAt[index]);
  assert.deepEqual(
    gaps,
    [1, 2, 3, 4].map((attempt) => retryBackoffMs(attempt)),
    "vahed peavad järgima lepingu backoffi"
  );
  assert.ok(gaps[0] === FIELD_SYNC_BACKOFF_BASE_MS, "esimene vahe on baas-backoff");
  assert.ok(gaps.at(-1) <= FIELD_SYNC_BACKOFF_MAX_MS, "lagi kehtib");
  assert.equal(scheduler.scheduled, false, "FAILED kirje ei jäta taimerit rippuma");
});

test("edu korral ajastaja peatub — ta ei jää tühja ringi käima", async () => {
  const clock = fakeClock();
  let item = queued({ nextAttemptAt: new Date(T0 + 5000).toISOString() });
  let runs = 0;

  const scheduler = createFieldSyncScheduler({
    run: async () => {
      runs += 1;
      const started = applyFieldSyncEvent(item, FieldSyncEvent.UPLOAD_STARTED, { now: new Date(clock.now()) });
      item = applyFieldSyncEvent(started, FieldSyncEvent.UPLOAD_OK, { now: new Date(clock.now()) });
    },
    wakeupAt: () => nextFieldSyncWakeup([item], new Date(clock.now())),
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    now: clock.now
  });

  scheduler.schedule();
  assert.equal(clock.nextDelay(), 5000, "esimene äratus tuleb tähtaja järgi");
  await clock.advance(60 * 1000);

  assert.equal(runs, 1);
  assert.equal(item.state, FIELD_ITEM_STATE.SYNCED);
  assert.equal(scheduler.scheduled, false);
  assert.equal(clock.pending, 0, "ühtki taimerit ei tohi järele jääda");
});

test("offline: ärkamist ei planeerita, ühenduse taastumine käivitab uuesti", async () => {
  const clock = fakeClock();
  const item = queued();
  let online = false;
  let runs = 0;

  const scheduler = createFieldSyncScheduler({
    run: async () => {
      runs += 1;
    },
    wakeupAt: () => (online ? nextFieldSyncWakeup([item], new Date(clock.now())) : null),
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    now: clock.now
  });

  scheduler.schedule();
  assert.equal(scheduler.scheduled, false, "võrguta ei ole mõtet ärgata");
  await clock.advance(10 * 60 * 1000);
  assert.equal(runs, 0);

  online = true;
  scheduler.schedule();
  assert.equal(scheduler.scheduled, true);
});

/* Möödunud tähtaeg ei tohi anda nulliga silmust: kui käik teda ei lahendanud,
   lükkub järgmine katse põranda võrra edasi. */
test("lahendamata küps kirje ei tekita tihedat silmust", async () => {
  const clock = fakeClock();
  const item = queued();
  let runs = 0;

  const scheduler = createFieldSyncScheduler({
    run: async () => {
      runs += 1;
    },
    wakeupAt: () => nextFieldSyncWakeup([item], new Date(clock.now())),
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    now: clock.now
  });

  scheduler.schedule();
  await clock.advance(60 * 1000);

  assert.ok(runs > 0, "katse peab toimuma");
  assert.ok(
    runs <= Math.ceil(60 * 1000 / FIELD_SYNC_BACKOFF_BASE_MS) + 1,
    `katseid oli ${runs} — põrand ei pidanud`
  );
});

test("korraga on ootel ÜKS äratus, ka korduva plaanimise järel", () => {
  const clock = fakeClock();
  const scheduler = createFieldSyncScheduler({
    run: async () => {},
    wakeupAt: () => clock.now() + 5000,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    now: clock.now
  });

  scheduler.schedule();
  scheduler.schedule();
  scheduler.schedule();
  assert.equal(clock.pending, 1);
});

test("stop koristab taimeri ega lase enam ärgata — see on unmount'i leping", async () => {
  const clock = fakeClock();
  let runs = 0;
  const scheduler = createFieldSyncScheduler({
    run: async () => {
      runs += 1;
    },
    wakeupAt: () => clock.now() + 5000,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    now: clock.now
  });

  scheduler.schedule();
  scheduler.stop();
  assert.equal(clock.pending, 0, "unmount ei tohi taimerit maha jätta");

  await clock.advance(60 * 1000);
  assert.equal(runs, 0);

  scheduler.schedule();
  assert.equal(scheduler.scheduled, false, "peatatud ajastaja ei ärka uuesti ellu");
});

/**
 * Kesta ja mootori side. Ta kukub, kui keegi eemaldab ajastaja või jätab ta
 * unmount'il peatamata — mõlemad taastaksid täpselt selle leiu.
 */
test("hook loob ajastaja, kutsub värsket runSync-i ja peatab ta unmount'il", () => {
  const hook = readFileSync(new URL("../../components/field/useFieldSync.js", import.meta.url), "utf8");

  assert.ok(hook.includes("createFieldSyncScheduler"), "mootoril peab olema ajastaja");
  assert.ok(
    /run: \(\) => runSyncRef\.current\?\.\(\)/.test(hook),
    "ajastaja peab kutsuma VÄRSKET runSync-i, mitte esimese renderduse oma"
  );
  assert.ok(/scheduler\.stop\(\)/.test(hook), "unmount peab taimeri koristama");
  assert.ok(
    /schedulerRef\.current\?\.schedule\(\)/.test(hook),
    "järgmine tähtaeg tuleb arvutada pärast iga katset"
  );
  assert.ok(
    /if \(typeof navigator !== "undefined" && !navigator\.onLine\) return null/.test(hook),
    "võrguta ei planeerita ärkamist"
  );
});
