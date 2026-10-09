"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";
import DateField from "@/components/ui/DateField";
import {
  CARE_ACTIVITY_DOMAINS,
  CARE_ACTIVITY_GROUPS,
  CARE_ACTIVITY_GROUP_DOMAIN,
  CARE_PLAN_FREQUENCIES,
  CARE_PLAN_MODES,
  CarePlanFrequency,
  CarePlanMode,
  HOME_CARE_LIMITS
} from "@/lib/homeCare/constants";

import HomeCareOutbox from "./HomeCareOutbox";
import HomeCarePlanView from "./HomeCarePlanView";
import { formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

/** Uue rea vaikeväärtused: kord nädalas, teeme koos. Hooldusjuht muudab need kohe sobivaks. */
const NEW_LINE = Object.freeze({
  frequencyKind: CarePlanFrequency.WEEKLY,
  frequencyCount: "1",
  frequencyNote: "",
  mode: CarePlanMode.TOGETHER,
  critical: false,
  note: ""
});

/** Vormi algseis: mustand, kui see on; muidu kehtiv kava lähtekohana; muidu tühi. */
function startFrom(plan, activities) {
  const known = new Set(activities.map((activity) => activity.id));
  const lines = {};
  for (const line of plan?.lines || []) {
    /* Arhiveeritud toimingut uude kavasse kaasa ei võeta. */
    if (!line.activityId || !known.has(line.activityId)) continue;
    lines[line.activityId] = {
      frequencyKind: line.frequencyKind,
      frequencyCount: line.frequencyCount ? String(line.frequencyCount) : "1",
      frequencyNote: line.frequencyNote || "",
      mode: line.mode,
      critical: Boolean(line.critical),
      note: line.note || ""
    };
  }
  return { goals: plan?.goals || "", reviewOn: plan?.reviewOn || "", note: plan?.note || "", lines };
}

/**
 * Hoolduskava koostamine hooldusjuhile.
 *
 * Muudetakse MUSTANDIT; kehtiv kava jääb samaks, kuni mustand kehtestatakse.
 * Kehtestamine asendab kehtiva kava ja eelmine jääb alles varasemate kavade loendis.
 * Toimingud tulevad asutuse kataloogist.
 */
export default function HomeCarePlanEditor({ context, initial }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const fieldId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const client = initial.client;
  const activities = initial.activities || [];
  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(client.id)}/kava`;
  const clientHref = `/org/${organizationId}/koduteenus/kliendid/${client.id}`;
  const canEdit = Boolean(initial.canEdit);

  const [active, setActive] = useState(initial.active || null);
  const [draft, setDraft] = useState(initial.draft || null);
  const [history, setHistory] = useState(initial.history || []);
  const [form, setForm] = useState(() => startFrom(initial.draft || initial.active, activities));
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  /* Kahe sammuga toimingud: "activate" | "discard" | null. */
  const [confirm, setConfirm] = useState(null);

  const chosen = Object.keys(form.lines).length;
  const touch = () => {
    setDirty(true);
    setNotice("");
    setConfirm(null);
  };
  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    touch();
  };
  const toggleLine = (activityId) => {
    setForm((current) => {
      const lines = { ...current.lines };
      if (lines[activityId]) delete lines[activityId];
      else lines[activityId] = { ...NEW_LINE };
      return { ...current, lines };
    });
    touch();
  };
  const setLine = (activityId, patch) => {
    setForm((current) => ({ ...current, lines: { ...current.lines, [activityId]: { ...current.lines[activityId], ...patch } } }));
    touch();
  };

  const body = () => ({
    version: draft?.version,
    goals: form.goals,
    reviewOn: form.reviewOn || null,
    note: form.note,
    /* Ridade järjekord on kataloogi järjekord. */
    lines: activities
      .filter((activity) => form.lines[activity.id])
      .map((activity) => {
        const line = form.lines[activity.id];
        return {
          activityId: activity.id,
          frequencyKind: line.frequencyKind,
          frequencyCount: line.frequencyKind === CarePlanFrequency.AS_NEEDED ? null : Number(line.frequencyCount),
          frequencyNote: line.frequencyNote,
          mode: line.mode,
          critical: line.critical,
          note: line.note
        };
      })
  });

  const saveDraft = async () => {
    const result = await call(base, { method: "PUT", body: body(), fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return null;
    setDraft(result.data.draft);
    setDirty(false);
    return result.data.draft;
  };

  const save = async (event) => {
    event.preventDefault();
    if (await saveDraft()) setNotice(t("home_care.plan.draft_saved"));
  };

  const activate = async () => {
    /* Kehtestatakse see, mis ekraanil on: salvestamata muudatused salvestatakse enne. */
    const current = dirty || !draft ? await saveDraft() : draft;
    if (!current) return;
    const result = await call(`${base}/kehtesta`, {
      method: "POST",
      body: { version: current.version },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setActive(result.data.active);
    setDraft(null);
    setHistory(result.data.history || []);
    setForm(startFrom(result.data.active, activities));
    setDirty(false);
    setConfirm(null);
    setNotice(t("home_care.plan.activated"));
  };

  const discard = async () => {
    if (draft) {
      const result = await call(base, { method: "DELETE", body: { version: draft.version }, fallbackKey: "home_care.errors.save_failed" });
      if (!result.ok) return;
    }
    setDraft(null);
    setForm(startFrom(active, activities));
    setDirty(false);
    setConfirm(null);
    setNotice(t("home_care.plan.draft_discarded"));
  };

  const lineFields = (activity) => {
    const line = form.lines[activity.id];
    const id = `${fieldId}-${activity.id}`;
    return (
      <div className="hc-fieldset">
        <div className="hc-chips" role="group" aria-label={t("home_care.plan.frequency_label")}>
          {CARE_PLAN_FREQUENCIES.map((value) => (
            <button
              key={value}
              type="button"
              className="hc-chip"
              aria-pressed={line.frequencyKind === value}
              onClick={() => setLine(activity.id, { frequencyKind: value })}
            >
              {t(`home_care.plan.frequency.${value}`)}
            </button>
          ))}
        </div>
        {line.frequencyKind !== CarePlanFrequency.AS_NEEDED ? (
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${id}-count`}>
              {t("home_care.plan.count_label")}
            </label>
            <input
              id={`${id}-count`}
              className="hc-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={HOME_CARE_LIMITS.PLAN_FREQUENCY_MAX}
              value={line.frequencyCount}
              onChange={(event) => setLine(activity.id, { frequencyCount: event.target.value })}
              required
            />
          </div>
        ) : null}
        <div className="hc-field">
          <label className="hc-label" htmlFor={`${id}-when`}>
            {t("home_care.plan.frequency_note")}
          </label>
          <input
            id={`${id}-when`}
            className="hc-input"
            value={line.frequencyNote}
            onChange={(event) => setLine(activity.id, { frequencyNote: event.target.value })}
            maxLength={HOME_CARE_LIMITS.PLAN_FREQUENCY_NOTE_MAX}
            autoComplete="off"
          />
        </div>
        <div className="hc-chips" role="group" aria-label={t("home_care.plan.mode_label")}>
          {CARE_PLAN_MODES.map((value) => (
            <button
              key={value}
              type="button"
              className="hc-chip"
              aria-pressed={line.mode === value}
              onClick={() => setLine(activity.id, { mode: value })}
            >
              {t(`home_care.plan.modes.${value}`)}
            </button>
          ))}
        </div>
        <div className="hc-chips">
          <button
            type="button"
            className="hc-chip"
            aria-pressed={line.critical}
            onClick={() => setLine(activity.id, { critical: !line.critical })}
          >
            {t("home_care.plan.critical")}
          </button>
        </div>
        <div className="hc-field">
          <label className="hc-label" htmlFor={`${id}-note`}>
            {t("home_care.plan.line_note")}
          </label>
          <input
            id={`${id}-note`}
            className="hc-input"
            value={line.note}
            onChange={(event) => setLine(activity.id, { note: event.target.value })}
            maxLength={HOME_CARE_LIMITS.PLAN_LINE_NOTE_MAX}
            autoComplete="off"
          />
        </div>
      </div>
    );
  };

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />
      <HomeCareOutbox ownerId={context.membership?.id || ""} timeZone={timeZone} />

      <div className="hc-head">
        <Link className="hc-back" href={clientHref} prefetch={false}>
          {t("home_care.plan.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.plan.editor_title", { name: client.displayName })}</h2>
        <p className="hc-sub">{t("home_care.plan.editor_intro")}</p>
      </div>

      {active ? (
        <section className="hc-section hc-section--card" aria-labelledby={`${fieldId}-active`}>
          <h3 className="hc-section-title" id={`${fieldId}-active`}>
            {t("home_care.plan.active_title")}
          </h3>
          <HomeCarePlanView plan={active} />
        </section>
      ) : (
        <p className="hc-notice">{t("home_care.plan.none_yet")}</p>
      )}

      {activities.length === 0 ? (
        <section className="hc-section">
          <p className="hc-sub">{t("home_care.plan.catalogue_empty")}</p>
          <Link className="hc-btn hc-btn--link" href={`/org/${organizationId}/koduteenus/toimingud`}>
            {t("home_care.activities.link")}
          </Link>
        </section>
      ) : canEdit ? (
        <form className="hc-form" onSubmit={save} aria-busy={busy}>
          <h3 className="hc-section-title">{draft ? t("home_care.plan.draft_title", { number: draft.number }) : t("home_care.plan.new_title")}</h3>

          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-goals`}>
              {t("home_care.plan.goals_label")}
            </label>
            <textarea
              id={`${fieldId}-goals`}
              className="hc-textarea hc-textarea--short"
              value={form.goals}
              onChange={(event) => setField("goals", event.target.value)}
              maxLength={HOME_CARE_LIMITS.PLAN_GOALS_MAX}
            />
          </div>

          {CARE_ACTIVITY_DOMAINS.map((domain) => (
            <section className="hc-section" key={domain} aria-labelledby={`${fieldId}-${domain}`}>
              <h4 className="hc-section-title" id={`${fieldId}-${domain}`}>
                {t(`home_care.activities.domains.${domain}`)}
              </h4>
              {CARE_ACTIVITY_GROUPS.filter((group) => CARE_ACTIVITY_GROUP_DOMAIN[group] === domain).map((group) => {
                const items = activities.filter((activity) => activity.group === group);
                if (!items.length) return null;
                return (
                  <div className="hc-field" key={group}>
                    <h5 className="hc-label">{t(`home_care.activities.groups.${group}`)}</h5>
                    {items.map((activity) => (
                      <div key={activity.id}>
                        <button
                          type="button"
                          className="hc-chip"
                          aria-pressed={Boolean(form.lines[activity.id])}
                          onClick={() => toggleLine(activity.id)}
                        >
                          {activity.name}
                        </button>
                        {form.lines[activity.id] ? lineFields(activity) : null}
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>
          ))}

          <div className="hc-field">
            <span className="hc-label">{t("home_care.plan.review_label")}</span>
            <DateField
              name="reviewOn"
              value={form.reviewOn}
              onChange={(value) => setField("reviewOn", value || "")}
              ariaLabel={t("home_care.plan.review_label")}
            />
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-note`}>
              {t("home_care.plan.note_label")}
            </label>
            <textarea
              id={`${fieldId}-note`}
              className="hc-textarea hc-textarea--short"
              value={form.note}
              onChange={(event) => setField("note", event.target.value)}
              maxLength={HOME_CARE_LIMITS.PLAN_NOTE_MAX}
            />
          </div>

          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="hc-ok" role="status">
              {notice}
            </p>
          ) : null}

          <p className="hc-hint">{t("home_care.plan.chosen", { count: chosen })}</p>
          <div className="hc-row">
            <button className="hc-btn" type="submit" disabled={busy || (!dirty && Boolean(draft))}>
              {t("home_care.plan.save_draft")}
            </button>
            {confirm === "activate" ? (
              <button className="hc-btn hc-btn--primary" type="button" onClick={activate} disabled={busy}>
                {t(active ? "home_care.plan.activate_confirm_replace" : "home_care.plan.activate_confirm")}
              </button>
            ) : (
              <button
                className="hc-btn hc-btn--primary"
                type="button"
                onClick={() => setConfirm("activate")}
                disabled={busy || chosen === 0 || (!dirty && !draft)}
              >
                {t("home_care.plan.activate")}
              </button>
            )}
            {draft || dirty ? (
              confirm === "discard" ? (
                <button className="hc-btn hc-btn--danger" type="button" onClick={discard} disabled={busy}>
                  {t("home_care.plan.discard_confirm")}
                </button>
              ) : (
                <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setConfirm("discard")} disabled={busy}>
                  {t("home_care.plan.discard")}
                </button>
              )
            ) : null}
          </div>
        </form>
      ) : (
        <p className="hc-notice">{t("home_care.client.read_only")}</p>
      )}

      {history.length > 0 ? (
        <section className="hc-section" aria-labelledby={`${fieldId}-history`}>
          <h3 className="hc-section-title" id={`${fieldId}-history`}>
            {t("home_care.plan.history_title")}
          </h3>
          <ul className="hc-list hc-list--plain">
            {history.map((item) => (
              <li key={item.id} className="hc-entry__meta">
                {t("home_care.plan.history_line", {
                  number: item.number,
                  from: formatDateTime(item.activatedAt, timeZone),
                  to: formatDateTime(item.replacedAt, timeZone),
                  count: item.lineCount
                })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
