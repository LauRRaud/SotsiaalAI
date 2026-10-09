"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import DateField from "@/components/ui/DateField";
import Dropdown from "@/components/ui/Dropdown";
import { CARE_CLIENT_STATUSES, CARE_ENTRY_KINDS, CARE_STATUS_REASONS, CareClientStatus } from "@/lib/homeCare/constants";

import HomeCareCallNote from "./HomeCareCallNote";
import HomeCareCard from "./HomeCareCard";
import HomeCareClientForm from "./HomeCareClientForm";
import HomeCareDecisionView from "./HomeCareDecisionView";
import HomeCareEntryForm from "./HomeCareEntryForm";
import HomeCareEntryItem from "./HomeCareEntryItem";
import HomeCareHistory from "./HomeCareHistory";
import HomeCareOutbox from "./HomeCareOutbox";
import HomeCarePlanView from "./HomeCarePlanView";
import HomeCareReasonForm from "./HomeCareReasonForm";
import HomeCareTeam from "./HomeCareTeam";
import {
  ACCESS_REASON_REQUIRED,
  HomeCareAccessProvider,
  formatDateTime,
  homeCareBase,
  useHomeCareApi
} from "./homeCareClient";
import { getOutboxManager } from "./homeCareOutbox";

const NO_FILTER = Object.freeze({ kind: "", from: "", to: "", q: "" });

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
 *
 * LUBA VÕIB LÕPPEDA, KUI LEHT ON LAHTI (päev sai läbi, inimene eemaldati
 * meeskonnast). Siis ei asendata lehte põhjuse küsimisega, vaid vorm ilmub
 * lehe algusesse: pooleli olev kirje jääb alles ja salvestub pärast põhjuse
 * andmist sama võtmega.
 */
