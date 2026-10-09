"use client";

/**
 * Minu mentoriprofiil: profiili loomine, muutmine ja seis.
 *
 * KUJU (09.10). Leht oli üks pikk vorm klaaspaneeli sees olevas tumedas
 * kaardis. Nüüd on see sammulava (`components/stage/StepFlight.jsx`): vorm on
 * lõigatud väikesteks vaadeteks (nimi, valdkonnad, keeled ja vormid, kolm
 * teksti) ja viimane samm on profiili seis. Olemasoleva profiiliga avaneb leht
 * seisu vaates, uue profiili tegija alustab esimesest sammust.
 *
 * Vaated on failis ./entry/MyProfileViews.jsx, otsused failis
 * ./entry/entryRows.js. Siin on andmed, päringud ja see, mis vaateid olekuga
 * seob.
 *
 * MIS ON TEISITI KUI ENNE (ja miks):
 *  - „Esita ülevaatusele” salvestab enne pooleli muudatused. Varem esitati
 *    serveris olev versioon ja vastus kirjutas vormi üle: salvestamata
 *    muudatused kadusid vaikides. Samal põhjusel ei puutu seisu tegevused
 *    (peatamine, mahutavus) enam vormi.
 *  - Leht ütleb enne esitamist, mis on puudu (nimi, lühitutvustus, valdkond).
 *    Server keeldus ka enne, aga vastas üldise veaga.
 *  - Mentorluse lõpetamine on jäädav (lõpetatud profiili ei saa taastada ega
 *    muuta), seepärast küsib see teist vajutust ja ütleb seda välja.
 *  - Lõpetatud või suletud profiili väljad on lukus: salvestamine ei saaks
 *    õnnestuda.
 *  - Loendid on üks kirje real (koma töötab endiselt) ja leht ütleb, kui kirjeid
 *    on rohkem, kui server alles jätab.
 *  - Kui seis on mujal muutunud (vastus 409), loeb leht värske seisu ise:
 *    veateade palus vaadet värskendada, aga lehel ei olnud selleks nuppu.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import Button from "@/components/ui/Button";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { localizePath } from "@/lib/localizePath";

import { EntryShell } from "./entry/EntryParts";
import {
  EMPTY_FORM,
  PROFILE_LIMITS,
  PROFILE_VIEW_KEYS,
  isDirty,
  missingForReview,
  overLimit,
  profilePayload,
  profileStateModel,
  profileSteps,
  statusWord,
  mergeAfterConflict,
  toForm
} from "./entry/entryRows";
import { ListsView, StateView, TextView, WhoView } from "./entry/MyProfileViews";

/* Teine vajutus mentorluse lõpetamiseks peab tulema selle aja sees. */
const CONFIRM_MS = 8000;

async function readProfileResponse(response, t, fallbackKey) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    const error = new Error(resolveApiMessage({ payload, t, fallbackKey }));
    error.status = response.status;
    throw error;
  }
  return payload?.profile || null;
}

