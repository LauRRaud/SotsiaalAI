import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createRoomMessageSession } from "../../lib/rooms/roomMessageSession.js";

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

const ORIGIN = "https://probe.invalid";

/** Laseb kõik ootel mikrotaskid ja lubadused läbi. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

function messagesResponse({ roomTitle, messages = [], status = 200 }) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => ({
      ok: status === 200,
      roomTitle,
      roomRole: "MEMBER",
      messages,
      nextCursor: null
    })
  };
}

/** Võltsvõrk, kus IGA laadimispäringu lahendamise hetke otsustab test. */
function makeNet() {
  const pending = [];
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const href = String(url);
    calls.push(href);
    if (href.includes("/read")) return { status: 200, ok: true, json: async () => ({ ok: true }) };
    const gate = deferred();
    const entry = { href, gate, signal: init.signal };
    pending.push(entry);
    if (init.signal) {
      init.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        gate.resolve(Promise.reject(error));
      }, { once: true });
    }
    return gate.promise;
  };
  return {
    fetchImpl,
    calls,
    pending,
    resolveFor(match, response) {
      const entry = pending.find((row) => row.href.includes(match) && !row.done);
      assert.ok(entry, `päringut ${match} ei ole ootel`);
      entry.done = true;
      entry.gate.resolve(response);
      return entry;
    }
  };
}

