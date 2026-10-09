/**
 * KODUTEENUS K1-e — krüpteeritud seadmehoidla: saatmata kirjed ja pooleli kirje.
 *
 * MIDA HOIAME. Kaks asja, mis mujal ei ole:
 *   - JÄRJEKORD: kirje, mille salvestamise hetkel võrku ei olnud (tehtud töö);
 *   - MUSTAND: pooleli kirje, et telefoni lukustumine või lehe uuesti laadimine
 *     teksti ära ei viiks.
 * Mõlemas on kliendi nimi ja päeviku tekst, seega eriliiki isikuandmed.
 *
 * KUIDAS (sama muster mis välitöö hoidlal `lib/field/localStore.js`):
 *   - üks IndexedDB andmebaas LIIKMESUSE kohta. Teine konto samas seadmes, ka
 *     sama inimese teise asutuse liikmesus, avab teise andmebaasi ja neid ridu
 *     ei näe;
 *   - sisu on krüpteeritud AES-GCM-iga; võti on brauseri hoitav
 *     MITTE-EKSPORDITAV WebCrypto võti samas andmebaasis. Aus piir: see kaitseb
 *     failisüsteemist lugemise eest, mitte lahti lukustatud seadme täieliku
 *     ülevõtmise eest. Esmane piir on seadme ekraanilukk;
 *   - tekst EI lähe kunagi `localStorage`-isse ega HTTP vahemällu.
 *
 * Avalikuna (krüpteerimata) on rea juures ainult see, mida on vaja saatmiseks
 * ja loendi järjestamiseks: tunnused, ooteaja algus ja viimase katse seis.
 *
 * Ainult brauseris. Kui IndexedDB või WebCrypto puudub (privaatrežiim, vana
 * brauser), viskab avamine erindi ja kutsuja käitub nagu enne: viga jääb
 * vormile ja tekst alles.
 */

const DB_VERSION = 1;
const STORE_QUEUE = "queue";
const STORE_DRAFTS = "drafts";
const STORE_META = "meta";
const KEY_RECORD = "aes-gcm-key";

function assertBrowser() {
  if (typeof indexedDB === "undefined" || typeof crypto === "undefined" || !crypto.subtle) {
    const error = new Error("home_care.errors.device_store_unavailable");
    error.code = "HOME_CARE_DEVICE_STORE_UNAVAILABLE";
    throw error;
  }
}

function dbName(ownerId) {
  const id = String(ownerId || "").trim();
  if (!id) throw new Error("home_care.errors.device_store_owner_required");
  return `sotsiaalai-homecare-${id}`;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("home_care.errors.device_store_failed"));
  });
}

function txDone(tx) {
  const done = new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error || new Error("home_care.errors.device_store_failed"));
  });
  /* Kui kutsuja katkestab enne `await`-i (päring tehingu sees ebaõnnestus), ei
     tohi katkenud tehing jääda käsitlemata tagasilükkamiseks. Kes ootab, saab vea ikka. */
  done.catch(() => {});
  return done;
}

async function openDb(ownerId) {
  assertBrowser();
  const request = indexedDB.open(dbName(ownerId), DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_QUEUE)) db.createObjectStore(STORE_QUEUE, { keyPath: "clientRequestId" });
    if (!db.objectStoreNames.contains(STORE_DRAFTS)) db.createObjectStore(STORE_DRAFTS, { keyPath: "clientId" });
    if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: "id" });
  };
  const db = await requestToPromise(request);
  /* Kui teine vaheleht tõstab andmebaasi versiooni, paneme oma ühenduse kinni,
     et uuendus kinni ei jääks. Järgmine toiming avab uue ühenduse (vt haldur). */
  db.onversionchange = () => {
    try {
      db.close();
    } catch {}
  };
  return db;
}

/**
 * Palub brauseril selle lehe andmeid ruumipuuduse korral mitte ära visata.
 * Parim katse: vastus võib olla „ei" ja see ei takista midagi. Järjekorras on
 * tehtud töö, mida mujal ei ole.
 */
export async function requestDevicePersistence() {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) return await navigator.storage.persist();
  } catch {}
  return false;
}

/**
 * Võti luuakse ENNE tehingut ja pannakse hoidlasse ÜHES tehingus koos
 * kontrolliga, kas võti on juba olemas. Kaks korraga avatud vahelehte ei saa
 * nii kumbki oma võtit kirjutada: teine näeks esimese võtit ja jätaks enda oma
 * kõrvale. Muidu jääks esimese võtmega krüpteeritud kirje lugematuks.
 */
