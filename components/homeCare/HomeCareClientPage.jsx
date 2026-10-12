"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgPart from "@/components/org/OrgPart";
import { CARE_CLIENT_STATUSES, CARE_ENTRY_KINDS, CARE_STATUS_REASONS, CareCardLineKind, CareClientStatus, CareEndReason } from "@/lib/homeCare/constants";

import ClientCard from "./card/ClientCard";
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
import { continuityLine, decisionSheet, decisionVolumeLabel, providedLines } from "./decision/decisionRows";
import { DecisionView } from "./decision/DecisionViews";
import { DIARY_PAGE, HITS_PAGE, NO_FILTER, diaryPage, diaryRows, filterActive as filterActiveOf, filterLine, historyVisible } from "./diary/diaryRows";
import { DiarySearchView, DiaryView, HistoryHitsView } from "./diary/DiaryViews";
import EntryOpen from "./diary/EntryOpen";
import ImportedHistory from "./diary/ImportedHistory";
import HomeCareCallNote from "./HomeCareCallNote";
import HomeCareChangeSignals from "./HomeCareChangeSignals";
import HomeCareClientForm from "./HomeCareClientForm";
import HomeCareControlCalls from "./HomeCareControlCalls";
import HomeCareDecisionNotices from "./HomeCareDecisionNotices";
import EntryFlow from "./entry/EntryFlow";
import HomeCareReasonForm from "./HomeCareReasonForm";
import HomeCareNearMiss from "./HomeCareNearMiss";
import {
  ACCESS_REASON_REQUIRED,
  HomeCareAccessProvider,
  clientHref,
  formatDateTime,
  homeCareBase,
  useHomeCareApi
} from "./homeCareClient";
import { getOutboxManager } from "./homeCareOutbox";
import ClientKeys from "./keys/ClientKeys";
import ClientMoney from "./money/ClientMoney";
import { euroText } from "./money/moneyRows";
import OutboxPanel, { OutboxNotice } from "./outbox/OutboxPanel";
import { planDayLabel, planSheet, planSignals } from "./plan/planRows";
import { PlanView } from "./plan/PlanViews";
import ClientNoAnswer from "./noAnswer/ClientNoAnswer";
import ClientRelatives from "./relatives/ClientRelatives";
import ClientTeam from "./team/ClientTeam";
import ClientSafety from "./safety/ClientSafety";
import { safetyRights } from "./safety/safetyRows";
import ClientSlots from "./slots/ClientSlots";
import ClientSupplies from "./supplies/ClientSupplies";
import ClientTransport from "./transport/ClientTransport";
import { sheetRights } from "./slots/slotRows";

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
 * VAADE, MIS EI OLE EES, JÄÄB LEHELE ALLES (peidetult). Enamiku osade sisu on veel
 * vanal `hc-*` kihil ja hoiab oma olekut ise: kui vaade eemaldataks, kaoks avatud
 * vorm ja äsja salvestatud seis. Seepärast on kõik osad korraga lehel nagu enne
 * ja ees on üks. Uus kirje on sammudena (`./entry/EntryFlow.jsx`): selle olek on
 * konksus, mis elab lehel kogu aja, nii et pooleli kirje vaate vahetusel ei kao.
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
  /* Päeviku loend: esimene lehekülg või kõik laaditud kirjed. */
  const [expanded, setExpanded] = useState(false);
  /* Tabamused varasemast ajaloost: esimesed lõigud või kõik. */
  const [allHits, setAllHits] = useState(false);
  /* Avatud kirje. Hoitakse kirjet ennast, mitte kohta loendis: filtriga päevikus võib parandatud kirje loendist välja jääda. */
  const [opened, setOpened] = useState(null);
  /* Kirje, mille parandus on pooleli (ID); tühi sõne, kui parandust ei ole. */
  const [correcting, setCorrecting] = useState("");
  const [lapsed, setLapsed] = useState(false);
  const [panel, setPanel] = useState(null);
  const [status, setStatus] = useState(initial?.client?.status || CareClientStatus.ACTIVE);
  const [statusReason, setStatusReason] = useState(initial?.client?.statusReason || "");
  const [statusNote, setStatusNote] = useState(initial?.client?.statusNote || "");
  const [confirmDeath, setConfirmDeath] = useState(false);
  /* Avatud vaade; tühi sõne on osade laud. */
  const [view, setView] = useState(CLIENT_LANDING);
  /* Vaade, kust seadmes ootavate kirjete loend avati (osade laud või „Ukse taga"): sinna viib „Tagasi". */
  const [outboxFrom, setOutboxFrom] = useState(CLIENT_LANDING);

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
      setExpanded(false);
      setOpened(null);
      setCorrecting("");
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
    setAllHits(false);
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
    return result.ok;
  };

  /* Uus otsing (või selle tühjendamine) algab loendi esimesest leheküljest ja toob päeviku ette. */
  const search = async (next) => {
    if (!(await applyFilter(next))) return;
    setExpanded(false);
    setView("diary");
  };

  /* „Näita varasemaid": kõigepealt juba laaditud kirjed, siis järgmine lehekülg serverist. */
  const showEarlier = () => {
    if (!expanded) setExpanded(true);
    if (!expanded && entries.items.length > DIARY_PAGE) return;
    loadMore();
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
    setOpened((now) => (now && now.id === entry.id ? entry : now));
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
  const filterActive = filterActiveOf(applied);
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
  const allowed = viewAllowed(view, who, data) ? view : "";
  const hits = historyHits?.items || [];
  const seesHistory = historyVisible(who, data);
  /* Alavaade, mille sisu ei ole enam olemas (kirje ei ole avatud, tabamusi ei ole), annab päeviku loendi. */
  const gone = (allowed === "diary_item" && !opened) || (allowed === "history_hits" && !hits.length) || (allowed === "history" && !seesHistory);
  /* Parandus on ees ainult selle kirje kohta, mis on avatud; muidu on ees kirje ise või loend. */
  const fixing = Boolean(opened && correcting === opened.id);
  const current = gone ? "diary" : allowed === "diary_correct" && !fixing ? (opened ? "diary_item" : "diary") : allowed;
  const sees = (part) => partVisible(part, who, data);
  const toDoor = { label: t("home_care.door.back"), onBack: () => setView("door") };
  const toEntry = { label: t("home_care.entry_steps.back"), onBack: () => setView("entry") };
  const toDiary = { label: t("home_care.diary.back"), onBack: () => setView("diary") };
  const diaryNotice = diary.error ? { text: diary.error, tone: "risk" } : null;
  const diaryList = diaryPage(diaryRows(entries.items, { t, moment: (value) => formatDateTime(value, timeZone), today: data.today || "" }), { expanded, hasMore: entries.hasMore });

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
        /* Kirje sammud (uus kirje, parandus) on kiirmenüüs lehe nime kõrval: nelja ruuduga nupp on siis ilma nimeta. */
        compact={current === "entry" || current === "diary_correct"}
      >
        <HomeCareAccessProvider onReasonRequired={() => setLapsed(true)}>
          {lapsed ? (
            <section className={`hc-shell ${styles.old}`} data-lapsed="1">
              <HomeCareReasonForm organizationId={organizationId} clientId={client.id} writable={canWrite} inPage onGranted={() => setLapsed(false)} />
            </section>
          ) : null}

          {/* Seadmes ootavad kirjed: üks rida osade laua ja vaate „Ukse taga" kohal (sinna leht avaneb); rida avab loendi. */}
          <div className={styles.above} hidden={current !== "" && current !== "door"}>
            <OutboxNotice
              ownerId={ownerId}
              onOpen={() => {
                setOutboxFrom(current);
                setView("outbox");
              }}
            />
          </div>

          {slot("outbox", <OutboxPanel ownerId={ownerId} timeZone={timeZone} back={{ label: t("home_care.outbox.back"), onBack: () => setView(outboxFrom) }} />)}

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

          {/* Püsikaart „enne kui lähed": ridade lisamine ja muutmine. Osa on lehel kogu aja (pooleli vorm elab selle konksus)
              ja joonistatakse, kui ta on ees. */}
          {slot(
            "card",
            <ClientCard
              active={current === "card"}
              organizationId={organizationId}
              clientId={client.id}
              title={t("home_care.card.title")}
              lines={card}
              canEdit={canWrite && access.canEditCard}
              onChange={(next) => setData((now) => ({ ...now, card: next }))}
              back={toDoor}
            />
          )}

          {/* Kui uks ei avane (K4-f): kokkulepitud sammud ja nupp „Ei saa sisse". Osa on lehel kogu aja (pooleli märkimine elab
              selle konksus) ja joonistatakse, kui ta on ees. */}
          {slot(
            "no_answer",
            <ClientNoAnswer
              active={current === "no_answer"}
              organizationId={organizationId}
              clientId={client.id}
              clientName={client.displayName}
              viewerMembershipId={access.membershipId}
              timeZone={timeZone}
              initial={data.doorSteps || []}
              canEdit={canWrite && access.canEditCard}
              canRecord={canAddEntry}
              onSaved={upsertEntry}
              title={t("home_care.no_answer.title")}
              back={toDoor}
            />
          )}

          {/* Uus kirje sammudena. Osa on lehel kogu aja (pooleli kirje elab selle konksus), sammud joonistatakse, kui osa on ees. */}
          {sees("entry")
            ? slot(
                "entry",
                <EntryFlow
                  active={current === "entry"}
                  organizationId={organizationId}
                  clientId={client.id}
                  team={team}
                  viewerMembershipId={access.membershipId}
                  clientName={client.displayName}
                  timeZone={timeZone}
                  plan={data.plan}
                  usualState={data.usualState || []}
                  onSaved={upsertEntry}
                  onQuick={setView}
                  onDiary={() => setView("diary")}
                  onDoor={() => setView("door")}
                />
              )
            : null}

          {/* Kõne ei ole käik: selle märkimine ei tohi nõuda vormi täitmist. */}
          {sees("entry")
            ? slot(
                "call",
                <HomeCareCallNote
                  organizationId={organizationId}
                  clientId={client.id}
                  clientName={client.displayName}
                  viewerMembershipId={access.membershipId}
                  onSaved={upsertEntry}
                  title={t("home_care.entry_steps.quick_call")}
                  back={toEntry}
                  more={{ label: t("home_care.entry_steps.to_diary"), onOpen: () => setView("diary") }}
                />
              )
            : null}

          {/* „Peaaegu juhtus" (K5-h): kahe puudutusega märge olukorrast, kus midagi oleks võinud juhtuda. */}
          {sees("entry")
            ? slot(
                "near_miss",
                <HomeCareNearMiss
                  organizationId={organizationId}
                  clientId={client.id}
                  clientName={client.displayName}
                  viewerMembershipId={access.membershipId}
                  onSaved={upsertEntry}
                  title={t("home_care.near_miss.start")}
                  back={toEntry}
                />
              )
            : null}

          {/* Päevik: kirjed madalate ridadena; kirje, otsing ja varasem ajalugu on omaette vaated. */}
          {slot(
            "diary",
            <DiaryView
              title={t(viewNameKey("diary"))}
              name={client.displayName}
              filter={
                filterActive
                  ? { line: filterLine(applied, { t, day: planDayLabel }), clear: { label: t("home_care.filter.clear"), onClear: () => search(NO_FILTER) } }
                  : null
              }
              rows={diaryList.rows}
              onOpen={(id) => {
                /* Teise kirje avamine lõpetab eelmise kirje pooleli paranduse. */
                if (correcting !== id) setCorrecting("");
                setOpened(entries.items.find((entry) => entry.id === id) || null);
                setView("diary_item");
              }}
              empty={applied.q ? t("home_care.filter.search_empty") : t("home_care.filter.empty")}
              notice={diaryNotice}
              busy={diary.busy}
              hits={
                hits.length
                  ? {
                      title: t("home_care.history.hits_title"),
                      line: t(historyHits.hasMore ? "home_care.diary.hits_count_more" : "home_care.diary.hits_count", { count: hits.length }),
                      onOpen: () => setView("history_hits")
                    }
                  : null
              }
              history={
                seesHistory
                  ? {
                      title: t("home_care.history.title"),
                      line: (data.histories || []).length ? t("home_care.diary.history_count", { count: data.histories.length }) : t("home_care.diary.history_none"),
                      onOpen: () => setView("history")
                    }
                  : null
              }
              search={{
                label: t("home_care.filter.search_label"),
                onOpen: () => {
                  /* Vorm avaneb kehtiva otsinguga, mitte pooleli jäänud valikuga. */
                  setFilter(applied);
                  diary.setError("");
                  setView("diary_search");
                }
              }}
              more={diaryList.more ? { label: t("home_care.diary.more"), onMore: showEarlier } : null}
            />
          )}

          {slot(
            "diary_search",
            <DiarySearchView
              title={t("home_care.filter.search_label")}
              name={client.displayName}
              form={{
                id: `${fieldId}-diary-search`,
                onSubmit: (event) => {
                  event.preventDefault();
                  search(filter);
                }
              }}
              query={{
                label: t("home_care.filter.search_label"),
                hint: t("home_care.filter.search_hint"),
                value: filter.q,
                onChange: (q) => setFilter((now) => ({ ...now, q }))
              }}
              kind={{
                label: t("home_care.entry.kind_label"),
                options: [{ value: "", label: t("home_care.filter.kind_all") }, ...CARE_ENTRY_KINDS.map((value) => ({ value, label: t(`home_care.entry.kinds.${value}`) }))],
                value: filter.kind,
                onChange: (kind) => setFilter((now) => ({ ...now, kind }))
              }}
              from={{ label: t("home_care.filter.from"), value: filter.from, onChange: (from) => setFilter((now) => ({ ...now, from })) }}
              to={{ label: t("home_care.filter.to"), value: filter.to, onChange: (to) => setFilter((now) => ({ ...now, to })) }}
              notice={diaryNotice}
              busy={diary.busy}
              clear={filterActive ? { label: t("home_care.filter.clear"), onClear: () => search(NO_FILTER) } : null}
              back={toDiary}
              submit={t("home_care.home.search_button")}
            />
          )}

          {/* Avatud kirje: kogu tekst ja tegevused; iga tegevus, mis küsib midagi juurde, on selle sees omaette vaade. */}
          {slot(
            "diary_item",
            opened ? (
              <EntryOpen
                key={opened.id}
                organizationId={organizationId}
                entry={opened}
                timeZone={timeZone}
                canWrite={canWrite}
                isCoordinator={access.isCoordinator}
                back={toDiary}
                onChange={upsertEntry}
                onCorrect={() => {
                  setCorrecting(opened.id);
                  setView("diary_correct");
                }}
              />
            ) : null
          )}

          {/* Kirje parandus samadel sammudel mis uus kirje. Osa on lehel, kuni parandus on pooleli (olek elab konksus). */}
          {fixing
            ? slot(
                "diary_correct",
                <EntryFlow
                  key={`${opened.id}-${opened.revision}`}
                  active={current === "diary_correct"}
                  organizationId={organizationId}
                  clientId={client.id}
                  team={team}
                  viewerMembershipId={access.membershipId}
                  clientName={client.displayName}
                  timeZone={timeZone}
                  entry={opened}
                  plan={data.plan}
                  onSaved={(next) => {
                    upsertEntry(next);
                    setCorrecting("");
                    setView("diary_item");
                  }}
                  onCancel={() => {
                    setCorrecting("");
                    setView("diary_item");
                  }}
                />
              )
            : null}

          {slot(
            "history_hits",
            <HistoryHitsView
              title={t("home_care.history.hits_title")}
              lead={t("home_care.history.hits_hint")}
              items={(allHits ? hits : hits.slice(0, HITS_PAGE)).map((hit) => ({ key: `${hit.historyId}-${hit.position}`, title: hit.title, text: hit.text }))}
              mark={t("home_care.history.mark")}
              note={historyHits?.hasMore ? t("home_care.history.hits_more") : ""}
              more={!allHits && hits.length > HITS_PAGE ? { label: t("home_care.home.more"), onMore: () => setAllHits(true) } : null}
              back={toDiary}
            />
          )}

          {/* Varasem ajalugu teisest kohast: dokumentide loend, avatud tekst ja üle toomine on selle sees omaette vaated. */}
          {seesHistory
            ? slot(
                "history",
                <ImportedHistory
                  organizationId={organizationId}
                  clientId={client.id}
                  histories={data.histories || []}
                  timeZone={timeZone}
                  canManage={access.isCoordinator && canWrite}
                  back={toDiary}
                  onChange={(next) => {
                    setData((now) => ({ ...now, histories: next }));
                    setHistoryHits(null);
                  }}
                />
              )
            : null}

          {/* Kehtiv hoolduskava (K2-b): mida siin tehakse, kui sageli ja kuidas. Kogu meeskonnale lugemiseks.
              Osal ei ole oma olekut: see joonistatakse siis, kui ta on ees. */}
          {current === "plan"
            ? slot(
                "plan",
                <PlanView
                  title={t(viewNameKey("plan"))}
                  name={client.displayName}
                  sheet={planSheet(data.plan, { t })}
                  labels={{ goals: t("home_care.plan.goals"), must: t("home_care.plan.critical_badge") }}
                  empty={t("home_care.plan.none")}
                  signals={planSignals(data, who, { t, moment: (value) => formatDateTime(value, timeZone) })}
                  edit={
                    access.isCoordinator
                      ? { label: t(data.plan ? "home_care.plan.edit_link" : "home_care.plan.create_link"), href: `/org/${organizationId}/koduteenus/kliendid/${client.id}/kava` }
                      : null
                  }
                />
              )
            : null}

          {/* Käigumuster (K3-a): mis päevadel ja kellaaegadel siin käiakse ja kes läheb; eilne ja tänane käik seisuga (K5-l).
              Lehed kliendi koju (külmkapileht K5-g, kuuleht K6-e) on osa sees omaette vaade.
              Osa on lehel kogu aja (sisestatud telefoninumber elab selle konksus) ja joonistatakse, kui ta on ees. */}
          {slot(
            "slots",
            <ClientSlots
              active={current === "slots"}
              organizationId={organizationId}
              clientId={client.id}
              title={t(viewNameKey("slots"))}
              name={client.displayName}
              slots={data.slots}
              recentVisits={data.recentVisits}
              today={data.today || ""}
              rights={sheetRights(who, data)}
              editHref={access.isCoordinator ? `/org/${organizationId}/koduteenus/kliendid/${client.id}/kaigud` : ""}
            />
          )}

          {/* Täna kehtiv otsus ja otsustatud maht (K2-c), osutatud aeg (K2-e) ja püsivuse näit (K5-f). Kogu meeskonnale lugemiseks.
              Osal ei ole oma olekut: see joonistatakse siis, kui ta on ees. */}
          {current === "decision"
            ? slot(
                "decision",
                <DecisionView
                  title={t(viewNameKey("decision"))}
                  name={client.displayName}
                  sheet={decisionSheet(data.decision, { t })}
                  empty={t("home_care.decision.none")}
                  provided={providedLines(data.provided, { t })}
                  continuity={continuityLine(data.continuity, { t })}
                  edit={access.isCoordinator ? { label: t("home_care.decision.edit_link"), href: `/org/${organizationId}/koduteenus/kliendid/${client.id}/otsused` } : null}
                />
              )
            : null}

          {/* Ohutus: eeltingimused enne teenuse algust (K4-a), ohutuskaart (K5-n), tavaline seis (K5-a), töö iseloom (K3-g)
              ja kriisivalmidus (K5-b); iga teema on osa sees omaette vaade.
              Osa on lehel kogu aja (pooleli vorm elab selle konksudes) ja joonistatakse, kui ta on ees. Salvestus jõuab
              ka lehe andmetesse: plaadi rida, vaade „Ukse taga" ja uue kirje küsimus „kas midagi oli teisiti" järgivad seda. */}
          {sees("safety")
            ? slot(
                "safety",
                <ClientSafety
                  active={current === "safety"}
                  organizationId={organizationId}
                  clientId={client.id}
                  title={t(viewNameKey("safety"))}
                  name={client.displayName}
                  rights={safetyRights(who)}
                  initial={data}
                  onChanged={(key, value) => setData((now) => ({ ...now, [key]: value }))}
                />
              )
            : null}

          {/* Võtmed (K4-b): mis võtmed asutuse käes on ja kelle käes iga võti praegu on.
              Osa on lehel kogu aja (pooleli vorm elab selle konksus) ja joonistatakse, kui ta on ees. */}
          {sees("keys")
            ? slot(
                "keys",
                <ClientKeys
                  active={current === "keys"}
                  organizationId={organizationId}
                  clientId={client.id}
                  title={t(viewNameKey("keys"))}
                  name={client.displayName}
                  initial={data.keys || []}
                  receivers={data.keyReceivers || []}
                  who={{ canManage: access.isCoordinator, canWrite, myMembershipId: access.membershipId }}
                  onChanged={(keys) => setData((now) => ({ ...now, keys }))}
                />
              )
            : null}

          {/* Kliendi sularaha vaataja käes (K4-c): arvestus, mitte makse.
              Osa on lehel kogu aja (pooleli rida elab selle konksus) ja joonistatakse, kui ta on ees. */}
          {sees("money")
            ? slot(
                "money",
                <ClientMoney
                  active={current === "money"}
                  organizationId={organizationId}
                  clientId={client.id}
                  title={t(viewNameKey("money"))}
                  initial={data.money || null}
                  canWrite={canWrite && !ended}
                  isCoordinator={access.isCoordinator}
                  onChanged={(money) => setData((now) => ({ ...now, money }))}
                />
              )
            : null}

          {/* Varud kliendi kodus (K4-e): seisu märgib igaüks, kes siin käib.
              Osa on lehel kogu aja (pooleli märkus elab selle konksus) ja joonistatakse, kui ta on ees. */}
          {sees("supplies")
            ? slot(
                "supplies",
                <ClientSupplies
                  active={current === "supplies"}
                  organizationId={organizationId}
                  clientId={client.id}
                  title={t(viewNameKey("supplies"))}
                  name={client.displayName}
                  initial={data.supplies || []}
                  timeZone={timeZone}
                  canWrite={canWrite && !ended}
                  canManage={access.isCoordinator}
                  onChanged={(supplies) => setData((now) => ({ ...now, supplies }))}
                />
              )
            : null}

          {/* Transport (K5-w): eesolevad sõidud ja soovid; „Telli transport" meeskonnale ja hooldusjuhile.
              Osa on lehel kogu aja (pooleli soov elab selle konksus) ja joonistatakse, kui ta on ees. */}
          {sees("transport")
            ? slot(
                "transport",
                <ClientTransport
                  active={current === "transport"}
                  organizationId={organizationId}
                  clientId={client.id}
                  title={t(viewNameKey("transport"))}
                  name={client.displayName}
                  initial={data.transport || null}
                  who={{ canRequest: canWrite && access.canEditCard && !ended, isCoordinator: access.isCoordinator, canWrite }}
                  today={data.today || ""}
                  onChanged={(transport) => setData((now) => ({ ...now, transport }))}
                />
              )
            : null}

          {/* Lähedased ja jagamisaste (K5-k): kellele ja mida klient on lubanud rääkida; esindusõigus (K6-i): kes tohib
              kliendi eest otsustada ja alla kirjutada. Osa on lehel kogu aja (pooleli vorm elab selle konksudes) ja
              joonistatakse, kui ta on ees. */}
          {sees("relatives")
            ? slot(
                "relatives",
                <ClientRelatives
                  active={current === "relatives"}
                  organizationId={organizationId}
                  clientId={client.id}
                  title={t(viewNameKey("relatives"))}
                  name={client.displayName}
                  initial={data}
                  who={{ canEdit: canWrite && access.isCoordinator, canFlag: canWrite && access.canEditCard }}
                  onChanged={(key, value) => setData((now) => ({ ...now, [key]: value }))}
                />
              )
            : null}

          {/* Meeskond: hooldusjuht lisab ja eemaldab, teised näevad aktiivseid nimesid; „Viimati avasid" ja „Seisu ajalugu" on
              meeskonna vaate ridade taga. Osa on lehel kogu aja (pooleli valik elab selle konksus) ja joonistatakse, kui ta on ees. */}
          {sees("team")
            ? slot(
                "team",
                <ClientTeam
                  active={current === "team"}
                  organizationId={organizationId}
                  clientId={client.id}
                  title={t(viewNameKey("team"))}
                  name={client.displayName}
                  team={team}
                  openers={recentOpeners}
                  history={statusHistory}
                  who={{ canWrite, isCoordinator: access.isCoordinator }}
                  timeZone={timeZone}
                  onChange={(next) => setData((now) => ({ ...now, team: next }))}
                />
              )
            : null}

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
