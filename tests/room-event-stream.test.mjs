// Audit T01 — ruumist lahkunu ei saa enam ühtegi uut sõnumit.
//
// Viga: ligipääsu kontrolliti ühenduse loomisel ja siis iga 20 sekundi järel;
// sündmus kirjutati voogu kohe. Lahkunu sai kuni 20 sekundit veel uusi sõnumeid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOM_STREAM_HEARTBEAT_MS, ROOM_STREAM_RECHECK_MS, createRoomEventStream } from '../lib/rooms/eventStream.js';

function harness({ access = true } = {}) {
  const state = { access, gate: null, checks: 0, unsubscribed: 0, listener: null };
  const intervals = new Map();
  let nextId = 0;
  const stream = createRoomEventStream({
    subscribe: (listener) => {
      state.listener = listener;
      return () => {
        state.unsubscribed += 1;
        state.listener = null;
      };
    },
    checkAccess: async () => {
      state.checks += 1;
      /* Tulemus on kontrolli alguse hetke seis, nagu päris päringul. */
      const result = state.access;
      if (state.gate) await state.gate;
      if (result === 'throw') throw new Error('database unavailable');
      return result;
    },
    timers: {
      setInterval: (fn, ms) => {
        intervals.set(++nextId, { fn, ms });
        return nextId;
      },
      clearInterval: (id) => intervals.delete(id)
    }
  });
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const next = async () => {
    const { value, done } = await reader.read();
    return done ? null : decoder.decode(value);
  };
  const timer = (ms) => [...intervals.values()].find((item) => item.ms === ms);
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  return { state, intervals, reader, next, timer, settle, emit: (event) => state.listener?.(event) };
}

const message = (text) => ({ type: 'message', message: { content: text } });

test('T01: liige saab sündmuse pärast ligipääsukontrolli', async () => {
  const h = harness();
  assert.equal(await h.next(), ': connected\n\n');
  assert.equal(h.state.checks, 0);
  h.emit(message('tere'));
  assert.equal(await h.next(), `data: ${JSON.stringify(message('tere'))}\n\n`);
  assert.equal(h.state.checks, 1);
});

test('T01: ruumist lahkunu ei saa sõnumit, mis saabus pärast lahkumist, ja voog suletakse kohe', async () => {
  const h = harness();
  await h.next();
  /* Lahkumine. 20 sekundi taimer ei ole veel käivitunud. */
  h.state.access = false;
  h.emit(message('SALAJANE PÄRAST LAHKUMIST'));
  assert.equal(await h.next(), null);
  assert.equal(h.state.unsubscribed, 1);
  assert.equal(h.intervals.size, 0);
  /* Hilisemad sündmused ei jõua enam kuhugi. */
  assert.equal(h.state.listener, null);
});

test('T01: kontrolli viga ja ebamäärane vastus on keeldumine', async () => {
  for (const access of ['throw', { ok: true }, 1, 'yes', null, undefined]) {
    const h = harness();
    h.state.access = access;
    await h.next();
    h.emit(message('ei tohi välja minna'));
    assert.equal(await h.next(), null, String(access));
    assert.equal(h.state.unsubscribed, 1);
  }
});

test('T01: kontrolli ajal saabunud sündmus ei sõida varasema kontrolli tulemusel', async () => {
  const h = harness();
  await h.next();
  let release;
  h.state.gate = new Promise((resolve) => { release = resolve; });
  /* Esimene sõnum: kontroll algab (inimene on veel liige) ja jääb vastust ootama. */
  h.emit(message('esimene'));
  await h.settle();
  assert.equal(h.state.checks, 1);
  /* Kontrolli ajal saabub teine sõnum ja kohe pärast seda inimene lahkub. */
  h.emit(message('teine, pärast lahkumist nähtamatu'));
  h.state.access = false;
  h.state.gate = null;
  release();
  /* Esimene sõnum saabus enne kontrolli algust ja läheb välja; teine vajab oma kontrolli ja jääb tulemata. */
  assert.equal(await h.next(), `data: ${JSON.stringify(message('esimene'))}\n\n`);
  assert.equal(await h.next(), null);
  assert.equal(h.state.checks, 2);
});

test('T01: sõnumivalang jääb järjekorda ega tee iga sõnumi kohta eraldi kontrolli', async () => {
  const h = harness();
  await h.next();
  let release;
  h.state.gate = new Promise((resolve) => { release = resolve; });
  h.emit(message('1'));
  await h.settle();
  for (const text of ['2', '3', '4']) h.emit(message(text));
  h.state.gate = null;
  release();
  const seen = [];
  for (let index = 0; index < 4; index += 1) seen.push(JSON.parse((await h.next()).slice(6)).message.content);
  assert.deepEqual(seen, ['1', '2', '3', '4']);
  /* Üks kontroll esimesele ja üks kolmele kontrolli ajal saabunule. */
  assert.equal(h.state.checks, 2);
});

test('T01: vaikse ruumi voo sulgeb perioodiline kontroll; elusolekumärk käib oma taimeriga', async () => {
  const h = harness();
  await h.next();
  h.timer(ROOM_STREAM_HEARTBEAT_MS).fn();
  assert.equal(await h.next(), ': keep-alive\n\n');
  await h.timer(ROOM_STREAM_RECHECK_MS).fn();
  assert.equal(h.intervals.size, 2);
  h.state.access = false;
  await h.timer(ROOM_STREAM_RECHECK_MS).fn();
  assert.equal(await h.next(), null);
  assert.equal(h.intervals.size, 0);
  assert.equal(h.state.unsubscribed, 1);
});

test('T01: lugeja katkestus tühistab tellimuse ja taimerid', async () => {
  const h = harness();
  await h.next();
  await h.reader.cancel();
  assert.equal(h.state.unsubscribed, 1);
  assert.equal(h.intervals.size, 0);
});

test('T01: marsruut kasutab sama voogu ja loeb ligipääsuks ainult selge „jah"', () => {
  const route = readFileSync(new URL('../app/api/rooms/[roomId]/messages/stream/route.js', import.meta.url), 'utf8');
  assert.match(route, /createRoomEventStream\(\{/);
  assert.match(route, /checkAccess: async \(\) => \(await ensureAccess\(auth\.userId, roomId, auth\.userRole\)\)\.ok === true/);
  /* Marsruut ise sündmusi voogu ei kirjuta: muidu läheks kontrollist mööda. */
  assert.equal(/controller\.enqueue|new ReadableStream/.test(route), false);
});