async function getOrCreateKey(db) {
  const readTx = db.transaction(STORE_META, "readonly");
  const existing = await requestToPromise(readTx.objectStore(STORE_META).get(KEY_RECORD));
  if (existing?.key) return existing.key;

  const fresh = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const writeTx = db.transaction(STORE_META, "readwrite");
  const meta = writeTx.objectStore(STORE_META);
  const done = txDone(writeTx);
  const current = await requestToPromise(meta.get(KEY_RECORD));
  if (!current?.key) meta.put({ id: KEY_RECORD, key: fresh, createdAt: new Date().toISOString() });
  await done;
  return current?.key || fresh;
}

async function encrypt(key, payload) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload ?? null));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { iv, cipher };
}

async function decrypt(key, record) {
  if (!record?.cipher || !record?.iv) return null;
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(record.iv) }, key, record.cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

export function isCareDeviceStoreSupported() {
  try {
    assertBrowser();
    return true;
  } catch {
    return false;
  }
}

export async function openCareDeviceStore(ownerId) {
  const db = await openDb(ownerId);
  const key = await getOrCreateKey(db);

  /** Rida, mida ei saa lahti krüpteerida (võti on kadunud), tuleb tagasi märgiga, mitte ei kao vaikselt. */
  async function decodeQueued(record) {
    const { payload, ...meta } = record;
    try {
      return { ...meta, payload: await decrypt(key, payload) };
    } catch {
      return { ...meta, payload: null, unreadable: true };
    }
  }

  async function listQueue() {
    const tx = db.transaction(STORE_QUEUE, "readonly");
    const records = await requestToPromise(tx.objectStore(STORE_QUEUE).getAll());
    const items = [];
    for (const record of records) items.push(await decodeQueued(record));
    return items;
  }

  async function countQueue() {
    const tx = db.transaction(STORE_QUEUE, "readonly");
    return requestToPromise(tx.objectStore(STORE_QUEUE).count());
  }

  /** Kirjutab rea koos sisuga (uus kirje) ja loeb tagasi, et „ootel" ei oleks pelk lubadus. */
  async function putQueued(item) {
    const { payload, unreadable: _unreadable, ...meta } = item;
    const record = { ...meta, payload: await encrypt(key, payload) };
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    tx.objectStore(STORE_QUEUE).put(record);
    await txDone(tx);
    const check = db.transaction(STORE_QUEUE, "readonly");
    return Boolean(await requestToPromise(check.objectStore(STORE_QUEUE).getKey(String(item.clientRequestId))));
  }

  /** Uuendab ainult rea avalikku osa (seis, viimane katse); sisu jääb puutumata. */
  async function patchQueued(clientRequestId, patch) {
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    const store = tx.objectStore(STORE_QUEUE);
    const done = txDone(tx);
    const record = await requestToPromise(store.get(String(clientRequestId)));
    if (record) store.put({ ...record, ...patch, clientRequestId: record.clientRequestId, payload: record.payload });
    await done;
    return Boolean(record);
  }

  async function removeQueued(clientRequestId) {
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    tx.objectStore(STORE_QUEUE).delete(String(clientRequestId));
    await txDone(tx);
  }

  async function getDraft(clientId) {
    const tx = db.transaction(STORE_DRAFTS, "readonly");
    const record = await requestToPromise(tx.objectStore(STORE_DRAFTS).get(String(clientId)));
    if (!record) return null;
    try {
      return { clientId: record.clientId, savedAtMs: record.savedAtMs, state: await decrypt(key, record.payload) };
    } catch {
      return null;
    }
  }

  async function putDraft(clientId, state, nowMs) {
    const record = { clientId: String(clientId), savedAtMs: nowMs, payload: await encrypt(key, state) };
    const tx = db.transaction(STORE_DRAFTS, "readwrite");
    tx.objectStore(STORE_DRAFTS).put(record);
    await txDone(tx);
  }

  async function removeDraft(clientId) {
    const tx = db.transaction(STORE_DRAFTS, "readwrite");
    tx.objectStore(STORE_DRAFTS).delete(String(clientId));
    await txDone(tx);
  }

  /** Aegunud mustandid kustutatakse lugemata: vanus on rea avalikus osas. */
  async function purgeDraftsOlderThan(cutoffMs) {
    const tx = db.transaction(STORE_DRAFTS, "readwrite");
    const store = tx.objectStore(STORE_DRAFTS);
    const done = txDone(tx);
    const records = await requestToPromise(store.getAll());
    let removed = 0;
    for (const record of records) {
      if (!Number.isFinite(record.savedAtMs) || record.savedAtMs < cutoffMs) {
        store.delete(record.clientId);
        removed += 1;
      }
    }
    await done;
    return removed;
  }

  function close() {
    try {
      db.close();
    } catch {}
  }

  return Object.freeze({
    listQueue,
    countQueue,
    putQueued,
    patchQueued,
    removeQueued,
    getDraft,
    putDraft,
    removeDraft,
    purgeDraftsOlderThan,
    close
  });
}
