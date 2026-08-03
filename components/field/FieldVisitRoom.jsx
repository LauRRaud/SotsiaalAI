"use client";

/**
 * FIELD-V1 visit mini-room (doc ptk 7.1 areas 2–8): three supportive phases
 * (prep → on site → wrap-up), one-hand quick note with mandatory provenance,
 * consent-gated photo/audio, the "Kontrolli enne saatmist" gate, handover to
 * existing carriers and safe local purge. Everything autosaves to the device;
 * text + checklist always work — camera, voice and OCR are optional inputs
 * with a typing alternative.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import {
  FIELD_ITEM_STATE,
  FIELD_NOTE_KIND,
  FIELD_PROVENANCE,
  FIELD_PROVENANCES,
  FIELD_VISIT_STATUS
} from "@/lib/field/constants";
import { useFieldSync } from "./useFieldSync";
import { isServiceLogUiEnabled } from "@/lib/serviceLog/flags";

const PHASES = ["prep", "on_site", "follow_up"];

function phaseForStatus(status) {
  if (status === FIELD_VISIT_STATUS.IN_PROGRESS) return "on_site";
  if (status === FIELD_VISIT_STATUS.WRAP_UP || status === FIELD_VISIT_STATUS.CLOSED) return "follow_up";
  return "prep";
}

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
  const [detail, setDetail] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [phase, setPhase] = useState("prep");
  const [notice, setNotice] = useState(null);

  const [noteBody, setNoteBody] = useState("");
  const [provenance, setProvenance] = useState(FIELD_PROVENANCE.TOOTAJA_TAHELEPANEK);
  const [consentSubject, setConsentSubject] = useState("");
  const [consentKind, setConsentKind] = useState("audio");
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
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
      setPhase((current) => (current === "prep" ? phaseForStatus(body?.visit?.status) : current));
    } catch {
      setLoadState(sync.pack ? "offline" : "error");
    }
  }, [visitId, sync.pack]);

  useEffect(() => {
    if (userId && allowed) loadDetail();
  }, [userId, allowed, loadDetail, sync.online]);

  // Offline arrival/departure markers flush once the network returns.
  const flushMarkers = useCallback(async () => {
    if (!navigator.onLine || !sync.pack?.payload) return;
    const markers = sync.pack.payload;
    for (const [flag, action] of [
      ["localArrivalAt", "confirm_arrival"],
      ["localDepartureAt", "confirm_departure"]
    ]) {
      if (!markers[flag]) continue;
      try {
        const fresh = await fetch(`/api/field/visits/${encodeURIComponent(visitId)}`).then((r) => r.json());
        if (!fresh?.visit) return;
        const already = action === "confirm_arrival" ? fresh.visit.arrivedConfirmedAt : fresh.visit.departedConfirmedAt;
        if (!already) {
          await fetch(`/api/field/visits/${encodeURIComponent(visitId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, version: fresh.visit.version })
          });
        }
        const nextPayload = { ...markers };
        delete nextPayload[flag];
        await sync.storePack({ ...fresh.visit, ...nextPayload, id: visitId });
      } catch {}
    }
    loadDetail();
  }, [visitId, sync, loadDetail]);

  useEffect(() => {
    if (sync.online) flushMarkers();
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
      await sync.storePack(updated);
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
      const markers = sync.pack?.payload || {};
      const key = which === "arrival" ? "localArrivalAt" : "localDepartureAt";
      await sync.storePack({
        id: visitId,
        ...markers,
        [key]: new Date().toISOString(),
        plannedEndAt: sync.pack?.plannedEndAt || null
      });
      setNotice(t("field.markers.storedOffline"));
    },
    [visit, patchVisit, sync, visitId, t]
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
        const blob = await compressPhoto(file);
        if (!blob) throw new Error("compress_failed");
        await sync.saveLocalAttachment({
          role: "photo",
          blob,
          consentClientItemId: consentRef,
          documentOnly: !consentRef
        });
        setNotice(t("field.photo.saved"));
      } catch {
        setNotice(t("field.photo.failed"));
      }
    },
    [consentFor, sync, t]
  );

  const startRecording = useCallback(async () => {
    if (recording) return;
    if (!consentFor("audio")) {
      setNotice(t("field.audio.consentFirst"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
        (candidate) => window.MediaRecorder?.isTypeSupported?.(candidate)
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size) {
          await sync.saveLocalAttachment({
            role: "audio",
            blob,
            consentClientItemId: consentFor("audio")
          });
          setNotice(t("field.audio.saved"));
        }
        setRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setNotice(t("field.audio.failed"));
      setRecording(false);
    }
  }, [recording, consentFor, sync, t]);

  const stopRecording = useCallback(() => {
    try {
      recorderRef.current?.stop();
    } catch {
      setRecording(false);
    }
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
          method: "POST"
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
    const id = await sync.saveLocalNote({
      kind: FIELD_NOTE_KIND.NOTE,
      provenance: FIELD_PROVENANCE.AI_MUSTAND,
      body: aiDraft.text.trim(),
      aiConfirmed: true
    });
    if (id) await sync.approveItem(id);
    if (aiDraft.source === "transcript") {
      await fetch(
        `/api/field/visits/${encodeURIComponent(visitId)}/attachments/${encodeURIComponent(aiDraft.clientItemId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmTranscript: true })
        }
      ).catch(() => {});
    }
    setAiDraft(null);
    setNotice(t("field.ai.confirmed"));
  }, [aiDraft, sync, visitId, t]);

  const doHandover = useCallback(async () => {
    if (!navigator.onLine) {
      setNotice(t("field.errors.needsOnline"));
      return;
    }
    const payload = { toArtifact: handoverArtifact };
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
      const response = await fetch(`/api/field/visits/${encodeURIComponent(visitId)}/handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(t(body?.message || "field.errors.handoverFailed"));
        return;
      }
      setNotice(t("field.handover.done"));
      await loadDetail();
    } catch {
      setNotice(t("field.errors.handoverFailed"));
    }
  }, [handoverArtifact, handoverNote, nextContactOn, visit, visitId, loadDetail, t]);

  const purgeLocal = useCallback(async () => {
    for (const item of sync.items) {
      if (item.state === FIELD_ITEM_STATE.SYNCED) await sync.deleteItem(item.clientItemId);
    }
    await sync.removePack();
    setNotice(t("field.purge.done"));
  }, [sync, t]);

  if (sessionStatus === "loading") {
    return <main className="fld-page"><p className="fld-muted">{t("field.loading")}</p></main>;
  }
  if (!userId || !allowed) {
    return (
      <main className="fld-page">
        <h1 className="fld-title">{t("field.title")}</h1>
        <p className="fld-muted">{userId ? t("field.roleRequired") : t("field.loginRequired")}</p>
      </main>
    );
  }
  if (loadState === "not-found") {
    return (
      <main className="fld-page">
        <h1 className="fld-title">{t("field.title")}</h1>
        <p className="fld-muted">{t("field.errors.notFound")}</p>
      </main>
    );
  }

  const offline = !sync.online;
  const packView = sync.pack?.payload || null;
  const view = visit || packView;
  const readOnly = view?.status === FIELD_VISIT_STATUS.CLOSED || view?.status === FIELD_VISIT_STATUS.CANCELLED;

  return (
    <main className="fld-page fld-page--visit">
      <div
        className={`fld-connection ${offline ? "fld-connection--offline" : "fld-connection--online"}`}
        role="status"
        aria-live="polite"
      >
        {offline
          ? t("field.sync.offline")
          : sync.pendingCount
            ? t("field.sync.onlinePending").replace("{count}", String(sync.pendingCount))
            : t("field.sync.online")}
        {sync.failedCount ? ` · ${t("field.sync.failed").replace("{count}", String(sync.failedCount))}` : ""}
      </div>

      {loadState === "loading" && !view ? <p className="fld-muted">{t("field.loading")}</p> : null}
      {loadState === "offline-empty" && !view ? (
        <p className="fld-warn">{t("field.errors.offlineNoPack")}</p>
      ) : null}
      {loadState === "error" && !view ? (
        <div className="fld-error" role="alert">
          <p>{t("field.errors.loadFailed")}</p>
          <Button variant="secondary" size="sm" onClick={loadDetail}>{t("field.retry")}</Button>
        </div>
      ) : null}

      {view ? (
        <>
          <header className="fld-visit-head">
            <h1 className="fld-title">{view.goal || t("field.visit.untitled")}</h1>
            <p className="fld-muted">
              {t(`field.status.${view.status || "DRAFT"}`)}
              {view.locationText ? ` · ${view.locationText}` : ""}
              {visit?.packStale ? ` · ${t("field.pack.stale")}` : ""}
            </p>
          </header>

          {notice ? (
            <p className="fld-notice" role="status">{notice}</p>
          ) : null}

          <nav className="fld-phases" aria-label={t("field.phases.label")}>
            {PHASES.map((key) => (
              <button
                key={key}
                type="button"
                className={`fld-phase ${phase === key ? "fld-phase--active" : ""}`}
                aria-current={phase === key ? "step" : undefined}
                onClick={() => setPhase(key)}
              >
                {t(`field.phase.${key}`)}
              </button>
            ))}
          </nav>

          {phase === "prep" ? (
            <section className="fld-section" aria-label={t("field.phase.prep")}>
              {(view.packKeyQuestions || []).length ? (
                <>
                  <h2 className="fld-h2">{t("field.pack.questions")}</h2>
                  <ul className="fld-plain-list">
                    {(view.packKeyQuestions || []).map((question, index) => (
                      <li key={index}>{question}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {view.packSummaryText ? (
                <>
                  <h2 className="fld-h2">{t("field.pack.summary")}</h2>
                  <p className="fld-body-text">{view.packSummaryText}</p>
                </>
              ) : null}
              {!readOnly && visit ? (
                <div className="fld-actions">
                  <Button onClick={takePack} disabled={offline}>
                    {sync.pack ? t("field.pack.refresh") : t("field.pack.take")}
                  </Button>
                </div>
              ) : null}
              {sync.pack ? <p className="fld-hint">{t("field.pack.onDevice")}</p> : null}
              {offline && !sync.pack ? <p className="fld-hint">{t("field.pack.needsOnline")}</p> : null}

              {!readOnly ? (
                <div className="fld-safety">
                  <h2 className="fld-h2">{t("field.safety.title")}</h2>
                  {view.safety?.armedAt && !view.safety?.cancelledAt ? (
                    <>
                      <p className="fld-body-text">
                        {t("field.safety.armedUntil").replace(
                          "{time}",
                          view.safety.deadlineAt ? new Date(view.safety.deadlineAt).toLocaleString() : "—"
                        )}
                      </p>
                      {view.safety.escalatedAt ? (
                        <p className="fld-warn">{t("field.safety.escalated")}</p>
                      ) : null}
                      {view.safety.escalationStatus === "FAILED" ? (
                        <p className="fld-warn">{t("field.safety.escalationFailed")}</p>
                      ) : null}
                      <Button variant="secondary" onClick={() => patchVisit({ action: "cancel_safety" })} disabled={offline}>
                        {t("field.safety.cancel")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="fld-hint">{t("field.safety.explain")}</p>
                      <p className="fld-hint fld-hint--strong">{t("field.safety.notEmergency")}</p>
                      <label className="fld-label" htmlFor="fld-safety-deadline">{t("field.safety.deadline")}</label>
                      <Input
                        id="fld-safety-deadline"
                        type="datetime-local"
                        className="fld-input"
                        value={safetyDeadline}
                        onChange={(event) => setSafetyDeadline(event.target.value)}
                      />
                      <label className="fld-label" htmlFor="fld-safety-email">{t("field.safety.contactEmail")}</label>
                      <Input
                        id="fld-safety-email"
                        type="email"
                        className="fld-input"
                        value={safetyEmail}
                        onChange={(event) => setSafetyEmail(event.target.value)}
                        autoComplete="off"
                      />
                      <label className="fld-label" htmlFor="fld-safety-name">{t("field.safety.contactName")}</label>
                      <Input
                        id="fld-safety-name"
                        className="fld-input"
                        value={safetyName}
                        onChange={(event) => setSafetyName(event.target.value)}
                        autoComplete="off"
                      />
                      <label className="fld-label" htmlFor="fld-safety-note">{t("field.safety.instructions")}</label>
                      <textarea
                        id="fld-safety-note"
                        className="fld-input"
                        rows={2}
                        value={safetyInstructions}
                        onChange={(event) => setSafetyInstructions(event.target.value)}
                      />
                      <Button onClick={armSafety} disabled={offline}>{t("field.safety.arm")}</Button>
                      {offline ? <p className="fld-hint">{t("field.safety.needsOnline")}</p> : null}
                    </>
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          {phase === "on_site" ? (
            <section className="fld-section" aria-label={t("field.phase.on_site")}>
              <div className="fld-actions">
                <Button
                  variant="secondary"
                  onClick={() => confirmMarker("arrival")}
                  disabled={readOnly || Boolean(visit?.arrivedConfirmedAt)}
                >
                  {visit?.arrivedConfirmedAt || packView?.localArrivalAt
                    ? t("field.markers.arrived")
                    : t("field.markers.confirmArrival")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => confirmMarker("departure")}
                  disabled={readOnly || Boolean(visit?.departedConfirmedAt)}
                >
                  {visit?.departedConfirmedAt || packView?.localDepartureAt
                    ? t("field.markers.departed")
                    : t("field.markers.confirmDeparture")}
                </Button>
              </div>
              {packView?.localArrivalAt || packView?.localDepartureAt ? (
                <p className="fld-hint">{t("field.markers.pendingSync")}</p>
              ) : null}

              <div className="fld-composer">
                <h2 className="fld-h2">{t("field.note.title")}</h2>
                <label className="fld-label" htmlFor="fld-note">{t("field.note.body")}</label>
                <textarea
                  id="fld-note"
                  className="fld-input fld-input--note"
                  rows={3}
                  value={noteBody}
                  onChange={(event) => setNoteBody(event.target.value)}
                  disabled={readOnly}
                />
                <label className="fld-label" htmlFor="fld-provenance">{t("field.note.provenance")}</label>
                <Dropdown
                  id="fld-provenance"
                  className="fld-input"
                  value={provenance}
                  onChange={setProvenance}
                  ariaLabel={t("field.note.provenance")}
                  options={FIELD_PROVENANCES.filter((value) => value !== FIELD_PROVENANCE.AI_MUSTAND).map((value) => ({
                    value,
                    label: t(`field.provenance.${value}`)
                  }))}
                />
                <Button fullWidth onClick={saveNote} disabled={readOnly || !noteBody.trim()}>
                  {t("field.note.save")}
                </Button>
              </div>

              <div className="fld-inputsbar">
                <h2 className="fld-h2">{t("field.inputs.title")}</h2>
                <p className="fld-hint">{t("field.inputs.alternative")}</p>
                <div className="fld-actions">
                  <Button variant="secondary" onClick={() => photoInputRef.current?.click()} disabled={readOnly}>
                    {t("field.photo.take")}
                  </Button>
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
                  {recording ? (
                    <Button variant="secondary" onClick={stopRecording}>{t("field.audio.stop")}</Button>
                  ) : (
                    <Button variant="secondary" onClick={startRecording} disabled={readOnly}>
                      {t("field.audio.start")}
                    </Button>
                  )}
                </div>
                <p className="fld-hint">{t("field.photo.policy")}</p>
              </div>

              <div className="fld-consent">
                <h2 className="fld-h2">{t("field.consent.title")}</h2>
                <label className="fld-label" htmlFor="fld-consent-kind">{t("field.consent.kindLabel")}</label>
                <Dropdown
                  id="fld-consent-kind"
                  className="fld-input"
                  value={consentKind}
                  onChange={setConsentKind}
                  ariaLabel={t("field.consent.kindLabel")}
                  options={[
                    { value: "audio", label: t("field.consent.kind.audio") },
                    { value: "photo", label: t("field.consent.kind.photo") }
                  ]}
                />
                <label className="fld-label" htmlFor="fld-consent-subject">{t("field.consent.subject")}</label>
                <Input
                  id="fld-consent-subject"
                  className="fld-input"
                  value={consentSubject}
                  onChange={(event) => setConsentSubject(event.target.value)}
                  autoComplete="off"
                />
                <Button variant="secondary" onClick={saveConsent} disabled={readOnly || !consentSubject.trim()}>
                  {t("field.consent.save")}
                </Button>
              </div>
            </section>
          ) : null}

          {phase === "follow_up" ? (
            <section className="fld-section" aria-label={t("field.phase.follow_up")}>
              <h2 className="fld-h2">{t("field.review.title")}</h2>
              {sync.items.length === 0 ? (
                <p className="fld-muted">{t("field.review.empty")}</p>
              ) : (
                <ul className="fld-items">
                  {sync.items.map((item) => (
                    <li key={item.clientItemId} className="fld-item" data-state={item.state}>
                      <div className="fld-item__body">
                        <span className="fld-item__type">
                          {item.itemType === "attachment"
                            ? t(`field.item.${item.payload?.role || "photo"}`)
                            : t(`field.item.${item.payload?.kind || "note"}`)}
                        </span>
                        {item.itemType === "note" ? (
                          <span className="fld-item__text">{item.payload?.body || ""}</span>
                        ) : null}
                        <span className="fld-item__state">{t(`field.itemState.${item.state}`)}</span>
                        {item.lastError && item.state === FIELD_ITEM_STATE.FAILED ? (
                          <span className="fld-item__error">{t(item.lastError) || item.lastError}</span>
                        ) : null}
                      </div>
                      <div className="fld-item__actions">
                        {item.state === FIELD_ITEM_STATE.DEVICE_ONLY ? (
                          <Button size="sm" onClick={() => sync.approveItem(item.clientItemId)}>
                            {t("field.review.approve")}
                          </Button>
                        ) : null}
                        {item.state === FIELD_ITEM_STATE.FAILED ? (
                          <Button size="sm" variant="secondary" onClick={() => sync.retryItem(item.clientItemId)}>
                            {t("field.retry")}
                          </Button>
                        ) : null}
                        {item.state === FIELD_ITEM_STATE.QUEUED ? (
                          <Button size="sm" variant="secondary" onClick={() => sync.cancelItem(item.clientItemId)}>
                            {t("field.cancel")}
                          </Button>
                        ) : null}
                        {item.state === FIELD_ITEM_STATE.CONFLICT ? (
                          <>
                            <Button size="sm" onClick={() => sync.resolveConflict(item.clientItemId, "device")}>
                              {t("field.conflict.keepDevice")}
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => sync.resolveConflict(item.clientItemId, "server")}>
                              {t("field.conflict.keepServer")}
                            </Button>
                          </>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => sync.deleteItem(item.clientItemId)}>
                          {t("field.review.remove")}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {attachments.length ? (
                <>
                  <h2 className="fld-h2">{t("field.attachments.title")}</h2>
                  <ul className="fld-items">
                    {attachments.map((attachment) => (
                      <li key={attachment.clientItemId} className="fld-item">
                        <div className="fld-item__body">
                          <span className="fld-item__type">{t(`field.item.${attachment.role}`)}</span>
                          <span className="fld-item__state">
                            {attachment.documentGone
                              ? t("field.attachments.gone")
                              : attachment.document?.title || ""}
                          </span>
                        </div>
                        <div className="fld-item__actions">
                          {attachment.role === "photo" && attachment.documentId ? (
                            <Button size="sm" variant="secondary" onClick={() => runOcr(attachment.clientItemId)} disabled={offline}>
                              {t("field.ocr.run")}
                            </Button>
                          ) : null}
                          {attachment.role === "audio" && attachment.documentId ? (
                            <Button size="sm" variant="secondary" onClick={() => runTranscribe(attachment)} disabled={offline}>
                              {t("field.transcribe.run")}
                            </Button>
                          ) : null}
                          {!readOnly ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const response = await fetch(
                                  `/api/field/visits/${encodeURIComponent(visitId)}/attachments/${encodeURIComponent(attachment.clientItemId)}`,
                                  { method: "DELETE" }
                                );
                                if (response.ok) loadDetail();
                                else setNotice(t("field.errors.deleteFailed"));
                              }}
                              disabled={offline}
                            >
                              {t("field.review.remove")}
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {aiDraft ? (
                <div className="fld-aidraft" role="dialog" aria-label={t("field.ai.title")}>
                  <h2 className="fld-h2">{t("field.ai.title")}</h2>
                  <p className="fld-hint">{t("field.ai.disclaimer")}</p>
                  <textarea
                    className="fld-input"
                    rows={6}
                    value={aiDraft.text}
                    onChange={(event) => setAiDraft({ ...aiDraft, text: event.target.value })}
                    aria-label={t("field.ai.draft")}
                  />
                  <div className="fld-actions">
                    <Button onClick={confirmAiDraft}>{t("field.ai.confirm")}</Button>
                    <Button variant="secondary" onClick={() => setAiDraft(null)}>{t("field.ai.discard")}</Button>
                  </div>
                </div>
              ) : null}

              {!readOnly && visit ? (
                <div className="fld-handover">
                  <h2 className="fld-h2">{t("field.handover.title")}</h2>
                  <label className="fld-check">
                    <Checkbox
                      bare
                      checked={handoverArtifact}
                      onChange={setHandoverArtifact}
                    />
                    <span>{t("field.handover.toArtifact")}</span>
                  </label>
                  {visit.preInquiryId ? (
                    <>
                      <label className="fld-label" htmlFor="fld-handover-note">{t("field.handover.toPreInquiry")}</label>
                      <textarea
                        id="fld-handover-note"
                        className="fld-input"
                        rows={4}
                        value={handoverNote}
                        onChange={(event) => setHandoverNote(event.target.value)}
                        placeholder={t("field.handover.notePlaceholder")}
                      />
                      <label className="fld-label" htmlFor="fld-next-contact">{t("field.handover.nextContact")}</label>
                      <Input
                        id="fld-next-contact"
                        type="date"
                        className="fld-input"
                        value={nextContactOn}
                        onChange={(event) => setNextContactOn(event.target.value)}
                      />
                    </>
                  ) : (
                    <p className="fld-hint">{t("field.handover.noPreInquiry")}</p>
                  )}
                  <Button fullWidth onClick={doHandover} disabled={offline}>{t("field.handover.send")}</Button>
                  {visit.handoverArtifactAt || visit.handoverPreInquiryAt ? (
                    <p className="fld-hint">{t("field.handover.alreadyDone")}</p>
                  ) : null}
                </div>
              ) : null}

              {!readOnly && visit ? (
                <div className="fld-actions fld-actions--footer">
                  <Button
                    variant="secondary"
                    onClick={() => patchVisit({ action: "close" })}
                    disabled={offline || sync.pendingCount > 0 || visit.status !== FIELD_VISIT_STATUS.WRAP_UP}
                  >
                    {t("field.visit.close")}
                  </Button>
                  <Button variant="ghost" onClick={() => patchVisit({ action: "cancel_visit" })} disabled={offline}>
                    {t("field.visit.cancel")}
                  </Button>
                </div>
              ) : null}
              {sync.pendingCount > 0 ? <p className="fld-hint">{t("field.visit.closeBlocked")}</p> : null}

              {/* SILD TEENUSPÄEVIKUSSE (leping 8.4). Ilmub alles SULETUD
                  külastuse juures: enne seda ei ole kestus lõplik ja eeltäide
                  annaks vale koguse.

                  LINK, MITTE AUTOMAATNE LOOMINE. Külastus ei ole alati
                  arveldatav teenus ja arve alusdokument ei tohi tekkida ilma
                  inimese kinnituseta — vorm täitub, inimene kinnitab. */}
              {isServiceLogUiEnabled() && visit?.closedAt ? (
                <div className="fld-actions">
                  <Button
                    as="a"
                    variant="secondary"
                    href={`/teenuspaevik?visit=${encodeURIComponent(visit.id)}`}
                  >
                    {t("field.visit.createServiceEntry")}
                  </Button>
                </div>
              ) : null}

              <div className="fld-purge">
                <h2 className="fld-h2">{t("field.purge.title")}</h2>
                <p className="fld-hint">{t("field.purge.explain")}</p>
                <Button variant="secondary" onClick={purgeLocal}>{t("field.purge.run")}</Button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
