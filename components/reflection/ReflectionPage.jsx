"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import ModalConfirm from "@/components/ui/ModalConfirm";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import {
  INTERIM_OUTCOMES,
  REFLECTION_FIELD_PROVENANCE,
  SUPPORT_NEEDS,
  interimOutcomeLabelKey,
  isReflectionSourceKind,
  reflectionSourceKindLabelKey,
  supportNeedLabelKey
} from "@/lib/reflection/constants";
import { isLatestReflectionDetailRequest } from "@/lib/reflection/requestSequence";
import { provenanceLabelKey } from "@/lib/workspaces/provenance";
import styles from "./ReflectionPage.module.css";

/**
 * Meetodipeegel V1 (T21 P3, O-CW-3). Kirje on ALATI ainult omaniku oma —
 * privaatsusmärgis on püsielement, mitte tooltip (sama reegel mis
 * supervisioonis). Vaatlus- ja tõlgendusväljad kannavad STRUKTURAALSET
 * päritolumärgist (kliendi-öeldud ≠ töötaja-tähelepanek ≠ tõlgendus): märgis
 * on välja küljes ja kasutaja ei saa seda ümber valida (doc ptk 3.3).
 *
 * Siin EI OLE skoori, võrdlust ega soovitatud „õiget meetodit": AI meetodi-
 * soovitused on blokeeritud kuni kinnitatud kataloogita (O-CW-5) ja töötajate
 * võrdlemine on arhitektuuriline keeld (doc ptk 3.4/3.6).
 */

/* Vormi struktuur (doc ptk 3.3 väljarühmad). Päritolu tuleb jagatud K2
   sõnastikust välja-tasemel kaardistusega — mitte siit failist. */
const FIELD_GROUPS = Object.freeze([
  {
    key: "choice",
    fields: ["approach", "method", "action", "supportTechnique", "choiceReason"]
  },
  {
    key: "observation",
    fields: ["clientGoal", "clientReaction", "workerObservation"]
  },
  {
    key: "interpretation",
    fields: ["interpretation", "whatWorked", "whatDidNot"]
  },
  {
    key: "conclusion",
    fields: ["nextStep"]
  }
]);

const ALL_TEXT_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields);

function emptyForm() {
  const form = { supportNeed: "", interimOutcome: "" };
  for (const field of ALL_TEXT_FIELDS) form[field] = "";
  return form;
}

function formFromReflection(reflection) {
  const form = emptyForm();
  for (const field of ALL_TEXT_FIELDS) form[field] = reflection?.[field] || "";
  form.supportNeed = reflection?.supportNeed || "";
  form.interimOutcome = reflection?.interimOutcome || "";
  return form;
}

