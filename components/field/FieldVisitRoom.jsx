"use client";

/**
 * FIELD-V1 visit mini-room (doc ptk 7.1 areas 2–8): three supportive phases
 * (prep → on site → wrap-up), one-hand quick note with mandatory provenance,
 * consent-gated photo/audio, the "Kontrolli enne saatmist" gate, handover to
 * existing carriers and safe local purge. Everything autosaves to the device;
 * text + checklist always work — camera, voice and OCR are optional inputs
 * with a typing alternative.
 *
 * KUJU (09.10, omaniku reeglid ja välitöö leping FIELD-A0 ptk 7.2). Leht oli
 * üks pikk veerg, kus faasi kõik osad olid üksteise all. Nüüd on igas faasis
 * kaks kuni kolm vaadet ja korraga on ees üks: vaate tegevus on all servas,
 * telefonis pöidla ulatuses. See fail hoiab andmeid, päringuid ja olekut;
 * vaated joonistab `visit/VisitViews.jsx`, jaotus ja väikesed reeglid on
 * `visit/visitViews.js`-is. Kustutamine, tagasivõtmine, sulgemine ja
 * ärajätmine küsivad teist vajutust (`twoPress`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import {
  FIELD_ITEM_STATE,
  FIELD_NOTE_KIND,
  FIELD_PROVENANCE,
  FIELD_PROVENANCES,
  FIELD_VISIT_STATUS
} from "@/lib/field/constants";
import {
  FIELD_MARKER,
  FIELD_MARKER_STATE,
  FIELD_MARKERS
} from "@/lib/field/visitMarkers";
import FieldConnection from "./FieldConnection";
import { useFieldSync } from "./useFieldSync";
import {
  AiDraftView,
  CaptureView,
  ConsentView,
  FinishView,
  HandoverView,
  NoteView,
  PackView,
  ReviewView,
  SafetyView,
  VisitHead,
  VisitTabs
} from "./visit/VisitViews";
import styles from "./visit/visit.module.css";
import {
  VISIT_PHASES,
  availableViews,
  closeAllowed,
  mainViewOf,
  nextConfirm,
  photoAllowed,
  placeAfterLoad,
  recordingClock,
  safetyArmed,
  safetyWarnings
} from "./visit/visitViews";
import { isServiceLogUiEnabled } from "@/lib/serviceLog/flags";
import { mergeVisibleFieldNotes } from "@/lib/field/continuity";
import {
  FIELD_RECORDING_MAX_MS,
  fieldRecordingSeconds,
  nextFieldRecordingChunk
} from "@/lib/field/recordingLimits";

/* Teise vajutuse ootamise aeg: sama mis mujal platvormil. */
const CONFIRM_MS = 8000;

async function compressPhoto(file, maxSide = 1600) {
  // Canvas re-encode both shrinks the photo and drops every EXIF/GPS field
  // client-side; the server strips metadata again as a backstop.
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
}

