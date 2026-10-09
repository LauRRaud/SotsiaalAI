"use client";

/**
 * Uue supervisiooni protsessi loomine neljas väikeses sammus.
 *
 * KUJU (09.10). Leht oli üks vorm teise klaaskasti sees, suure pealkirja ja
 * ülapolstriga, ning kiirmenüüs oli ainult tagasi-nool. Nüüd on see sammulava
 * (`components/stage/StepFlight.jsx`): tüüp, pealkiri ja kohtumiste arv,
 * eesmärk, ülevaade ja loomine. Sammu nimi ja nool edasi on all kiirmenüüs.
 * Vaated on failis ./entry/CreateViews.jsx; siin on vormi seis, kontroll ja
 * päring.
 *
 * ÕIGUSE PUUDUMINE ON SELGITUS, mitte tühi viga: server annab 403
 * `supervision.errors.grant_required` ja viimane vaade ütleb, mida teha
 * (pöördu administraatori poole). Leht ei saa õigust ette kontrollida (server
 * seda loendi vastuses ei ütle), seepärast ütleb juba esimene vaade, et
 * loomiseks on õigust vaja.
 *
 * KUI MIDAGI ON PUUDU, viib „Loo protsess" selle sammu juurde, kus puudus on,
 * ja ütleb seal, mis puudu on. Vana leht näitas tühikutest pealkirja peale
 * lauset „Supervisiooni salvestamine ebaõnnestus".
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import Button from "@/components/ui/Button";

import { GoalView, ReviewView, TitleView, TypeView } from "./entry/CreateViews";
import {
  CREATE_STEP_KEYS,
  PROCESS_TYPES,
  SUPERVISION_HOME_HREF,
  createDraft,
  excerpt,
  isGrantRequired,
  parseMeetingCount,
  processHref,
  typeLabel
} from "./entry/entryRows";
import styles from "./entry/entry.module.css";
import { supervisionMessage, supervisionRequest } from "./supervisionClient";

/* Viivitus enne iseliikumist: inimene näeb, et tema valik märgiti (sama mis töövormidel). */
const AUTO_ADVANCE_MS = 420;

