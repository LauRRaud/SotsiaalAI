"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import DateField from "@/components/ui/DateField";
import Dropdown from "@/components/ui/Dropdown";
import {
  CARE_ACCESS_REASONS,
  CARE_CLIENT_STATUSES,
  CARE_ENTRY_KINDS,
  CareAccessReason,
  CareClientStatus
} from "@/lib/homeCare/constants";

import HomeCareCard from "./HomeCareCard";
import HomeCareClientForm from "./HomeCareClientForm";
import HomeCareEntryForm from "./HomeCareEntryForm";
import HomeCareEntryItem from "./HomeCareEntryItem";
import HomeCareTeam from "./HomeCareTeam";
import { ACCESS_REASON_REQUIRED, formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

function sortEntries(items) {
  return [...items].sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

/**
 * Kliendi leht telefonis: üks veerg, püsikaart „enne kui lähed" kõige ees,
 * siis uus kirje ja päevik. Hooldusjuhi haldus on lehe lõpus, et hooldaja ei
 * peaks sellest ukse taga mööda kerima.
 *
 * Meeskonda mittekuuluv hooldaja näeb sisu asemel põhjuse küsimist. Enne
 * põhjuse andmist ei näita leht kliendi kohta midagi.
 */
export default function HomeCareClientPage({ context, clientId, initial, needsReason: initialNeedsReason, unitOptions }) {
  const { t } = useI18n();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const page = useHomeCareApi();
  const diary = useHomeCareApi();
  const fieldId = useId();

  const [data, setData] = useState(initial || null);
  const [needsReason, setNeedsReason] = useState(Boolean(initialNeedsReason));
  const [entries, setEntries] = useState(initial?.entries || { items: [], hasMore: false, nextCursor: null });
  const [filter, setFilter] = useState({ kind: "", from: "", to: "" });
  const [applied, setApplied] = useState({ kind: "", from: "", to: "" });
  const [reasonCode, setReasonCode] = useState(CareAccessReason.COVERING);
  const [reasonText, setReasonText] = useState("");
  const [panel, setPanel] = useState(null);
  const [status, setStatus] = useState(initial?.client?.status || CareClientStatus.ACTIVE);
  const [statusNote, setStatusNote] = useState(initial?.client?.statusNote || "");

  const base = `${homeCareBase(organizationId)}/kliendid/${clientId}`;
  const backHref = `/org/${organizationId}/koduteenus`;

  const reload = async () => {
    const result = await page.call(base, { fallbackKey: "home_care.errors.open_failed" });
    if (result.ok) {
      setData(result.data);
      setEntries(result.data.entries);
      setApplied({ kind: "", from: "", to: "" });
      setFilter({ kind: "", from: "", to: "" });
      setStatus(result.data.client.status);
      setStatusNote(result.data.client.statusNote || "");
      setNeedsReason(false);
      page.setError("");
    } else if (result.messageKey === ACCESS_REASON_REQUIRED) {
      setNeedsReason(true);
      page.setError("");
    }
    return result.ok;
  };

  const submitReason = async (event) => {
    event.preventDefault();
    const result = await page.call(`${base}/ava`, {
      method: "POST",
      body: { reasonCode, reason: reasonText },
      fallbackKey: "home_care.errors.open_failed"
    });
    if (result.ok) await reload();
  };

  const entriesUrl = (query, cursor) => {
    const params = new URLSearchParams();
    if (query.kind) params.set("kind", query.kind);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    if (cursor) params.set("cursor", cursor);
    const text = params.toString();
    return `${base}/kirjed${text ? `?${text}` : ""}`;
  };

  const applyFilter = async (next) => {
    const result = await diary.call(entriesUrl(next), { fallbackKey: "home_care.errors.list_failed" });
    if (result.ok) {
      setEntries(result.data.entries);
      setApplied(next);
      setFilter(next);
    }
  };

  const loadMore = async () => {
    if (!entries.nextCursor) return;
    const result = await diary.call(entriesUrl(applied, entries.nextCursor), {
      fallbackKey: "home_care.errors.list_failed"
    });
    if (!result.ok) return;
    setEntries((current) => {
      const known = new Set(current.items.map((item) => item.id));
      return {
        items: [...current.items, ...result.data.entries.items.filter((item) => !known.has(item.id))],
        hasMore: result.data.entries.hasMore,
        nextCursor: result.data.entries.nextCursor
      };
    });
  };

  const upsertEntry = (entry) => {
    setEntries((current) => ({
      ...current,
      items: sortEntries([entry, ...current.items.filter((item) => item.id !== entry.id)])
    }));
  };

  const saveStatus = async (event) => {
    event.preventDefault();
    const result = await page.call(`${base}/seis`, {
      method: "POST",
      body: { status, statusNote, version: data.client.version },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) {
      setData((current) => ({ ...current, client: result.data.client }));
      setPanel(null);
    }
  };

  if (needsReason) {
    return (
      <section className="hc-shell">
        <Link className="hc-back" href={backHref}>
          {t("home_care.client.back")}
        </Link>
        <form className="hc-section" onSubmit={submitReason}>
          <h1 className="hc-title">{t("home_care.reason.title")}</h1>
          <p className="hc-sub">{t("home_care.reason.intro")}</p>
          <div className="hc-field">
            <span className="hc-label" id={`${fieldId}-reason`}>
              {t("home_care.reason.code_label")}
            </span>
            <div className="hc-chips" role="group" aria-labelledby={`${fieldId}-reason`}>
              {CARE_ACCESS_REASONS.map((code) => (
                <button
                  key={code}
                  type="button"
                  className="hc-chip"
                  aria-pressed={reasonCode === code}
                  onClick={() => setReasonCode(code)}
                >
                  {t(`home_care.reason.codes.${code}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-reason-text`}>
              {t("home_care.reason.text_label")}
            </label>
            <input
              id={`${fieldId}-reason-text`}
              className="hc-input"
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              maxLength={300}
              autoComplete="off"
            />
          </div>
          {page.error ? (
            <p className="hc-error" role="alert">
              {page.error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={page.busy || !context.writable}>
              {t("home_care.reason.submit")}
            </button>
          </div>
          {context.writable ? null : <p className="hc-hint">{t("home_care.client.read_only")}</p>}
        </form>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="hc-shell">
        <Link className="hc-back" href={backHref}>
          {t("home_care.client.back")}
        </Link>
        <p className="hc-error" role="alert">
          {page.error || t("home_care.errors.open_failed")}
        </p>
      </section>
    );
  }

  const { client, card, team, recentOpeners, access } = data;
  const ended = client.status === CareClientStatus.ENDED;
  const canWrite = Boolean(access.canWrite);
  const canAddEntry = canWrite && (!ended || access.isCoordinator);
  const filterActive = Boolean(applied.kind || applied.from || applied.to);
  const activeTeam = team.filter((member) => member.active);

  return (
    <section className="hc-shell">
      <Link className="hc-back" href={backHref}>
        {t("home_care.client.back")}
      </Link>

      <header className="hc-head">
        <h1 className="hc-title">{client.displayName}</h1>
        <div className="hc-row">
          {client.status !== CareClientStatus.ACTIVE ? (
            <span className={`hc-badge${ended ? "" : " hc-badge--warn"}`}>{t(`home_care.status.${client.status}`)}</span>
          ) : null}
          {client.status !== CareClientStatus.ACTIVE && client.statusNote ? (
            <span className="hc-sub">{client.statusNote}</span>
          ) : null}
        </div>
        {client.address ? <p className="hc-sub">{client.address}</p> : null}
        {client.contactPhone ? (
          <a className="hc-tel" href={`tel:${client.contactPhone.replace(/[^\d+]/g, "")}`}>
            {client.contactPhone}
          </a>
        ) : null}
        {client.contactNote ? <p className="hc-sub hc-sub--pre">{client.contactNote}</p> : null}
      </header>

      {data.talkToCoordinator ? (
        <p className="hc-notice hc-notice--warn" role="status">
          {t("home_care.client.talk_to_coordinator")}
        </p>
      ) : null}
      {client.status === CareClientStatus.AWAY ? <p className="hc-notice">{t("home_care.client.away_notice")}</p> : null}
      {ended ? <p className="hc-notice">{t("home_care.client.ended_notice")}</p> : null}
      {canWrite ? null : <p className="hc-notice">{t("home_care.client.read_only")}</p>}

      <HomeCareCard
        organizationId={organizationId}
        clientId={client.id}
        lines={card}
        canEdit={canWrite && access.canEditCard}
        onChange={(next) => setData((current) => ({ ...current, card: next }))}
      />

      {canAddEntry ? (
        <section className="hc-section" aria-labelledby={`${fieldId}-new`}>
          <h2 className="hc-section-title" id={`${fieldId}-new`}>
            {t("home_care.entry.new_title")}
          </h2>
          <HomeCareEntryForm
            organizationId={organizationId}
            clientId={client.id}
            team={team}
            viewerMembershipId={access.membershipId}
            onSaved={upsertEntry}
          />
        </section>
      ) : null}

      <section className="hc-section" aria-labelledby={`${fieldId}-diary`}>
        <h2 className="hc-section-title" id={`${fieldId}-diary`}>
          {t("home_care.filter.title")}
        </h2>
        <form
          className="hc-filter"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilter(filter);
          }}
        >
          <div className="hc-field">
            <span className="hc-label">{t("home_care.entry.kind_label")}</span>
            <Dropdown
              value={filter.kind}
              onChange={(value) => setFilter((current) => ({ ...current, kind: value }))}
              ariaLabel={t("home_care.entry.kind_label")}
              options={[
                { value: "", label: t("home_care.filter.kind_all") },
                ...CARE_ENTRY_KINDS.map((value) => ({ value, label: t(`home_care.entry.kinds.${value}`) }))
              ]}
            />
          </div>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.filter.from")}</span>
            <DateField
              name="from"
              value={filter.from}
              onChange={(value) => setFilter((current) => ({ ...current, from: value || "" }))}
              ariaLabel={t("home_care.filter.from")}
            />
          </div>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.filter.to")}</span>
            <DateField
              name="to"
              value={filter.to}
              onChange={(value) => setFilter((current) => ({ ...current, to: value || "" }))}
              ariaLabel={t("home_care.filter.to")}
            />
          </div>
          <div className="hc-row">
            <button className="hc-btn" type="submit" disabled={diary.busy}>
              {t("home_care.filter.apply")}
            </button>
            {filterActive ? (
              <button
                className="hc-btn hc-btn--quiet"
                type="button"
                onClick={() => applyFilter({ kind: "", from: "", to: "" })}
                disabled={diary.busy}
              >
                {t("home_care.filter.clear")}
              </button>
            ) : null}
          </div>
        </form>

        {diary.error ? (
          <p className="hc-error" role="alert">
            {diary.error}
          </p>
        ) : null}

        {entries.items.length === 0 ? (
          <p className="hc-sub">{t("home_care.filter.empty")}</p>
        ) : (
          <ul className="hc-list hc-list--plain">
            {entries.items.map((entry) => (
              <HomeCareEntryItem
                key={entry.id}
                organizationId={organizationId}
                entry={entry}
                timeZone={timeZone}
                canWrite={canWrite}
                isCoordinator={access.isCoordinator}
                team={team}
                viewerMembershipId={access.membershipId}
                onChange={upsertEntry}
              />
            ))}
          </ul>
        )}
        {entries.hasMore ? (
          <div className="hc-row">
            <button className="hc-btn" type="button" onClick={loadMore} disabled={diary.busy}>
              {t("home_care.filter.more")}
            </button>
          </div>
        ) : null}
      </section>

      {access.isCoordinator ? null : (
        <section className="hc-section" aria-labelledby={`${fieldId}-team`}>
          <h2 className="hc-section-title" id={`${fieldId}-team`}>
            {t("home_care.team.title")}
          </h2>
          <p className="hc-sub">
            {activeTeam.length > 0 ? activeTeam.map((member) => member.name).join(", ") : t("home_care.team.empty")}
          </p>
        </section>
      )}

      {recentOpeners.length > 0 ? (
        <section className="hc-section" aria-labelledby={`${fieldId}-openers`}>
          <h2 className="hc-section-title" id={`${fieldId}-openers`}>
            {t("home_care.client.opened_recently")}
          </h2>
          <ul className="hc-list hc-list--plain">
            {recentOpeners.map((opener, index) => (
              <li key={`${opener.at}-${index}`} className="hc-entry__meta">
                {opener.name} · {t(`home_care.client.basis.${opener.basis}`)} · {formatDateTime(opener.at, timeZone)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {access.isCoordinator ? (
        <section className="hc-section" aria-labelledby={`${fieldId}-manage`}>
          <h2 className="hc-section-title" id={`${fieldId}-manage`}>
            {t("home_care.client.manage")}
          </h2>

          <HomeCareTeam
            organizationId={organizationId}
            clientId={client.id}
            team={team}
            canWrite={canWrite}
            onChange={(next) => setData((current) => ({ ...current, team: next }))}
          />

          {canWrite && panel === null ? (
            <div className="hc-row">
              <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setPanel("details")}>
                {t("home_care.client.edit")}
              </button>
              <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setPanel("status")}>
                {t("home_care.client.status_title")}
              </button>
            </div>
          ) : null}

          {panel === "details" ? (
            <>
              <h3 className="hc-section-title">{t("home_care.client.details")}</h3>
              <HomeCareClientForm
                organizationId={organizationId}
                client={client}
                unitOptions={unitOptions}
                onCancel={() => setPanel(null)}
                onSaved={(next) => {
                  setData((current) => ({ ...current, client: next }));
                  setPanel(null);
                }}
              />
            </>
          ) : null}

          {panel === "status" ? (
            <form className="hc-form" onSubmit={saveStatus}>
              <h3 className="hc-section-title">{t("home_care.client.status_title")}</h3>
              <div className="hc-chips" role="group" aria-label={t("home_care.client.status_title")}>
                {CARE_CLIENT_STATUSES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="hc-chip"
                    aria-pressed={status === value}
                    onClick={() => setStatus(value)}
                  >
                    {t(`home_care.status.${value}`)}
                  </button>
                ))}
              </div>
              <div className="hc-field">
                <label className="hc-label" htmlFor={`${fieldId}-status-note`}>
                  {t("home_care.client.status_note")}
                </label>
                <input
                  id={`${fieldId}-status-note`}
                  className="hc-input"
                  value={statusNote}
                  onChange={(event) => setStatusNote(event.target.value)}
                  maxLength={300}
                  autoComplete="off"
                />
              </div>
              <div className="hc-row">
                <button className="hc-btn hc-btn--primary" type="submit" disabled={page.busy}>
                  {t("home_care.client.status_save")}
                </button>
                <button className="hc-btn" type="button" onClick={() => setPanel(null)} disabled={page.busy}>
                  {t("home_care.client.cancel")}
                </button>
              </div>
            </form>
          ) : null}

          {page.error ? (
            <p className="hc-error" role="alert">
              {page.error}
            </p>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
