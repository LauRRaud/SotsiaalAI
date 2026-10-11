"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Dropdown from "@/components/ui/Dropdown";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Kliendi meeskond hooldusjuhile. Meeskond näeb klienti ilma põhjust andmata;
 * eemaldamine lõpetab rea, ajalugu jääb alles.
 *
 * Liikmete valik laaditakse alles siis, kui hooldusjuht hakkab kedagi lisama:
 * kliendi lehe avamine ei pea iga kord kogu asutuse nimekirja tooma.
 */
export default function HomeCareTeam({ organizationId, clientId, team, canWrite, onChange }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const [candidates, setCandidates] = useState(null);
  const [selected, setSelected] = useState("");

  const base = `${homeCareBase(organizationId)}/kliendid/${clientId}/meeskond`;
  const inTeam = new Set(team.map((member) => member.membershipId));

  const loadCandidates = async () => {
    const result = await call(`${homeCareBase(organizationId)}/liikmed`, { fallbackKey: "home_care.errors.list_failed" });
    if (result.ok) setCandidates(result.data.members || []);
  };

  const add = async (event) => {
    event.preventDefault();
    if (!selected) return;
    const result = await call(base, {
      method: "POST",
      body: { membershipId: selected },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) {
      onChange(result.data.team || []);
      setSelected("");
    }
  };

  const remove = async (membershipId) => {
    const result = await call(`${base}/${membershipId}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) onChange(result.data.team || []);
  };

  const options = (candidates || [])
    .filter((member) => !inTeam.has(member.membershipId))
    .map((member) => ({ value: member.membershipId, label: member.name || member.membershipId }));

  return (
    <div className="hc-form">
      <h3 className="hc-section-title">{t("home_care.team.title")}</h3>
      <p className="hc-hint">{t("home_care.team.hint")}</p>

      {team.length === 0 ? (
        <p className="hc-sub">{t("home_care.team.empty")}</p>
      ) : (
        <ul className="hc-list hc-list--plain">
          {team.map((member) => (
            <li key={member.membershipId} className="hc-cardline">
              <span className="hc-cardline__text">
                {member.name}
                {member.active ? "" : ` (${t("home_care.team.inactive")})`}
              </span>
              {canWrite ? (
                <button
                  className="hc-btn hc-btn--quiet"
                  type="button"
                  onClick={() => remove(member.membershipId)}
                  disabled={busy}
                >
                  {t("home_care.team.remove")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        candidates ? (
          <form className="hc-row hc-row--search" onSubmit={add}>
            <div className="hc-field hc-field--grow">
              <Dropdown
                value={selected}
                onChange={setSelected}
                ariaLabel={t("home_care.team.add_label")}
                placeholder={t("home_care.team.add_label")}
                options={options}
              />
            </div>
            <button className="hc-btn" type="submit" disabled={busy || !selected}>
              {t("home_care.team.add")}
            </button>
          </form>
        ) : (
          <div className="hc-row">
            <button className="hc-btn hc-btn--quiet" type="button" onClick={loadCandidates} disabled={busy}>
              {t("home_care.team.add_label")}
            </button>
          </div>
        )
      ) : null}

      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
