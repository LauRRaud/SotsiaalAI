/**
 * TEENUSPÄEVIK-V1 — võrguta järjekord.
 *
 * Järjekord hoiab TEHTUD TÖÖD, mida ei ole veel õnnestunud saata. Iga viga
 * siin maksab kas kadunud kirje (tasustamata töö) või topeltkirje (kaks arve
 * alusdokumenti ühest tööst), seega testitakse mõlemat suunda.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  OUTBOX_LIMIT,
  OUTBOX_ROW,
  OUTBOX_STATE,
  attentionItems,
  dequeue,
  enqueue,
  enqueueResult,
  markNeedsAttention,
  outboxCount,
  outboxItemState,
  outboxPayload,
  readOutbox,
  shouldRetry
} from "../../lib/serviceLog/outbox.js";
import { deviceRowKey, openDeviceStore } from "../../lib/serviceLog/deviceStore.js";

/**
 * Järjekord EI VÕTA enam `localStorage`-i, vaid kontoga seotud salvestust
 * (SOL-SLOG-01). Testid käivad sama teed pidi, mis komponent — muidu mõõdaks
 * siinne roheline sviit rada, mida tootmises ei ole.
 */
const OWNER = "user-a";

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  const store = openDeviceStore(
    {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: (key) => map.delete(key)
    },
    OWNER
  );
  return Object.assign(store, {
    get size() {
      return map.size;
    }
  });
}

/** Sildistamata sisendi ehitamiseks: rikutud JSON peab olema ÕIGE võtme all. */
const rowKey = (row) => deviceRowKey(row, OWNER);

test("kirje läheb järjekorda ja tuleb sealt tagasi", () => {
  const storage = makeStorage();
  enqueue(storage, { clientRequestId: "a", clientDisplayName: "Mari" });
  const items = readOutbox(storage);
  assert.equal(items.length, 1);
  assert.equal(items[0].clientDisplayName, "Mari");
});

/* Kaks vajutust ei tohi anda kahte saadetist — server on küll idempotentne,
   aga järjekord ei tohi teda üleliigselt koormata ega kasutajale valetada, et
   ootel on kaks kirjet. */
test("sama clientRequestId asendab, ei lisa teist rida", () => {
  const storage = makeStorage();
  enqueue(storage, { clientRequestId: "a", quantity: "1" });
  enqueue(storage, { clientRequestId: "a", quantity: "2" });
  const items = readOutbox(storage);
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, "2");
});

test("ilma võtmeta kirjet ei võeta vastu", () => {
  const storage = makeStorage();
  enqueue(storage, { clientDisplayName: "Ilma võtmeta" });
  assert.equal(outboxCount(storage), 0);
});

test("saadetud kirje kaob järjekorrast", () => {
  const storage = makeStorage();
  enqueue(storage, { clientRequestId: "a" });
  enqueue(storage, { clientRequestId: "b" });
  dequeue(storage, "a");
  assert.deepEqual(
    readOutbox(storage).map((item) => item.clientRequestId),
    ["b"]
  );
});

/* Tühi järjekord peab võtme ÄRA KUSTUTAMA, mitte jätma "[]"-i: muidu jääb
   seadmesse igaveseks kirje, mille sisu on juba serveris. */
test("tühjenenud järjekord ei jäta jälge", () => {
  const storage = makeStorage();
  enqueue(storage, { clientRequestId: "a" });
  dequeue(storage, "a");
  assert.equal(storage.size, 0);
});

test("rikutud salvestus ei lõhu lugemist", () => {
  const storage = makeStorage({ [rowKey(OUTBOX_ROW)]: "{ see ei ole json" });
  assert.deepEqual(readOutbox(storage), []);
});

/* Ülempiir kaitseb salvestuskvooti, aga ei tohi selleks tehtud tööd kustutada. */
test("201. kirje blokeeritakse ja ükski varasem töö ei kao", () => {
  const storage = makeStorage();
  for (let i = 0; i < OUTBOX_LIMIT; i += 1) {
    enqueue(storage, { clientRequestId: `req-${i}` });
  }
  const result = enqueueResult(storage, { clientRequestId: "req-200" });
  const items = readOutbox(storage);
  assert.equal(items.length, OUTBOX_LIMIT);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "full");
  assert.equal(items[0].clientRequestId, "req-0");
  assert.equal(items.at(-1).clientRequestId, "req-199");
  assert.equal(items.some((item) => item.clientRequestId === "req-200"), false);
});

test("parandatav 400 jääb reload'i järel needs_attention olekusse koos põhjusega", () => {
  const storage = makeStorage();
  enqueue(storage, { clientRequestId: "a", clientDisplayName: "Mari" });
  markNeedsAttention(storage, "a", { status: 400, message: "Kogus puudub" });

  const [item] = readOutbox(storage);
  assert.equal(outboxItemState(item), OUTBOX_STATE.NEEDS_ATTENTION);
  assert.equal(attentionItems(storage).length, 1);
  assert.equal(item.__outbox.status, 400);
  assert.equal(item.__outbox.message, "Kogus puudub");
  assert.deepEqual(outboxPayload(item), {
    clientRequestId: "a",
    clientDisplayName: "Mari"
  });
});

/* Kogu järjekorra mõte on selles vahes: võrguviga = „ei tea, kas jõudis",
   4xx = „server vaatas ja ütles ei". Kui 4xx-i korrataks, ei tühjeneks
   järjekord enam kunagi. */
test("autentimis- ja ajutised olekuvead säilivad retry-na", () => {
  assert.equal(shouldRetry({ networkError: true }), true);
  assert.equal(shouldRetry({ status: 503 }), true);
  assert.equal(shouldRetry({ status: 500 }), true);
  assert.equal(shouldRetry({ status: 401 }), true);
  assert.equal(shouldRetry({ status: 403 }), true);
  assert.equal(shouldRetry({ status: 408 }), true);
  assert.equal(shouldRetry({ status: 429 }), true);
  assert.equal(shouldRetry({ status: 400 }), false);
  assert.equal(shouldRetry({ status: 409 }), false);
  assert.equal(shouldRetry({ status: 201 }), false);
});

/* Server-render: `localStorage`-i ei ole. See ei tohi olla eriharu ega viga. */
test("salvestuseta keskkond ei viska", () => {
  assert.deepEqual(readOutbox(null), []);
  assert.equal(outboxCount(undefined), 0);
  assert.deepEqual(enqueue(null, { clientRequestId: "a" }), []);
});
