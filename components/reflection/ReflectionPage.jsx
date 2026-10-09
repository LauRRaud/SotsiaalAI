"use client";

/**
 * Meetodipeegel V1 (T21 P3, O-CW-3). Kirje on ALATI ainult omaniku oma:
 * privaatsusmärgis on püsielement, mitte kohtspikker (sama reegel mis
 * supervisioonis). Vaatlus- ja tõlgendusväljad kannavad STRUKTUURSET
 * päritolumärgist (kliendi öeldu ≠ töötaja tähelepanek ≠ tõlgendus): märgis
 * on välja küljes ja kasutaja ei saa seda ümber valida (doc ptk 3.3).
 *
 * Siin EI OLE skoori, võrdlust ega soovitatud „õiget meetodit": AI
 * meetodisoovitused on blokeeritud kuni kinnitatud kataloogita (O-CW-5) ja
 * töötajate võrdlemine on arhitektuuriline keeld (doc ptk 3.4/3.6).
 *
 * KUJU (09.10). Leht oli klaaspaneeli sees veel üks tume kaart oma pealkirjaga
 * ning vorm üks pikk veerg, mille salvestamise nupuni tuli kerida. Nüüd on
 * paneelis kirjete loend ja avatud kirje juures sammulava
 * (`components/stage/StepFlight.jsx`): loend, vormi vaated (kuni kolm välja
 * korraga), vajadusel kahe versiooni võrdlus ning kirje andmed. Lehe nime ütleb
 * alumine kiirmenüü; pealkiri jääb ekraanilugejale. Vaated on failis
 * ./ReflectionViews.jsx, vormi kirjeldus ja arvutused failis
 * ./reflectionForm.js. Siin on andmed, päringud ja see, mis vaateid olekuga seob.
 *
 * AVATUD KIRJE JÄÄB AVATUKS, kuni töötaja selle sulgeb (kirje andmete vaates)
 * või teise avab: loendisse minek ei viska pooleli teksti ära. Salvestamine on
 * iga vormi vaate all servas ja salvestab kogu kirje.
 *
 * MIDA EI TEHTA ÜHE VAJUTUSEGA. Kirje kustutamine küsib teist vajutust (ja
 * selle saab 30 sekundi jooksul tagasi võtta). Sama kehtib salvestamata teksti
 * kohta: kirje sulgemine, teise kirje avamine, uue alustamine ja serveri
 * versiooni võtmine küsivad teist vajutust, kui vormis on salvestamata muudatusi.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import Button from "@/components/ui/Button";
import {
  INTERIM_OUTCOMES,
  REFLECTION_FIELD_PROVENANCE,
  REFLECTION_TEXT_MAX_LENGTH,
  SUPPORT_NEEDS,
  interimOutcomeLabelKey,
  isReflectionSourceKind,
  reflectionSourceKindLabelKey,
  supportNeedLabelKey
} from "@/lib/reflection/constants";
import { isLatestReflectionDetailRequest } from "@/lib/reflection/requestSequence";
import { provenanceLabelKey } from "@/lib/workspaces/provenance";

import {
  CHOICE_FIELDS,
  FORM_VIEWS,
  choiceLabel,
  conflictRows,
  emptyForm,
  formFromReflection,
  isChoiceField,
  reflectionBody,
  reflectionErrorText,
  reflectionRows,
  reflectionViewKeys,
  sameForm,
  textRows,
  viewState,
  viewSummary
} from "./reflectionForm";
import { ConflictView, EntryView, FootNote, FormView, ListView } from "./ReflectionViews";
import styles from "./reflection.module.css";

const VIEWS_KEY = "reflection.views";
const FIRST_FORM_VIEW = FORM_VIEWS[0].key;
const FORM_VIEW_BY_KEY = Object.fromEntries(FORM_VIEWS.map((item) => [item.key, item]));
/* Teine vajutus (kustutamine, salvestamata tekstist loobumine) peab tulema selle aja sees. */
const CONFIRM_MS = 8000;

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
  const [editingCreatedAt, setEditingCreatedAt] = useState(null);
  const [createKey, setCreateKey] = useState(null);
  const [conflictReflection, setConflictReflection] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  /* Vorm sellisena, nagu see viimati laaditi või salvestati: selle järgi on
     näha, kas ekraanil on salvestamata muudatusi. */
  const [baseline, setBaseline] = useState(emptyForm);
  const [sourceRef, setSourceRef] = useState(null);
  const [sourceState, setSourceState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusIsError, setStatusIsError] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [undoDeletion, setUndoDeletion] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [view, setView] = useState("list");
  /* Teist vajutust ootav tegevus: `delete`, `close`, `new`, `use-server` või `open:<id>`. */
  const [confirming, setConfirming] = useState("");
  const confirmTimer = useRef(0);
  const detailAbortController = useRef(null);
  const detailRequestSequence = useRef(0);
  /* Viimane avatud kirje vaade, kus töötaja oli: sinna naaseb ta pärast kahe
     versiooni lahendamist. Loetakse lehe olekust igal joonistusel, sest lava
     ei teata vaatest, millel ta avanes (ainult vahetusest). */
  const lastFormView = useRef(FIRST_FORM_VIEW);
  if (view !== "list" && view !== "conflict") lastFormView.current = view;
  const shellRef = useRef(null);
  /* Kas fookus on lehe sees (vt fookuse hoidmist lava uuesti ehitamisel allpool). */
  const focusInside = useRef(false);

  const armConfirm = useCallback((key) => {
    window.clearTimeout(confirmTimer.current);
    setConfirming(key);
    confirmTimer.current = window.setTimeout(() => setConfirming(""), CONFIRM_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(confirmTimer.current), []);

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium", timeStyle: "short" }),
    [locale]
  );
  const formatDate = useCallback((value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : formatter.format(date);
  }, [formatter]);

  const message = useCallback((result) => reflectionErrorText(result, t), [t]);

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

  /* Kui tagasivõtmise aeg lõpeb (või seadme kell on sellest juba möödas),
     kaob tagasivõtmise nupp, aga kinnitus, et kirje kustutati, jääb: muidu
     kaoks kirje ekraanilt ilma ühegi sõnata. */
  useEffect(() => {
    if (!undoDeletion?.undoUntil) return undefined;
    const settle = () => {
      setUndoDeletion(null);
      setStatusIsError(false);
      setStatusMessage(t("reflection.views.deleted"));
    };
    const remaining = new Date(undoDeletion.undoUntil).getTime() - Date.now();
    if (remaining <= 0) {
      settle();
      return undefined;
    }
    const timer = window.setTimeout(settle, remaining);
    return () => window.clearTimeout(timer);
  }, [t, undoDeletion]);

  /* Sisenemispunkt tegevuse juurest (doc ptk 3.1): ?sourceKind=PRE_INQUIRY
     &sourceId=... avab uue kirje vormi, side salvestub loomisel ja on pärast
     muutumatu. */
  useEffect(() => {
    const kind = String(searchParams?.get("sourceKind") || "").trim().toUpperCase();
    const id = String(searchParams?.get("sourceId") || "").trim();
    if (isReflectionSourceKind(kind) && id) {
      detailRequestSequence.current += 1;
      detailAbortController.current?.abort();
      setOpeningId(null);
      setSourceRef({ sourceKind: kind, sourceId: id });
      setSourceState(null);
      setFormOpen(true);
      setEditingId(null);
      setEditingUpdatedAt(null);
      setEditingCreatedAt(null);
      setCreateKey(newIdempotencyKey());
      setConflictReflection(null);
      setForm(emptyForm());
      setBaseline(emptyForm());
      setView(FIRST_FORM_VIEW);
    }
  }, [searchParams]);

  const openNew = useCallback(() => {
    detailRequestSequence.current += 1;
    detailAbortController.current?.abort();
    setOpeningId(null);
    setEditingId(null);
    setEditingUpdatedAt(null);
    setEditingCreatedAt(null);
    setCreateKey(newIdempotencyKey());
    setConflictReflection(null);
    setSourceRef(null);
    setSourceState(null);
    setForm(emptyForm());
    setBaseline(emptyForm());
    setFormOpen(true);
    setStatusMessage("");
    setConfirming("");
    setView(FIRST_FORM_VIEW);
  }, []);

  const openExisting = useCallback(async (id) => {
    const requestSequence = detailRequestSequence.current + 1;
    detailRequestSequence.current = requestSequence;
    detailAbortController.current?.abort();
    const controller = new AbortController();
    detailAbortController.current = controller;
    setStatusMessage("");
    setConfirming("");
    setOpeningId(id);
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
      setEditingCreatedAt(reflection.createdAt || null);
      setCreateKey(null);
      setConflictReflection(null);
      setSourceRef(reflection.sourceKind
        ? { sourceKind: reflection.sourceKind, sourceId: reflection.sourceId }
        : null);
      setSourceState(reflection.sourceState || null);
      setForm(formFromReflection(reflection));
      setBaseline(formFromReflection(reflection));
      setFormOpen(true);
      setView(FIRST_FORM_VIEW);
    } catch (error) {
      if (
        error?.name === "AbortError"
        || !isLatestReflectionDetailRequest(requestSequence, detailRequestSequence.current)
      ) return;
      setStatusIsError(true);
      setStatusMessage(t("reflection.errors.load_failed"));
    } finally {
      /* Ainult viimane päring tohib rea „laen" märgi maha võtta: katkestatud
         varasem päring ei tea, et uus on juba teel. */
      if (detailAbortController.current === controller) {
        detailAbortController.current = null;
        setOpeningId(null);
      }
    }
  }, [message, t]);

  const closeForm = useCallback(() => {
    detailRequestSequence.current += 1;
    detailAbortController.current?.abort();
    setOpeningId(null);
    setFormOpen(false);
    setEditingId(null);
    setEditingUpdatedAt(null);
    setEditingCreatedAt(null);
    setCreateKey(null);
    setConflictReflection(null);
    setSourceRef(null);
    setSourceState(null);
    setStatusMessage("");
    setConfirming("");
    setView("list");
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setStatusMessage("");
    const body = reflectionBody(form);
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
          /* Server on uuem. Minu tekst jääb vormi alles; järgmine salvestus
             kirjutab teadlikult serveri versiooni üle, seepärast võetakse
             siit serveri ajatempel. Erinevused avanevad omaette vaates. */
          setConflictReflection(payload.details.current);
          setEditingUpdatedAt(payload.details.current.updatedAt || null);
          setView("conflict");
        }
        setStatusIsError(true);
        setStatusMessage(message({ status, payload }));
        return;
      }
      setStatusIsError(false);
      setStatusMessage(t("reflection.form.saved"));
      setEditingId(payload?.reflection?.id || editingId);
      setEditingUpdatedAt(payload?.reflection?.updatedAt || editingUpdatedAt);
      setEditingCreatedAt(payload?.reflection?.createdAt || editingCreatedAt);
      setCreateKey(null);
      setConflictReflection(null);
      setBaseline(form);
      setConfirming("");
      /* Võrdluse vaade kaob koos erinevusega: tagasi sinna, kus töötaja kirjutas. */
      setView((current) => (current === "conflict" ? lastFormView.current : current));
      await load();
    } catch {
      setStatusIsError(true);
      setStatusMessage(t("reflection.errors.save_failed"));
    } finally {
      setSaving(false);
    }
  }, [createKey, editingCreatedAt, editingId, editingUpdatedAt, form, load, message, sourceRef, t]);

  /* Kustutatakse avatud kirje (loendi real on ainult avamine). Õnnestumisel
     läheb leht loendisse, kus teade ja tagasivõtmine seisavad koos. */
  const remove = useCallback(async () => {
    const id = editingId;
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
      closeForm();
      setUndoDeletion({ id, undoUntil: payload?.undoUntil || null });
      await load();
    } catch {
      setStatusIsError(true);
      setStatusMessage(t("reflection.errors.delete_failed"));
    } finally {
      setDeleting(false);
      setConfirming("");
    }
  }, [closeForm, deleting, editingId, load, message, t]);

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

  /* Uus täht vormis teeb eelmise teate („Salvestatud.", veateade) vanaks. */
  const updateField = useCallback((field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setStatusMessage("");
  }, []);

  const takeServerVersion = useCallback(() => {
    if (!conflictReflection) return;
    setForm(formFromReflection(conflictReflection));
    setBaseline(formFromReflection(conflictReflection));
    setConflictReflection(null);
    setStatusMessage("");
    setConfirming("");
    setView(lastFormView.current);
  }, [conflictReflection]);

  const dirty = formOpen && !sameForm(form, baseline);
  /* Salvestamata tekst ei kao ühe vajutusega: esimene vajutus küsib, teine teeb. */
  const guardDiscard = (key, run) => {
    if (!dirty || confirming === key) run();
    else armConfirm(key);
  };
  const discardText = t("reflection.views.confirm_discard");

  const privacyText = t("reflection.privacy.only_you");
  const sourceKindKey = sourceRef ? reflectionSourceKindLabelKey(sourceRef.sourceKind) : null;
  const sourceKindText = sourceKindKey ? t(sourceKindKey) : "";
  const sourceChip = !sourceRef
    ? ""
    : sourceKindText
      ? t("reflection.views.source_chip", { kind: sourceKindText })
      : t("reflection.views.entry.source");
  /* Loendi laadimise viga (aegunud sisselogimine, õiguse puudumine, võrk) on
     näha ka avatud kirje vaadetes: muidu saaks inimene sellest teada alles
     salvestamisel, pärast kõigi vaadete täitmist. */
  const status = statusMessage
    ? { text: statusMessage, tone: statusIsError ? "risk" : undefined }
    : loadError
      ? { text: loadError, tone: "risk" }
      : dirty
        ? { text: t("reflection.views.unsaved") }
        : null;
  const foot = <FootNote privacy={privacyText} source={sourceChip} status={status} />;
  /* Kirje andmete vaates on seotud tegevus juba real näha: all seda ei korrata. */
  const entryFoot = <FootNote privacy={privacyText} status={status} />;
  /* Võrdluse vaate juhis ütleb juba, et kirjet muudeti mujal ja minu tekst on
     salvestamata: seal näidatakse all ainult muud viga (nt salvestamine ei õnnestunud). */
  const staleText = t("reflection.errors.stale_update");
  const conflictFoot = <FootNote privacy={privacyText} source={sourceChip} status={statusMessage && statusMessage !== staleText ? status : null} />;
  const savingText = t("reflection.form.saving");

  const rows = reflectionRows(reflections, { t, formatDate, openId: formOpen ? editingId : null, busyId: openingId }).map((row) => ({
    ...row,
    armed: confirming === `open:${row.id}`,
    openText: row.busy ? t("reflection.common.loading") : confirming === `open:${row.id}` ? discardText : t("reflection.list.open"),
    onOpen: () => {
      /* Juba avatud kirje: vii selle juurde, ära lae uuesti (salvestamata tekst jääb alles). */
      if (row.selected) setView(FIRST_FORM_VIEW);
      else guardDiscard(`open:${row.id}`, () => { void openExisting(row.id); });
    }
  }));

  const choiceOptions = {
    supportNeed: SUPPORT_NEEDS.map((value) => ({ value, label: t(supportNeedLabelKey(value)) })),
    interimOutcome: INTERIM_OUTCOMES.map((value) => ({ value, label: t(interimOutcomeLabelKey(value)) }))
  };
  const describeField = (key, labelHidden = false) => {
    const label = t(`reflection.field.${key}`);
    if (isChoiceField(key)) {
      return {
        key,
        kind: "choice",
        label,
        labelHidden,
        options: choiceOptions[key],
        columns: CHOICE_FIELDS[key].columns,
        value: form[key],
        clearLabel: t("reflection.views.clear_choice")
      };
    }
    const provenance = REFLECTION_FIELD_PROVENANCE[key];
    return {
      key,
      kind: "text",
      label,
      labelHidden,
      provenance,
      chip: provenance ? t(provenanceLabelKey(provenance)) : "",
      rows: textRows(key),
      maxLength: REFLECTION_TEXT_MAX_LENGTH,
      value: form[key]
    };
  };

  const viewKeys = reflectionViewKeys({ open: formOpen, conflict: Boolean(conflictReflection) });
  const stageKey = viewKeys.join("|");
  /* Kui vaadete loend muutub, ehitatakse lava uuesti ja nupp, millel fookus oli
     (loendi rida, „Tagasi loendisse"), kaob lehelt. Klaviatuuri ja ekraanilugeja
     kasutaja jääks siis lehe algusesse: fookus läheb ette tulnud vaate
     pealkirjale, nagu lava teeb sammu vahetusel. Ainult siis, kui fookus oli
     enne lehe sees (lingilt saabudes fookust ei võeta). */
  useEffect(() => {
    const root = shellRef.current;
    if (!focusInside.current || !root || root.contains(document.activeElement)) return undefined;
    let frame = 0;
    const deadline = performance.now() + 1500;
    const tryFocus = () => {
      /* Laval on ees olev vaade märgitud (`data-active`); ilma lavata on lehel üks vaade (loend). */
      const heading = root.querySelector('section[data-active="1"] [data-step-heading]')
        || (root.querySelector("section[data-active]") ? null : root.querySelector("[data-step-heading]"));
      /* Lava näitab avanevat vaadet alles järgmisel kaadril: proovime, kuni õnnestub. */
      heading?.focus({ preventScroll: true });
      if ((heading && document.activeElement === heading) || performance.now() > deadline) return;
      frame = requestAnimationFrame(tryFocus);
    };
    tryFocus();
    return () => cancelAnimationFrame(frame);
  }, [stageKey]);
  const formViews = FORM_VIEW_BY_KEY;
  /* Sammu numbri heledus: vormi vaatel täituvus; võrdlus ootab otsust. */
  const stepState = (key) => (formViews[key] ? viewState(formViews[key], form) : key === "conflict" ? "partial" : "empty");
  const stepSummary = (key) => {
    if (formViews[key]) return viewSummary(formViews[key], form, t) || t("reflection.views.summary_empty");
    if (key === "conflict") return staleText;
    if (key === "entry") {
      return editingId && editingCreatedAt
        ? `${t("reflection.views.entry.created")} ${formatDate(editingCreatedAt)}`
        : t("reflection.views.entry.new");
    }
    return !loading && !loadError && !reflections.length ? t("reflection.list.empty") : undefined;
  };
  const steps = viewKeys.map((key) => ({
    key,
    label: t(`${VIEWS_KEY}.${key}.title`),
    short: t(`${VIEWS_KEY}.${key}.short`),
    state: stepState(key),
    summary: stepSummary(key),
    /* Loend ja kahe versiooni võrdlus võivad olla pikad: nende järgi ühist kõrgust ei võeta. */
    free: key === "list" || key === "conflict"
  }));

  const renderView = (step, index, flight) => {
    /* Lava hoiab kõik vaated lehel, aga põhinupp joonistab oma läike eraldi
       WebGL-pinnale: läige on ainult ees oleval vaatel, muidu oleks avatud
       kirjel kaheksa pinda korraga (brauser piirab nende arvu). */
    const glow = flight?.isActive !== false;
    if (formViews[step.key]) {
      const view = formViews[step.key];
      return (
        <FormView
          title={step.label}
          lead={t(`${VIEWS_KEY}.${step.key}.lead`)}
          layout={view.layout.map((row) => row.map((key) => describeField(key, Boolean(view.labelHidden))))}
          onChange={updateField}
          note={foot}
          actions={
            <Button type="button" variant="primary" glow={glow} disabled={saving} onClick={() => { void save(); }}>
              {saving ? savingText : t("reflection.form.save")}
            </Button>
          }
        />
      );
    }
    switch (step.key) {
      case "conflict":
        return (
          <ConflictView
            title={step.label}
            lead={t("reflection.views.conflict.lead")}
            rows={conflictRows(form, conflictReflection).map((row) => ({
              key: row.field,
              label: t(`reflection.field.${row.field}`),
              mine: row.choice ? choiceLabel(row.field, row.mine, t) : row.mine,
              theirs: row.choice ? choiceLabel(row.field, row.theirs, t) : row.theirs
            }))}
            mineLabel={t("reflection.conflict.your_version")}
            serverLabel={t("reflection.conflict.server_version")}
            emptyText={t("reflection.views.conflict.empty")}
            sameText={t("reflection.views.conflict.same")}
            note={conflictFoot}
            actions={
              <>
                {/* Serveri versioon asendab minu salvestamata teksti: see küsib teist vajutust. */}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => {
                    if (confirming === "use-server") takeServerVersion();
                    else armConfirm("use-server");
                  }}
                >
                  {confirming === "use-server" ? discardText : t("reflection.conflict.use_server")}
                </Button>
                <Button type="button" variant="primary" glow={glow} disabled={saving} onClick={() => { void save(); }}>
                  {saving ? savingText : t("reflection.views.conflict.save_mine")}
                </Button>
              </>
            }
          />
        );
      case "entry":
        return (
          <EntryView
            title={step.label}
            newText={editingId ? "" : t("reflection.views.entry.new")}
            facts={[
              sourceRef
                ? {
                    key: "source",
                    label: t("reflection.views.entry.source"),
                    value: sourceKindText,
                    /* Allika kustumisel kirje JÄÄB ja seda öeldakse välja (doc ptk 3.3 „Seos"). */
                    note: sourceState === "deleted" ? t("reflection.views.entry.source_deleted") : ""
                  }
                : null,
              editingId && editingCreatedAt
                ? { key: "created", label: t("reflection.views.entry.created"), value: formatDate(editingCreatedAt) }
                : null,
              editingId && editingUpdatedAt
                ? { key: "updated", label: t("reflection.views.entry.updated"), value: formatDate(editingUpdatedAt) }
                : null
            ].filter(Boolean)}
            hint={editingId ? t("reflection.views.entry.delete_hint") : ""}
            note={entryFoot}
            actions={
              <>
                {editingId ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={deleting}
                    onClick={() => {
                      if (confirming === "delete") void remove();
                      else armConfirm("delete");
                    }}
                  >
                    {deleting
                      ? t("reflection.deletion.deleting")
                      : confirming === "delete"
                        ? t("reflection.views.confirm_delete")
                        : t("reflection.views.entry.delete")}
                  </Button>
                ) : null}
                <Button type="button" variant="secondary" onClick={() => guardDiscard("close", closeForm)}>
                  {confirming === "close" ? discardText : t("reflection.form.back")}
                </Button>
              </>
            }
          />
        );
      default:
        return (
          <ListView
            title={step.label}
            lead={t("reflection.views.list.lead")}
            privacy={privacyText}
            loading={loading}
            loadingText={t("reflection.common.loading")}
            error={
              loadError
                ? {
                    text: loadError,
                    retry: {
                      label: t("reflection.common.retry"),
                      onClick: () => {
                        setLoading(true);
                        void load();
                      }
                    }
                  }
                : null
            }
            create={
              !loading && !loadError
                ? { label: confirming === "new" ? discardText : t("reflection.list.new"), onClick: () => guardDiscard("new", openNew) }
                : null
            }
            notice={statusMessage ? { text: statusMessage, tone: statusIsError ? "risk" : undefined } : null}
            undo={
              undoDeletion
                ? {
                    text: t("reflection.deletion.deleted"),
                    label: restoring ? t("reflection.deletion.restoring") : t("reflection.deletion.undo"),
                    busy: restoring,
                    onClick: () => {
                      void undoRemove();
                    }
                  }
                : null
            }
            rows={rows}
            emptyText={t("reflection.list.empty")}
            more={
              nextCursor
                ? {
                    label: loadingMore ? t("reflection.common.loading") : t("reflection.list.load_more"),
                    busy: loadingMore,
                    onClick: () => {
                      void load({ cursor: nextCursor, append: true });
                    }
                  }
                : null
            }
          />
        );
    }
  };

  return (
    <section
      className={styles.shell}
      ref={shellRef}
      onFocusCapture={() => {
        focusInside.current = true;
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) focusInside.current = false;
      }}
    >
      {/* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale. */}
      <h1 className="sr-only">{t("reflection.title")}</h1>
      {viewKeys.length > 1 ? (
        /* Vaadete loend muutub, kui kirje avatakse või suletakse ja kui tekib
           kahe versiooni võrdlus: siis ehitatakse lava uuesti ja see avaneb
           vaatel, kuhu töötaja läks. */
        <StepFlight
          key={stageKey}
          label={t("reflection.title")}
          steps={steps}
          initialIndex={Math.max(0, viewKeys.indexOf(view))}
          activeKey={viewKeys.includes(view) ? view : "list"}
          onStepChange={(index, step) => {
            if (!step) return;
            setView(step.key);
            setConfirming("");
          }}
        >
          {renderView}
        </StepFlight>
      ) : (
        /* Kuni ühtegi kirjet ei ole avatud, on lehel üks vaade (loend). Ühe
           vaatega lava näitaks kiirmenüüs „1/1" ja avaks välja kerides
           ülevaate ühe plaadiga: siis on loend otse paneelis. */
        renderView(steps[0])
      )}
    </section>
  );
}