export default function MyMentorProfilePage() {
  const { t } = useI18n();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  /* Vaade, kust leht avaneb: olemasoleva profiiliga seis, muidu esimene samm. */
  const [startView, setStartView] = useState("who");
  /* Teist vajutust ootav tegevus (`retire`). */
  const [confirming, setConfirming] = useState("");
  const confirmTimer = useRef(0);

  const armConfirm = useCallback((key) => {
    window.clearTimeout(confirmTimer.current);
    setConfirming(key);
    confirmTimer.current = window.setTimeout(() => setConfirming(""), CONFIRM_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(confirmTimer.current), []);

  const load = useCallback(async (signal) => {
    setLoadError("");
    try {
      const response = await fetch("/api/mentoring/profile", { cache: "no-store", signal });
      const loaded = await readProfileResponse(response, t, "mentoring.errors.load_failed");
      setProfile(loaded);
      setForm(toForm(loaded));
      setStartView(loaded ? "state" : "who");
    } catch (error) {
      if (error?.name === "AbortError") return;
      setLoadError(error?.message || t("mentoring.errors.load_failed"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const model = profileStateModel(profile);
  const dirty = isDirty(form, profile);
  const locked = !model.editable;
  const hasName = Boolean(form.displayName.trim());
  const canSave = !busy && !locked && dirty && hasName;
  const missing = missingForReview(form);
  const over = overLimit(form);

  /* Seis muutus mujal (nt admin vaatas profiili üle või see salvestati teises
     aknas): loeme värske seisu, et järgmine katse ei põrkaks vana versiooni
     taha. Pooleli vormist jäävad alles inimese enda muudatused; väljad, mida ta
     ei puutunud, saavad serveri värske väärtuse (`mergeAfterConflict`), muidu
     kirjutaks järgmine salvestamine need vana väärtusega üle. Tagastab, kas
     värske seis saadi kätte. */
  async function refreshAfterConflict(error, keepForm) {
    if (error?.status !== 409) return false;
    try {
      const response = await fetch("/api/mentoring/profile", { cache: "no-store" });
      const fresh = await readProfileResponse(response, t, "mentoring.errors.load_failed");
      const before = profile;
      setProfile(fresh);
      setForm((current) => (keepForm ? mergeAfterConflict(current, before, fresh) : toForm(fresh)));
      return true;
    } catch {
      /* värskendus on abiks, mitte nõue: algne veateade jääb ette */
      return false;
    }
  }

  /** Salvestab vormi. Tagastab, kas õnnestus (esitamine ootab selle järel). */
  async function save() {
    /* Väljad jäävad salvestamise ajal kirjutatavaks (fookus ei tohi kaduda),
       seepärast hoiab topeltsaatmise ära see kontroll, mitte välja lukustamine. */
    if (busy) return false;
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/api/mentoring/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload(form, profile?.version))
      });
      const saved = await readProfileResponse(response, t, "mentoring.errors.save_failed");
      setProfile(saved);
      setForm(toForm(saved));
      /* Lause ütleb, mis salvestamisest sai: mustand vajab veel esitamist ja
         kataloogis oleva profiili sisu muutus läheb uuesti ülevaatusele. */
      const status = String(saved?.status || "").toUpperCase();
      setFeedback(
        status === "DRAFT" || status === "REJECTED"
          ? t("mentoring.my_profile.saved_draft")
          : status === "PENDING_REVIEW"
            ? t("mentoring.my_profile.saved_pending")
            : t("mentoring.my_profile.saved")
      );
      return true;
    } catch (error) {
      setFeedback(error?.message || t("mentoring.errors.save_failed"));
      /* Värske seis on käes ja inimese muudatused alles: lause ütleb seda,
         mitte „värskenda vaadet" (leht tegi seda juba ise). */
      if (await refreshAfterConflict(error, true)) setFeedback(t("mentoring.my_profile.conflict_kept"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  /* Seisu tegevus muudab ainult seisu või mahutavust, mitte profiili sisu:
     vormi see ei puutu, muidu kaoksid pooleli muudatused. */
  async function runAction(action, extra = {}) {
    setBusy(true);
    setFeedback("");
    setConfirming("");
    try {
      const response = await fetch("/api/mentoring/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra })
      });
      setProfile(await readProfileResponse(response, t, "mentoring.errors.save_failed"));
      setFeedback(t(`mentoring.my_profile.action_done.${action}`));
    } catch (error) {
      setFeedback(error?.message || t("mentoring.errors.save_failed"));
      await refreshAfterConflict(error, dirty);
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview() {
    if (dirty && !(await save())) return;
    await runAction("submit");
  }

  const onField = (key) => (value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setFeedback("");
  };
  const onEnter = () => {
    if (canSave) void save();
  };

  const note = feedback
    || (locked
      ? t("mentoring.my_profile.locked")
      : !dirty
        ? ""
        : hasName
          ? t("mentoring.my_profile.unsaved")
          : t("mentoring.my_profile.name_required"));
  const saveButton = locked ? null : (
    <Button type="button" variant="primary" disabled={!canSave} onClick={() => void save()}>
      {t("mentoring.my_profile.save")}
    </Button>
  );
  const listHint = (key, hint) => (over[key] ? `${hint} ${t("mentoring.my_profile.list_over", { max: PROFILE_LIMITS[key] })}` : hint);
  /* Väljad on lukus ainult siis, kui profiili ei saa muuta. Salvestamise ajal
     jäävad need kirjutatavaks: lukustatud väli kaotaks klaviatuuri fookuse. */
  const formProps = { disabled: locked, note, actions: saveButton };

  const steps = profileSteps({ t, form, profile });

  const renderView = (step) => {
    switch (step.key) {
      case "areas":
        return (
          <ListsView
            title={t("mentoring.my_profile.views.areas.title")}
            lead={t("mentoring.my_profile.views.areas.lead")}
            left={{
              label: t("mentoring.my_profile.fields"),
              hint: listHint("fields", t("mentoring.my_profile.list_hint", { max: PROFILE_LIMITS.fields })),
              value: form.fields,
              onChange: onField("fields")
            }}
            right={{
              label: t("mentoring.my_profile.topics"),
              hint: listHint("topics", t("mentoring.my_profile.list_hint", { max: PROFILE_LIMITS.topics })),
              value: form.topics,
              onChange: onField("topics")
            }}
            {...formProps}
          />
        );
      case "ways":
        return (
          <ListsView
            title={t("mentoring.my_profile.views.ways.title")}
            rows={3}
            left={{
              label: t("mentoring.my_profile.languages"),
              hint: listHint("languages", t("mentoring.my_profile.languages_hint", { max: PROFILE_LIMITS.languages })),
              value: form.languages,
              onChange: onField("languages")
            }}
            right={{
              label: t("mentoring.my_profile.formats"),
              hint: listHint("formats", t("mentoring.my_profile.formats_hint", { max: PROFILE_LIMITS.formats })),
              value: form.formats,
              onChange: onField("formats")
            }}
            {...formProps}
          />
        );
      case "intro":
        return (
          <TextView
            title={t("mentoring.my_profile.views.intro.title")}
            label={t("mentoring.my_profile.bio_short")}
            hint={t("mentoring.my_profile.bio_short_hint", { max: PROFILE_LIMITS.bioShort })}
            value={form.bioShort}
            rows={5}
            maxLength={PROFILE_LIMITS.bioShort}
            onChange={onField("bioShort")}
            {...formProps}
          />
        );
      case "story":
        return (
          <TextView
            title={t("mentoring.my_profile.views.story.title")}
            label={t("mentoring.my_profile.bio_full")}
            hint={t("mentoring.my_profile.bio_full_hint")}
            value={form.bioFull}
            rows={8}
            maxLength={PROFILE_LIMITS.text}
            onChange={onField("bioFull")}
            {...formProps}
          />
        );
      case "experience":
        return (
          <TextView
            title={t("mentoring.my_profile.views.experience.title")}
            label={t("mentoring.my_profile.experience")}
            hint={t("mentoring.my_profile.experience_hint")}
            value={form.experienceSummary}
            rows={8}
            maxLength={PROFILE_LIMITS.text}
            onChange={onField("experienceSummary")}
            {...formProps}
          />
        );
      case "state": {
        const missingNames = {
          display_name: t("mentoring.my_profile.missing.display_name"),
          bio_short: t("mentoring.my_profile.missing.bio_short"),
          fields: t("mentoring.my_profile.missing.fields")
        };
        const help = {
          none: t("mentoring.my_profile.state_help.none"),
          draft: t("mentoring.my_profile.state_help.draft"),
          pending_review: t("mentoring.my_profile.state_help.pending_review"),
          active: t("mentoring.my_profile.state_help.active"),
          rejected: t("mentoring.my_profile.state_help.rejected"),
          paused: t("mentoring.my_profile.state_help.paused"),
          retired: t("mentoring.my_profile.state_help.retired"),
          revoked: t("mentoring.my_profile.state_help.revoked")
        };
        const capacityValue = String(profile?.capacity || "").toUpperCase() === "FULL" ? "FULL" : "OPEN";
        const cards = [
          model.canPause
            ? {
                key: "pause",
                title: t("mentoring.my_profile.pause"),
                description: t("mentoring.my_profile.pause_hint"),
                disabled: busy,
                onClick: () => void runAction("pause")
              }
            : null,
          model.canResume
            ? {
                key: "resume",
                title: t("mentoring.my_profile.resume"),
                description: t("mentoring.my_profile.resume_hint"),
                disabled: busy,
                onClick: () => void runAction("resume")
              }
            : null,
          model.canRetire
            ? {
                key: "retire",
                title: confirming === "retire" ? t("mentoring.my_profile.confirm_retire") : t("mentoring.my_profile.retire"),
                description: t("mentoring.my_profile.retire_hint"),
                disabled: busy,
                onClick: () => (confirming === "retire" ? void runAction("retire") : armConfirm("retire"))
              }
            : null
        ].filter(Boolean);
        /* Mis on esitamiseks puudu, näeb nii uue profiili tegija kui see, kelle
           mustand või tagasi lükatud profiil ootab esitamist. */
        const reviewNote = !profile || model.canSubmit
          ? missing.length
            ? t("mentoring.my_profile.missing_lead", { items: missing.map((key) => missingNames[key]).join(", ") })
            : model.canSubmit
              ? t("mentoring.my_profile.ready_for_review")
              : ""
          : "";
        const showSave = dirty && saveButton;
        return (
          <StateView
            t={t}
            chip={profile ? statusWord("profile_status", profile.status, t) : null}
            reason={model.reasonKey ? t(`mentoring.review_reason.${model.reasonKey}`) : ""}
            help={help[model.helpKey] || ""}
            review={reviewNote ? { text: reviewNote, tone: missing.length ? undefined : "ok" } : null}
            capacity={
              model.canSetCapacity
                ? {
                    value: capacityValue,
                    disabled: busy,
                    options: [
                      { value: "OPEN", label: t("mentoring.my_profile.capacity_open") },
                      { value: "FULL", label: t("mentoring.my_profile.capacity_full") }
                    ],
                    onChange: (value) => {
                      if (value !== capacityValue) void runAction("capacity", { capacity: value });
                    }
                  }
                : null
            }
            cards={cards}
            backHref={localizePath("/mentorlus")}
            note={note}
            actions={
              showSave || model.canSubmit ? (
                <>
                  {showSave ? saveButton : null}
                  {model.canSubmit ? (
                    <Button
                      type="button"
                      variant={showSave ? "secondary" : "primary"}
                      disabled={busy || missing.length > 0}
                      onClick={() => void submitForReview()}
                    >
                      {t("mentoring.my_profile.submit_review")}
                    </Button>
                  ) : null}
                </>
              ) : null
            }
          />
        );
      }
      default:
        return (
          <WhoView
            t={t}
            form={form}
            onField={onField}
            onEnter={onEnter}
            maxLength={PROFILE_LIMITS.line}
            {...formProps}
          />
        );
    }
  };

  return (
    <EntryShell
      title={t("mentoring.my_profile.title")}
      loadingText={loading ? t("mentoring.labels.loading") : ""}
      error={loadError}
      retryText={t("mentoring.labels.retry")}
      onRetry={() => {
        setLoading(true);
        void load();
      }}
    >
      {!loading && !loadError ? (
        <StepFlight
          label={t("mentoring.my_profile.title")}
          steps={steps}
          initialIndex={Math.max(0, PROFILE_VIEW_KEYS.indexOf(startView))}
          /* Teade käib selle sammu kohta, kus tegu tehti: teises sammus see enam ei kehti. */
          onStepChange={() => setFeedback("")}
        >
          {renderView}
        </StepFlight>
      ) : null}
    </EntryShell>
  );
}
