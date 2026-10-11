"use client";

import { useId } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Dropdown from "@/components/ui/Dropdown";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { trailRows } from "./diary/entryOpen";
import { useIncidentTrail } from "./diary/useIncidentTrail";
import { formatDateTime } from "./homeCareClient";

/**
 * Erijuhtumi käik kirje real MITME KLIENDI LOENDIS (vana kiht): erijuhtumite
 * leht ja hooldusjuhi ülevaade. Kliendi lehel on käik avatud kirje alavaade
 * (`./diary/EntryOpen.jsx`).
 *
 * Olek ja päringud on konksus `./diary/useIncidentTrail.js`, ridade sõnad
 * reeglites `./diary/entryOpen.js`; siin on ainult märgistus.
 */
export default function HomeCareIncidentTrail({ organizationId, entry, timeZone, canWrite, isCoordinator, onEntryChange }) {
  const { t } = useI18n();
  const fieldId = useId();
  const { busy, error, open, updates, text, setText, assignees, retracted, assigneeId, show, hide, add, assign } = useIncidentTrail({
    organizationId,
    entry,
    canWrite,
    isCoordinator,
    onEntryChange
  });
  const toggle = () => (open ? hide() : show());
  const rows = updates ? trailRows(updates, { t, moment: (value) => formatDateTime(value, timeZone) }) : null;

  return (
    <div className="hc-form">
      <div className="hc-row">
        <button className="hc-btn hc-btn--quiet" type="button" onClick={toggle} disabled={busy} aria-expanded={open}>
          {t("home_care.trail.toggle")}
        </button>
      </div>

      {open ? (
        <div className="hc-history">
          <h3 className="hc-section-title">{t("home_care.trail.title")}</h3>
          {isCoordinator ? null : <p className="hc-hint">{t("home_care.trail.author_only_note")}</p>}

          {rows && rows.length > 0 ? (
            <ul className="hc-list hc-list--plain">
              {rows.map((row) => (
                <li key={row.key} className="hc-entry">
                  <div className="hc-entry__head">
                    <span className="hc-badge">{row.kind}</span>
                    <span className="hc-entry__author">{row.who}</span>
                    <span className="hc-entry__time">{row.when}</span>
                  </div>
                  <p className="hc-entry__text">{row.text}</p>
                </li>
              ))}
            </ul>
          ) : rows ? (
            <p className="hc-sub">{t("home_care.trail.empty")}</p>
          ) : null}

          {isCoordinator && canWrite && !retracted && assignees ? (
            <div className="hc-field">
              <span className="hc-label">{t("home_care.trail.assignee_label")}</span>
              <Dropdown
                value={assigneeId}
                onChange={assign}
                disabled={busy}
                ariaLabel={t("home_care.trail.assignee_label")}
                options={[
                  { value: "", label: t("home_care.trail.assignee_none") },
                  ...assignees.map((person) => ({ value: person.membershipId, label: person.name || person.membershipId }))
                ]}
              />
            </div>
          ) : null}

          {canWrite && !retracted ? (
            <form className="hc-form" onSubmit={add}>
              <div className="hc-field">
                <label className="hc-label" htmlFor={`${fieldId}-update`}>
                  {t("home_care.trail.add_label")}
                </label>
                <textarea
                  id={`${fieldId}-update`}
                  className="hc-textarea hc-textarea--short"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={HOME_CARE_LIMITS.INCIDENT_UPDATE_MAX}
                  rows={2}
                  required
                  aria-describedby={`${fieldId}-update-hint`}
                />
                <p className="hc-hint" id={`${fieldId}-update-hint`}>
                  {isCoordinator ? t("home_care.trail.add_hint_coordinator") : t("home_care.trail.add_hint")}
                </p>
              </div>
              <div className="hc-row">
                <button className="hc-btn" type="submit" disabled={busy || !text.trim()}>
                  {t("home_care.trail.add")}
                </button>
              </div>
            </form>
          ) : null}

          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