class FakeEventSource {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.closed = false;
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

function makeTimers() {
  const intervals = new Map();
  const timeouts = new Map();
  let id = 1;
  return {
    api: {
      setInterval: (fn, ms) => { const key = id++; intervals.set(key, { fn, ms }); return key; },
      clearInterval: (key) => intervals.delete(key),
      setTimeout: (fn, ms) => { const key = id++; timeouts.set(key, { fn, ms }); return key; },
      clearTimeout: (key) => timeouts.delete(key)
    },
    intervals,
    timeouts,
    runTimeout(key) {
      const entry = timeouts.get(key);
      timeouts.delete(key);
      entry?.fn();
    }
  };
}

function start(roomId, net, timers, { EventSourceImpl = FakeEventSource } = {}) {
  const states = [];
  const session = createRoomMessageSession({
    roomId,
    pollMs: 3000,
    origin: ORIGIN,
    fetchImpl: net.fetchImpl,
    EventSourceImpl,
    timers: timers.api,
    onChange: (state) => states.push(state)
  });
  session.start();
  return { session, states, last: () => states[states.length - 1] };
}

// --- SOL-ROOM-02 ----------------------------------------------------------

test("vana ruumi hiline vastus ei jõua uude vaatesse", async () => {
  const net = makeNet();
  const timers = makeTimers();
  FakeEventSource.instances = [];

  // Kasutaja avab ruumi A…
  const a = start("room-A", net, timers);
  // …ja vahetab enne vastuse saabumist ruumi B peale.
  a.session.close();
  const b = start("room-B", net, timers);

  // B vastus saabub esimesena, A oma viimasena — täpselt see järjekord, mida kriteerium nõuab.
  net.resolveFor("room-B", messagesResponse({
    roomTitle: "Ruum B",
    messages: [{ id: "b1", content: "B sõnum", createdAt: "2026-08-11T10:00:00Z" }]
  }));
  await flush();

  net.resolveFor("room-A", messagesResponse({
    roomTitle: "Ruum A",
    messages: [{ id: "a1", content: "A sõnum", createdAt: "2026-08-11T09:00:00Z" }]
  }));
  await flush();

  const state = b.last();
  assert.equal(state.meta.roomTitle, "Ruum B");
  assert.deepEqual(state.messages.map((m) => m.id), ["b1"], "A ajalugu jõudis B vaatesse");
});

test("sulgemine katkestab poolelioleva päringu", async () => {
  const net = makeNet();
  const timers = makeTimers();
  FakeEventSource.instances = [];

  const a = start("room-A", net, timers);
  const entry = net.pending.find((row) => row.href.includes("room-A"));
  assert.ok(entry.signal, "päring peab kandma abort-signaali");
  assert.equal(entry.signal.aborted, false);

  a.session.close();
  assert.equal(entry.signal.aborted, true, "cleanup peab päringu abortima, mitte ainult unustama");
  assert.equal(FakeEventSource.instances.at(-1).closed, true, "voog peab sulguma koos seansiga");
  assert.equal(timers.intervals.size, 0, "taimer ei tohi seansi järel edasi käia");
});

test("abort ei paista tõrkena ega jäta seisu poolikuks", async () => {
  const net = makeNet();
  const timers = makeTimers();
  FakeEventSource.instances = [];

  const a = start("room-A", net, timers);
  a.session.close();
  net.resolveFor("room-A", messagesResponse({ roomTitle: "Ruum A" }));
  await flush();

  // Ainus lubatud tulemus: suletud seanss ei kirjuta midagi.
  assert.equal(a.states.length, 0);
});

// --- SOL-ROOM-03 ----------------------------------------------------------

test("avatud SSE ei lammuta ennast — üks ühendus, mitte kaks", async () => {
  const net = makeNet();
  const timers = makeTimers();
  FakeEventSource.instances = [];

  const a = start("room-A", net, timers);
  assert.equal(FakeEventSource.instances.length, 1, "avamisel tehakse täpselt üks ühendus");
  assert.equal(timers.intervals.size, 1, "pollimine käib kuni voog avaneb");

  FakeEventSource.instances[0].onopen();
  assert.equal(a.last().useSse, true);
  assert.equal(timers.intervals.size, 0, "avatud voo ajal ei pollita");
  assert.equal(FakeEventSource.instances.length, 1, "olekumuutus EI tohi teha uut ühendust");
  assert.equal(FakeEventSource.instances[0].closed, false, "just avatud ühendust ei tohi sulgeda");
});

test("katkenud voog taastub backoff'iga ja pollimine tuleb vahepeal tagasi", () => {
  const net = makeNet();
  const timers = makeTimers();
  FakeEventSource.instances = [];

  const a = start("room-A", net, timers);
  FakeEventSource.instances[0].onopen();
  FakeEventSource.instances[0].onerror();

  assert.equal(a.last().useSse, false);
  assert.equal(timers.intervals.size, 1, "voo kadu paneb pollimise tagasi");
  assert.equal(timers.timeouts.size, 1, "taasühendus on ajastatud");

  const [key, entry] = [...timers.timeouts.entries()][0];
  assert.equal(entry.ms, 2000);
  timers.runTimeout(key);
  assert.equal(FakeEventSource.instances.length, 2, "taasühendus loob uue voo");
});

test("401 ja 403 on TERMINAALSED: ei pollita ega ühendata uuesti", async () => {
  for (const [status, flag] of [[401, "authRequired"], [403, "blocked"]]) {
    const net = makeNet();
    const timers = makeTimers();
    FakeEventSource.instances = [];

    const a = start("room-A", net, timers);
    net.resolveFor("room-A", messagesResponse({ roomTitle: "Ruum A", status }));
    await flush();

    assert.equal(a.last()[flag], true, `status ${status}`);
    assert.equal(timers.intervals.size, 0, `status ${status}: pollimine peab peatuma`);
    assert.equal(timers.timeouts.size, 0, `status ${status}: taasühendust ei planeerita`);
    assert.equal(FakeEventSource.instances.at(-1).closed, true, `status ${status}: voog suletakse`);
    assert.equal(a.session.isTerminal(), true);

    // Ja ta EI tohi ise ellu ärgata: uus laadimiskatse ei tekita päringut.
    const before = net.calls.length;
    await a.session.reload();
    assert.equal(net.calls.length, before, `status ${status}: terminaalne seanss ei küsi edasi`);
  }
});

// --- Leping Reactiga ------------------------------------------------------

test("hook sõltub ainult ruumi identiteedist, mitte muutuvast olekust", () => {
  const source = read("components/rooms/useRoomMessages.js");
  assert.match(source, /createRoomMessageSession/);
  assert.match(source, /\}, \[roomId, pollMs, initialIsHelpMatchRoom\]\);/);
  // Vana kuju: effect sõltus callback'idest, mis omakorda olekust — just see tekitas tsükli.
  assert.doesNotMatch(source, /\[roomId, roomPathId, pollMs, load, connectSse/);
});
