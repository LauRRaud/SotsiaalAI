"use client";

import Link from "next/link";
import { useId } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CareContactMode, CareEntryKind, CareIncidentStatus, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { useEntryActions } from "./diary/useEntryActions";
import HomeCareIncidentTrail from "./HomeCareIncidentTrail";
import { clientHref, formatDateTime, formatTime } from "./homeCareClient";

const KIND_BADGE = {
  [CareEntryKind.INCIDENT]: " hc-badge--danger",
  [CareEntryKind.HANDOVER]: " hc-badge--warn",
  [CareEntryKind.CONCERN]: " hc-badge--warn"
};

/**
 * Üks päevikukirje MITME KLIENDI LOENDIS (vana kiht): erijuhtumite leht ja
 * hooldusjuhi ülevaade. Kliendi lehel on kirje omaette vaade
 * (`./diary/EntryOpen.jsx`).
 *
 * Siin saab muuta erijuhtumi seisu, määrata vastutaja ja lisada täiendusi.
 * Kirje teksti parandamine, tühistamine ja varasem sisu käivad kliendi lehel,
 * kus on olemas kaart ja meeskond: rida viib sinna kliendi nime kaudu.
 *
 * Olek ja päringud on konksus `./diary/useEntryActions.js` (sama, mida kasutab
 * kliendi lehe vaade).
 */
