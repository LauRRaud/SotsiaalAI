"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
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

async function reflectionRequest(url, { method = "GET", body, signal } = {}) {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    signal,
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sourceRef, setSourceRef] = useState(null);
  const [sourceState, setSourceState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusIsError, setStatusIsError] = useState(false);

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium", timeStyle: "short" }),
    [locale]
  );

  const message = useCallback(({ status, payload }) => {
    if (status === 401) return t("reflection.common.login_required");
    if (status === 404) return t("reflection.errors.record_missing");
    return resolveApiMessage({ payload, t, fallbackKey: "reflection.errors.load_failed" });
  }, [t]);

  const load = useCallback(async (signal) => {
    setLoadError("");
    try {
      const { ok, status, payload } = await reflectionRequest("/api/reflections", { signal });
      if (!ok) {
        setLoadError(message({ status, payload }));
        return;
      }
      setReflections(payload?.reflections || []);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setLoadError(t("reflection.errors.load_failed"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /* Sisenemispunkt tegevuse juurest (doc ptk 3.1): ?sourceKind=PRE_INQUIRY
     &sourceId=... avab uue kirje vormi, side salvestub loomisel ja on pärast
     muutumatu. */
  useEffect(() => {
    const kind = String(searchParams?.get("sourceKind") || "").trim().toUpperCase();
    const id = String(searchParams?.get("sourceId") || "").trim();
    if (isReflectionSourceKind(kind) && id) {
      setSourceRef({ sourceKind: kind, sourceId: id });
      setFormOpen(true);
      setEditingId(null);
      setForm(emptyForm());
    }
  }, [searchParams]);

  const openNew = useCallback(() => {
    setEditingId(null);
    setSourceRef(null);
    setSourceState(null);
    setForm(emptyForm());
    setFormOpen(true);
    setStatusMessage("");
  }, []);

  const openExisting = useCallback(async (id) => {
    setStatusMessage("");
    const { ok, status, payload } = await reflectionRequest(`/api/reflections/${id}`);
    if (!ok) {
      setStatusIsError(true);
      setStatusMessage(message({ status, payload }));
      return;
    }
    const reflection = payload?.reflection || {};
    setEditingId(reflection.id || null);
    setSourceRef(reflection.sourceKind
      ? { sourceKind: reflection.sourceKind, sourceId: reflection.sourceId }
      : null);
    setSourceState(reflection.sourceState || null);
    setForm(formFromReflection(reflection));
    setFormOpen(true);
  }, [message]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
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

    try {
      const { ok, status, payload } = editingId
        ? await reflectionRequest(`/api/reflections/${editingId}`, { method: "PATCH", body })
        : await reflectionRequest("/api/reflections", {
            method: "POST",
            body: sourceRef ? { ...body, ...sourceRef } : body
          });
      if (!ok) {
        setStatusIsError(true);
        setStatusMessage(message({ status, payload }));
        return;
      }
      setStatusIsError(false);
      setStatusMessage(t("reflection.form.saved"));
      setEditingId(payload?.reflection?.id || editingId);
      await load();
    } catch {
      setStatusIsError(true);
      setStatusMessage(t("reflection.errors.save_failed"));
    } finally {
      setSaving(false);
    }
  }, [editingId, form, load, message, sourceRef, t]);

  const remove = useCallback(async (id) => {
    setStatusMessage("");
    const { ok, status, payload } = await reflectionRequest(`/api/reflections/${id}`, { method: "DELETE" });
    if (!ok) {
      setStatusIsError(true);
      setStatusMessage(message({ status, payload }));
      return;
    }
    setStatusIsError(false);
    setStatusMessage(t("reflection.form.deleted"));
    if (editingId === id) closeForm();
    await load();
  }, [closeForm, editingId, load, message, t]);

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
                  <Button onClick={() => { void remove(reflection.id); }} variant="ghost">
                    {t("reflection.list.delete")}
                  </Button>
                </div>
              </article>
            ))}
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
    </main>
  );
}
