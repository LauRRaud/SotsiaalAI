"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { newClientActionKey } from "@/components/casework/caseWorkClient";
import { useI18n } from "@/components/i18n/I18nProvider";
import Dropdown from "@/components/ui/Dropdown";
import { CareIncidentUpdateKind, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Erijuhtumi käik: täiendused, seisumuutused ja vastutaja ajajärjestuses.
 *
 * Kirje teksti täiendus ei muuda. Hooldusjuht näeb kogu käiku ja määrab
 * vastutaja; autor näeb ja lisab oma täiendusi (hooldusjuhi märkmeid talle ei
 * näidata, sest seal võib olla info, mis ei ole kogu meeskonna jaoks).
 *
 * Käik laaditakse alles avamisel: päevikus võib olla kümneid erijuhtumeid ja
 * enamikku neist parajasti ei vaadata.
 */
export default function HomeCareIncidentTrail({ organizationId, entry, timeZone, canWrite, isCoordinator, onEntryChange }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [updates, setUpdates] = useState(null);
  const [text, setText] = useState("");
  const [assignees, setAssignees] = useState(null);
  /* Sama täienduse korduskatsel läheb teele sama võti; teksti muutmine teeb uue. */
  const attemptRef = useRef(null);

  const base = `${homeCareBase(organizationId)}/kliendid/${entry.clientId}/kirjed/${entry.id}`;
  const retracted = Boolean(entry.retractedAt);
  const assigneeId = entry.incident?.assignee?.membershipId || "";

  const load = useCallback(async () => {
    const result = await call(`${base}/kaik`, { fallbackKey: "home_care.errors.list_failed" });
    setUpdates(result.ok ? result.data.updates || [] : null);
  }, [base, call]);

  /* Seisu või vastutaja muutus (ka kirje rea nuppudest) lisab käiku rea. Lahtine
     käik laaditakse siis uuesti, muidu jääks uus rida ja sulgemise selgitus
     nägemata, kuni paneel suletakse ja avatakse. */
  const trailKey = `${entry.incident?.status || ""}|${assigneeId}`;
  const seenKey = useRef(trailKey);
  useEffect(() => {
    if (seenKey.current === trailKey) return;
    seenKey.current = trailKey;
    if (open) load();
  }, [trailKey, open, load]);

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    await load();
    if (isCoordinator && canWrite && !assignees) {
      const result = await call(`${base}/vastutaja`, { fallbackKey: "home_care.errors.list_failed" });
      if (result.ok) setAssignees(result.data.assignees || []);
    }
  };

  const add = async (event) => {
    event.preventDefault();
    if (attemptRef.current?.text !== text) attemptRef.current = { text, key: newClientActionKey() };
    const result = await call(`${base}/kaik`, {
      method: "POST",
      body: { text, clientRequestId: attemptRef.current.key },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) {
      const saved = result.data.update;
      setUpdates((current) => [...(current || []).filter((item) => item.id !== saved.id), saved]);
      setText("");
      attemptRef.current = null;
    }
  };

  const assign = async (membershipId) => {
    if ((membershipId || "") === assigneeId) return;
    const result = await call(`${base}/vastutaja`, {
      method: "POST",
      body: { membershipId: membershipId || null },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) {
      /* Käik laaditakse uuesti siis, kui kirje uus vastutaja siia jõuab (vt efekt ülal). */
      onEntryChange?.(result.data.entry);
    }
  };

  const describe = (update) => {
    if (update.kind === CareIncidentUpdateKind.STATUS) {
      const change = `${t(`home_care.incident.status.${update.fromStatus || "OPEN"}`)} → ${t(
        `home_care.incident.status.${update.toStatus}`
      )}`;
      return update.text ? `${change}. ${update.text}` : change;
    }
    if (update.kind === CareIncidentUpdateKind.ASSIGNED) {
      return update.assigned
        ? t("home_care.trail.assigned_to", { name: update.assigneeName || "—" })
        : t("home_care.trail.unassigned");
    }
    return update.text || "";
  };

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

          {updates && updates.length > 0 ? (
            <ul className="hc-list hc-list--plain">
              {updates.map((update) => (
                <li key={update.id} className="hc-entry">
                  <div className="hc-entry__head">
                    <span className="hc-badge">{t(`home_care.trail.kind.${update.kind}`)}</span>
                    <span className="hc-entry__author">{update.actorName}</span>
                    <time className="hc-entry__time" dateTime={update.createdAt}>
                      {formatDateTime(update.createdAt, timeZone)}
                    </time>
                  </div>
                  <p className="hc-entry__text">{describe(update)}</p>
                </li>
              ))}
            </ul>
          ) : updates ? (
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
