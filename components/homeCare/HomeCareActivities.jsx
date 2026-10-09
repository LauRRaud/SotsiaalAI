"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";
import Dropdown from "@/components/ui/Dropdown";
import {
  CARE_ACTIVITY_DOMAINS,
  CARE_ACTIVITY_GROUPS,
  CARE_ACTIVITY_GROUP_DOMAIN,
  HOME_CARE_LIMITS
} from "@/lib/homeCare/constants";

import HomeCareOutbox from "./HomeCareOutbox";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Asutuse toimingute kataloog.
 *
 * Ülemine tase on määruse nr 40 kuusteist toimingurühma (kuus koduabi, kümme
 * isikuabi) ja seda siin ei muudeta. Selle all on asutuse enda toimingud tema enda
 * sõnadega. Loevad kõik hooldajad; lisab, muudab ja arhiveerib kogu asutuse hooldusjuht.
 */
export default function HomeCareActivities({ context, initial }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const fieldId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const base = `${homeCareBase(organizationId)}/toimingud`;

  const [activities, setActivities] = useState(initial?.activities || []);
  const canEdit = Boolean(initial?.canEdit) && Boolean(context.writable);
  /* Avatud vorm: `{ mode: "add", group }` või `{ mode: "edit", id }`. Korraga üks. */
  const [form, setForm] = useState(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [group, setGroup] = useState("");

  const active = activities.filter((item) => !item.archivedAt);
  const archived = activities.filter((item) => item.archivedAt);
  const groupLabel = (value) => t(`home_care.activities.groups.${value}`);

  const openAdd = (targetGroup) => {
    setForm({ mode: "add", group: targetGroup });
    setName("");
    setNote("");
    setGroup(targetGroup);
  };
  const openEdit = (item) => {
    setForm({ mode: "edit", id: item.id });
    setName(item.name);
    setNote(item.note || "");
    setGroup(item.group);
  };
  const closeForm = () => setForm(null);

  const upsert = (item) =>
    setActivities((current) => (current.some((row) => row.id === item.id) ? current.map((row) => (row.id === item.id ? item : row)) : [...current, item]));

  const save = async (event) => {
    event.preventDefault();
    if (!form || !name.trim()) return;
    const editing = form.mode === "edit" ? activities.find((item) => item.id === form.id) : null;
    const result = editing
      ? await call(`${base}/${encodeURIComponent(editing.id)}`, {
          method: "PATCH",
          body: { name, note, group, version: editing.version },
          fallbackKey: "home_care.errors.save_failed"
        })
      : await call(base, { method: "POST", body: { name, note, group }, fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) {
      upsert(result.data.activity);
      closeForm();
    }
  };

  const setArchived = async (item, value) => {
    const result = await call(`${base}/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: { archived: value, version: item.version },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) upsert(result.data.activity);
  };

  const seed = async () => {
    const result = await call(base, { method: "POST", body: { seed: true }, fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setActivities(result.data.activities);
  };

  const formBlock = (
    <form className="hc-form" onSubmit={save}>
      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-name`}>
          {t("home_care.activities.name")}
        </label>
        <input
          id={`${fieldId}-name`}
          className="hc-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={HOME_CARE_LIMITS.ACTIVITY_NAME_MAX}
          autoComplete="off"
          required
        />
      </div>
      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-note`}>
          {t("home_care.activities.note")}
        </label>
        <input
          id={`${fieldId}-note`}
          className="hc-input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={HOME_CARE_LIMITS.ACTIVITY_NOTE_MAX}
          autoComplete="off"
        />
      </div>
      {form?.mode === "edit" ? (
        <div className="hc-field">
          <span className="hc-label">{t("home_care.activities.group")}</span>
          <Dropdown
            value={group}
            onChange={setGroup}
            ariaLabel={t("home_care.activities.group")}
            placeholder={t("home_care.activities.group")}
            options={CARE_ACTIVITY_GROUPS.map((value) => ({ value, label: groupLabel(value) }))}
            required
          />
        </div>
      ) : null}
      <div className="hc-row">
        <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !name.trim()}>
          {t("home_care.activities.save")}
        </button>
        <button className="hc-btn" type="button" onClick={closeForm} disabled={busy}>
          {t("home_care.client.cancel")}
        </button>
      </div>
    </form>
  );

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />
      <HomeCareOutbox ownerId={context.membership?.id || ""} timeZone={timeZone} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus`}>
          {t("home_care.client.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.activities.title")}</h2>
        <p className="hc-sub">{t("home_care.activities.intro")}</p>
      </div>

      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}

      {activities.length === 0 ? (
        <section className="hc-section">
          <p className="hc-sub">{t(canEdit ? "home_care.activities.empty_editor" : "home_care.activities.empty")}</p>
          {canEdit ? (
            <div className="hc-row">
              <button className="hc-btn hc-btn--primary" type="button" onClick={seed} disabled={busy}>
                {t("home_care.activities.seed")}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {CARE_ACTIVITY_DOMAINS.map((domain) => (
        <section className="hc-section" key={domain} aria-labelledby={`${fieldId}-${domain}`}>
          <h3 className="hc-section-title" id={`${fieldId}-${domain}`}>
            {t(`home_care.activities.domains.${domain}`)}
          </h3>
          {CARE_ACTIVITY_GROUPS.filter((value) => CARE_ACTIVITY_GROUP_DOMAIN[value] === domain).map((value) => {
            const items = active.filter((item) => item.group === value);
            const adding = form?.mode === "add" && form.group === value;
            return (
              <div className="hc-field" key={value}>
                <h4 className="hc-label">{groupLabel(value)}</h4>
                {items.length > 0 ? (
                  <ul className="hc-list hc-list--plain">
                    {items.map((item) =>
                      form?.mode === "edit" && form.id === item.id ? (
                        <li key={item.id}>{formBlock}</li>
                      ) : (
                        <li key={item.id}>
                          <span>{item.name}</span>
                          {item.note ? <span className="hc-sub"> {item.note}</span> : null}
                          {canEdit && !form ? (
                            <span className="hc-row">
                              <button className="hc-btn hc-btn--quiet" type="button" onClick={() => openEdit(item)} disabled={busy}>
                                {t("home_care.activities.edit")}
                              </button>
                              <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setArchived(item, true)} disabled={busy}>
                                {t("home_care.activities.archive")}
                              </button>
                            </span>
                          ) : null}
                        </li>
                      )
                    )}
                  </ul>
                ) : (
                  <p className="hc-hint">{t("home_care.activities.group_empty")}</p>
                )}
                {adding ? formBlock : null}
                {canEdit && !form ? (
                  <button className="hc-btn hc-btn--quiet" type="button" onClick={() => openAdd(value)} disabled={busy}>
                    {t("home_care.activities.add")}
                  </button>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}

      {canEdit && archived.length > 0 ? (
        <section className="hc-section" aria-labelledby={`${fieldId}-archived`}>
          <h3 className="hc-section-title" id={`${fieldId}-archived`}>
            {t("home_care.activities.archived_title")}
          </h3>
          <ul className="hc-list hc-list--plain">
            {archived.map((item) => (
              <li key={item.id}>
                <span>{item.name}</span>
                <span className="hc-sub"> {groupLabel(item.group)}</span>
                <span className="hc-row">
                  <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setArchived(item, false)} disabled={busy}>
                    {t("home_care.activities.restore")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="hc-hint">{t("home_care.activities.source")}</p>
    </section>
  );
}