export default function HomeCareClientPage({ context, clientId, initial, needsReason: initialNeedsReason, unitOptions }) {
  const { t } = useI18n();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const page = useHomeCareApi();
  const diary = useHomeCareApi();
  const past = useHomeCareApi();
  const fieldId = useId();

  const [data, setData] = useState(initial || null);
  const [needsReason, setNeedsReason] = useState(Boolean(initialNeedsReason));
  const [entries, setEntries] = useState(initial?.entries || { items: [], hasMore: false, nextCursor: null });
  const [filter, setFilter] = useState(NO_FILTER);
  const [applied, setApplied] = useState(NO_FILTER);
  /* Otsingu tabamused imporditud ajaloost: `null`, kui otsingut ei ole. */
  const [historyHits, setHistoryHits] = useState(null);
  const [lapsed, setLapsed] = useState(false);
  const [panel, setPanel] = useState(null);
  const [status, setStatus] = useState(initial?.client?.status || CareClientStatus.ACTIVE);
  const [statusReason, setStatusReason] = useState(initial?.client?.statusReason || "");
  const [statusNote, setStatusNote] = useState(initial?.client?.statusNote || "");

  const base = `${homeCareBase(organizationId)}/kliendid/${clientId}`;
  const backHref = `/org/${organizationId}/koduteenus`;

  const reload = async () => {
    const result = await page.call(base, { fallbackKey: "home_care.errors.open_failed" });
    if (result.ok) {
      setData(result.data);
      setEntries(result.data.entries);
      setApplied(NO_FILTER);
      setFilter(NO_FILTER);
      setHistoryHits(null);
      setNeedsReason(false);
      setLapsed(false);
      page.setError("");
    } else if (result.messageKey === ACCESS_REASON_REQUIRED) {
      /* Sisu on juba ees: jätame lehe alles ja küsime põhjust selle kohal. */
      if (data) setLapsed(true);
      else setNeedsReason(true);
      page.setError("");
    }
    return result.ok;
  };

  /* Päeviku leht. Otsisõnaga päring läheb POST-iga (otsisõna ei tohi jääda
     aadressi ega logidesse); ilma otsisõnata on see tavaline loend. */
  const fetchEntries = (query, cursor) => {
    const q = (query.q || "").trim();
    if (q) {
      return diary.call(`${base}/kirjed/otsing`, {
        method: "POST",
        body: { q, kind: query.kind || "", from: query.from || "", to: query.to || "", cursor: cursor || "" },
        fallbackKey: "home_care.errors.search_failed"
      });
    }
    const params = new URLSearchParams();
    if (query.kind) params.set("kind", query.kind);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    if (cursor) params.set("cursor", cursor);
    const text = params.toString();
    return diary.call(`${base}/kirjed${text ? `?${text}` : ""}`, { fallbackKey: "home_care.errors.list_failed" });
  };

  /* Otsisõna otsitakse ka kliendi imporditud ajaloost (senine päevik teisest
     kohast). Liigi ja ajavahemiku filter sinna ei kehti: sellel tekstil ei ole
     kontrollitud aegu ega liike. */
  const searchHistory = async (query) => {
    const q = (query.q || "").trim();
    if (!q || !(data?.histories || []).length) {
      setHistoryHits(null);
      return;
    }
    const result = await past.call(`${base}/ajalugu/otsing`, {
      method: "POST",
      body: { q },
      fallbackKey: "home_care.errors.search_failed",
      quiet: true
    });
    setHistoryHits(result.ok ? result.data : null);
  };

  const applyFilter = async (next) => {
    const result = await fetchEntries(next);
    if (result.ok) {
      setEntries(result.data.entries);
      setApplied(next);
      setFilter(next);
      await searchHistory(next);
    } else if (result.messageKey === ACCESS_REASON_REQUIRED) {
      setLapsed(true);
    }
  };

  const loadMore = async () => {
    if (!entries.nextCursor) return;
    const result = await fetchEntries(applied, entries.nextCursor);
    if (!result.ok) {
      if (result.messageKey === ACCESS_REASON_REQUIRED) setLapsed(true);
      return;
    }
    setEntries((current) => {
      const known = new Set(current.items.map((item) => item.id));
      return {
        /* Sorteerime uuesti: vahepeal lisatud tagantjärele kirje võib kuuluda
           äsja laetud lehe kirjete vahele. */
        items: sortEntries([...current.items, ...result.data.entries.items.filter((item) => !known.has(item.id))]),
        hasMore: result.data.entries.hasMore,
        nextCursor: result.data.entries.nextCursor
      };
    });
  };

  /* Salvestatud või muudetud kirje. Filtriga päevikus otsustab SERVER, kas
     kirje sinna kuulub: laeme filtreeritud lehe uuesti, selle asemel et
     liigi- ja kuupäevareegleid brauseris korrata. */
  const upsertEntry = (entry) => {
    if (applied.kind || applied.from || applied.to || applied.q) {
      applyFilter(applied);
      return;
    }
    setEntries((current) => ({
      ...current,
      items: sortEntries([entry, ...current.items.filter((item) => item.id !== entry.id)])
    }));
  };

  /* Seadmes oodanud kirje jõudis serverisse: kui see on selle kliendi oma,
     näitab päevik seda kohe. Viide, sest `upsertEntry` sõltub kehtivast filtrist. */
  const ownerId = context.membership?.id || "";
  const upsertRef = useRef(upsertEntry);
  useEffect(() => {
    upsertRef.current = upsertEntry;
  });
  useEffect(() => {
    const manager = getOutboxManager(ownerId);
    if (!manager) return undefined;
    return manager.onSent((entry, item) => {
      if (entry && item.clientId === clientId) upsertRef.current(entry);
    });
  }, [ownerId, clientId]);

  /* Seisu vorm avaneb alati kliendi PRAEGUSE seisuga. Pooleli jäänud valik ei
     tohi järgmisel avamisel ees olla: „Lõpetatud" jääks muidu märkamatult
     salvestama. */
  const openStatusPanel = () => {
    setStatus(data.client.status);
    setStatusReason(data.client.statusReason || "");
    setStatusNote(data.client.statusNote || "");
    setPanel("status");
  };

  /* Alus kuulub seisu juurde: teise seisu valimisel eelmise seisu alus ei jää külge. */
  const reasonOptions = CARE_STATUS_REASONS[status] || [];
  const chooseStatus = (value) => {
    if (value === status) return;
    setStatus(value);
    if (!(CARE_STATUS_REASONS[value] || []).includes(statusReason)) setStatusReason("");
    /* Selgitus kuulub samuti seisu juurde: „haiglas alates 9.10" ei tohi minna kaasa lõpetamisele. */
    setStatusNote(value === data.client.status ? data.client.statusNote || "" : "");
  };
  const reasonMissing = reasonOptions.length > 0 && !reasonOptions.includes(statusReason);

  const saveStatus = async (event) => {
    event.preventDefault();
    const result = await page.call(`${base}/seis`, {
      method: "POST",
      body: { status, statusReason: reasonOptions.length ? statusReason : null, statusNote, version: data.client.version },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) {
      setData((current) => ({
        ...current,
        client: result.data.client,
        statusHistory: result.data.statusHistory || current.statusHistory
      }));
      setPanel(null);
    }
  };

  if (needsReason) {
    return (
      <section className="hc-shell">
        <Link className="hc-back" href={backHref}>
          {t("home_care.client.back")}
        </Link>
        <HomeCareReasonForm
          organizationId={organizationId}
          clientId={clientId}
          writable={Boolean(context.writable)}
          onGranted={() => reload()}
        />
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
  const statusHistory = Array.isArray(data.statusHistory) ? data.statusHistory : [];
  const ended = client.status === CareClientStatus.ENDED;
  const canWrite = Boolean(access.canWrite);
  const canAddEntry = canWrite && (!ended || access.isCoordinator);
  const filterActive = Boolean(applied.kind || applied.from || applied.to || applied.q);
  const activeTeam = team.filter((member) => member.active);

  return (
    <HomeCareAccessProvider onReasonRequired={() => setLapsed(true)}>
    <section className="hc-shell">
      <Link className="hc-back" href={backHref}>
        {t("home_care.client.back")}
      </Link>

      {lapsed ? (
        <HomeCareReasonForm
          organizationId={organizationId}
          clientId={client.id}
          writable={canWrite}
          heading="h2"
          onGranted={() => setLapsed(false)}
        />
      ) : null}

      <header className="hc-head">
        <h1 className="hc-title">{client.displayName}</h1>
        <div className="hc-row">
          {client.status !== CareClientStatus.ACTIVE ? (
            <span className={`hc-badge${ended ? "" : " hc-badge--warn"}`}>{t(`home_care.status.${client.status}`)}</span>
          ) : null}
          {client.status !== CareClientStatus.ACTIVE && client.statusReason ? (
            <span className="hc-sub">{t(`home_care.status_reason.${client.status}.${client.statusReason}`)}</span>
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

      <HomeCareOutbox ownerId={ownerId} timeZone={timeZone} />

      <HomeCareCard
        organizationId={organizationId}
        clientId={client.id}
        lines={card}
        canEdit={canWrite && access.canEditCard}
        onChange={(next) => setData((current) => ({ ...current, card: next }))}
      />

      {/* Täna kehtiv otsus ja otsustatud maht (K2-c). Kogu meeskonnale lugemiseks. */}
      <section className="hc-section" aria-labelledby={`${fieldId}-decision`}>
        <h2 className="hc-section-title" id={`${fieldId}-decision`}>
          {t("home_care.decision.title")}
        </h2>
        {data.decision ? <HomeCareDecisionView decision={data.decision} /> : <p className="hc-hint">{t("home_care.decision.none")}</p>}
        {access.isCoordinator ? (
          <Link
            className="hc-btn hc-btn--quiet hc-btn--link"
            href={`/org/${organizationId}/koduteenus/kliendid/${client.id}/otsused`}
            prefetch={false}
          >
            {t("home_care.decision.edit_link")}
          </Link>
        ) : null}
      </section>

      {/* Kehtiv hoolduskava (K2-b): mida siin tehakse, kui sageli ja kuidas. Kogu meeskonnale lugemiseks. */}
      <section className="hc-section" aria-labelledby={`${fieldId}-plan`}>
        <h2 className="hc-section-title" id={`${fieldId}-plan`}>
          {t("home_care.plan.title")}
        </h2>
        {data.plan ? <HomeCarePlanView plan={data.plan} /> : <p className="hc-hint">{t("home_care.plan.none")}</p>}
        {access.isCoordinator ? (
          <Link
            className="hc-btn hc-btn--quiet hc-btn--link"
            href={`/org/${organizationId}/koduteenus/kliendid/${client.id}/kava`}
            prefetch={false}
          >
            {t(data.plan ? "home_care.plan.edit_link" : "home_care.plan.create_link")}
          </Link>
        ) : null}
      </section>

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
            clientName={client.displayName}
            timeZone={timeZone}
            plan={data.plan}
            onSaved={upsertEntry}
          />
          {/* Kõne ei ole käik: selle märkimine ei tohi nõuda vormi täitmist. */}
          <HomeCareCallNote
            organizationId={organizationId}
            clientId={client.id}
            clientName={client.displayName}
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
          className="hc-form"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilter(filter);
          }}
        >
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-search`}>
              {t("home_care.filter.search_label")}
            </label>
            <div className="hc-row hc-row--search">
              <input
                id={`${fieldId}-search`}
                className="hc-input"
                type="search"
                value={filter.q}
                onChange={(event) => setFilter((current) => ({ ...current, q: event.target.value }))}
                maxLength={80}
                autoComplete="off"
                enterKeyHint="search"
                aria-describedby={`${fieldId}-search-hint`}
              />
              <button className="hc-btn" type="submit" disabled={diary.busy}>
                {t("home_care.home.search_button")}
              </button>
            </div>
            <p className="hc-hint" id={`${fieldId}-search-hint`}>
              {t("home_care.filter.search_hint")}
            </p>
          </div>
        </form>

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
                onClick={() => applyFilter(NO_FILTER)}
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
          <p className="hc-sub" role="status">
            {applied.q ? t("home_care.filter.search_empty") : t("home_care.filter.empty")}
          </p>
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
                plan={data.plan}
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

        {historyHits && historyHits.items.length > 0 ? (
          <>
            <h3 className="hc-section-title">{t("home_care.history.hits_title")}</h3>
            <p className="hc-hint">{t("home_care.history.hits_hint")}</p>
            <ul className="hc-list hc-list--plain">
              {historyHits.items.map((hit) => (
                <li key={`${hit.historyId}-${hit.position}`} className="hc-entry">
                  <div className="hc-entry__head">
                    <span className="hc-entry__author">{hit.title}</span>
                    <span className="hc-badge hc-badge--warn">{t("home_care.history.mark")}</span>
                  </div>
                  <p className="hc-entry__text">{hit.text}</p>
                </li>
              ))}
            </ul>
            {historyHits.hasMore ? <p className="hc-hint">{t("home_care.history.hits_more")}</p> : null}
          </>
        ) : null}
      </section>

      <HomeCareHistory
        organizationId={organizationId}
        clientId={client.id}
        histories={data.histories || []}
        timeZone={timeZone}
        isCoordinator={access.isCoordinator}
        canWrite={canWrite}
        onChange={(next) => {
          setData((current) => ({ ...current, histories: next }));
          setHistoryHits(null);
        }}
      />

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

      {statusHistory.length > 0 ? (
        <section className="hc-section" aria-labelledby={`${fieldId}-status-history`}>
          <h2 className="hc-section-title" id={`${fieldId}-status-history`}>
            {t("home_care.client.status_history")}
          </h2>
          <ul className="hc-list hc-list--plain">
            {statusHistory.map((change) => (
              <li key={change.id} className="hc-entry__meta">
                {[
                  formatDateTime(change.changedAt, timeZone),
                  t(`home_care.status.${change.toStatus}`),
                  change.reason ? t(`home_care.status_reason.${change.toStatus}.${change.reason}`) : null,
                  change.note,
                  change.actorName
                ]
                  .filter(Boolean)
                  .join(" · ")}
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

          {/* Kronoloogia koostamine on lugemine ja valik, seepärast on link olemas ka
              siis, kui asutus ei ole kirjutatav; väljastuse loomise keelab sel
              juhul server. */}
          <div className="hc-row">
            <Link
              className="hc-btn hc-btn--quiet hc-btn--link"
              href={`/org/${organizationId}/koduteenus/kliendid/${client.id}/kronoloogia`}
              prefetch={false}
            >
              {t("home_care.chronology.link")}
            </Link>
            <Link
              className="hc-btn hc-btn--quiet hc-btn--link"
              href={`/org/${organizationId}/koduteenus/kliendid/${client.id}/silt`}
              prefetch={false}
            >
              {t("home_care.door_tag.link")}
            </Link>
          </div>

          {canWrite && panel === null ? (
            <div className="hc-row">
              <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setPanel("details")}>
                {t("home_care.client.edit")}
              </button>
              <button className="hc-btn hc-btn--quiet" type="button" onClick={openStatusPanel}>
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
                    onClick={() => chooseStatus(value)}
                  >
                    {t(`home_care.status.${value}`)}
                  </button>
                ))}
              </div>
              {reasonOptions.length > 0 ? (
                <>
                  <div className="hc-chips" role="group" aria-label={t("home_care.client.status_reason")}>
                    {reasonOptions.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className="hc-chip"
                        aria-pressed={statusReason === value}
                        onClick={() => setStatusReason(value)}
                      >
                        {t(`home_care.status_reason.${status}.${value}`)}
                      </button>
                    ))}
                  </div>
                  {status === CareClientStatus.ENDED ? <p className="hc-sub">{t("home_care.client.status_ended_hint")}</p> : null}
                </>
              ) : null}
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
                <button className="hc-btn hc-btn--primary" type="submit" disabled={page.busy || reasonMissing}>
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
    </HomeCareAccessProvider>
  );
}
