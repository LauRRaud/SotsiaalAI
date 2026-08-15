"use client";

/**
 * FIELD-V1 client sync engine (doc ptk 3). Bridges the encrypted per-user
 * IndexedDB store and the idempotent server API:
 *  - every input autosaves to the device first (no "save" button, no loss);
 *  - nothing content-bearing uploads before the user approves it in the
 *    "Kontrolli enne saatmist" gate;
 *  - sync runs only while the app is open (no background work is promised);
 *  - on mount, UPLOADING items are reconciled against the server so an
 *    interrupted sync can never duplicate or lose an item.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FIELD_ITEM_STATE,
  FIELD_NOTE_KIND,
  FIELD_PROVENANCE
} from "@/lib/field/constants";
import {
  applyFieldSyncEvent,
  FieldSyncEvent,
  isUploadDue,
  nextFieldSyncWakeup
} from "@/lib/field/syncMachine";
import { createFieldSyncScheduler } from "@/lib/field/syncScheduler";
import {
  acknowledgeFieldWarning,
  applyFieldVisitStatusToPack,
  confirmFieldPurge,
  runFieldLocalRetention
} from "@/lib/field/localRetention";
import {
  isFieldStoreSupported,
  openFieldStore,
  requestPersistentStorage
} from "@/lib/field/localStore";
import {
  applyLocalMarker,
  FIELD_PACK_SCHEMA_VERSION,
  flushVisitMarkers,
  readPackMarkers
} from "@/lib/field/visitMarkers";
import { buildOfflineVisitList, fieldCloseBlockers } from "@/lib/field/continuity";

function makeClientItemId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `fld_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export function useFieldSync({ userId, visitId = null }) {
  const [supported, setSupported] = useState(true);
  const [online, setOnline] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [items, setItems] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [pack, setPack] = useState(null);
  const [localVisits, setLocalVisits] = useState([]);
  /* SOL-FIELD-01: hoiatus on NÄHTAV OLEK. Need kaks loendit lähevad otse
     liidesesse — ilma nendeta oli „kolm hoiatust" ainult loendur andmebaasis. */
  const [retentionWarnings, setRetentionWarnings] = useState([]);
  const [retentionAwaitingConfirmation, setRetentionAwaitingConfirmation] = useState([]);
  const storeRef = useRef(null);
  const syncingRef = useRef(false);
  const itemsRef = useRef([]);
  const runSyncRef = useRef(null);
  const schedulerRef = useRef(null);

  const refreshItems = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return [];
    const list = await store.listItems(visitId ? { visitId } : {});
    const visible = list.filter((item) => item.state !== FIELD_ITEM_STATE.REMOVED);
    visible.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
    /* SOL-FIELD-06: ajastaja loeb järjekorda viitest, mitte React-i olekust —
       ta ärkab väljaspool renderdust ja vajab VÄRSKET nimekirja. */
    itemsRef.current = visible;
    setItems(visible);
    return visible;
  }, [visitId]);

  const refreshLocalVisits = useCallback(async () => {
    const store = storeRef.current;
    if (!store?.listDecodedPacks) return [];
    const visits = buildOfflineVisitList(await store.listDecodedPacks(), { now: new Date() });
    setLocalVisits(visits);
    return visits;
  }, []);

  const persist = useCallback(
    async (item) => {
      const store = storeRef.current;
      if (!store) return;
      await store.putItem(item);
      await refreshItems();
    },
    [refreshItems]
  );

  const transition = useCallback(
    async (item, event) => {
      const next = applyFieldSyncEvent(item, event);
      if (!next) return null;
      if (next.state === FIELD_ITEM_STATE.REMOVED) {
        await storeRef.current?.deleteItem(item.clientItemId);
        await refreshItems();
        return next;
      }
      await persist(next);
      return next;
    },
    [persist, refreshItems]
  );

  /** Upload one item; returns the resulting state. */
  const uploadItem = useCallback(
    async (item) => {
      const store = storeRef.current;
      if (!store || !item.visitId) return item;
      const started = applyFieldSyncEvent(item, FieldSyncEvent.UPLOAD_STARTED);
      if (!started) return item;
      await store.putItem(started);
      try {
        let response;
        if (item.itemType === "attachment") {
          const full = await store.getItem(item.clientItemId, { withBlob: true });
          if (!full?.blob) throw Object.assign(new Error("blob_missing"), { permanent: true });
          const form = new FormData();
          form.set("file", full.blob, "capture");
          form.set("role", full.payload?.role || "photo");
          if (full.payload?.consentClientItemId) {
            form.set("consentClientItemId", full.payload.consentClientItemId);
          }
          if (full.payload?.documentOnly) form.set("documentOnly", "true");
          if (full.payload?.documentRequestConfirmed) form.set("documentRequestConfirmed", "true");
          if (full.payload?.documentRequestReason) form.set("documentRequestReason", full.payload.documentRequestReason);
          if (item.createdAt) form.set("deviceCreatedAt", item.createdAt);
          response = await fetch(
            `/api/field/visits/${encodeURIComponent(item.visitId)}/attachments/${encodeURIComponent(item.clientItemId)}`,
            { method: "PUT", body: form }
          );
        } else {
          response = await fetch(
            `/api/field/visits/${encodeURIComponent(item.visitId)}/items/${encodeURIComponent(item.clientItemId)}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                kind: item.payload?.kind || FIELD_NOTE_KIND.NOTE,
                provenance: item.payload?.provenance || FIELD_PROVENANCE.TOOTAJA_TAHELEPANEK,
                body: item.payload?.body || "",
                revision: item.revision || 1,
                consentKind: item.payload?.consentKind,
                consentSubject: item.payload?.consentSubject,
                consentForm: item.payload?.consentForm,
                aiConfirmed: item.payload?.aiConfirmed || false,
                transcriptClientItemId: item.payload?.transcriptClientItemId || null,
                deviceCreatedAt: item.createdAt || null
              })
            }
          );
        }
        if (response.status === 401 || response.status === 403) {
          setNeedsLogin(true);
          return transition(started, FieldSyncEvent.AUTH_REQUIRED);
        }
        if (response.status === 409) {
          const body = await readJson(response);
          if (body?.message === "field.errors.visit_read_only") {
            const next = await transition(started, FieldSyncEvent.UPLOAD_PERMANENT_ERROR);
            if (next) await persist({ ...next, lastError: body.message });
            return next;
          }
          const next = await transition(started, FieldSyncEvent.UPLOAD_CONFLICT);
          if (next && body?.conflict) await persist({ ...next, serverConflict: body.conflict });
          return next;
        }
        if (!response.ok) {
          const event = response.status >= 500 || response.status === 429
            ? FieldSyncEvent.UPLOAD_RETRYABLE_ERROR
            : FieldSyncEvent.UPLOAD_PERMANENT_ERROR;
          const body = await readJson(response);
          const next = await transition(started, event);
          if (next) await persist({ ...next, lastError: String(body?.message || response.status) });
          return next;
        }
        return transition(started, FieldSyncEvent.UPLOAD_OK);
      } catch (error) {
        const event = error?.permanent
          ? FieldSyncEvent.UPLOAD_PERMANENT_ERROR
          : FieldSyncEvent.UPLOAD_RETRYABLE_ERROR;
        return transition(started, event);
      }
    },
    [persist, transition]
  );

  const runSync = useCallback(async () => {
    if (syncingRef.current || !storeRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const list = await refreshItems();
      for (const item of list) {
        if (isUploadDue(item)) await uploadItem(item);
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      await refreshItems();
      /* SOL-FIELD-06: järgmine tähtaeg arvutatakse PÄRAST katset, mitte ette —
         backoff kasvab ja ajastaja järgib teda ise. */
      schedulerRef.current?.schedule();
    }
  }, [refreshItems, uploadItem]);

  /** Startup reconcile (doc 2.2): UPLOADING is never a trusted state. */
  const reconcile = useCallback(async () => {
    const store = storeRef.current;
    if (!store || !navigator.onLine) return;
    const list = await store.listItems(visitId ? { visitId } : {});
    const uploading = list.filter((item) => item.state === FIELD_ITEM_STATE.UPLOADING);
    if (!uploading.length) return;
    const byVisit = new Map();
    for (const item of uploading) {
      if (!byVisit.has(item.visitId)) byVisit.set(item.visitId, []);
      byVisit.get(item.visitId).push(item);
    }
    for (const [visit, visitItems] of byVisit) {
      try {
        const response = await fetch(`/api/field/visits/${encodeURIComponent(visit)}`);
        if (!response.ok) continue;
        const detail = await readJson(response);
        const known = new Set([
          ...(detail.notes || []).map((note) => note.clientItemId),
          ...(detail.attachments || []).map((attachment) => attachment.clientItemId)
        ]);
        for (const item of visitItems) {
          await transition(
            item,
            known.has(item.clientItemId)
              ? FieldSyncEvent.RECONCILE_FOUND_ON_SERVER
              : FieldSyncEvent.RECONCILE_NOT_ON_SERVER
          );
        }
      } catch {}
    }
  }, [transition, visitId]);

  /**
   * Local retention pass (doc 4.5): silent purge only for synced copies.
   *
   * SOL-FIELD-01: käik EI KASVATA hoiatuste loendurit. Ta ainult nimetab, keda
   * kasutajale näidata — loenduri liigutab inimene, kes hoiatust päriselt nägi
   * (`acknowledgeWarning`). Poliitika ise elab `lib/field/localRetention.js`-is,
   * et teda saaks mõõta ilma Reactita ja ilma IndexedDB-ta.
   *
   * SOL-FIELD-02: sama käik puhastab nüüd ka külastuspaketid — KÕIK, mitte ainult
   * praegu avatud külastuse oma. Kui käik võttis just selle paketi, mida ekraan
   * näitab, tuleb vaade värskendada; muidu jääks liidesesse pakett, mida seadmes
   * enam ei ole.
   */
  const runLocalRetention = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const outcome = await runFieldLocalRetention({ store, now: new Date() });
    setRetentionWarnings(outcome.warned);
    setRetentionAwaitingConfirmation(outcome.awaitingConfirmation);
    if (visitId && outcome.packsPurged.includes(String(visitId))) setPack(null);
    await refreshItems();
  }, [refreshItems, visitId]);

  /**
   * Server ütles, mis külastusest sai. Sulgemine on lepingu esimene tähtaeg —
   * pakett kaob KOHE, ka siis, kui sulges teine seade või teine inimene.
   */
  const applyVisitStatus = useCallback(
    async (visit) => {
      const store = storeRef.current;
      if (!store) return;
      /* Kutsuja on `loadDetail`, kelle catch tähendab „server ei vastanud".
         Kohaliku hoidla viga EI TOHI seda valet lauset öelda — pakett on
         mugavus, serveri vastus on käes. */
      try {
        const outcome = await applyFieldVisitStatusToPack({ store, visit, now: new Date() });
        if (!outcome || String(visit?.id) !== String(visitId)) return;
        setPack(outcome.removed ? null : await store.getPack(visitId));
      } catch {}
    },
    [visitId]
  );

  /** Inimene kinnitab, et NÄGI hoiatust. Alles see loeb hoiatuseks. */
  const acknowledgeWarning = useCallback(
    async (clientItemId) => {
      const store = storeRef.current;
      if (!store) return;
      await acknowledgeFieldWarning({ store, clientItemId, now: new Date() });
      await runLocalRetention();
    },
    [runLocalRetention]
  );

  /** Inimene lubab kustutada. Kolm nähtud hoiatust ei ole veel luba. */
  const confirmPurge = useCallback(
    async (clientItemId) => {
      const store = storeRef.current;
      if (!store) return;
      await confirmFieldPurge({ store, clientItemId, now: new Date() });
      await runLocalRetention();
    },
    [runLocalRetention]
  );

  useEffect(() => {
    let closed = false;
    if (!userId) return undefined;
    if (!isFieldStoreSupported()) {
      setSupported(false);
      return undefined;
    }
    (async () => {
      try {
        const store = await openFieldStore(userId);
        if (closed) {
          store.close();
          return;
        }
        storeRef.current = store;
        await requestPersistentStorage();
        await runLocalRetention();
        await refreshLocalVisits();
        if (visitId) setPack(await store.getPack(visitId));
        await refreshItems();
        if (navigator.onLine) {
          await reconcile();
          await runSync();
        }
      } catch {
        setSupported(false);
      }
    })();
    return () => {
      closed = true;
      storeRef.current?.close();
      storeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, visitId, refreshLocalVisits]);

  /**
   * SOL-FIELD-06: mootor ärkab ise.
   *
   * Ajastaja luuakse ÜKS kord ja kutsub alati värsket `runSync`-i viite kaudu —
   * muidu jääks ta esimese renderduse sulundisse kinni. Unmount peatab ta, seega
   * lahkunud vaade ei jäta taimerit taha.
   */
  useEffect(() => {
    runSyncRef.current = runSync;
  }, [runSync]);

  useEffect(() => {
    const scheduler = createFieldSyncScheduler({
      run: () => runSyncRef.current?.(),
      wakeupAt: () => {
        if (typeof navigator !== "undefined" && !navigator.onLine) return null;
        return nextFieldSyncWakeup(itemsRef.current, new Date());
      }
    });
    schedulerRef.current = scheduler;
    return () => {
      scheduler.stop();
      schedulerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      runSync();
    };
    const goOffline = () => setOnline(false);
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [runSync]);

  /** Autosave a new or edited note item locally (state DEVICE_ONLY). */
  const saveLocalNote = useCallback(
    async ({
      clientItemId = null,
      kind,
      provenance,
      body,
      consentKind,
      consentSubject,
      consentForm,
      aiConfirmed = false,
      /* SOL-FIELD-05: kinnitatud transkript kannab viidet salvestisele, mille
         tekst ta on. Server käivitab toorheli kella SAMAS tehingus, kus ta
         teksti vastu võtab — kaht eraldi päringut enam ei ole. */
      transcriptClientItemId = null
    }) => {
      const store = storeRef.current;
      if (!store || !visitId) return null;
      const existing = clientItemId ? await store.getItem(clientItemId) : null;
      const id = clientItemId || makeClientItemId();
      const base = existing
        ? applyFieldSyncEvent(existing, FieldSyncEvent.USER_EDITED) || existing
        : {
            clientItemId: id,
            visitId,
            itemType: "note",
            state: FIELD_ITEM_STATE.DEVICE_ONLY,
            revision: 1,
            attempts: 0,
            createdAt: new Date().toISOString()
          };
      await persist({
        ...base,
        payload: {
          kind,
          provenance,
          body,
          consentKind,
          consentSubject,
          consentForm,
          aiConfirmed,
          transcriptClientItemId
        }
      });
      return id;
    },
    [persist, visitId]
  );

  /** Autosave a captured photo/audio blob locally. */
  const saveLocalAttachment = useCallback(
    async ({
      role,
      blob,
      consentClientItemId = null,
      documentOnly = false,
      documentRequestConfirmed = false,
      documentRequestReason = null
    }) => {
      const store = storeRef.current;
      if (!store || !visitId || !blob) return null;
      const id = makeClientItemId();
      await persist({
        clientItemId: id,
        visitId,
        itemType: "attachment",
        state: FIELD_ITEM_STATE.DEVICE_ONLY,
        revision: 1,
        attempts: 0,
        createdAt: new Date().toISOString(),
        payload: {
          role,
          consentClientItemId,
          documentOnly,
          documentRequestConfirmed,
          documentRequestReason
        },
        blob
      });
      return id;
    },
    [persist, visitId]
  );

  /**
   * SOL-FIELD-05: tagastab LÕPPSEISU, mitte `undefined`.
   *
   * Ilma selleta ei saa kutsuja ausat teadet anda: „kinnitatud" tohib öelda
   * ainult siis, kui server vastas 2xx (kirje on `SYNCED`). Kõik muu on ausalt
   * „seadmes, saadetakse" või „saatmine ebaõnnestus".
   */
  const approveItem = useCallback(
    async (clientItemId) => {
      const item = await storeRef.current?.getItem(clientItemId);
      if (!item) return null;
      await transition(item, FieldSyncEvent.USER_APPROVED);
      if (navigator.onLine) await runSync();
      return storeRef.current?.getItem(clientItemId) || null;
    },
    [runSync, transition]
  );

  const retryItem = useCallback(
    async (clientItemId) => {
      const item = await storeRef.current?.getItem(clientItemId);
      if (!item) return;
      await transition(item, FieldSyncEvent.USER_RETRY);
      if (navigator.onLine) await runSync();
    },
    [runSync, transition]
  );

  const cancelItem = useCallback(
    async (clientItemId) => {
      const item = await storeRef.current?.getItem(clientItemId);
      if (!item) return;
      await transition(item, FieldSyncEvent.USER_CANCELLED);
    },
    [transition]
  );

  const deleteItem = useCallback(
    async (clientItemId) => {
      const item = await storeRef.current?.getItem(clientItemId);
      if (!item) return;
      await transition(item, FieldSyncEvent.USER_DELETED);
      if (item.state === FIELD_ITEM_STATE.SYNCED || item.state === FIELD_ITEM_STATE.PURGE_PENDING) {
        const after = await storeRef.current?.getItem(clientItemId);
        if (after) await transition(after, FieldSyncEvent.PURGE_DONE);
      }
    },
    [transition]
  );

  const resolveConflict = useCallback(
    async (clientItemId, resolve) => {
      const item = await storeRef.current?.getItem(clientItemId);
      if (!item || !visitId) return false;
      try {
        const response = await fetch(
          `/api/field/visits/${encodeURIComponent(visitId)}/items/${encodeURIComponent(clientItemId)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resolve })
          }
        );
        if (!response.ok) return false;
        const body = await readJson(response);
        const resolved = applyFieldSyncEvent(item, FieldSyncEvent.CONFLICT_RESOLVED);
        if (resolved) {
          const serverNote = body?.note || null;
          await persist({
            ...resolved,
            state: FIELD_ITEM_STATE.SYNCED,
            revision: serverNote?.revision || resolved.revision,
            serverConflict: null,
            payload: serverNote
              ? {
                  ...resolved.payload,
                  body: serverNote.body,
                  provenance: serverNote.provenance,
                  kind: serverNote.kind
                }
              : resolved.payload
          });
        }
        return true;
      } catch {
        return false;
      }
    },
    [persist, visitId]
  );

  /**
   * Store the prep pack for offline use ("Võta seadmesse").
   *
   * SOL-FIELD-02, KAKS VÄLJA, MIS PEAVAD KIRJE PEAL PÜSIMA:
   * - `takenAt` on säilituskell ja teda EI nullita iga kirjutusega. Seda funktsiooni
   *   kutsuvad ka markerite rajad (`confirmMarker`, `flushMarkers`) — kui nemad
   *   kella nullivad, ei jõua 7 päeva tähtaeg kunagi kohale ja säilituskäik ei
   *   leia midagi. Ainult teadlik uuesti võtmine (`retake`) alustab kella otsast.
   * - `status` elab PEALMISEL kirjel, mitte krüptitud sisu sees: säilituskäik loeb
   *   `listPacks()`-iga ainult metaandmeid ega tohi iga paketti lahti krüptida.
   *   Kui kutsuja olekut kaasa ei anna (markerite rada), jääb kehtima vana.
   */
  const storePack = useCallback(
    async (visit, { retake = false } = {}) => {
      const store = storeRef.current;
      if (!store || !visit?.id) return;
      /* Vana kirje lugemine ei tohi UUE võtmist blokeerida: kui salvestatud
         pakett on loetamatu (katkine krüptogramm), on „Võta seadmesse" just see
         tegevus, mis olukorra parandab. Siis algab ka säilituskell otsast. */
      let existing = null;
      try {
        existing = await store.getPack(visit.id);
      } catch {}
      const record = {
        visitId: visit.id,
        takenAt: !retake && existing?.takenAt ? existing.takenAt : new Date().toISOString(),
        plannedEndAt: visit.plannedEndAt || null,
        status: visit.status || existing?.status || null,
        payload: {
          /* SERVERI POOL: ettevalmistuse sisu ehitatakse värskest külastusest. */
          goal: visit.goal,
          locationText: visit.locationText,
          plannedStartAt: visit.plannedStartAt,
          plannedEndAt: visit.plannedEndAt,
          packKeyQuestions: visit.packKeyQuestions || [],
          packSummaryText: visit.packSummaryText || null,
          status: visit.status,
          version: visit.version,
          preInquiryId: visit.preInquiryId || null,
          safety: visit.safety || null,
          /* SEADME POOL: seda EI EHITATA ümber, teda kantakse edasi. Kinnine
             väljaloend on selle faili korduv viga — SOL-FIELD-02 kaotas nii
             `takenAt`/`status`, SOL-FIELD-04 kaotas markerid. Kui siia tuleb
             neljas seadmepoolne väli, kuulub ta SIIA plokki. */
          schemaVersion: FIELD_PACK_SCHEMA_VERSION,
          markers: readPackMarkers(existing?.payload)
        }
      };
      await store.putPack(record);
      setPack(await store.getPack(visit.id));
      await refreshLocalVisits();
    },
    [refreshLocalVisits]
  );

  const removePack = useCallback(async () => {
    if (!storeRef.current || !visitId) return;
    await storeRef.current.deletePack(visitId);
    setPack(null);
    await refreshLocalVisits();
  }, [visitId, refreshLocalVisits]);

  /**
   * SOL-FIELD-04: võrguta kinnitus.
   *
   * Varem läks see läbi `storePack`-i VÕLTSVISIIDIGA (`{ id, ...markers }`) ja
   * kirjutas seetõttu üle kogu ettevalmistuspaketi sisu. Nüüd on marker paketi
   * seadmepoolne osa ja teda kirjutatakse ainuüksi teda puudutava tehtega.
   */
  const recordMarker = useCallback(
    async (which) => {
      const store = storeRef.current;
      if (!store || !visitId) return null;
      const existing = await store.getPack(visitId);
      if (!existing) return null;
      await store.putPack({ ...existing, payload: applyLocalMarker(existing.payload, which, new Date()) });
      const fresh = await store.getPack(visitId);
      setPack(fresh);
      return fresh;
    },
    [visitId]
  );

  /** Ühenduse taastudes: marker kaob AINULT 2xx või tõendatud sündmuse peale. */
  const flushMarkers = useCallback(async () => {
    const store = storeRef.current;
    if (!store || !visitId || !navigator.onLine) return null;
    const outcome = await flushVisitMarkers({
      store,
      visitId,
      fetchImpl: (url, init) => fetch(url, init),
      now: new Date()
    });
    setPack(await store.getPack(visitId));
    return outcome;
  }, [visitId]);

  const markers = useMemo(() => readPackMarkers(pack?.payload), [pack]);

  const pendingCount = useMemo(
    () =>
      items.filter((item) =>
        [FIELD_ITEM_STATE.DEVICE_ONLY, FIELD_ITEM_STATE.QUEUED, FIELD_ITEM_STATE.UPLOADING].includes(item.state)
      ).length,
    [items]
  );
  const failedCount = useMemo(
    () =>
      items.filter((item) =>
        [FIELD_ITEM_STATE.FAILED, FIELD_ITEM_STATE.CONFLICT].includes(item.state)
      ).length,
    [items]
  );

  const closeBlockers = useMemo(
    () => fieldCloseBlockers(items, { needsLogin }),
    [items, needsLogin]
  );

  return {
    supported,
    online,
    needsLogin,
    syncing,
    items,
    pack,
    localVisits,
    refreshLocalVisits,
    pendingCount,
    failedCount,
    closeBlockers,
    saveLocalNote,
    saveLocalAttachment,
    approveItem,
    retryItem,
    cancelItem,
    deleteItem,
    resolveConflict,
    runSync,
    storePack,
    removePack,
    applyVisitStatus,
    markers,
    recordMarker,
    flushMarkers,
    refreshItems,
    retentionWarnings,
    retentionAwaitingConfirmation,
    acknowledgeWarning,
    confirmPurge
  };
}
