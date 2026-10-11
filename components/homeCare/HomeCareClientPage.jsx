"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgPart from "@/components/org/OrgPart";
import DateField from "@/components/ui/DateField";
import Dropdown from "@/components/ui/Dropdown";
import { CARE_CLIENT_STATUSES, CARE_ENTRY_KINDS, CARE_STATUS_REASONS, CareCardLineKind, CareClientStatus, CareEndReason } from "@/lib/homeCare/constants";

import styles from "./client/client.module.css";
import {
  CLIENT_LANDING,
  canOpenNoAnswer,
  clientTiles,
  clientViewer,
  doorAlerts,
  doorHandover,
  doorNotices,
  partVisible,
  reviewItems as reviewItemsOf,
  viewAllowed,
  viewNameKey
} from "./client/clientParts";
import { DoorView, HandoversView, OldPart, PartsView } from "./client/ClientViews";
import HomeCareCallNote from "./HomeCareCallNote";
import HomeCareCard from "./HomeCareCard";
import HomeCareChangeSignals from "./HomeCareChangeSignals";
import HomeCareCrisis from "./HomeCareCrisis";
import HomeCareClientForm from "./HomeCareClientForm";
import HomeCareControlCalls from "./HomeCareControlCalls";
import HomeCareDecisionNotices from "./HomeCareDecisionNotices";
import HomeCareTransport from "./HomeCareTransport";
import HomeCareDecisionView, { decisionVolumeLabel, minutesLabel } from "./HomeCareDecisionView";
import HomeCareEntryForm from "./HomeCareEntryForm";
import HomeCareEntryItem from "./HomeCareEntryItem";
import HomeCareFridgeSheet from "./HomeCareFridgeSheet";
import HomeCareHistory from "./HomeCareHistory";
import HomeCareOutbox from "./HomeCareOutbox";
import HomeCarePlanView, { planDayLabel } from "./HomeCarePlanView";
import HomeCareReasonForm from "./HomeCareReasonForm";
import HomeCareRelatives from "./HomeCareRelatives";
import HomeCareSafetyCard from "./HomeCareSafetyCard";
import HomeCareKeys from "./HomeCareKeys";
import HomeCareNearMiss from "./HomeCareNearMiss";
import HomeCareNoAnswer from "./HomeCareNoAnswer";
import HomeCareMoney from "./HomeCareMoney";
import HomeCarePreconditions from "./HomeCarePreconditions";
import HomeCareRepresentatives from "./HomeCareRepresentatives";
import HomeCareSlotList from "./HomeCareSlotList";
import HomeCareSupplies from "./HomeCareSupplies";
import HomeCareWorkNature from "./HomeCareWorkNature";
import HomeCareTeam from "./HomeCareTeam";
import HomeCareUsualState from "./HomeCareUsualState";
import {
  ACCESS_REASON_REQUIRED,
  HomeCareAccessProvider,
  clientHref,
  formatDateTime,
  homeCareBase,
  useHomeCareApi
} from "./homeCareClient";
import { getOutboxManager } from "./homeCareOutbox";
import { euroText } from "./HomeCareMoney";

const NO_FILTER = Object.freeze({ kind: "", from: "", to: "", q: "" });

