"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

import { isCareDeviceStoreSupported, openCareDeviceStore, requestDevicePersistence } from "@/lib/homeCare/deviceStore";
import {
  DRAFT_MAX_AGE_MS,
  OutboxState,
  SendOutcome,
  afterAttempt,
  bodyForSend,
  canEnqueue,
  isDraftExpired,
  newQueueItem,
  sendOutcome,
  sortQueue
} from "@/lib/homeCare/outbox";

import { homeCareBase } from "./homeCareClient";

/**
 * KODUTEENUS K1-e — seadme järjekorra haldur ja selle hook.
 *
 * ÜKS HALDUR LIIKMESUSE KOHTA, moodulitasemel. Kirje vorm (paneb järjekorda) ja
 * riba (näitab ja saadab) on lehel eri kohtades; ühine haldur hoiab neil sama
 * seisu ilma, et leht peaks seda propidena läbi kandma. Liikmesuse vahetumisel
 * (teine konto samas brauseris) on teine haldur ja teine andmebaas.
 *
 * SAATMINE käib järjest ja üks korraga. Proovitakse: lehe avamisel, ühenduse
 * taastumisel, vahelehe nähtavaks muutumisel, iga 30 sekundi järel, kuni midagi
 * ootab, ja nupust. Kaks vahelehte võivad sama kirjet korraga saata: server
 * tunneb `clientRequestId` järgi korduse ära ja teist kirjet ei teki.
 *
 * ÕNNESTUNUD KIRJE KUSTUB SEADMEST KOHE. Lahti olev kliendi leht saab
 * salvestatud kirje kätte (`onSent`) ja näitab seda päevikus.
 *
 * HOIDLA ÜHENDUS VÕIB KATKEDA (telefon paneb taustal oleva lehe andmebaasi
 * kinni). Iga toiming proovib sel juhul ühe korra uue ühendusega. Kui ka see ei
 * õnnestu, jääb riba viimase teadaoleva seisuga alles: ootel kirjeid ei tohi
 * peita selle pärast, et neid hetkel lugeda ei saanud.
 */

const RETRY_INTERVAL_MS = 30_000;
/* Rippuma jäänud päring (nõrk levi) ei tohi järjekorda kinni hoida: saatmine
   käib üks korraga, seega lõputu ootamine peataks ka kõik järgmised katsed. */
const SEND_TIMEOUT_MS = 30_000;
const EMPTY = Object.freeze({ ready: false, available: false, items: [], flushing: false });
const managers = new Map();