export default function HomeCareEntryItem({ organizationId, entry, timeZone, canWrite = false, isCoordinator = false, onChange }) {
  const { t } = useI18n();
  const fieldId = useId();
  const { busy, error, mode, setMode, note, setNote, rights, close, setIncidentStatus } = useEntryActions({
    organizationId,
    entry,
    canWrite,
    isCoordinator,
    showClient: true,
    onChange
  });

  const { retracted, canSetIncident, canSeeTrail } = rights;
  const incident = entry.incident;

  return (
    <li className="hc-entry">
      <div className="hc-entry__head">
        {entry.client ? (
          <Link className="hc-entry__link" href={clientHref(organizationId, entry.client.id)} prefetch={false}>
            {entry.client.displayName}
          </Link>
        ) : null}
        <span className="hc-entry__author">{entry.authorName}</span>
        <time className="hc-entry__time" dateTime={entry.occurredAt}>
          {formatDateTime(entry.occurredAt, timeZone)}
        </time>
        {entry.kind !== CareEntryKind.NOTE ? (
          <span className={`hc-badge${KIND_BADGE[entry.kind] || ""}`}>{t(`home_care.entry.kinds.${entry.kind}`)}</span>
        ) : null}
        {entry.contactMode !== CareContactMode.VISIT ? (
          <span className="hc-badge">{t(`home_care.entry.contact.${entry.contactMode}`)}</span>
        ) : null}
        {entry.call ? (
          <span className="hc-badge">
            {t(`home_care.call.callers.${entry.call.caller}`)} · {t(`home_care.call.topics.${entry.call.topic}`)}
          </span>
        ) : null}
        {incident ? <span className="hc-badge">{t(`home_care.incident.status.${incident.status}`)}</span> : null}
        {entry.coordinatorOnly ? <span className="hc-badge">{t("home_care.entry.coordinator_only")}</span> : null}
        {entry.writtenLater ? <span className="hc-badge">{t("home_care.entry.written_later")}</span> : null}
        {entry.sentLater ? <span className="hc-badge">{t("home_care.entry.sent_later")}</span> : null}
        {entry.corrected ? <span className="hc-badge">{t("home_care.entry.corrected")}</span> : null}
      </div>

      {/* Hiljem kohale jõudnud kirjel on alati näha, millal server selle sai:
          sündmuse aeg ülal on inimese või seadme väide, see aeg on serveri oma. */}
      {(entry.writtenLater || entry.sentLater) && entry.createdAt ? (
        <p className="hc-entry__meta">
          {t("home_care.entry.arrived_at", { time: formatDateTime(entry.createdAt, timeZone) })}
        </p>
      ) : null}

      {incident ? <p className="hc-entry__meta">{t(`home_care.incident.types.${incident.type}`)}</p> : null}

      {retracted ? (
        <p className="hc-entry__text hc-entry__text--muted">{t("home_care.entry.retracted")}</p>
      ) : entry.text ? (
        <p className="hc-entry__text">{entry.text}</p>
      ) : null}

      {/* Käigu kirje (K2-d): kestus ja tehtud toimingud koos sellega, kuidas tehti. */}
      {entry.visit ? (
        <div className="hc-entry__meta">
          {entry.visit.minutes ? <span>{t("home_care.visit.lasted", { minutes: entry.visit.minutes })}</span> : null}
          {entry.visit.activities.length > 0 ? (
            <ul className="hc-list hc-list--plain">
              {entry.visit.activities.map((activity) => (
                <li key={activity.id}>
                  {activity.name} ·{" "}
                  {activity.outcome && activity.outcome !== "DONE" ? (
                    <span className="hc-badge hc-badge--warn">{t(`home_care.visit.outcomes.${activity.outcome}`)}</span>
                  ) : (
                    t(`home_care.visit.modes.${activity.mode}`)
                  )}
                  {activity.medication ? ` · ${t(`home_care.medication.actions.${activity.medication}`)}` : ""}
                  {activity.outsidePlan ? (
                    <>
                      {" "}
                      <span className="hc-badge">{t("home_care.visit.outside_plan")}</span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* „Kas midagi oli teisiti?" (K5-a): ainult vastus „jah" on päevikus rida. */}
      {entry.change?.answer === "YES" ? (
        <p className="hc-entry__meta">
          {t("home_care.change.entry_line", { areas: entry.change.areas.map((area) => t(`home_care.change.areas.${area}`)).join(", ") })}
          {entry.change.major ? (
            <>
              {" "}
              <span className="hc-badge hc-badge--warn">{t("home_care.change.major_badge")}</span>
            </>
          ) : null}
        </p>
      ) : null}

      {incident && !retracted && incident.assessment ? (
        <p className="hc-entry__meta">
          {t("home_care.incident.assessment_label")}: {incident.assessment}
        </p>
      ) : null}
      {incident && !retracted && incident.actions.length > 0 ? (
        <p className="hc-entry__meta">
          {t("home_care.incident.actions_label")}:{" "}
          {incident.actions
            .map((action) => `${t(`home_care.incident.actions.${action.code}`)} ${formatTime(action.at, timeZone)}`.trim())
            .join("; ")}
        </p>
      ) : null}
      {incident && incident.resolutionNote ? (
        <p className="hc-entry__meta">
          {t("home_care.incident.resolution_label")}: {incident.resolutionNote}
        </p>
      ) : null}
      {incident && incident.assignee ? (
        <p className="hc-entry__meta">
          {t("home_care.incident.assignee", { name: incident.assignee.name || "—" })}
          {entry.assigneeStale ? (
            <>
              {" "}
              <span className="hc-badge hc-badge--warn">{t("home_care.incident.assignee_stale")}</span>
            </>
          ) : null}
        </p>
      ) : null}
      {entry.companionName ? (
        <p className="hc-entry__meta">{t("home_care.entry.with_companion", { name: entry.companionName })}</p>
      ) : null}
      {entry.kind === CareEntryKind.HANDOVER && !retracted && (entry.isMine || isCoordinator) ? (
        <p className="hc-entry__meta">
          {entry.readCount > 0
            ? t("home_care.entry.read_count", { count: entry.readCount })
            : t("home_care.entry.unread")}
        </p>
      ) : null}

      {canSetIncident ? (
        <div className="hc-row">
          {incident.status === CareIncidentStatus.OPEN ? (
            <button
              className="hc-btn hc-btn--quiet"
              type="button"
              onClick={() => setIncidentStatus(CareIncidentStatus.IN_REVIEW)}
              disabled={busy}
            >
              {t("home_care.incident.set_in_review")}
            </button>
          ) : null}
          {incident.status !== CareIncidentStatus.CLOSED ? (
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setMode("close")} disabled={busy}>
              {t("home_care.incident.close")}
            </button>
          ) : null}
          {incident.status === CareIncidentStatus.CLOSED ? (
            <button
              className="hc-btn hc-btn--quiet"
              type="button"
              onClick={() => setIncidentStatus(CareIncidentStatus.OPEN)}
              disabled={busy}
            >
              {t("home_care.incident.reopen")}
            </button>
          ) : null}
        </div>
      ) : null}

      {canSeeTrail ? (
        <HomeCareIncidentTrail
          organizationId={organizationId}
          entry={entry}
          timeZone={timeZone}
          canWrite={canWrite}
          isCoordinator={isCoordinator}
          onEntryChange={onChange}
        />
      ) : null}

      {mode === "close" ? (
        <form
          className="hc-form"
          onSubmit={(event) => {
            event.preventDefault();
            setIncidentStatus(CareIncidentStatus.CLOSED, note);
          }}
        >
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-note`}>
              {t("home_care.incident.resolution_label")}
            </label>
            <textarea
              id={`${fieldId}-note`}
              className="hc-textarea hc-textarea--short"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={HOME_CARE_LIMITS.ASSESSMENT_MAX}
              rows={2}
            />
          </div>
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy}>
              {t("home_care.incident.close")}
            </button>
            <button className="hc-btn" type="button" onClick={close} disabled={busy}>
              {t("home_care.entry.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