function sortEntries(items) {
  return [...items].sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

/**
 * Kliendi leht: OSADE LAUD ja osade vaated.
 *
 * KUJU (11.10, kavandi variant A). Leht oli üks pikk keritav leht (proovandmetega
 * 13 000 px). Nüüd on iga osa omaette vaade ja leht ise on osade laud: plaadid
 * kõigi osadega, mida inimene näeb, ja plaadil osa seis lehe enda andmetest.
 * Leht avaneb kõigil vaatega „Ukse taga" (kaart „Enne kui lähed" ja eelmise
 * hooldaja teade peavad olema ees enne sisenemist). Kiirmenüü nelja ruuduga nupp
 * kannab osa vaates nime „Kliendi leht" ja viib osade lauale; osade laual viib
 * see koduteenusesse (kest `components/org/OrgPart.jsx`).
 *
 * VAADE, MIS EI OLE EES, JÄÄB LEHELE ALLES (peidetult). Osade sisu on veel vanal
 * `hc-*` kihil ja hoiab oma olekut ise: kui vaade eemaldataks, kaoks pooleli
 * kirje, avatud vorm ja äsja salvestatud seis. Seepärast on kõik osad korraga
 * lehel nagu enne ja ees on üks.
 *
 * Meeskonda mittekuuluv hooldaja näeb sisu asemel põhjuse küsimist. Enne
 * põhjuse andmist ei näita leht kliendi kohta midagi.
 *
 * LUBA VÕIB LÕPPEDA, KUI LEHT ON LAHTI (päev sai läbi, inimene eemaldati
 * meeskonnast). Siis ei asendata lehte põhjuse küsimisega, vaid vorm ilmub
 * avatud vaate kohale, ükskõik mis vaade ees on: pooleli olev kirje jääb alles
 * ja salvestub pärast põhjuse andmist sama võtmega.
 *
 * Reeglid on failis ./client/clientParts.js, vaated failis ./client/ClientViews.jsx.
 */
export default function HomeCareClientPage({ context, clientId, initial, needsReason: initialNeedsReason, unitOptions }) {
  const { t, locale } = useI18n();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const page = useHomeCareApi();
  const diary = useHomeCareApi();
  const past = useHomeCareApi();
  const fieldId = useId();
  const rootRef = useRef(null);

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
  const [confirmDeath, setConfirmDeath] = useState(false);
  /* Avatud vaade; tühi sõne on osade laud. */
  const [view, setView] = useState(CLIENT_LANDING);

  const base = `${homeCareBase(organizationId)}/kliendid/${clientId}`;

  /* Vaate vahetusel algab paneel ülalt ja fookus läheb vaate pealkirjale, et
     ekraanilugeja ja klaviatuur jõuaksid kaasa. Esimesel joonistusel fookust ei võeta. */
  const shown = useRef(null);
  useEffect(() => {
    const first = shown.current === null;
    const moved = shown.current !== view;
    shown.current = view;
    if (first || !moved) return;
    rootRef.current?.closest(".panel-body")?.scrollTo({ top: 0 });
    rootRef.current?.querySelector(`[data-view="${view || "parts"}"] [data-step-heading]`)?.focus({ preventScroll: true });
  }, [view]);

  /* Luba lõppes: põhjuse vorm on avatud vaate kohal, paneel keritakse selle juurde. */
  useEffect(() => {
    if (lapsed) rootRef.current?.closest(".panel-body")?.scrollTo({ top: 0 });
  }, [lapsed]);

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
    setConfirmDeath(false);
    setPanel("status");
  };

  /* Alus kuulub seisu juurde: teise seisu valimisel eelmise seisu alus ei jää külge. */
  const reasonOptions = CARE_STATUS_REASONS[status] || [];
  const chooseStatus = (value) => {
    if (value === status) return;
    setConfirmDeath(false);
    setStatus(value);
    if (!(CARE_STATUS_REASONS[value] || []).includes(statusReason)) setStatusReason("");
    /* Selgitus kuulub samuti seisu juurde: „haiglas alates 9.10" ei tohi minna kaasa lõpetamisele. */
    setStatusNote(value === data.client.status ? data.client.statusNote || "" : "");
  };
  const reasonMissing = reasonOptions.length > 0 && !reasonOptions.includes(statusReason);
  /* Surm (kava II.6.5): allikas on kohustuslik ja salvestamine käib kahes sammus. */
  const death = status === CareClientStatus.ENDED && statusReason === CareEndReason.DIED;
  const sourceMissing = death && !statusNote.trim();

  const saveStatus = async (event) => {
    event.preventDefault();
    if (death && !confirmDeath) {
      setConfirmDeath(true);
      return;
    }
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
      setConfirmDeath(false);
      setPanel(null);
    }
  };

  const pageName = t("home_care.client.page_name");

  if (needsReason) {
    return (
      <OrgPart context={context} part="home_care" partLabel={t("home_care.client.page_name")}>
        <OldPart title={pageName}>
          <HomeCareReasonForm organizationId={organizationId} clientId={clientId} writable={Boolean(context.writable)} onGranted={() => reload()} />
        </OldPart>
      </OrgPart>
    );
  }

  if (!data) {
    return (
      <OrgPart context={context} part="home_care" partLabel={t("home_care.client.page_name")}>
        <OldPart title={pageName}>
          <p className="hc-error" role="alert">
            {page.error || t("home_care.errors.open_failed")}
          </p>
        </OldPart>
      </OrgPart>
    );
  }

  const { client, card, team, recentOpeners, access } = data;
  const statusHistory = Array.isArray(data.statusHistory) ? data.statusHistory : [];
  const ended = client.status === CareClientStatus.ENDED;
  const who = clientViewer(data);
  const canWrite = who.canWrite;
  const canAddEntry = who.canAddEntry;
  const filterActive = Boolean(applied.kind || applied.from || applied.to || applied.q);
  const activeTeam = team.filter((member) => member.active);
  const format = {
    t,
    day: planDayLabel,
    moment: (value) => formatDateTime(value, timeZone).slice(0, 10),
    euro: (cents) => euroText(cents, locale),
    volume: (decision) => decisionVolumeLabel(t, decision)
  };
  /* Lahtised asjad peatatud või lõppenud kliendi juures, arvutatud lehe enda andmetest. */
  const reviewItems = reviewItemsOf(data, format);
  /* Päeviku plaadi rida: viimane kirje filtrita päevikust (filtriga päeviku esimene kirje ei ole viimane kirje). */
  const tileData = { ...data, latestEntryAt: (filterActive ? data.entries?.items : entries.items)?.[0]?.occurredAt || "" };
  /* Vaade, mida inimene enam ei näe (näiteks kirje vorm pärast lõpetamist), annab osade laua. */
  const current = viewAllowed(view, who, data) ? view : "";
  const sees = (part) => partVisible(part, who, data);
  const toDoor = { label: t("home_care.door.back"), onBack: () => setView("door") };

  const head = {
    name: client.displayName,
    chips: client.status !== CareClientStatus.ACTIVE ? [{ key: "status", text: t(`home_care.status.${client.status}`), wait: !ended }] : [],
    state:
      client.status !== CareClientStatus.ACTIVE
        ? [client.statusReason ? t(`home_care.status_reason.${client.status}.${client.statusReason}`) : null, client.statusNote].filter(Boolean).join(" · ")
        : "",
    address: client.address || "",
    phone: client.contactPhone ? { text: client.contactPhone, href: `tel:${client.contactPhone.replace(/[^\d+]/g, "")}` } : null,
    contact: client.contactNote || ""
  };
  const handover = doorHandover(data);
  const handoverMeta = (item) => [item.authorName, formatDateTime(item.occurredAt, timeZone)].filter(Boolean).join(" · ");

  /* Üks vaade: ees või peidetult lehel. Funktsioon, mitte komponent, et vaate sisu ei loodaks igal joonistusel uuesti. */
  const slot = (name, body) => (
    <div key={name || "parts"} className={styles.slot} data-view={name || "parts"} hidden={current !== name}>
      {body}
    </div>
  );
  const part = (name, body) => (sees(name) ? slot(name, <OldPart title={t(viewNameKey(name))}>{body}</OldPart>) : null);

  return (
    <div ref={rootRef}>
      <OrgPart
        context={context}
        part="home_care"
        partLabel={current ? t(viewNameKey(current)) : pageName}
        up={current ? { label: pageName, href: clientHref(organizationId, client.id) } : null}
        onDesk={current ? () => setView("") : undefined}
      >
        <HomeCareAccessProvider onReasonRequired={() => setLapsed(true)}>
          {lapsed ? (
            <section className={`hc-shell ${styles.old}`} data-lapsed="1">
              <HomeCareReasonForm organizationId={organizationId} clientId={client.id} writable={canWrite} inPage onGranted={() => setLapsed(false)} />
            </section>
          ) : null}

          {/* Seadmes ootavad kirjed: osade laual ja vaates „Ukse taga", sest sinna leht avaneb. */}
          <section className={`hc-shell ${styles.old}`} hidden={current !== "" && current !== "door"}>
            <HomeCareOutbox ownerId={ownerId} timeZone={timeZone} />
          </section>

          {slot("", <PartsView title={pageName} client={head} tiles={clientTiles(who, tileData, format)} onOpen={setView} />)}

          {slot(
            "door",
            <DoorView
              title={t(viewNameKey("door"))}
              client={head}
              notices={doorNotices(who, data, format)}
              alerts={doorAlerts(who, data, format).map((alert) => ({ ...alert, onOpen: () => setView(alert.view) }))}
              card={{
                title: t("home_care.card.title"),
                lines: card.map((line) => ({ id: line.id, kind: t(`home_care.card.kinds.${line.kind}`), risk: line.kind === CareCardLineKind.RISK, text: line.text })),
                empty: t(canWrite && access.canEditCard ? "home_care.card.empty" : "home_care.card.empty_readonly"),
                edit: canWrite && access.canEditCard ? { label: t(card.length ? "home_care.card.edit" : "home_care.card.add"), onEdit: () => setView("card") } : null
              }}
              /* Viimane teade järgmisele: eelmise hooldaja sõnum peab olema näha enne käiku, mitte päeviku põhjas. */
              handover={
                handover.latest
                  ? {
                      title: t("home_care.client.handovers_title"),
                      text: handover.latest.text,
                      meta: handoverMeta(handover.latest),
                      more: handover.more ? t("home_care.door.more_handovers", { count: handover.more }) : "",
                      onOpen: () => setView("handovers")
                    }
                  : null
              }
              actions={{
                noAnswer: canOpenNoAnswer(who, data) ? { label: t("home_care.door.no_answer"), onOpen: () => setView("no_answer") } : null,
                entry: canAddEntry ? { label: t("home_care.door.write_entry"), onOpen: () => setView("entry") } : null
              }}
            />
          )}

          {slot(
            "handovers",
            <HandoversView
              title={t("home_care.client.handovers_title")}
              items={(data.recentHandovers || []).map((item) => ({ id: item.id, text: item.text, meta: handoverMeta(item) }))}
              back={toDoor}
            />
          )}

          {/* Püsikaart „enne kui lähed": ridade lisamine ja muutmine. */}
          {slot(
            "card",
            <OldPart title={t("home_care.card.title")} back={toDoor}>
              <HomeCareCard
                organizationId={organizationId}
                clientId={client.id}
                lines={card}
                canEdit={canWrite && access.canEditCard}
                onChange={(next) => setData((now) => ({ ...now, card: next }))}
              />
            </OldPart>
          )}

          {/* Kui uks ei avane (K4-f): kokkulepitud sammud ja nupp „Ei saa sisse". */}
          {slot(
            "no_answer",
            <OldPart title={t("home_care.no_answer.title")} back={toDoor}>
              <HomeCareNoAnswer
                organizationId={organizationId}
                clientId={client.id}
                clientName={client.displayName}
                viewerMembershipId={access.membershipId}
                timeZone={timeZone}
                initial={data.doorSteps || []}
                canEdit={canWrite && access.canEditCard}
                canRecord={canAddEntry}
                onSaved={upsertEntry}
              />
            </OldPart>
          )}

          {part(
            "entry",
            <>
              <section className="hc-section" aria-label={t("home_care.entry.new_title")}>
                <HomeCareEntryForm
                  organizationId={organizationId}
                  clientId={client.id}
                  team={team}
                  viewerMembershipId={access.membershipId}
                  clientName={client.displayName}
                  timeZone={timeZone}
                  plan={data.plan}
                  usualState={data.usualState || []}
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
              {/* „Peaaegu juhtus" (K5-h): kahe puudutusega märge olukorrast, kus midagi oleks võinud juhtuda. */}
              <HomeCareNearMiss
                organizationId={organizationId}
                clientId={client.id}
                clientName={client.displayName}
                viewerMembershipId={access.membershipId}
                onSaved={upsertEntry}
              />
            </>
          )}

          {part(
            "diary",
            <>
              <section className="hc-section" aria-label={t("home_care.filter.title")}>
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
                        onChange={(event) => setFilter((now) => ({ ...now, q: event.target.value }))}
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
                      onChange={(value) => setFilter((now) => ({ ...now, kind: value }))}
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
                      onChange={(value) => setFilter((now) => ({ ...now, from: value || "" }))}
                      ariaLabel={t("home_care.filter.from")}
                    />
                  </div>
                  <div className="hc-field">
                    <span className="hc-label">{t("home_care.filter.to")}</span>
                    <DateField
                      name="to"
                      value={filter.to}
                      onChange={(value) => setFilter((now) => ({ ...now, to: value || "" }))}
                      ariaLabel={t("home_care.filter.to")}
                    />
                  </div>
                  <div className="hc-row">
                    <button className="hc-btn" type="submit" disabled={diary.busy}>
                      {t("home_care.filter.apply")}
                    </button>
                    {filterActive ? (
                      <button className="hc-btn hc-btn--quiet" type="button" onClick={() => applyFilter(NO_FILTER)} disabled={diary.busy}>
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
                  setData((now) => ({ ...now, histories: next }));
                  setHistoryHits(null);
                }}
              />
            </>
          )}

          {/* Kehtiv hoolduskava (K2-b): mida siin tehakse, kui sageli ja kuidas. Kogu meeskonnale lugemiseks. */}
          {part(
            "plan",
            <section className="hc-section" aria-label={t("home_care.plan.title")}>
              {data.plan ? <HomeCarePlanView plan={data.plan} /> : <p className="hc-hint">{t("home_care.plan.none")}</p>}
              {/* Käigud ilma ühegi erandita (K6-g): märge kliendi, mitte töötaja kohta. Ainult hooldusjuhile. */}
              {data.exceptionStreak ? (
                <p className="hc-notice">
                  {t("home_care.exception_streak.line", { count: data.exceptionStreak.visits, date: formatDateTime(data.exceptionStreak.since, timeZone) })}
                </p>
              ) : null}
              {/* Abi rohkem või vähem kui kavas (K6-d): käigul märgitud viis võrreldes kava reaga. */}
              {data.helpDrift && data.helpDrift.more + data.helpDrift.less > 0 ? (
                <p className={data.helpDrift.due ? "hc-notice hc-notice--warn" : "hc-sub"}>
                  {t("home_care.help_drift.line", { more: data.helpDrift.more, less: data.helpDrift.less, total: data.helpDrift.total })}
                  {data.helpDrift.due ? ` ${t(access.isCoordinator ? "home_care.help_drift.due_coordinator" : "home_care.help_drift.due_team")}` : ""}
                </p>
              ) : null}
              {access.isCoordinator ? (
                <Link className="hc-btn hc-btn--quiet hc-btn--link" href={`/org/${organizationId}/koduteenus/kliendid/${client.id}/kava`} prefetch={false}>
                  {t(data.plan ? "home_care.plan.edit_link" : "home_care.plan.create_link")}
                </Link>
              ) : null}
            </section>
          )}

          {/* Käigumuster (K3-a): mis päevadel ja kellaaegadel siin käiakse ja kes läheb. */}
          {part(
            "slots",
            <section className="hc-section" aria-label={t("home_care.slots.title")}>
              {/* Eilne ja tänane käik seisuga (K5-l): vastus küsimusele „kas käidi?" ühe pilguga. */}
              {data.recentVisits ? (
                <ul className="hc-list hc-list--plain">
                  {data.recentVisits.map((item, index) => (
                    <li key={item.day}>
                      <strong>{t(index === 0 ? "home_care.recent.yesterday" : "home_care.recent.today")}:</strong>{" "}
                      {item.away
                        ? t("home_care.recent.away")
                        : item.visits.length
                          ? item.visits.map((visit) => `${visit.startTime} ${t(`home_care.day.states.${visit.state}`)}`).join(", ")
                          : t("home_care.recent.none")}
                    </li>
                  ))}
                </ul>
              ) : null}
              <h3 className="hc-section-title">{t("home_care.slots.title")}</h3>
              <HomeCareSlotList slots={data.slots} today={data.today || ""} />
              {access.isCoordinator ? (
                <Link className="hc-btn hc-btn--quiet hc-btn--link" href={`/org/${organizationId}/koduteenus/kliendid/${client.id}/kaigud`} prefetch={false}>
                  {t("home_care.slots.edit_link")}
                </Link>
              ) : null}
              {/* Külmkapileht (K5-g): prinditav leht kliendi koju. Meeskond ja hooldusjuht.
                  Kliendi kuuleht (K6-e) samalt väljalt: ainult hooldusjuht, ka ilma käigumustrita. */}
              {(access.canEditCard && data.slots?.length) || access.isCoordinator ? (
                <HomeCareFridgeSheet
                  organizationId={organizationId}
                  clientId={client.id}
                  showFridge={Boolean(access.canEditCard && data.slots?.length)}
                  canStatement={access.isCoordinator}
                />
              ) : null}
            </section>
          )}

          {/* Täna kehtiv otsus ja otsustatud maht (K2-c). Kogu meeskonnale lugemiseks. */}
          {part(
            "decision",
            <section className="hc-section" aria-label={t("home_care.decision.title")}>
              {data.decision ? <HomeCareDecisionView decision={data.decision} /> : <p className="hc-hint">{t("home_care.decision.none")}</p>}
              {/* Osutatud aeg (K2-e): selle nädala ja selle kuu käigu kirjed. */}
              {data.provided
                ? ["week", "month"].map((period) => {
                    const sums = data.provided[period];
                    return (
                      <p className="hc-entry__meta" key={period}>
                        {sums.visits === 0
                          ? t(`home_care.provided.${period}_none`)
                          : [
                              t(`home_care.provided.${period}`, { visits: sums.visits, amount: minutesLabel(t, sums.minutes) }),
                              sums.withoutLength ? t("home_care.provided.without_length", { count: sums.withoutLength }) : null
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                      </p>
                    );
                  })
                : null}
              {/* Püsivuse näit (K5-f): mitu eri töötajat tegi viimase nelja nädala käigud. */}
              {data.continuity ? (
                <p className="hc-sub">
                  {data.continuity.workers === 1
                    ? t("home_care.continuity.one", { visits: data.continuity.visits })
                    : t("home_care.continuity.many", {
                        workers: data.continuity.workers,
                        top: data.continuity.topWorkers,
                        percent: data.continuity.topPercent,
                        visits: data.continuity.visits
                      })}
                </p>
              ) : null}
              {access.isCoordinator ? (
                <Link className="hc-btn hc-btn--quiet hc-btn--link" href={`/org/${organizationId}/koduteenus/kliendid/${client.id}/otsused`} prefetch={false}>
                  {t("home_care.decision.edit_link")}
                </Link>
              ) : null}
            </section>
          )}

          {part(
            "safety",
            <>
              {/* Eeltingimus enne teenuse algust (K4-a): kuni see on täitmata, teenust ei alustata. */}
              <HomeCarePreconditions organizationId={organizationId} clientId={client.id} initial={data.preconditions || []} canEdit={canWrite && access.isCoordinator} />

              {/* Ohutuskaart (K5-n): kodu kui töökoht. Seda peab enne minekut teadma. */}
              <HomeCareSafetyCard organizationId={organizationId} clientId={client.id} initial={data.safety || null} canEdit={canWrite && access.canEditCard} />

              {/* Tavaline seis (K5-a): selle järgi hindab hooldaja, kas täna oli midagi teisiti. */}
              <HomeCareUsualState
                organizationId={organizationId}
                clientId={client.id}
                initial={data.usualState || []}
                canEdit={canWrite && access.canEditCard}
                onChanged={(usualState) => setData((now) => ({ ...now, usualState }))}
              />

              {/* Töö iseloom (K3-g): „ainult kahekesi" peab olema näha enne minekut. */}
              <HomeCareWorkNature organizationId={organizationId} clientId={client.id} initial={data.workNature || null} canEdit={canWrite && access.isCoordinator} />

              {/* Kriisivalmidus (K5-b): kui palju tuge klient kriisis vajab ja millest ta sõltub. */}
              <HomeCareCrisis organizationId={organizationId} clientId={client.id} initial={data.crisis || null} canEdit={canWrite && access.isCoordinator} />
            </>
          )}

          {/* Võtmed (K4-b): mis võtmed asutuse käes on ja kelle käes iga võti praegu on. */}
          {part(
            "keys",
            <HomeCareKeys
              organizationId={organizationId}
              clientId={client.id}
              initial={data.keys || []}
              receivers={data.keyReceivers || []}
              canManage={access.isCoordinator}
              canWrite={canWrite}
              myMembershipId={access.membershipId}
              onChanged={(keys) => setData((now) => ({ ...now, keys }))}
            />
          )}

          {/* Kliendi sularaha vaataja käes (K4-c): arvestus, mitte makse. */}
          {part(
            "money",
            <HomeCareMoney
              organizationId={organizationId}
              clientId={client.id}
              initial={data.money || null}
              canWrite={canWrite && !ended}
              isCoordinator={access.isCoordinator}
              onChanged={(money) => setData((now) => ({ ...now, money }))}
            />
          )}

          {/* Varud kliendi kodus (K4-e): seisu märgib igaüks, kes siin käib. */}
          {part(
            "supplies",
            <HomeCareSupplies
              organizationId={organizationId}
              clientId={client.id}
              initial={data.supplies || []}
              timeZone={timeZone}
              canWrite={canWrite && !ended}
              canManage={access.isCoordinator}
              onChanged={(supplies) => setData((now) => ({ ...now, supplies }))}
            />
          )}

          {/* Transport (K5-w): eesolevad sõidud ja soovid; „Telli transport" meeskonnale ja hooldusjuhile. */}
          {part(
            "transport",
            <HomeCareTransport
              organizationId={organizationId}
              clientId={client.id}
              initial={data.transport || null}
              canRequest={canWrite && access.canEditCard && !ended}
              isCoordinator={access.isCoordinator}
              canWrite={canWrite}
              today={data.today || ""}
              onChanged={(transport) => setData((now) => ({ ...now, transport }))}
            />
          )}

          {part(
            "relatives",
            <>
              {/* Lähedased ja jagamisaste (K5-k): kellele ja mida klient on lubanud rääkida. */}
              <HomeCareRelatives
                organizationId={organizationId}
                clientId={client.id}
                initial={data.relatives || []}
                canEdit={canWrite && access.isCoordinator}
                canFlag={canWrite && access.canEditCard}
                onChanged={(relatives) => setData((now) => ({ ...now, relatives }))}
              />

              {/* Esindusõigus (K6-i): kes tohib kliendi eest otsustada ja alla kirjutada. */}
              <HomeCareRepresentatives organizationId={organizationId} clientId={client.id} initial={data.representatives || []} canEdit={canWrite && access.isCoordinator} />
            </>
          )}

          {part(
            "team",
            <>
              <section className="hc-section" aria-label={t("home_care.team.title")}>
                {access.isCoordinator ? (
                  <HomeCareTeam organizationId={organizationId} clientId={client.id} team={team} canWrite={canWrite} onChange={(next) => setData((now) => ({ ...now, team: next }))} />
                ) : (
                  <p className="hc-sub">{activeTeam.length > 0 ? activeTeam.map((member) => member.name).join(", ") : t("home_care.team.empty")}</p>
                )}
              </section>

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
            </>
          )}

          {part(
            "manage",
            <>
              {/* Peatamisel ja lõpetamisel üle vaadata (K4-g): mis on selle kliendi juures veel lahti. */}
              {reviewItems.length ? (
                <section className="hc-section" aria-labelledby={`${fieldId}-review`}>
                  <h2 className="hc-section-title" id={`${fieldId}-review`}>
                    {t(ended ? "home_care.review.ended_title" : "home_care.review.away_title")}
                  </h2>
                  <ul className="hc-list hc-list--plain">
                    {reviewItems.map((item) => (
                      <li key={item.key}>{item.text}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* Märkamised, mis ootavad vastust (K5-a): enne muud, sest need on hooldusjuhi teha. */}
              <HomeCareChangeSignals
                organizationId={organizationId}
                initial={data.changeSignals}
                timeZone={timeZone}
                onChanged={(changeSignals) => setData((now) => ({ ...now, changeSignals }))}
              />

              {/* Kontrollkõne (K6-l): hooldusjuhi enda kõne kliendile kord kvartalis. */}
              {data.controlCalls ? <HomeCareControlCalls organizationId={organizationId} clientId={client.id} initial={data.controlCalls} canEdit={canWrite} /> : null}

              {/* Teated otsustajale (K5-r). Valikuks on päeviku esimese lehe kirjed. */}
              <HomeCareDecisionNotices
                organizationId={organizationId}
                clientId={client.id}
                initial={data.decisionNotices || []}
                entries={entries.items}
                canEdit={canWrite}
                today={data.today || ""}
                timeZone={timeZone}
              />

              <section className="hc-section" aria-label={t("home_care.client.manage")}>
                {/* Kronoloogia koostamine on lugemine ja valik, seepärast on link olemas ka
                    siis, kui asutus ei ole kirjutatav; väljastuse loomise keelab sel
                    juhul server. */}
                <div className="hc-row">
                  <Link className="hc-btn hc-btn--quiet hc-btn--link" href={`/org/${organizationId}/koduteenus/kliendid/${client.id}/kronoloogia`} prefetch={false}>
                    {t("home_care.chronology.link")}
                  </Link>
                  <Link className="hc-btn hc-btn--quiet hc-btn--link" href={`/org/${organizationId}/koduteenus/kliendid/${client.id}/silt`} prefetch={false}>
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
                        setData((now) => ({ ...now, client: next }));
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
                        <button key={value} type="button" className="hc-chip" aria-pressed={status === value} onClick={() => chooseStatus(value)}>
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
                              onClick={() => {
                                setConfirmDeath(false);
                                setStatusReason(value);
                              }}
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
                        {death ? t("home_care.client.status_source") : t("home_care.client.status_note")}
                      </label>
                      <input
                        id={`${fieldId}-status-note`}
                        className="hc-input"
                        value={statusNote}
                        onChange={(event) => setStatusNote(event.target.value)}
                        maxLength={300}
                        autoComplete="off"
                        required={death}
                      />
                    </div>
                    {death && confirmDeath ? <p className="hc-notice hc-notice--warn">{t("home_care.client.status_death_confirm")}</p> : null}
                    <div className="hc-row">
                      <button className="hc-btn hc-btn--primary" type="submit" disabled={page.busy || reasonMissing || sourceMissing}>
                        {death ? (confirmDeath ? t("home_care.client.status_death_save") : t("home_care.client.status_death_next")) : t("home_care.client.status_save")}
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
            </>
          )}
        </HomeCareAccessProvider>
      </OrgPart>
    </div>
  );
}