export default function SupervisionCreatePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState({ type: "", title: "", goal: "", plannedMeetingCount: "5" });
  const [view, setView] = useState(CREATE_STEP_KEYS[0]);
  /* Puuduvat tüüpi ja pealkirja ei heideta ette enne, kui inimene on proovinud luua. */
  const [checked, setChecked] = useState(false);
  const [formError, setFormError] = useState("");
  const [grantRequired, setGrantRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const advanceTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  const submit = useCallback(async () => {
    if (saving) return;
    setFormError("");
    setGrantRequired(false);
    const draft = createDraft(form);
    if (!draft.ok) {
      setChecked(true);
      setView(draft.firstProblemStep);
      return;
    }
    setSaving(true);
    /* Õnnestumise järel jääb nupp lukku, kuni leht vahetub: teine vajutus
       looks teise protsessi. */
    let created = false;
    try {
      const { ok, status, payload } = await supervisionRequest("/api/supervision/processes", {
        method: "POST",
        body: draft.payload
      });
      if (!ok) {
        // 403 grant_required on ainus olek, mis vajab OMA selgitust: muidu
        // näeks kasutaja üldist „ei õnnestunud" ja ei teaks, mida teha.
        if (isGrantRequired({ status, payload })) {
          setGrantRequired(true);
          return;
        }
        setFormError(supervisionMessage({ status, payload, t, fallbackKey: "supervision.errors.save_failed" }));
        return;
      }
      const id = payload?.process?.id;
      if (!id) {
        setFormError(t("supervision.errors.save_failed"));
        return;
      }
      created = true;
      /* Uus protsess avaneb kontrakti alal: järgmine töö on kontrakt ja kutsed. */
      router.push(`${processHref(id)}?ala=kontrakt`);
    } catch {
      setFormError(t("supervision.errors.save_failed"));
    } finally {
      if (!created) setSaving(false);
    }
  }, [form, router, saving, t]);

  const draft = createDraft(form);
  const meetings = parseMeetingCount(form.plannedMeetingCount);
  const title = form.title.trim();
  const goal = form.goal.trim();
  const typeOptions = PROCESS_TYPES.map((value) => ({ value, label: typeLabel(value, t) }));
  const typeError = checked && draft.problems.type ? t("supervision.create.typeMissing") : "";
  const titleError = checked && draft.problems.title ? t("supervision.create.titleMissing") : "";
  /* Loetamatu arv öeldakse välja kohe: see on kirjaviga, mitte tegemata töö. */
  const meetingsError = draft.problems.meetings ? t("supervision.create.meetingsInvalid") : "";

  const steps = CREATE_STEP_KEYS.map((key) => ({
    key,
    label: t(`supervision.create.views.${key}.title`),
    short: t(`supervision.create.views.${key}.short`),
    state:
      key === "type"
        ? draft.problems.type ? "empty" : "done"
        : key === "title"
          ? draft.problems.title ? "empty" : draft.problems.meetings ? "partial" : "done"
          : key === "goal"
            ? goal ? "done" : "empty"
            : "empty",
    summary:
      key === "type" ? typeLabel(form.type, t) : key === "title" ? title : key === "goal" ? excerpt(goal, 90) : undefined
  }));

  /* Loobumine viib tagasi supervisiooni lauale (kiirmenüü nool viib Töölauale). */
  const cancel = (
    <Button type="button" size="sm" variant="secondary" onClick={() => router.push(SUPERVISION_HOME_HREF)}>
      {t("supervision.common.cancel")}
    </Button>
  );

  const renderView = (step, index, flight) => {
    switch (step.key) {
      case "title":
        return (
          <TitleView
            t={t}
            title={form.title}
            onTitle={(value) => update("title", value)}
            meetings={form.plannedMeetingCount}
            onMeetings={(value) => update("plannedMeetingCount", value)}
            titleError={titleError}
            meetingsError={meetingsError}
            onEnter={flight.next}
            actions={cancel}
          />
        );
      case "goal":
        return <GoalView t={t} value={form.goal} onChange={(value) => update("goal", value)} actions={cancel} />;
      case "create":
        return (
          <ReviewView
            t={t}
            problem={grantRequired ? t("supervision.create.grantRequired") : formError}
            facts={[
              {
                key: "type",
                label: t("supervision.create.typeLabel"),
                value: typeLabel(form.type, t) || t("supervision.create.typeNone"),
                missing: draft.problems.type
              },
              {
                key: "title",
                label: t("supervision.create.titleLabel"),
                value: title || t("supervision.create.titleNone"),
                missing: draft.problems.title
              },
              {
                key: "meetings",
                label: t("supervision.create.meetingsLabel"),
                value: meetings.ok ? String(meetings.value) : form.plannedMeetingCount,
                missing: draft.problems.meetings
              },
              {
                key: "goal",
                label: t("supervision.create.views.goal.title"),
                value: goal ? excerpt(goal, 220) : t("supervision.create.goalNone"),
                missing: !goal
              }
            ]}
            actions={
              <>
                {cancel}
                <Button type="button" size="sm" variant="primary" disabled={saving} onClick={submit}>
                  {saving ? t("supervision.common.saving") : t("supervision.create.submit")}
                </Button>
              </>
            }
          />
        );
      default:
        return (
          <TypeView
            t={t}
            value={form.type}
            options={typeOptions}
            note={typeError}
            onChange={(value) => {
              /* Vaates on ainult see üks valik: esimene vastus viib ise edasi.
                 Hilisem muutmine ei vii, muidu ei saaks klaviatuuriga variante
                 läbi käia. */
              const first = !form.type;
              update("type", value);
              window.clearTimeout(advanceTimer.current);
              if (first) advanceTimer.current = window.setTimeout(flight.next, AUTO_ADVANCE_MS);
            }}
            actions={cancel}
          />
        );
    }
  };

  return (
    <section className={styles.shell}>
      <h1 className="sr-only">{t("supervision.create.title")}</h1>
      <StepFlight
        label={t("supervision.create.title")}
        steps={steps}
        activeKey={view}
        onStepChange={(index, step) => {
          /* Inimene liikus ise: ootel iseliikumine ei tohi teda tagasi tuua. */
          window.clearTimeout(advanceTimer.current);
          if (step) setView(step.key);
        }}
      >
        {renderView}
      </StepFlight>
    </section>
  );
}
