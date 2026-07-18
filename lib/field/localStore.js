/**
 * FIELD-V1 encrypted per-user device store (doc ptk 4.3, O-FD-2).
 *
 * - One IndexedDB database per user (`sotsiaalai-field-<userId>`) so another
 *   account on the same device can never read this partition.
 * - Item payloads (note text, consent fields, photo/audio blobs) are encrypted
 *   with AES-GCM under a NON-EXTRACTABLE WebCrypto key stored in the same
 *   database. Honest limit (documented to the user): this protects against
 *   casual file-system access, not a full device compromise — the OS screen
 *   lock is the primary boundary. No app PIN lock in V1 (O-FD-2).
 * - Sensitive content NEVER goes to localStorage; only ciphertext lives here.
 * - Browser-only module: every entry point throws when IndexedDB or WebCrypto
 *   is unavailable, and callers fall back to online-only behaviour.
 */

const DB_VERSION = 1;
const STORE_ITEMS = "items";
const STORE_PACKS = "packs";
const STORE_META = "meta";
const KEY_RECORD = "aes-gcm-key";

function assertBrowser() {
  if (typeof indexedDB === "undefined" || typeof crypto === "undefined" || !crypto.subtle) {
    const error = new Error("field.errors.local_store_unavailable");
    error.code = "FIELD_LOCAL_STORE_UNAVAILABLE";
    throw error;
  }
}

function dbName(userId) {
  const id = String(userId || "").trim();
  if (!id) throw new Error("field.errors.local_store_user_required");
  return `sotsiaalai-field-${id}`;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("field.errors.local_store_failed"));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error || new Error("field.errors.local_store_failed"));
  });
}

async function openDb(userId) {
  assertBrowser();
  const request = indexedDB.open(dbName(userId), DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_ITEMS)) {
      const items = db.createObjectStore(STORE_ITEMS, { keyPath: "clientItemId" });
      items.createIndex("byVisit", "visitId", { unique: false });
      items.createIndex("byState", "state", { unique: false });
    }
    if (!db.objectStoreNames.contains(STORE_PACKS)) {
      db.createObjectStore(STORE_PACKS, { keyPath: "visitId" });
    }
    if (!db.objectStoreNames.contains(STORE_META)) {
      db.createObjectStore(STORE_META, { keyPath: "id" });
    }
  };
  return requestToPromise(request);
}

async function getOrCreateKey(db) {
  const readTx = db.transaction(STORE_META, "readonly");
  const existing = await requestToPromise(readTx.objectStore(STORE_META).get(KEY_RECORD));
  if (existing?.key) return existing.key;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt"
  ]);
  const writeTx = db.transaction(STORE_META, "readwrite");
  writeTx.objectStore(STORE_META).put({ id: KEY_RECORD, key, createdAt: new Date().toISOString() });
  await txDone(writeTx);
  return key;
}

async function encryptPayload(key, payload) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload ?? null));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { iv: Array.from(iv), cipher };
}

async function decryptPayload(key, record) {
  if (!record?.cipher) return null;
  const iv = new Uint8Array(record.iv || []);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, record.cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

async function encryptBlob(key, blob) {
  if (!blob) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, await blob.arrayBuffer());
  return { iv: Array.from(iv), cipher, type: blob.type || "application/octet-stream" };
}

async function decryptBlob(key, record) {
  if (!record?.cipher) return null;
  const iv = new Uint8Array(record.iv || []);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, record.cipher);
  return new Blob([plain], { type: record.type || "application/octet-stream" });
}