function createManager(ownerId) {
  let snapshot = EMPTY;
  let storePromise = null;
  let flushPromise = null;
  let locale = "et";
  let attached = 0;
  let timer = null;
  let persistenceAsked = false;
  const listeners = new Set();
  const sentListeners = new Set();
  /* Mustandi toimingud käivad JÄRJEST. Viitega salvestus võib olla veel teel
     (krüpteerimine on asünkroonne), kui kirje salvestub ja mustand kustutatakse;
     ilma järjekorrata võiks hilinenud salvestus mustandi tagasi tuua. */
  let draftChain = Promise.resolve();
  const inOrder = (operation) => {
    const next = draftChain.then(operation, operation);
    draftChain = next.catch(() => {});
    return next;
  };

  const emit = (patch) => {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };

  /**
   * Hoidla ühendus. Seade, mis hoidlat ei toeta (privaatrežiim), annab püsivalt
   * `null`; ebaõnnestunud avamist meelde ei jäeta, järgmine toiming proovib uuesti.
   */
  function open() {
    if (!storePromise) {
      const attempt = (async () => {
        if (!isCareDeviceStoreSupported()) return null;
        try {
          const store = await openCareDeviceStore(ownerId);
          await store.purgeDraftsOlderThan(Date.now() - DRAFT_MAX_AGE_MS).catch(() => {});
          return store;
        } catch {
          if (storePromise === attempt) storePromise = null;
          return null;
        }
      })();
      storePromise = attempt;
    }
    return storePromise;
  }

  function dropStore() {
    const stale = storePromise;
    storePromise = null;
    stale?.then((store) => store?.close()).catch(() => {});
  }

  /**
   * Toiming hoidlaga; katkenud ühenduse korral üks uus katse värske ühendusega.
   * @returns `{ ok, value }`; `ok` on väär, kui hoidlat ei ole või toiming ei õnnestunud ka teisel katsel.
   */
  async function withStore(operation) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const store = await open();
      if (!store) {
        if (!isCareDeviceStoreSupported()) return { ok: false, value: null };
        continue;
      }
      try {
        return { ok: true, value: await operation(store) };
      } catch {
        dropStore();
      }
    }
    return { ok: false, value: null };
  }

  async function refresh() {
    const result = await withStore((store) => store.listQueue());
    if (!result.ok) {
      /* Lugeda ei saanud: viimane teadaolev loend jääb ette. */
      emit({ ready: true, available: false });
      return snapshot.items;
    }
    const items = sortQueue(result.value);
    emit({ ready: true, available: true, items });
    return items;
  }

  /**
   * @returns `{ ok, reason }`: `full` (järjekord täis), `unavailable` (hoidlat
   *   ei ole) või `storage` (kirjutamine ei õnnestunud). Vorm hoiab neil
   *   juhtudel teksti alles.
   */
  async function enqueue({ organizationId, clientId, clientName, body }) {
    if (!isCareDeviceStoreSupported()) return { ok: false, reason: "unavailable" };
    const item = newQueueItem({ organizationId, clientId, clientName, body, nowMs: Date.now() });
    if (!item) return { ok: false, reason: "invalid" };
    const result = await withStore(async (store) => {
      const current = await store.listQueue();
      if (!canEnqueue(current, item.clientRequestId)) return "full";
      /* Sama võti on juba ootel (teine vajutus): ooteaja algus jääb esimese vajutuse omaks. */
      const existing = current.find((queued) => queued.clientRequestId === item.clientRequestId);
      const saved = await store.putQueued(existing ? { ...item, queuedAtMs: existing.queuedAtMs } : item);
      return saved ? "saved" : "storage";
    });
    await refresh();
    if (!result.ok) return { ok: false, reason: "storage" };
    if (result.value !== "saved") return { ok: false, reason: result.value };
    /* Tehtud töö on nüüd ainult selles seadmes: palume brauseril seda ruumipuuduse
       korral mitte ära visata. Küsitakse üks kord; keeldumine ei takista midagi. */
    if (!persistenceAsked) {
      persistenceAsked = true;
      requestDevicePersistence();
    }
    return { ok: true, reason: null };
  }

  async function sendOne(item) {
    let result = { ok: false, status: 0, messageKey: "", entry: null };
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), SEND_TIMEOUT_MS) : null;
    try {
      const response = await fetch(
        `${homeCareBase(item.organizationId)}/kliendid/${encodeURIComponent(item.clientId)}/kirjed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-ui-locale": locale },
          cache: "no-store",
          signal: controller?.signal,
          body: JSON.stringify(bodyForSend(item, Date.now()))
        }
      );
      const payload = await response.json().catch(() => ({}));
      result = {
        ok: Boolean(response.ok && payload?.ok),
        status: response.status,
        messageKey: typeof payload?.messageKey === "string" ? payload.messageKey : "",
        entry: payload?.entry || null
      };
    } catch {
      /* Võrguviga või ajapiir: seis jääb „ei tea, kas jõudis" ja kirje jääb ootele. */
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    const outcome = sendOutcome(result);
    if (outcome === SendOutcome.SENT) {
      /* Kui eemaldamine ei õnnestu, jääb rida alles ja järgmine katse on serverile kordus. */
      await withStore((store) => store.removeQueued(item.clientRequestId));
      for (const listener of sentListeners) {
        try {
          listener(result.entry, item);
        } catch {}
      }
      return { outcome, status: result.status };
    }
    const next = afterAttempt(item, { outcome, status: result.status, messageKey: result.messageKey, nowMs: Date.now() });
    await withStore((store) =>
      store.patchQueued(item.clientRequestId, {
        state: next.state,
        attempts: next.attempts,
        lastStatus: next.lastStatus,
        lastMessageKey: next.lastMessageKey,
        lastTriedAtMs: next.lastTriedAtMs
      })
    );
    return { outcome, status: result.status };
  }

  function flush() {
    if (flushPromise) return flushPromise;
    flushPromise = (async () => {
      emit({ flushing: true });
      try {
        const items = await refresh();
        for (const item of items) {
          if (item.unreadable || item.state === OutboxState.ATTENTION) continue;
          const { status } = await sendOne(item);
          /* Võrku ei ole: ülejäänute proovimine annaks sama tulemuse. */
          if (status === 0) break;
        }
      } catch {
        /* Hoidla viga ei tohi lehte katki teha; järgmine katse proovib uuesti. */
      } finally {
        await refresh().catch(() => {});
        emit({ flushing: false });
      }
    })().finally(() => {
      flushPromise = null;
    });
    return flushPromise;
  }

  /** Tagasi lükatud kirje uuesti ootele: inimene on põhjuse kõrvaldanud (nt klient on taas avatud). */
  async function retry(clientRequestId) {
    await withStore((store) => store.patchQueued(clientRequestId, { state: OutboxState.PENDING }));
    await refresh();
    return flush();
  }

  async function discard(clientRequestId) {
    await withStore((store) => store.removeQueued(clientRequestId));
    await refresh();
  }

  /** @returns `{ state, savedAtMs }` või `null`. */
  function loadDraft(clientId) {
    return inOrder(async () => {
      const result = await withStore(async (store) => {
        const draft = await store.getDraft(clientId);
        if (!draft) return null;
        if (isDraftExpired(draft, Date.now())) {
          await store.removeDraft(clientId);
          return null;
        }
        return { state: draft.state, savedAtMs: draft.savedAtMs };
      });
      return result.ok ? result.value : null;
    });
  }

  function saveDraft(clientId, state) {
    return inOrder(async () => {
      const result = await withStore((store) => store.putDraft(clientId, state, Date.now()));
      return result.ok;
    });
  }

  function clearDraft(clientId) {
    return inOrder(async () => {
      await withStore((store) => store.removeDraft(clientId));
    });
  }

  const hasPending = () => snapshot.items.some((item) => !item.unreadable && item.state !== OutboxState.ATTENTION);
  const onOnline = () => flush();
  const onVisible = () => {
    if (document.visibilityState === "visible") refresh().then(() => (hasPending() ? flush() : null));
  };

  /** Esimene kasutaja lehel paneb kuulajad külge, viimane võtab maha. */
  function attach() {
    attached += 1;
    if (attached === 1) {
      window.addEventListener("online", onOnline);
      document.addEventListener("visibilitychange", onVisible);
      timer = window.setInterval(() => {
        if (document.visibilityState !== "visible" || navigator.onLine === false) return;
        if (hasPending()) flush();
      }, RETRY_INTERVAL_MS);
      refresh().then(() => (hasPending() ? flush() : null));
    }
    return () => {
      attached -= 1;
      if (attached === 0) {
        window.removeEventListener("online", onOnline);
        document.removeEventListener("visibilitychange", onVisible);
        if (timer) window.clearInterval(timer);
        timer = null;
      }
    };
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    onSent(listener) {
      sentListeners.add(listener);
      return () => sentListeners.delete(listener);
    },
    setLocale(value) {
      if (typeof value === "string" && value) locale = value;
    },
    attach,
    refresh,
    enqueue,
    flush,
    retry,
    discard,
    loadDraft,
    saveDraft,
    clearDraft
  };
}

/** Ilma omanikuta (sessioon veel laadimata) haldurit ei ole: midagi ei loeta ega kirjutata. */
export function getOutboxManager(ownerId) {
  const id = typeof ownerId === "string" ? ownerId.trim() : "";
  if (!id || typeof window === "undefined") return null;
  if (!managers.has(id)) managers.set(id, createManager(id));
  return managers.get(id);
}

const subscribeNothing = () => () => {};
const getEmpty = () => EMPTY;

/**
 * @returns `{ ready, available, items, flushing, manager }`. `available` on
 *   väär, kuni hoidla on avatud, ja jääb vääraks, kui seade seda ei toeta.
 */
export function useHomeCareOutbox(ownerId, { locale } = {}) {
  const manager = useMemo(() => getOutboxManager(ownerId), [ownerId]);
  const snapshot = useSyncExternalStore(
    manager ? manager.subscribe : subscribeNothing,
    manager ? manager.getSnapshot : getEmpty,
    getEmpty
  );

  useEffect(() => {
    if (!manager) return undefined;
    manager.setLocale(locale);
    return manager.attach();
  }, [manager, locale]);

  return { ...snapshot, manager };
}