export default function FieldVisitRoom({ visitId }) {
  const { t } = useI18n();
  const { data: session, status: sessionStatus } = useSession();
  const userId = session?.user?.id || null;
  const role = String(session?.user?.role || "").toUpperCase();
  const allowed = ["ADMIN", "SOCIAL_WORKER", "SERVICE_PROVIDER"].includes(role);

  const sync = useFieldSync({ userId, visitId });
  /* Stabiilne viide: `sync.applyVisitStatus` meetodikutse `loadDetail`-i sees
     nõuaks sõltuvusena kogu `sync`-objekti, mis muutub igal renderdusel. */
  const { applyVisitStatus } = sync;
  const [detail, setDetail] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  /* Kus inimene on: faas ja selle vaade. `picked` ütleb, et inimene valis faasi
     ise; kuni ta seda teinud ei ole, järgib faas külastuse olekut. */
  const [place, setPlace] = useState({ phase: "prep", view: mainViewOf("prep"), picked: false });
  const openPhase = useCallback((phase) => setPlace({ phase, view: mainViewOf(phase), picked: true }), []);
  const openView = useCallback((view) => setPlace((current) => ({ ...current, view, picked: true })), []);
  const [notice, setNotice] = useState(null);

  /* Kustutamine, tagasivõtmine, sulgemine ja ärajätmine küsivad teist vajutust. */
  const [confirming, setConfirming] = useState("");
  const confirmTimer = useRef(0);
  const twoPress = useCallback(
    (key, action) => {
      window.clearTimeout(confirmTimer.current);
      const next = nextConfirm(confirming, key);
      setConfirming(next.confirming);
      if (next.fire) return action();
      confirmTimer.current = window.setTimeout(() => setConfirming(""), CONFIRM_MS);
      return null;
    },
    [confirming]
  );
  useEffect(() => () => window.clearTimeout(confirmTimer.current), []);
  const confirmLabel = (key, label) => (confirming === key ? t("field.confirm.again") : label);

  const [noteBody, setNoteBody] = useState("");
  const [provenance, setProvenance] = useState(FIELD_PROVENANCE.TOOTAJA_TAHELEPANEK);
  const [consentSubject, setConsentSubject] = useState("");
  const [consentKind, setConsentKind] = useState("audio");
  const [clientDocumentRequested, setClientDocumentRequested] = useState(false);
  const [documentRequestReason, setDocumentRequestReason] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingBytesRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef(null);
  const recordingLimitTimerRef = useRef(null);
  const discardRecordingRef = useRef(false);
  const recordingStoppedAtLimitRef = useRef(false);
  const mountedRef = useRef(true);
  const photoInputRef = useRef(null);

  const [safetyDeadline, setSafetyDeadline] = useState("");
  const [safetyEmail, setSafetyEmail] = useState("");
  const [safetyName, setSafetyName] = useState("");
  const [safetyInstructions, setSafetyInstructions] = useState("");

  const [handoverNote, setHandoverNote] = useState("");
  const [handoverArtifact, setHandoverArtifact] = useState(true);
  const [nextContactOn, setNextContactOn] = useState("");
  const [aiDraft, setAiDraft] = useState(null);

  const visit = detail?.visit || null;
  // Stable identity: a bare `|| []` allocates a new array every render, which
  // invalidated the consentFor callback on each pass.
  const serverNotes = useMemo(() => detail?.notes || [], [detail]);
  const attachments = detail?.attachments || [];
  const visibleNotes = useMemo(
    () => mergeVisibleFieldNotes(serverNotes, sync.items),
    [serverNotes, sync.items]
  );
  const deviceReviewItems = useMemo(
    () => sync.items.filter((item) =>
      item.itemType !== "note" || item.state !== FIELD_ITEM_STATE.SYNCED ||
      !serverNotes.some((note) => note.clientItemId === item.clientItemId)
    ),
    [serverNotes, sync.items]
  );

  const loadDetail = useCallback(async () => {
    if (!navigator.onLine) {
      setLoadState(sync.pack ? "offline" : "offline-empty");
      return;
    }
    try {
      const response = await fetch(`/api/field/visits/${encodeURIComponent(visitId)}`);
      if (response.status === 404) {
        setLoadState("not-found");
        return;
      }
      if (!response.ok) throw new Error("load_failed");
      const body = await response.json();
      setDetail(body);
      setLoadState("ready");
      setPlace((current) => placeAfterLoad(current, body?.visit?.status));
      /* SOL-FIELD-02: sulgemine on paketi esimene tähtaeg. Seadmel on ainult see
         olek, mis paketti kirjutades kehtis — värske vastus on ainus koht, kus
         me sulgemisest üldse teada saame (ka siis, kui sulges teine seade). */
      await applyVisitStatus(body?.visit);
    } catch {
      setLoadState(sync.pack ? "offline" : "error");
    }
  }, [visitId, sync.pack, applyVisitStatus]);

  useEffect(() => {
    if (userId && allowed) loadDetail();
  }, [userId, allowed, loadDetail, sync.online]);

  /* SOL-FIELD-04: kogu otsustamine elab `lib/field/visitMarkers.js`-is, sest
     just VASTUSE KÄSITLUS oli katki — teda peab saama mõõta ilma Reactita. */
  const { flushMarkers } = sync;
  const flushAndReload = useCallback(async () => {
    const outcome = await flushMarkers();
    if (outcome?.confirmed?.length) await loadDetail();
  }, [flushMarkers, loadDetail]);

  useEffect(() => {
    if (sync.online) flushAndReload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync.online]);

  const patchVisit = useCallback(
    async (body) => {
      if (!navigator.onLine) {
        setNotice(t("field.errors.needsOnline"));
        return null;
      }
      const version = visit?.version;
      if (!version) return null;
      try {
        const response = await fetch(`/api/field/visits/${encodeURIComponent(visitId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version, ...body })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setNotice(t(payload?.message || "field.errors.saveFailed"));
          if (response.status === 409) loadDetail();
          return null;
        }
        setNotice(null);
        await loadDetail();
        return payload.visit;
      } catch {
        setNotice(t("field.errors.saveFailed"));
        return null;
      }
    },
    [visit, visitId, loadDetail, t]
  );

  const takePack = useCallback(async () => {
    const updated = await patchVisit({ action: "take_pack" });
    if (updated) {
      /* Teadlik võtmine alustab säilituskella otsast — markerite kirjutused
         (`confirmMarker`, `flushMarkers`) EI tohi seda teha, vt `storePack`. */
      await sync.storePack(updated, { retake: true });
      setNotice(t("field.pack.taken"));
    }
  }, [patchVisit, sync, t]);

  const confirmMarker = useCallback(
    async (which) => {
      if (navigator.onLine && visit) {
        await patchVisit({ action: which === "arrival" ? "confirm_arrival" : "confirm_departure" });
        return;
      }
      // Offline: record locally and tell the truth about server state.
      const stored = await sync.recordMarker(which === "arrival" ? FIELD_MARKER.ARRIVAL : FIELD_MARKER.DEPARTURE);
      setNotice(t(stored ? "field.markers.storedOffline" : "field.markers.needsPack"));
    },
    [visit, patchVisit, sync, t]
  );

  const saveNote = useCallback(async () => {
    const body = noteBody.trim();
    if (!body) return;
    await sync.saveLocalNote({ kind: FIELD_NOTE_KIND.NOTE, provenance, body });
    setNoteBody("");
  }, [noteBody, provenance, sync]);

  const saveConsent = useCallback(async () => {
    const subject = consentSubject.trim();
    if (!subject) return;
    await sync.saveLocalNote({
      kind: FIELD_NOTE_KIND.CONSENT,
      provenance: FIELD_PROVENANCE.KLIENDI_OELDUD,
      body: t("field.consent.recordBody").replace("{kind}", t(`field.consent.kind.${consentKind}`)),
      consentKind,
      consentSubject: subject,
      consentForm: "suuline"
    });
    setConsentSubject("");
    setNotice(t("field.consent.saved"));
  }, [consentSubject, consentKind, sync, t]);

  const localConsents = useMemo(
    () =>
      sync.items.filter(
        (item) => item.itemType === "note" && item.payload?.kind === FIELD_NOTE_KIND.CONSENT
      ),
    [sync.items]
  );
  const consentFor = useCallback(
    (kind) =>
      localConsents.find((item) => item.payload?.consentKind === kind)?.clientItemId ||
      serverNotes.find((note) => note.kind === "consent" && note.consentKind === kind && !note.consentWithdrawnAt)
        ?.clientItemId ||
      null,
    [localConsents, serverNotes]
  );

  const onPhotoPicked = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const consentRef = consentFor("photo");
      try {
        const reason = documentRequestReason.trim();
        if (!consentRef && (!clientDocumentRequested || !reason)) {
          setNotice(t("field.photo.basisRequired"));
          return;
        }
        const blob = await compressPhoto(file);
        if (!blob) throw new Error("compress_failed");
        await sync.saveLocalAttachment({
          role: "photo",
          blob,
          consentClientItemId: consentRef,
          documentOnly: !consentRef,
          documentRequestConfirmed: !consentRef && clientDocumentRequested,
          documentRequestReason: !consentRef ? reason : null
        });
        if (!consentRef) {
          setClientDocumentRequested(false);
          setDocumentRequestReason("");
        }
        setNotice(t("field.photo.saved"));
      } catch {
        setNotice(t("field.photo.failed"));
      }
    },
    [clientDocumentRequested, consentFor, documentRequestReason, sync, t]
  );

  const startRecording = useCallback(async () => {
    if (recording) return;
    if (!consentFor("audio")) {
      setNotice(t("field.audio.consentFirst"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
        (candidate) => window.MediaRecorder?.isTypeSupported?.(candidate)
      );
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recordingBytesRef.current = 0;
      discardRecordingRef.current = false;
      recordingStoppedAtLimitRef.current = false;
      recordingStartedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (!event.data?.size) return;
        const next = nextFieldRecordingChunk(recordingBytesRef.current, event.data.size);
        if (next.accept) {
          chunksRef.current.push(event.data);
          recordingBytesRef.current = next.totalBytes;
        }
        if (next.limitReached && recorder.state !== "inactive") {
          recordingStoppedAtLimitRef.current = true;
          recorder.stop();
          stream.getTracks().forEach((track) => track.stop());
          if (mountedRef.current) setNotice(t("field.audio.limitReached"));
        }
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        if (recordingLimitTimerRef.current) window.clearTimeout(recordingLimitTimerRef.current);
        recordingTimerRef.current = null;
        recordingLimitTimerRef.current = null;
        if (discardRecordingRef.current) {
          chunksRef.current = [];
          recordingBytesRef.current = 0;
          if (mountedRef.current) {
            setRecording(false);
            setRecordingSeconds(0);
          }
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size) {
          await sync.saveLocalAttachment({
            role: "audio",
            blob,
            consentClientItemId: consentFor("audio")
          });
          if (mountedRef.current) {
            setNotice(t(recordingStoppedAtLimitRef.current ? "field.audio.limitReached" : "field.audio.saved"));
          }
        }
        if (mountedRef.current) {
          setRecording(false);
          setRecordingSeconds(0);
        }
      };
      recorder.onerror = () => {
        discardRecordingRef.current = true;
        stream.getTracks().forEach((track) => track.stop());
        if (recorder.state !== "inactive") recorder.stop();
        if (mountedRef.current) setNotice(t("field.audio.failed"));
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      recordingTimerRef.current = window.setInterval(() => {
        if (mountedRef.current) {
          setRecordingSeconds(fieldRecordingSeconds(Date.now() - recordingStartedAtRef.current));
        }
      }, 1000);
      recordingLimitTimerRef.current = window.setTimeout(() => {
        recordingStoppedAtLimitRef.current = true;
        if (recorder.state !== "inactive") recorder.stop();
        stream.getTracks().forEach((track) => track.stop());
        if (mountedRef.current) setNotice(t("field.audio.limitReached"));
      }, FIELD_RECORDING_MAX_MS);
      setRecording(true);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setNotice(t("field.audio.failed"));
      setRecording(false);
    }
  }, [recording, consentFor, sync, t]);

  const stopRecording = useCallback(() => {
    try {
      recorderRef.current?.stop();
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setRecording(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const stopHiddenRecording = () => {
      discardRecordingRef.current = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
    };
    const stopWhenHidden = () => {
      if (document.hidden) stopHiddenRecording();
    };
    window.addEventListener("pagehide", stopHiddenRecording);
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("pagehide", stopHiddenRecording);
      document.removeEventListener("visibilitychange", stopWhenHidden);
      stopHiddenRecording();
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      if (recordingLimitTimerRef.current) window.clearTimeout(recordingLimitTimerRef.current);
    };
  }, []);

  const armSafety = useCallback(async () => {
    if (!safetyDeadline || !safetyEmail.trim()) {
      setNotice(t("field.safety.fillRequired"));
      return;
    }
    const updated = await patchVisit({
      action: "arm_safety",
      deadlineAt: new Date(safetyDeadline).toISOString(),
      contactEmail: safetyEmail.trim(),
      contactName: safetyName.trim() || null,
      instructions: safetyInstructions.trim() || null
    });
    if (updated) setNotice(t("field.safety.armed"));
  }, [safetyDeadline, safetyEmail, safetyName, safetyInstructions, patchVisit, t]);

  const runOcr = useCallback(
    async (clientItemId) => {
      try {
        const response = await fetch(
          `/api/field/visits/${encodeURIComponent(visitId)}/attachments/${encodeURIComponent(clientItemId)}/ocr`,
          { method: "POST" }
        );
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setNotice(t(body?.message || "field.errors.ocrFailed"));
          return;
        }
        setAiDraft({ source: "ocr", clientItemId, text: body.draft || "" });
        setPlace({ phase: "follow_up", view: "aiDraft", picked: true });
      } catch {
        setNotice(t("field.errors.ocrFailed"));
      }
    },
    [visitId, t]
  );

  const runTranscribe = useCallback(
    async (attachment) => {
      if (!attachment.documentId) return;
      try {
        const response = await fetch(`/api/documents/${encodeURIComponent(attachment.documentId)}/transcribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Allika id on kavatsuse võti: kordus ei võta teist korda STT-mahtu.
          body: JSON.stringify({ idempotencyKey: attachment.documentId })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setNotice(t(body?.message || "field.errors.transcribeFailed"));
          return;
        }
        setAiDraft({
          source: "transcript",
          clientItemId: attachment.clientItemId,
          text: body?.transcriptDocument?.content || ""
        });
        setPlace({ phase: "follow_up", view: "aiDraft", picked: true });
      } catch {
        setNotice(t("field.errors.transcribeFailed"));
      }
    },
    [t]
  );

  const confirmAiDraft = useCallback(async () => {
    if (!aiDraft?.text?.trim()) {
      setAiDraft(null);
      return;
    }
    /* SOL-FIELD-05: ÜKS toiming, mitte kaks. Transkripti kinnitus rändab kaasa
       märkme endaga ja server käivitab toorheli kella samas tehingus, kus ta
       teksti vastu võtab. Varem läks kinnitus eraldi päringuga, mille viga
       neelati vaikselt, ja eduteade anti alati — ka siis, kui toorheli jäi
       kustutamata. */
    const id = await sync.saveLocalNote({
      kind: FIELD_NOTE_KIND.NOTE,
      provenance: FIELD_PROVENANCE.AI_MUSTAND,
      body: aiDraft.text.trim(),
      aiConfirmed: true,
      transcriptClientItemId: aiDraft.source === "transcript" ? aiDraft.clientItemId : null
    });
    if (!id) {
      setNotice(t("field.errors.saveFailed"));
      return;
    }
    const settled = await sync.approveItem(id);
    setAiDraft(null);
    /* Eduteade AINULT serveri 2xx järel. Järjekorda jäänud kirje on ausalt
       „saadetakse", tõrge on ausalt tõrge — mõlemad on kasutajale nähtavad ka
       kirje enda seisus, mille kest niikuinii kuvab. */
    if (settled?.state === FIELD_ITEM_STATE.SYNCED) setNotice(t("field.ai.confirmed"));
    else if (settled?.state === FIELD_ITEM_STATE.FAILED || settled?.state === FIELD_ITEM_STATE.CONFLICT) {
      setNotice(t("field.ai.confirmFailed"));
    } else setNotice(t("field.ai.confirmQueued"));
  }, [aiDraft, sync, t]);

  const doHandover = useCallback(async () => {
    if (!navigator.onLine) {
      setNotice(t("field.errors.needsOnline"));
      return;
    }
    const payload = {
      toArtifact: handoverArtifact,
      noteClientItemIds: visibleNotes
        .filter((note) => note.source === "server")
        .map((note) => note.clientItemId)
    };
    if (handoverNote.trim() && visit?.preInquiryId) {
      payload.toPreInquiry = true;
      payload.preInquiryNote = handoverNote.trim();
      if (nextContactOn) payload.nextContactOn = nextContactOn;
    }
    if (!payload.toArtifact && !payload.toPreInquiry) {
      setNotice(t("field.handover.pickTarget"));
      return;
    }
    try {
      const actionStorageKey = `field:handover:${visitId}`;
      const fingerprint = JSON.stringify(payload);
      let savedAction = null;
      try {
        savedAction = JSON.parse(window.localStorage.getItem(actionStorageKey) || "null");
      } catch {}
      const clientActionId = savedAction?.fingerprint === fingerprint && savedAction?.clientActionId
        ? savedAction.clientActionId
        : crypto.randomUUID();
      window.localStorage.setItem(actionStorageKey, JSON.stringify({ fingerprint, clientActionId }));
      const response = await fetch(`/api/field/visits/${encodeURIComponent(visitId)}/handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, clientActionId })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(t(body?.message || "field.errors.handoverFailed"));
        return;
      }
      const targets = body?.handover?.targets || {};
      const requestedDone = (!payload.toArtifact || targets.artifact?.status === "DONE")
        && (!payload.toPreInquiry || targets.preInquiry?.status === "DONE");
      if (requestedDone) {
        window.localStorage.removeItem(actionStorageKey);
        setNotice(t("field.handover.done"));
      } else {
        setNotice(t("field.handover.pending"));
      }
      await loadDetail();
    } catch {
      setNotice(t("field.errors.handoverFailed"));
    }
  }, [handoverArtifact, handoverNote, nextContactOn, visit, visitId, loadDetail, t, visibleNotes]);

  const removeServerNote = useCallback(async (note) => {
    const url = `/api/field/visits/${encodeURIComponent(visitId)}/items/${encodeURIComponent(note.clientItemId)}`;
    const response = await fetch(url, note.kind === FIELD_NOTE_KIND.CONSENT
      ? {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ withdrawConsent: true })
        }
      : { method: "DELETE" });
    if (response.ok) await loadDetail();
    else setNotice(t("field.errors.deleteFailed"));
  }, [visitId, loadDetail, t]);

  const removeAttachment = useCallback(async (attachment) => {
    const response = await fetch(
      `/api/field/visits/${encodeURIComponent(visitId)}/attachments/${encodeURIComponent(attachment.clientItemId)}`,
      { method: "DELETE" }
    );
    if (response.ok) loadDetail();
    else setNotice(t("field.errors.deleteFailed"));
  }, [visitId, loadDetail, t]);

  /* Seadme üksuse tegevused (nimed annab `deviceItemActions`). */
  const onItemAction = (item, action) => {
    const id = item.clientItemId;
    if (action === "approve") return sync.approveItem(id);
    if (action === "retry") return sync.retryItem(id);
    if (action === "recovery") return sync.retryRecoveryImport(id);
    if (action === "cancel") return sync.cancelItem(id);
    /* Kumbki valik kirjutab teise versiooni teksti üle: see küsib teist vajutust. */
    if (action === "keepDevice") return twoPress(`conflict:${id}:device`, () => sync.resolveConflict(id, "device"));
    if (action === "keepServer") return twoPress(`conflict:${id}:server`, () => sync.resolveConflict(id, "server"));
    if (action === "remove") return twoPress(`item:${id}`, () => sync.deleteItem(id));
    return null;
  };

  const purgeLocal = useCallback(async () => {
    for (const item of sync.items) {
      if (item.state === FIELD_ITEM_STATE.SYNCED) await sync.deleteItem(item.clientItemId);
    }
    await sync.removePack();
    setNotice(t("field.purge.done"));
  }, [sync, t]);

  /* Lehe raam annab main-elemendi; siin on tavaline plokk. Lehe pealkiri on ainult
     ekraanilugejale, kuni külastus on laetud (siis on pealkiri külastuse eesmärk). */
  const srTitle = <h1 className="sr-only">{t("field.meta.visitTitle")}</h1>;

  if (sessionStatus === "loading") {
    return <div className={styles.page}><p className={styles.quiet}>{t("field.loading")}</p></div>;
  }
  if (!userId || !allowed) {
    return (
      <div className={styles.page}>
        {srTitle}
        <p className={styles.quiet}>{userId ? t("field.roleRequired") : t("field.loginRequired")}</p>
      </div>
    );
  }
  if (loadState === "not-found") {
    return (
      <div className={styles.page}>
        {srTitle}
        <p className={styles.quiet}>{t("field.errors.notFound")}</p>
      </div>
    );
  }

  const offline = !sync.online;
  const packView = sync.pack?.payload || null;
  const markerList = FIELD_MARKERS.map((which) => sync.markers[which]).filter(Boolean);
  const failedMarkers = markerList.filter((marker) => marker.state === FIELD_MARKER_STATE.FAILED);
  const pendingMarkers = markerList.filter((marker) => marker.state !== FIELD_MARKER_STATE.FAILED);
  const view = visit || packView;
  const readOnly = view?.status === FIELD_VISIT_STATUS.CLOSED || view?.status === FIELD_VISIT_STATUS.CANCELLED;

  const armed = safetyArmed(view?.safety);
  const deadlineText = view?.safety?.deadlineAt ? new Date(view.safety.deadlineAt).toLocaleString() : "—";
  const views = availableViews(place.phase, { readOnly, hasVisit: Boolean(visit), hasDraft: Boolean(aiDraft) });
  const currentView = views.includes(place.view) ? place.view : views[0];
  const canChange = !readOnly && Boolean(visit);

  return (
    <div className={styles.page}>
      {/* Ühenduse seis on kiirmenüüs ja vajadusel teatena sisu alguses; varem
          oli see kleepuv riba, mis kerides jäi sisu peale (kujundusaudit K04). */}
      <FieldConnection t={t} online={!offline} pendingCount={sync.pendingCount} failedCount={sync.failedCount} />

      {!view ? srTitle : null}
      {loadState === "loading" && !view ? <p className={styles.quiet}>{t("field.loading")}</p> : null}
      {loadState === "offline-empty" && !view ? (
        <p className={styles.warn}>{t("field.errors.offlineNoPack")}</p>
      ) : null}
      {loadState === "error" && !view ? (
        <div className={styles.alert} role="alert">
          <p>{t("field.errors.loadFailed")}</p>
          <Button variant="secondary" size="sm" onClick={loadDetail}>{t("field.retry")}</Button>
        </div>
      ) : null}

      {/* Faili valija on peidetud ja elab lehel, et see ei kaoks vaate vahetusel. */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onPhotoPicked}
        aria-hidden="true"
        tabIndex={-1}
      />

      {view ? (
        <>
          <VisitHead t={t} view={view} stale={Boolean(visit?.packStale)} armed={armed} />

          {/* `aria-live`, mitte status-roll: ühine lehekiht joonistab iga
              status-rolliga elemendi teatekastina. Element on alati lehel ja
              muutub ainult selle tekst: koos tekstiga tekkivat teadet
              ekraanilugeja sageli välja ei ütle. */}
          <p className={notice ? styles.notice : "sr-only"} aria-live="polite">{notice || ""}</p>

          {/* Käimasolev helisalvestus on näha ja peatatav igas vaates: mikrofon
              ei tohi jääda sisse nii, et lõpetamise nupp on teise vaate taga. */}
          {recording && currentView !== "capture" ? (
            <div className={styles.recording}>
              <span className={styles.recordingDot} aria-hidden="true" />
              <span className={styles.recordingText}>
                {t("field.audio.recording")} · {recordingClock(recordingSeconds)}
              </span>
              <Button variant="secondary" size="sm" onClick={stopRecording}>{t("field.audio.stop")}</Button>
            </div>
          ) : null}

          <VisitTabs
            t={t}
            phases={VISIT_PHASES}
            phase={place.phase}
            onPhase={openPhase}
            views={views}
            current={currentView}
            onView={openView}
          />

          <div className={styles.view}>
            {currentView === "aiDraft" && aiDraft ? (
              <AiDraftView
                t={t}
                text={aiDraft.text}
                onText={(text) => setAiDraft({ ...aiDraft, text })}
                onConfirm={confirmAiDraft}
                onDiscard={() => twoPress("draft", () => setAiDraft(null))}
                discardLabel={confirmLabel("draft", t("field.ai.discard"))}
              />
            ) : currentView === "pack" ? (
              <PackView
                t={t}
                view={view}
                canTake={canChange}
                hasPack={Boolean(sync.pack)}
                offline={offline}
                onTake={takePack}
              />
            ) : currentView === "safety" ? (
              <SafetyView
                t={t}
                armed={armed}
                deadlineText={deadlineText}
                warnings={safetyWarnings(view.safety)}
                form={{ deadline: safetyDeadline, email: safetyEmail, name: safetyName, instructions: safetyInstructions }}
                onForm={(patch) => {
                  if ("deadline" in patch) setSafetyDeadline(patch.deadline);
                  if ("email" in patch) setSafetyEmail(patch.email);
                  if ("name" in patch) setSafetyName(patch.name);
                  if ("instructions" in patch) setSafetyInstructions(patch.instructions);
                }}
                offline={offline}
                onArm={armSafety}
                onCancel={() => twoPress("cancel-safety", () => patchVisit({ action: "cancel_safety" }))}
                cancelLabel={confirmLabel("cancel-safety", t("field.safety.cancel"))}
              />
            ) : currentView === "note" ? (
              <NoteView
                t={t}
                readOnly={readOnly}
                offline={offline}
                arrived={Boolean(visit?.arrivedConfirmedAt) || Boolean(sync.markers.arrival)}
                departed={Boolean(visit?.departedConfirmedAt) || Boolean(sync.markers.departure)}
                onMarker={confirmMarker}
                failedReason={failedMarkers.length ? failedMarkers[0].reason || "server" : ""}
                markersPending={pendingMarkers.length > 0}
                onRetryMarkers={flushAndReload}
                body={noteBody}
                onBody={setNoteBody}
                provenance={provenance}
                onProvenance={setProvenance}
                provenanceOptions={FIELD_PROVENANCES.filter((value) => value !== FIELD_PROVENANCE.AI_MUSTAND).map((value) => ({
                  value,
                  label: t(`field.provenance.${value}`)
                }))}
                onSave={saveNote}
              />
            ) : currentView === "capture" ? (
              <CaptureView
                t={t}
                readOnly={readOnly}
                photoEnabled={photoAllowed({
                  readOnly,
                  hasConsent: Boolean(consentFor("photo")),
                  documentRequested: clientDocumentRequested,
                  reason: documentRequestReason
                })}
                onPhoto={() => photoInputRef.current?.click()}
                recording={recording}
                recordingSeconds={recordingSeconds}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                needsBasis={!consentFor("photo")}
                documentRequested={clientDocumentRequested}
                onDocumentRequested={setClientDocumentRequested}
                reason={documentRequestReason}
                onReason={setDocumentRequestReason}
              />
            ) : currentView === "consent" ? (
              <ConsentView
                t={t}
                readOnly={readOnly}
                kind={consentKind}
                onKind={setConsentKind}
                subject={consentSubject}
                onSubject={setConsentSubject}
                onSave={saveConsent}
              />
            ) : currentView === "review" ? (
              <ReviewView
                t={t}
                readOnly={readOnly}
                offline={offline}
                serverNotes={visibleNotes.filter((note) => note.source === "server")}
                deviceItems={deviceReviewItems}
                attachments={attachments}
                confirmLabel={confirmLabel}
                onRemoveServerNote={(note) => twoPress(`note:${note.clientItemId}`, () => removeServerNote(note))}
                onItemAction={onItemAction}
                onOcr={(attachment) => runOcr(attachment.clientItemId)}
                onTranscribe={runTranscribe}
                onRemoveAttachment={(attachment) => twoPress(`att:${attachment.clientItemId}`, () => removeAttachment(attachment))}
              />
            ) : currentView === "handover" ? (
              <HandoverView
                t={t}
                offline={offline}
                toArtifact={handoverArtifact}
                onToArtifact={setHandoverArtifact}
                hasPreInquiry={Boolean(visit?.preInquiryId)}
                note={handoverNote}
                onNote={setHandoverNote}
                nextContactOn={nextContactOn}
                onNextContactOn={setNextContactOn}
                alreadyDone={Boolean(visit?.handoverArtifactAt || visit?.handoverPreInquiryAt)}
                onSend={doHandover}
              />
            ) : (
              <FinishView
                t={t}
                canChange={canChange}
                closeEnabled={canChange && closeAllowed({ offline, blocked: sync.closeBlockers.blocked, status: visit.status })}
                closeBlocked={sync.closeBlockers.blocked}
                offline={offline}
                closeLabel={confirmLabel("close-visit", t("field.visit.close"))}
                cancelLabel={confirmLabel("cancel-visit", t("field.visit.cancel"))}
                purgeLabel={confirmLabel("purge", t("field.purge.run"))}
                onClose={() => twoPress("close-visit", () => patchVisit({ action: "close" }))}
                onCancelVisit={() => twoPress("cancel-visit", () => patchVisit({ action: "cancel_visit" }))}
                onPurge={() => twoPress("purge", purgeLocal)}
                serviceEntryHref={
                  isServiceLogUiEnabled() && visit?.closedAt ? `/teenuspaevik?visit=${encodeURIComponent(visit.id)}` : ""
                }
              />
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
