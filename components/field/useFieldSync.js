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
  isUploadDue
} from "@/lib/field/syncMachine";
import {
  acknowledgeFieldWarning,
  confirmFieldPurge,
  runFieldLocalRetention
} from "@/lib/field/localRetention";
import {
  isFieldStoreSupported,
  openFieldStore,
  requestPersistentStorage
} from "@/lib/field/localStore";

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
  /* SOL-FIELD-01: hoiatus on NÄHTAV OLEK. Need kaks loendit lähevad otse
     liidesesse — ilma nendeta oli „kolm hoiatust" ainult loendur andmebaasis. */
  const [retentionWarnings, setRetentionWarnings] = useState([]);
  const [retentionAwaitingConfirmation, setRetentionAwaitingConfirmation] = useState([]);
  const storeRef = useRef(null);
  const syncingRef = useRef(false);

  const refreshItems = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return [];
    const list = await store.listItems(visitId ? { visitId } : {});
    const visible = list.filter((item) => item.state !== FIELD_ITEM_STATE.REMOVED);
    visible.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
    setItems(visible);
    return visible;
  }, [visitId]);

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
   */
  const runLocalRetention = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const outcome = await runFieldLocalRetention({ store, now: new Date() });
    setRetentionWarnings(outcome.warned);
    setRetentionAwaitingConfirmation(outcome.awaitingConfirmation);
    await refreshItems();
  }, [refreshItems]);

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
  }, [userId, visitId]);

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
    async ({ clientItemId = null, kind, provenance, body, consentKind, consentSubject, consentForm, aiConfirmed = false }) => {
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
        payload: { kind, provenance, body, consentKind, consentSubject, consentForm, aiConfirmed }
      });
      return id;
    },
    [persist, visitId]
  );

  /** Autosave a captured photo/audio blob locally. */
  const saveLocalAttachment = useCallback(
    async ({ role, blob, consentClientItemId = null, documentOnly = false }) => {
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
        payload: { role, consentClientItemId, documentOnly },
        blob
      });
      return id;
    },
    [persist, visitId]
  );

  const approveItem = useCallback(
    async (clientItemId) => {
      const item = await storeRef.current?.getItem(clientItemId);
      if (!item) return;
      await transition(item, FieldSyncEvent.USER_APPROVED);
      if (navigator.onLine) await runSync();
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

  /** Store the prep pack for offline use ("Võta seadmesse"). */
  const storePack = useCallback(
    async (visit) => {
      const store = storeRef.current;
      if (!store || !visit?.id) return;
      const record = {
        visitId: visit.id,
        takenAt: new Date().toISOString(),
        plannedEndAt: visit.plannedEndAt || null,
        payload: {
          goal: visit.goal,
          locationText: visit.locationText,
          plannedStartAt: visit.plannedStartAt,
          plannedEndAt: visit.plannedEndAt,
          packKeyQuestions: visit.packKeyQuestions || [],
          packSummaryText: visit.packSummaryText || null,
          status: visit.status,
          version: visit.version,
          preInquiryId: visit.preInquiryId || null,
          safety: visit.safety || null
        }
      };
      await store.putPack(record);
      setPack(await store.getPack(visit.id));
    },
    []
  );

  const removePack = useCallback(async () => {
    if (!storeRef.current || !visitId) return;
    await storeRef.current.deletePack(visitId);
    setPack(null);
  }, [visitId]);

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

  return {
    supported,
    online,
    needsLogin,
    syncing,
    items,
    pack,
    pendingCount,
    failedCount,
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
    refreshItems,
    retentionWarnings,
    retentionAwaitingConfirmation,
    acknowledgeWarning,
    confirmPurge
  };
}