function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `reflection-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function reflectionRequest(url, { method = "GET", body, signal, idempotencyKey } = {}) {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    signal,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok && payload?.ok !== false, status: response.status, payload };
}

function ProvenanceChip({ field }) {
  const { t } = useI18n();
  const provenance = REFLECTION_FIELD_PROVENANCE[field];
  if (!provenance) return null;
  const labelKey = provenanceLabelKey(provenance);
  return (
    <span className={styles.provenance} data-provenance={provenance}>
      {t(labelKey)}
    </span>
  );
}

export default function ReflectionPage() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();

  const [reflections, setReflections] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingUpdatedAt, setEditingUpdatedAt] = useState(null);
  const [createKey, setCreateKey] = useState(null);
  const [conflictReflection, setConflictReflection] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sourceRef, setSourceRef] = useState(null);
  const [sourceState, setSourceState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusIsError, setStatusIsError] = useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [undoDeletion, setUndoDeletion] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const detailAbortController = useRef(null);
  const detailRequestSequence = useRef(0);

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium", timeStyle: "short" }),
    [locale]
  );

  const message = useCallback(({ status, payload }) => {
    if (status === 401) return t("reflection.common.login_required");
    if (status === 404) return t("reflection.errors.record_missing");
    const apiKey = typeof payload?.message === "string" ? payload.message.trim() : "";
    if (apiKey.startsWith("reflection.")) {
      const translated = t(apiKey);
      if (translated && translated !== apiKey) return translated;
    }
    return resolveApiMessage({ payload, t, fallbackKey: "reflection.errors.load_failed" });
  }, [t]);

  const load = useCallback(async ({ signal, cursor = null, append = false } = {}) => {
    setLoadError("");
    if (append) setLoadingMore(true);
    try {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const { ok, status, payload } = await reflectionRequest(`/api/reflections${query}`, { signal });
      if (!ok) {
        setLoadError(message({ status, payload }));
        return;
      }
      const incoming = payload?.reflections || [];
      setReflections((current) => {
        if (!append) return incoming;
        const byId = new Map(current.map((item) => [item.id, item]));
        for (const item of incoming) byId.set(item.id, item);
        return [...byId.values()];
      });
      setNextCursor(payload?.page?.nextCursor || null);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setLoadError(t("reflection.errors.load_failed"));
    } finally {
      if (!signal?.aborted) setLoading(false);
      if (!signal?.aborted) setLoadingMore(false);
    }
  }, [message, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load({ signal: controller.signal });
    return () => controller.abort();
  }, [load]);

  useEffect(() => () => {
    detailRequestSequence.current += 1;
    detailAbortController.current?.abort();
  }, []);

  useEffect(() => {
    if (!undoDeletion?.undoUntil) return undefined;
    const remaining = new Date(undoDeletion.undoUntil).getTime() - Date.now();
    if (remaining <= 0) {
      setUndoDeletion(null);
      return undefined;
    }
    const timer = window.setTimeout(() => setUndoDeletion(null), remaining);
    return () => window.clearTimeout(timer);
  }, [undoDeletion]);

  /* Sisenemispunkt tegevuse juurest (doc ptk 3.1): ?sourceKind=PRE_INQUIRY
     &sourceId=... avab uue kirje vormi, side salvestub loomisel ja on pärast
     muutumatu. */
  useEffect(() => {
    const kind = String(searchParams?.get("sourceKind") || "").trim().toUpperCase();
    const id = String(searchParams?.get("sourceId") || "").trim();
    if (isReflectionSourceKind(kind) && id) {
      detailRequestSequence.current += 1;
      detailAbortController.current?.abort();
      setSourceRef({ sourceKind: kind, sourceId: id });
      setFormOpen(true);
      setEditingId(null);
      setEditingUpdatedAt(null);
      setCreateKey(newIdempotencyKey());
      setConflictReflection(null);
      setForm(emptyForm());
    }
  }, [searchParams]);

  const openNew = useCallback(() => {
    detailRequestSequence.current += 1;
    detailAbortController.current?.abort();
    setEditingId(null);
    setEditingUpdatedAt(null);
    setCreateKey(newIdempotencyKey());
    setConflictReflection(null);
    setSourceRef(null);
    setSourceState(null);
    setForm(emptyForm());
    setFormOpen(true);
    setStatusMessage("");
  }, []);

  const openExisting = useCallback(async (id) => {
    const requestSequence = detailRequestSequence.current + 1;
    detailRequestSequence.current = requestSequence;
    detailAbortController.current?.abort();
    const controller = new AbortController();
    detailAbortController.current = controller;
    setStatusMessage("");
    try {
      const { ok, status, payload } = await reflectionRequest(`/api/reflections/${id}`, {
        signal: controller.signal
      });
      if (!isLatestReflectionDetailRequest(requestSequence, detailRequestSequence.current)) return;
      if (!ok) {
        setStatusIsError(true);
        setStatusMessage(message({ status, payload }));
        return;
      }
      const reflection = payload?.reflection || {};
      setEditingId(reflection.id || null);
      setEditingUpdatedAt(reflection.updatedAt || null);
      setCreateKey(null);
      setConflictReflection(null);
      setSourceRef(reflection.sourceKind
        ? { sourceKind: reflection.sourceKind, sourceId: reflection.sourceId }
        : null);
      setSourceState(reflection.sourceState || null);
      setForm(formFromReflection(reflection));
      setFormOpen(true);
    } catch (error) {
      if (
        error?.name === "AbortError"
        || !isLatestReflectionDetailRequest(requestSequence, detailRequestSequence.current)
      ) return;
      setStatusIsError(true);
      setStatusMessage(t("reflection.errors.load_failed"));
    } finally {
      if (detailAbortController.current === controller) detailAbortController.current = null;
    }
  }, [message, t]);

  const closeForm = useCallback(() => {
    detailRequestSequence.current += 1;
    detailAbortController.current?.abort();
    setFormOpen(false);
    setEditingId(null);
    setEditingUpdatedAt(null);
    setCreateKey(null);
    setConflictReflection(null);
    setSourceRef(null);
    setSourceState(null);
    setStatusMessage("");
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setStatusMessage("");
    const body = {};
    for (const field of ALL_TEXT_FIELDS) body[field] = form[field] || null;
    body.supportNeed = form.supportNeed || null;
    body.interimOutcome = form.interimOutcome || null;
    if (editingId) body.expectedUpdatedAt = editingUpdatedAt;

    try {
      const { ok, status, payload } = editingId
        ? await reflectionRequest(`/api/reflections/${editingId}`, { method: "PATCH", body })
        : await reflectionRequest("/api/reflections", {
            method: "POST",
            body: sourceRef ? { ...body, ...sourceRef } : body,
            idempotencyKey: createKey
          });
      if (!ok) {
        if (status === 409 && payload?.message === "reflection.errors.stale_update" && payload?.details?.current) {
          setConflictReflection(payload.details.current);
          setEditingUpdatedAt(payload.details.current.updatedAt || null);
        }
        setStatusIsError(true);
        setStatusMessage(message({ status, payload }));
        return;
      }
      setStatusIsError(false);
      setStatusMessage(t("reflection.form.saved"));
      setEditingId(payload?.reflection?.id || editingId);
      setEditingUpdatedAt(payload?.reflection?.updatedAt || editingUpdatedAt);
      setCreateKey(null);
      setConflictReflection(null);
      await load();
    } catch {
      setStatusIsError(true);
      setStatusMessage(t("reflection.errors.save_failed"));
    } finally {
      setSaving(false);
    }
  }, [createKey, editingId, editingUpdatedAt, form, load, message, sourceRef, t]);

  const remove = useCallback(async () => {
    const id = deleteCandidateId;
    if (!id || deleting) return;
    setDeleting(true);
    setStatusMessage("");
    try {
      const { ok, status, payload } = await reflectionRequest(`/api/reflections/${id}`, { method: "DELETE" });
      if (!ok) {
        setStatusIsError(true);
        setStatusMessage(message({ status, payload }));
        return;
      }
      setStatusIsError(false);
      setStatusMessage(t("reflection.deletion.deleted"));
      setUndoDeletion({ id, undoUntil: payload?.undoUntil || null });
      setDeleteCandidateId(null);
      if (editingId === id) closeForm();
      await load();
    } catch {
      setStatusIsError(true);
      setStatusMessage(t("reflection.errors.delete_failed"));
    } finally {
      setDeleting(false);
    }
  }, [closeForm, deleteCandidateId, deleting, editingId, load, message, t]);

  const undoRemove = useCallback(async () => {
    if (!undoDeletion?.id || restoring) return;
    setRestoring(true);
    setStatusMessage("");
    try {
      const { ok, status, payload } = await reflectionRequest(
        `/api/reflections/${undoDeletion.id}/undo`,
        { method: "POST" }
      );
      if (!ok) {
        setStatusIsError(true);
        setStatusMessage(message({ status, payload }));
        setUndoDeletion(null);
        return;
      }
      setStatusIsError(false);
      setStatusMessage(t("reflection.deletion.restored"));
      setUndoDeletion(null);
      await load();
    } catch {
      setStatusIsError(true);
      setStatusMessage(t("reflection.errors.undo_failed"));
    } finally {
      setRestoring(false);
    }
  }, [load, message, restoring, t, undoDeletion]);

  const updateField = useCallback((field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.shell} data-glass-back-anchor="">
        <SubpageHeader title={t("reflection.title")} />
        <span className={styles.privacy} data-privacy="private">
          {t("reflection.privacy.only_you")}
        </span>
        <p className={styles.lead}>{t("reflection.lead")}</p>

        {loading ? <p className={styles.loading}>{t("reflection.common.loading")}</p> : null}

        {loadError ? (
          <div aria-live="polite" className={styles.loadError} role="status">
            <p>{loadError}</p>
            <Button onClick={() => { setLoading(true); void load(); }} variant="secondary">
              {t("reflection.common.retry")}
            </Button>
          </div>
        ) : null}

        {!formOpen && statusMessage ? (
          <div aria-live="polite" className={styles.statusRow} role="status">
            <span className={statusIsError ? styles.errorText : undefined}>{statusMessage}</span>
          </div>
        ) : null}

        {!formOpen && undoDeletion ? (
          <div className={styles.actions} data-reflection-undo="available">
            <Button disabled={restoring} onClick={() => { void undoRemove(); }} variant="secondary">
              {restoring ? t("reflection.deletion.restoring") : t("reflection.deletion.undo")}
            </Button>
          </div>
        ) : null}

        {!loading && !loadError && !formOpen ? (
          <div className={styles.actions}>
            <Button onClick={openNew}>{t("reflection.list.new")}</Button>
          </div>
        ) : null}

        {!loading && !loadError && !formOpen && !reflections.length ? (
          <p className={styles.empty}>{t("reflection.list.empty")}</p>
        ) : null}

        {!loading && !loadError && !formOpen && reflections.length ? (
          <div className={styles.cards}>
            {reflections.map((reflection) => (
              <article key={reflection.id} className={styles.card}>
                <h2 className={styles.cardTitle}>
                  {reflection.method || reflection.approach || t("reflection.list.untitled")}
                </h2>
                <p className={styles.cardMeta}>
                  {reflection.createdAt ? formatter.format(new Date(reflection.createdAt)) : ""}
                </p>
                {reflection.interimOutcome ? (
                  <p className={styles.cardMeta}>
                    {t(interimOutcomeLabelKey(reflection.interimOutcome) || "reflection.list.untitled")}
                  </p>
                ) : null}
                <div className={styles.actions}>
                  <Button onClick={() => { void openExisting(reflection.id); }} variant="secondary">
                    {t("reflection.list.open")}
                  </Button>
                  <Button onClick={() => { setDeleteCandidateId(reflection.id); }} variant="ghost">
                    {t("reflection.list.delete")}
                  </Button>
                </div>
              </article>
            ))}
            {nextCursor ? (
              <div className={styles.loadMore}>
                <Button
                  disabled={loadingMore}
                  onClick={() => { void load({ cursor: nextCursor, append: true }); }}
                  variant="secondary"
                >
                  {loadingMore ? t("reflection.common.loading") : t("reflection.list.load_more")}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {formOpen ? (
          <div className={styles.form}>
            {sourceRef ? (
              <p className={styles.sourceRef}>
                {t("reflection.form.source_label")}{" "}
                {t(reflectionSourceKindLabelKey(sourceRef.sourceKind) || "reflection.form.source_label")}
                {sourceState === "deleted" ? (
                  <span className={styles.sourceDeleted}>
                    {" "}
                    {t("reflection.form.source_deleted")}
                  </span>
                ) : null}
              </p>
            ) : null}

            {FIELD_GROUPS.map((group) => (
              <div key={group.key}>
                <h3 className={styles.groupHeading}>{t(`reflection.group.${group.key}`)}</h3>
                <p className={styles.groupHint}>{t(`reflection.group.${group.key}_hint`)}</p>
                {group.fields.map((field) => (
                  <label key={field}>
                    <span>
                      {t(`reflection.field.${field}`)} <ProvenanceChip field={field} />
                    </span>
                    <textarea
                      maxLength={4000}
                      onChange={(event) => updateField(field, event.target.value)}
                      rows={field === "choiceReason" || field === "interpretation" ? 4 : 2}
                      value={form[field]}
                    />
                  </label>
                ))}
              </div>
            ))}

            <label>
              <span>{t("reflection.field.supportNeed")}</span>
              <Dropdown
                onChange={(next) => updateField("supportNeed", next)}
                value={form.supportNeed}
                ariaLabel={t("reflection.field.supportNeed")}
                options={[
                  { value: "", label: t("reflection.form.not_set") },
                  ...SUPPORT_NEEDS.map((value) => ({ value, label: t(supportNeedLabelKey(value)) }))
                ]}
              />
              <span className={styles.fieldHint}>{t("reflection.field.supportNeed_hint")}</span>
            </label>

            <label>
              <span>{t("reflection.field.interimOutcome")}</span>
              <Dropdown
                onChange={(next) => updateField("interimOutcome", next)}
                value={form.interimOutcome}
                ariaLabel={t("reflection.field.interimOutcome")}
                options={[
                  { value: "", label: t("reflection.form.not_set") },
                  ...INTERIM_OUTCOMES.map((value) => ({ value, label: t(interimOutcomeLabelKey(value)) }))
                ]}
              />
              <span className={styles.fieldHint}>{t("reflection.field.interimOutcome_hint")}</span>
            </label>

            <div aria-live="polite" className={styles.statusRow} role="status">
              {statusMessage ? (
                <span className={statusIsError ? styles.errorText : undefined}>{statusMessage}</span>
              ) : null}
            </div>

            {conflictReflection ? (
              <section className={styles.conflict} aria-labelledby="reflection-conflict-title">
                <h3 id="reflection-conflict-title">{t("reflection.conflict.title")}</h3>
                <p>{t("reflection.conflict.explanation")}</p>
                <div className={styles.conflictColumns}>
                  <div>
                    <h4>{t("reflection.conflict.your_version")}</h4>
                    {ALL_TEXT_FIELDS.map((field) => form[field] ? (
                      <p key={`local-${field}`}><strong>{t(`reflection.field.${field}`)}:</strong> {form[field]}</p>
                    ) : null)}
                  </div>
                  <div>
                    <h4>{t("reflection.conflict.server_version")}</h4>
                    {ALL_TEXT_FIELDS.map((field) => conflictReflection[field] ? (
                      <p key={`server-${field}`}><strong>{t(`reflection.field.${field}`)}:</strong> {conflictReflection[field]}</p>
                    ) : null)}
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setForm(formFromReflection(conflictReflection));
                    setConflictReflection(null);
                    setStatusMessage("");
                  }}
                  variant="secondary"
                >
                  {t("reflection.conflict.use_server")}
                </Button>
              </section>
            ) : null}

            <div className={styles.actions}>
              <Button disabled={saving} onClick={() => { void save(); }}>
                {saving ? t("reflection.form.saving") : t("reflection.form.save")}
              </Button>
              <Button onClick={closeForm} variant="secondary">
                {t("reflection.form.back")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      {deleteCandidateId ? (
        <ModalConfirm
          busy={deleting}
          busyLabel={t("reflection.deletion.deleting")}
          cancelLabel={t("reflection.deletion.cancel")}
          confirmLabel={t("reflection.deletion.confirm_action")}
          message={t("reflection.deletion.confirm")}
          onCancel={() => { if (!deleting) setDeleteCandidateId(null); }}
          onConfirm={() => { void remove(); }}
        />
      ) : null}
    </main>
  );
}
