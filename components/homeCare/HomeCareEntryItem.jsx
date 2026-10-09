"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CareContactMode, CareEntryKind, CareIncidentStatus, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import HomeCareEntryForm from "./HomeCareEntryForm";
import HomeCareIncidentTrail from "./HomeCareIncidentTrail";
import { clientHref, formatDateTime, formatTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

const KIND_BADGE = {
  [CareEntryKind.INCIDENT]: " hc-badge--danger",
  [CareEntryKind.HANDOVER]: " hc-badge--warn",
  [CareEntryKind.CONCERN]: " hc-badge--warn"
};

/**
 * Üks päevikukirje.
 *
 * Kirjet ei kustutata: tühistatud kirje jääb oma kohale ilma tekstita ja
 * parandatud kirjel on märge. Varasemat sisu näevad autor ja hooldusjuht
 * („Ajalugu").
 *
 * `showClient` on hooldusjuhi ülevaate jaoks: seal on kirjed mitme kliendi
 * kohta ja parandamine käib kliendi lehel, kus on olemas kaart ja meeskond.
 */
export default function HomeCareEntryItem({
  organizationId,
  entry,
  timeZone,
  canWrite = false,
  isCoordinator = false,
  team = [],
  viewerMembershipId = null,
  showClient = false,
  onChange
}) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [mode, setMode] = useState(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [revisions, setRevisions] = useState(null);

  const clientId = entry.clientId;
  const base = `${homeCareBase(organizationId)}/kliendid/${clientId}/kirjed/${entry.id}`;
  const retracted = Boolean(entry.retractedAt);
  const incident = entry.incident;
  const canEdit = canWrite && !showClient && (entry.isMine || isCoordinator);
  /* Erijuhtumi tühistab hooldusjuht: autori tühistus võtaks lahtise juhtumi
     registrist vaikselt maha. Server keelab sama. */
  const canRetract = canEdit && (!incident || isCoordinator);
  const canSeeHistory = !showClient && (entry.isMine || isCoordinator) && entry.revision > 1;
  const canSetIncident = canWrite && isCoordinator && incident && !retracted;
  /* Juhtumi käiku näevad hooldusjuht ja autor (autor ainult oma täiendusi). */
  const canSeeTrail = Boolean(incident) && (isCoordinator || entry.isMine);

  const close = () => {
    setMode(null);
    setReason("");
    setNote("");
    setError("");
  };

  const retract = async (event) => {
    event.preventDefault();
    const result = await call(`${base}/tuhista`, {
      method: "POST",
      body: { reason, revision: entry.revision },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) {
      onChange?.(result.data.entry);
      close();
    }
  };

  const setIncidentStatus = async (status, withNote = "") => {
    const result = await call(`${base}/juhtum`, {
      method: "POST",
      body: { status, note: withNote },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) {
      onChange?.(result.data.entry);
      close();
    }
  };

  const toggleHistory = async () => {
    if (mode === "history") {
      close();
      return;
    }
    setMode("history");
    const result = await call(`${base}/ajalugu`, { fallbackKey: "home_care.errors.list_failed" });
    setRevisions(result.ok ? result.data.revisions || [] : null);
  };

  if (mode === "correct") {
    return (
      <li className="hc-entry">
        <h3 className="hc-section-title">{t("home_care.entry.correct_title")}</h3>
        <HomeCareEntryForm
          organizationId={organizationId}
          clientId={clientId}
          team={team}
          viewerMembershipId={viewerMembershipId}
          timeZone={timeZone}
          entry={entry}
          onCancel={close}
          onSaved={(next) => {
            onChange?.(next);
            close();
          }}
        />
      </li>
    );
  }

  return (
    <li className="hc-entry">
      <div className="hc-entry__head">
        {showClient && entry.client ? (
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
      ) : (
        <p className="hc-entry__text">{entry.text}</p>
      )}

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

      {canEdit || canSeeHistory || canSetIncident ? (
        <div className="hc-row">
          {canEdit && !retracted ? (
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setMode("correct")} disabled={busy}>
              {t("home_care.entry.correct")}
            </button>
          ) : null}
          {canRetract && !retracted ? (
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setMode("retract")} disabled={busy}>
              {t("home_care.entry.retract")}
            </button>
          ) : null}
          {canSeeHistory ? (
            <button
              className="hc-btn hc-btn--quiet"
              type="button"
              onClick={toggleHistory}
              disabled={busy}
              aria-expanded={mode === "history"}
            >
              {t("home_care.entry.history")}
            </button>
          ) : null}
          {canSetIncident && incident.status === CareIncidentStatus.OPEN ? (
            <button
              className="hc-btn hc-btn--quiet"
              type="button"
              onClick={() => setIncidentStatus(CareIncidentStatus.IN_REVIEW)}
              disabled={busy}
            >
              {t("home_care.incident.set_in_review")}
            </button>
          ) : null}
          {canSetIncident && incident.status !== CareIncidentStatus.CLOSED ? (
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setMode("close")} disabled={busy}>
              {t("home_care.incident.close")}
            </button>
          ) : null}
          {canSetIncident && incident.status === CareIncidentStatus.CLOSED ? (
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

      {mode === "retract" ? (
        <form className="hc-form" onSubmit={retract}>
          <h3 className="hc-section-title">{t("home_care.entry.retract_title")}</h3>
          <p className="hc-hint">{t("home_care.entry.retract_hint")}</p>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-reason`}>
              {t("home_care.entry.reason_label")}
            </label>
            <input
              id={`${fieldId}-reason`}
              className="hc-input"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={HOME_CARE_LIMITS.REASON_MAX}
              required
              autoComplete="off"
            />
          </div>
          <div className="hc-row">
            <button className="hc-btn hc-btn--danger" type="submit" disabled={busy}>
              {t("home_care.entry.retract_save")}
            </button>
            <button className="hc-btn" type="button" onClick={close} disabled={busy}>
              {t("home_care.entry.cancel")}
            </button>
          </div>
        </form>
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

      {mode === "history" && revisions ? (
        <div className="hc-history">
          <h3 className="hc-section-title">{t("home_care.entry.history_title")}</h3>
          {revisions.length === 0 ? (
            <p className="hc-sub">{t("home_care.entry.history_empty")}</p>
          ) : (
            <ul className="hc-list hc-list--plain">
              {revisions.map((revision) => (
                <li key={revision.id} className="hc-entry">
                  <div className="hc-entry__head">
                    <span className="hc-badge">{t(`home_care.entry.revision_kind.${revision.kind}`)}</span>
                    <span className="hc-entry__author">{revision.actorName}</span>
                    <time className="hc-entry__time" dateTime={revision.createdAt}>
                      {formatDateTime(revision.createdAt, timeZone)}
                    </time>
                  </div>
                  <p className="hc-entry__meta">
                    {t("home_care.entry.reason_label")}: {revision.reason}
                  </p>
                  <p className="hc-entry__text hc-entry__text--muted">{revision.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