export async function openFieldStore(userId) {
  const db = await openDb(userId);
  const key = await getOrCreateKey(db);

  async function putItem(item) {
    const { payload, blob, ...plainMeta } = item;
    const record = {
      ...plainMeta,
      payload: await encryptPayload(key, payload ?? null),
      blob: blob ? await encryptBlob(key, blob) : null,
      updatedAtLocal: new Date().toISOString()
    };
    const tx = db.transaction(STORE_ITEMS, "readwrite");
    tx.objectStore(STORE_ITEMS).put(record);
    await txDone(tx);
    return record.clientItemId;
  }

  async function decodeItem(record, { withBlob = false } = {}) {
    if (!record) return null;
    const { payload, blob, ...meta } = record;
    return {
      ...meta,
      payload: await decryptPayload(key, payload),
      blob: withBlob && blob ? await decryptBlob(key, blob) : null,
      hasBlob: Boolean(blob)
    };
  }

  async function getItem(clientItemId, options) {
    const tx = db.transaction(STORE_ITEMS, "readonly");
    const record = await requestToPromise(tx.objectStore(STORE_ITEMS).get(String(clientItemId)));
    return decodeItem(record, options);
  }

  async function listItems({ visitId = null, withBlob = false } = {}) {
    const tx = db.transaction(STORE_ITEMS, "readonly");
    const store = tx.objectStore(STORE_ITEMS);
    const records = visitId
      ? await requestToPromise(store.index("byVisit").getAll(String(visitId)))
      : await requestToPromise(store.getAll());
    const items = [];
    for (const record of records) items.push(await decodeItem(record, { withBlob }));
    return items;
  }

  async function deleteItem(clientItemId) {
    const tx = db.transaction(STORE_ITEMS, "readwrite");
    tx.objectStore(STORE_ITEMS).delete(String(clientItemId));
    await txDone(tx);
  }

  async function putPack(pack) {
    const { payload, ...meta } = pack;
    const record = { ...meta, payload: await encryptPayload(key, payload ?? null) };
    const tx = db.transaction(STORE_PACKS, "readwrite");
    tx.objectStore(STORE_PACKS).put(record);
    await txDone(tx);
  }

  async function getPack(visitId) {
    const tx = db.transaction(STORE_PACKS, "readonly");
    const record = await requestToPromise(tx.objectStore(STORE_PACKS).get(String(visitId)));
    if (!record) return null;
    const { payload, ...meta } = record;
    return { ...meta, payload: await decryptPayload(key, payload) };
  }

  async function listPacks() {
    const tx = db.transaction(STORE_PACKS, "readonly");
    const records = await requestToPromise(tx.objectStore(STORE_PACKS).getAll());
    return records.map(({ payload: _payload, ...meta }) => meta);
  }

  async function deletePack(visitId) {
    const tx = db.transaction(STORE_PACKS, "readwrite");
    tx.objectStore(STORE_PACKS).delete(String(visitId));
    await txDone(tx);
  }

  async function getJournal() {
    const tx = db.transaction(STORE_META, "readonly");
    const record = await requestToPromise(tx.objectStore(STORE_META).get("journal"));
    return record?.value || null;
  }

  async function putJournal(value) {
    const tx = db.transaction(STORE_META, "readwrite");
    tx.objectStore(STORE_META).put({ id: "journal", value, updatedAt: new Date().toISOString() });
    await txDone(tx);
  }

  function close() {
    try {
      db.close();
    } catch {}
  }

  return Object.freeze({
    putItem,
    getItem,
    listItems,
    deleteItem,
    putPack,
    getPack,
    listPacks,
    deletePack,
    getJournal,
    putJournal,
    close
  });
}

/** "Kustuta kõik kohalikud andmed" — removes the whole per-user partition. */
export async function destroyFieldStore(userId) {
  assertBrowser();
  await requestToPromise(indexedDB.deleteDatabase(dbName(userId)));
}

export function isFieldStoreSupported() {
  try {
    assertBrowser();
    return true;
  } catch {
    return false;
  }
}

/** Best-effort durable storage request (doc ptk 9: eviction mitigation). */
export async function requestPersistentStorage() {
  try {
    if (navigator?.storage?.persist) return await navigator.storage.persist();
  } catch {}
  return false;
}
