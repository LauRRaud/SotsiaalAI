"use client";

/**
 * Teekonna avaleht: inimese Teekonnad ja uue alustamine.
 *
 * KUJU (10.10). Leht oli üks pikk veerg vanal ühisel kihil (1839 px sisu 496 px
 * paneelis). Nüüd on korraga ees üks asi ja vaated vahetuvad kohapeal:
 *  - loend: Teekonnad madalate ridadena, käimasolevad ees;
 *  - alustamine: viis väikest vaadet sammulaval (`components/stage/StepFlight`),
 *    sammud all kiirmenüüs.
 * Loend ja alustamine ei ole järjestikused sammud: need vahetuvad lehe sees,
 * ilma lavata.
 *
 * SEE FAIL hoiab olekut ja teeb päringud. Vaated on failis
 * ./dashboard/DashboardViews.jsx, lehe reeglid (rühmad, read, mustandi värskus,
 * taastamine) failis ./dashboard/journeyBoard.js.
 *
 * ÜLEVAADE KOOSTATAKSE ISE. Ülevaate teeb server kirjelduse põhjal reeglitega
 * (mudelit ei kutsuta). See koostatakse, kui inimene liigub kirjelduselt edasi
 * (nupp, kiirmenüü või kerimine) ja kirjeldus on pärast eelmist koostamist
 * muutunud. Sammude loend on kindel: kuni ülevaadet ei ole, ütleb vaade seda ise.
 *
 * KIRJUTATU EI KAO. Pooleli töö hoitakse selle vahekaardi mälus omaniku kaupa
 * (SOL-JOUR-02: rida kannab kasutaja ID-d, konto vahetus tühjendab ekraani).
 * Lahkumise teed, mida leht ise ei joonista (kiirmenüü tagasinool, Esc, akna
 * sulgemine), peab kinni värav `lib/panelLeaveGuard.js`; töölaua sees hoiab leht
 * Esc-i ise kinni, sest töölaua oma kuulaja väravat ei küsi.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import { openOwnerScopedStore, purgeUnscopedRows } from "@/lib/device/ownerScopedStorage";
import { JOURNEY_TEXT_LIMITS } from "@/lib/journey/constants";
import { journeyErrorText } from "@/lib/journey/errorText";
import { localizePath } from "@/lib/localizePath";
import { setPanelLeaveGuard, twoPressLeaveGuard } from "@/lib/panelLeaveGuard";
import { pushWithTransition } from "@/lib/routeTransition";
import { loginHref } from "@/lib/safeNextPath";

import { AheadView, BoardView, DescribeView, OverviewView, RoleView, SaveView, SignedOutView, WaitingView, WishView } from "./dashboard/DashboardViews";
import {
  CONFIRM_MS,
  EMPTY_DRAFT,
  START_STEPS,
  boardGroups,
  boardMore,
  boardShown,
  createdJourneyPath,
  draftNoticed,
  draftReady,
  draftStale,
  draftWish,
  journeyRow,
  mergeBuiltDraft,
  pressTooSoon,
  restoreStart,
  roleWorkspace,
  saveProblem,
  startDirty,
  startStepStates,
  startStorageRow,
  startUrlStep,
  withWish
} from "./dashboard/journeyBoard";
import shared from "./journey.module.css";

/**
 * TEEKONNA MUSTANDI RIDA (SOL-JOUR-02, P0).
 *
 * See oli GLOBAALNE sama-origin võti ilma kasutaja ID-ta ja teda ei puhastanud
 * ei väljalogimine ega konto vahetus — ainult edukas salvestus ja teadlik
 * katkestamine. `sessionStorage` elab VAHEKAARDI, mitte konto eluea järgi:
 * kui A logis samas vahekaardis välja ja B sisse, taastus B-le A olukirjeldus,
 * riskisignaalid ja kolmanda isiku kontekst.
 *
 * Nüüd on see ALUSNIMI, millele lisatakse omanik — vt
 * `lib/device/ownerScopedStorage.js`. Sama kaitse mis teenuspäevikul
 * (SOL-SLOG-01), ühest ja samast failist.
 */
const JOURNEY_DRAFT_ROW = "sotsiaalai:journey-v1:draft";

function createJourneyActionId() {
  return globalThis.crypto?.randomUUID?.()
    || `journey-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function setJourneyStepInUrl(step = "") {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (step) url.searchParams.set("samm", step);
  else url.searchParams.delete("samm");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function JourneyDashboard({ embedded = false, roleOverride = "" } = {}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { data: session, status } = useSession();
  /**
   * Mustandi omanik. Kuni sessioon ei ole autenditud, on ta tühi ja
   * `openOwnerScopedStore` annab `null` — seade on lukus, mitte lahti vale
   * omaniku peale (SOL-JOUR-02).
   */
  const draftOwnerId = status === "authenticated" && session?.user?.id ? String(session.user.id) : "";
  const draftStore = useCallback(
    () => openOwnerScopedStore(typeof window === "undefined" ? null : window.sessionStorage, draftOwnerId),
    [draftOwnerId]
  );
  const { effectiveRole, isRoleResolved } = useEffectiveRole();
  const [journeys, setJourneys] = useState([]);
  const [journeyPage, setJourneyPage] = useState({ totalCount: 0, hasMore: false, nextCursor: null });
  const [listLoaded, setListLoaded] = useState(false);
  const [listFault, setListFault] = useState("");
  const [wantedGroup, setWantedGroup] = useState("active");
  const [mode, setMode] = useState("list");
  const [stepKey, setStepKey] = useState("describe");
  const [situation, setSituation] = useState("");
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [builtFor, setBuiltFor] = useState("");
  /* Mis päring käib: "" | "build" | "save" | "more" | "archive:<id>". */
  const [busy, setBusy] = useState("");
  /* Teade kuulub vaate juurde, kus tegevus tehti: { view, text, tone }. */
  const [notice, setNotice] = useState(null);
  const [restored, setRestored] = useState(false);
  const [archiveArmedId, setArchiveArmedId] = useState("");
  const [declineArmed, setDeclineArmed] = useState(false);
  const [leaveAsked, setLeaveAsked] = useState(false);

  const rootRef = useRef(null);
  const situationInputRef = useRef(null);
  const createActionIdRef = useRef("");
  const titleEditedRef = useRef(false);
  const busyRef = useRef("");
  const armedAt = useRef(0);
  const shownAt = useRef(0);
  /* Värskeim seis päringu vastuse jaoks: vastus rakendub ainult sellele
     kirjeldusele, mille kohta see küsiti. */
  const live = useRef({ situation: "", draft: EMPTY_DRAFT, builtFor: "" });
  live.current = { situation, draft, builtFor };

  const normalizedRole = String(roleOverride || effectiveRole || "CLIENT").toUpperCase();
  const isClientRole = normalizedRole === "CLIENT";
  const groups = useMemo(() => boardGroups(journeys), [journeys]);
  const filter = boardShown(groups, wantedGroup);
  const rows = useMemo(
    () => (filter.shown === "earlier" ? groups.earlier : groups.active).map((journey) => journeyRow(journey, { t })),
    [filter.shown, groups, t]
  );
  const dirty = mode === "start" && startDirty({ situation, draft });

  /* ⓘ elab kiirmenüüs lehe nime kõrval (PanelFrame); siin ainult sisu.
     Manustatuna registreerib Töölaud (WorkspacePanel) — sama reegel mis
     kõigil teistel moodulitel. Ilma `active`-väravata registreeriksid MÕLEMAD
     samasse pesasse ja võidaks see, kelle effect juhtub viimasena jooksma. */
  usePanelInfoSlot({
    infoId: "journey",
    title: t("journey.title", "Teekond"),
    label: t("journey.info.label", "Open journey info"),
    active: !embedded
  });

  const lock = useCallback((value) => {
    busyRef.current = value;
    setBusy(value);
  }, []);

  const loadJourneys = useCallback(async ({ cursor = "", append = false } = {}) => {
    if (status !== "authenticated" || !isRoleResolved || !isClientRole) return;
    const query = new URLSearchParams({ limit: "25" });
    if (cursor) query.set("cursor", cursor);
    const response = await fetch(`/api/journeys?${query.toString()}`, {
      cache: "no-store"
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(journeyErrorText(t, payload.message, t("journey.messages.load_failed", "Loading the journey failed.")));
    }
    const items = Array.isArray(payload.journeys) ? payload.journeys : [];
    setJourneys((current) => append ? [...current, ...items] : items);
    setJourneyPage(payload.page || { totalCount: items.length, hasMore: false, nextCursor: null });
  }, [isClientRole, isRoleResolved, status, t]);

  /* Esimene laadimine ja uus katse. Brauseri enda veateksti (võrgutõrge) ei
     näidata: lause tuleb kataloogist. */
  const loadFirst = useCallback(() => {
    setListFault("");
    return loadJourneys()
      .then(() => setListLoaded(true))
      .catch((loadError) => {
        const known = loadError instanceof Error && !(loadError instanceof TypeError) ? loadError.message : "";
        setListFault(known || t("journey.messages.load_failed", "Loading the journey failed."));
        setListLoaded(true);
      });
  }, [loadJourneys, t]);

  useEffect(() => {
    if (status !== "authenticated" || !isRoleResolved || !isClientRole) return;
    void loadFirst();
  }, [isClientRole, isRoleResolved, loadFirst, status]);

  /* Eelmise renderduse omanik: `null` = esimene kord, tühi string = välja
     logitud. Ainult PÄRIS vahetus (A → B) tühjendab ekraani. */
  const draftOwnerRef = useRef(null);
  const draftReadyRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    /* Vana sildistamata rida ei kuulu kellelegi ja teda ei saa omistada —
       ta kustutatakse, mitte ei anta järgmisele sisselogijale. */
    purgeUnscopedRows(window.sessionStorage, [JOURNEY_DRAFT_ROW]);

    const previousOwner = draftOwnerRef.current;
    draftOwnerRef.current = draftOwnerId;
    if (previousOwner !== null && previousOwner !== draftOwnerId) {
      /* KASUTAJAVAHETUS. Ekraanil olev tekst kuulub eelmisele kontole: teda ei
         tohi uue konto reale kirjutada ega talle näidata. Salvestust me siin
         EI puutu — see läheks juba uue omaniku reale. */
      draftReadyRef.current = false;
      setSituation("");
      setDraft(EMPTY_DRAFT);
      setBuiltFor("");
      setNotice(null);
      setRestored(false);
      setMode("list");
      setStepKey("describe");
    }
    if (!draftOwnerId) {
      draftReadyRef.current = false;
      return;
    }

    const step = new URL(window.location.href).searchParams.get("samm");
    let saved = null;
    try {
      saved = JSON.parse(draftStore()?.getItem(JOURNEY_DRAFT_ROW) || "null");
    } catch {}
    const back = restoreStart(saved, step || "");
    if (back.situation) setSituation(back.situation);
    if (back.draft) {
      const clientActionId = back.draft.clientActionId || createJourneyActionId();
      createActionIdRef.current = clientActionId;
      setDraft({ ...back.draft, clientActionId });
      setBuiltFor(back.builtFor);
    }
    if (back.mode === "start") {
      setMode("start");
      setStepKey(back.stepKey);
      setRestored(back.restored);
    }
    draftReadyRef.current = true;
  }, [draftOwnerId, draftStore]);

  useEffect(() => {
    /* Ilma omanikuta ega enne taastamist ei kirjutata midagi: muidu kirjutaks
       tühi vorm üle rea, mida keegi ei puutunud. */
    if (typeof window === "undefined" || !draftOwnerId || !draftReadyRef.current) return;
    if (mode !== "start") return;
    draftStore()?.setItem(JOURNEY_DRAFT_ROW, JSON.stringify(startStorageRow({ stepKey, situation, draft, builtFor })));
  }, [builtFor, draft, draftOwnerId, draftStore, mode, situation, stepKey]);

  /* Aadress ütleb, kus inimene on: lehe uuesti laadimine toob ta samasse kohta. */
  useEffect(() => {
    if (mode === "start") setJourneyStepInUrl(startUrlStep(stepKey));
  }, [mode, stepKey]);

  /* Salvestamata kirjutatu ja lahkumise teed, mida leht ise ei joonista.
     Esimene lahkumine jääb kinni ja lava kohal seisab põhjus, teine lahkub.
     Omaette lehel küsib paneeli raam väravat ise (kiirmenüü tagasinool ja Esc).
     Töölaua oma Esc-kuulaja väravat ei küsi ja sulgeb töölaua ka siis, kui
     fookus on tekstiväljal: seal peetakse Esc kinni siin, enne teisi (püüdmise
     faasis). Sama vajutuse jooksul võib väravat küsida veel paneeli raam:
     `passing` vastab talle sama, mis siin juba otsustati. */
  useEffect(() => {
    if (!dirty) return undefined;
    const leave = twoPressLeaveGuard({
      onAsk: () => setLeaveAsked(true),
      onClear: () => setLeaveAsked(false)
    });
    let passing = false;
    const gate = (reason) => passing || leave(reason);
    const release = setPanelLeaveGuard(gate);
    const holdEscape = (event) => {
      if (event.key !== "Escape") return;
      /* Kiirmenüü avatud sammurida sulgeb Esc-i ise. */
      if (event.target?.closest?.("[data-esc-scope]")) return;
      if (gate("escape")) {
        passing = true;
        window.setTimeout(() => {
          passing = false;
        }, 0);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    if (embedded) window.addEventListener("keydown", holdEscape, true);
    window.addEventListener("beforeunload", warn);
    return () => {
      release();
      leave.clear();
      window.removeEventListener("keydown", holdEscape, true);
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty, embedded]);

  /* Vaate vahetusel (loend ↔ alustamine) kaob vajutatud nupp: fookus läheb
     kirjelduse väljale või loendi pealkirjale. Esimesel joonistusel fookust ei
     võeta. */
  const shownMode = useRef("");
  useEffect(() => {
    const first = shownMode.current === "";
    if (shownMode.current === mode) return undefined;
    shownMode.current = mode;
    shownAt.current = Date.now();
    if (first) return undefined;
    const frame = window.requestAnimationFrame(() => {
      if (mode === "start") situationInputRef.current?.focus?.({ preventScroll: true });
      else rootRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  /* Teist vajutust küsiv nupp ei jää ootama: küsimus aegub. */
  useEffect(() => {
    if (!archiveArmedId) return undefined;
    const timer = window.setTimeout(() => setArchiveArmedId(""), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [archiveArmedId]);
  useEffect(() => {
    if (!declineArmed) return undefined;
    const timer = window.setTimeout(() => setDeclineArmed(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [declineArmed]);

  /**
   * Koostab ülevaate, kui seda ei ole või kirjeldus on muutunud. Vastus rakendub
   * ainult siis, kui kirjeldus on ikka see, mille kohta küsiti. Tagastab, kas
   * ülevaade on praeguse kirjelduse kohta olemas.
   */
  const buildDraft = useCallback(async () => {
    const situation = live.current.situation;
    if (!situation.trim()) return false;
    if (!draftStale(live.current)) return true;
    if (busyRef.current) return false;
    lock("build");
    setNotice(null);

    try {
      const response = await fetch("/api/journeys/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ situation })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setNotice({ view: "build", tone: "risk", text: journeyErrorText(t, payload.message, t("journey.messages.draft_failed", "Teekonna ülevaate koostamine ebaõnnestus.")) });
        return false;
      }
      if (live.current.situation !== situation) return false;
      const clientActionId = createJourneyActionId();
      createActionIdRef.current = clientActionId;
      setDraft(mergeBuiltDraft({ previous: live.current.draft, built: payload.draft, clientActionId, titleEdited: titleEditedRef.current }));
      setBuiltFor(situation);
      return true;
    } catch {
      setNotice({ view: "build", tone: "risk", text: t("journey.messages.draft_failed", "Teekonna ülevaate koostamine ebaõnnestus.") });
      return false;
    } finally {
      lock("");
    }
  }, [lock, t]);

  const handleSaveDraft = useCallback(async (startWith = "") => {
    if (busyRef.current) return;
    const draft = live.current.draft;
    const problem = draftStale(live.current) ? { key: "journey.start.need_situation", step: "describe" } : saveProblem(draft);
    if (problem) {
      setNotice({ view: problem.step, tone: "risk", text: t(problem.key) });
      setStepKey(problem.step);
      return;
    }
    lock("save");
    setNotice(null);
    setDeclineArmed(false);

    try {
      const response = await fetch("/api/journeys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...draft,
          ...(startWith ? { primaryPath: startWith } : {}),
          clientActionId: draft.clientActionId || createActionIdRef.current,
          status: "ACTIVE",
          sharingStatus: "PRIVATE"
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setNotice({ view: "save", tone: "risk", text: journeyErrorText(t, payload.message, t("journey.messages.save_failed", "Saving the journey failed.")) });
        return;
      }
      setSituation("");
      setDraft(EMPTY_DRAFT);
      setBuiltFor("");
      createActionIdRef.current = "";
      titleEditedRef.current = false;
      setMode("list");
      setStepKey("describe");
      draftStore()?.removeItem(JOURNEY_DRAFT_ROW);
      setJourneyStepInUrl("");
      pushWithTransition(router, localizePath(createdJourneyPath(payload.journey.id, startWith), locale));
    } catch {
      setNotice({ view: "save", tone: "risk", text: t("journey.messages.save_failed", "Saving the journey failed.") });
    } finally {
      lock("");
    }
  }, [draftStore, locale, lock, router, t]);

  const handleArchive = useCallback(async (journey) => {
    if (busyRef.current || !journey) return;
    lock(`archive:${journey.id}`);
    setNotice(null);

    try {
      const response = await fetch(`/api/journeys/${encodeURIComponent(journey.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: "ARCHIVED", expectedUpdatedAt: journey.updatedAt })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setNotice({ view: "list", tone: "risk", text: journeyErrorText(t, payload.message, t("journey.messages.archive_failed", "Archiving the journey failed.")) });
        return;
      }
      /* Arhiveerimine õnnestus: rida läheb kohe varasemate hulka. Loendi uus
         laadimine tuleb pärast; kui see ei õnnestu, on seis ikka õige. */
      setJourneys((current) => current.map((item) => (item.id === journey.id
        ? { ...item, status: "ARCHIVED", updatedAt: payload.journey?.updatedAt || item.updatedAt, closure: null }
        : item)));
      setNotice({ view: "list", text: t("journey.messages.archived", "Journey archived.") });
      /* Vajutatud nupp kadus koos reaga: fookus läheb loendi pealkirjale. */
      rootRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
      await loadJourneys().catch(() => {});
    } catch {
      setNotice({ view: "list", tone: "risk", text: t("journey.messages.archive_failed", "Archiving the journey failed.") });
    } finally {
      setArchiveArmedId("");
      lock("");
    }
  }, [loadJourneys, lock, t]);

  /* Arhiveerimine küsib teist vajutust samal nupul; topeltklõps ei arhiveeri. */
  const pressArchive = useCallback((row) => {
    if (busyRef.current) return;
    if (archiveArmedId !== row.id) {
      armedAt.current = Date.now();
      setArchiveArmedId(row.id);
      return;
    }
    if (pressTooSoon(armedAt.current)) return;
    void handleArchive(journeys.find((journey) => journey.id === row.id));
  }, [archiveArmedId, handleArchive, journeys]);

  /* „Loobu" arhiveerimise küsimuse kõrval kaob koos küsimusega: fookus läheb
     tagasi sama rea arhiveerimise nupule. */
  const cancelArchive = useCallback(() => {
    const id = archiveArmedId;
    setArchiveArmedId("");
    window.requestAnimationFrame(() => {
      rootRef.current?.querySelector(`[data-archive="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    });
  }, [archiveArmedId]);

  const handleLoadMore = useCallback(() => {
    if (busyRef.current || !journeyPage.nextCursor) return;
    lock("more");
    setNotice(null);
    loadJourneys({ cursor: journeyPage.nextCursor, append: true })
      .catch(() => setNotice({ view: "list", tone: "risk", text: t("journey.messages.load_failed", "Loading the journey failed.") }))
      .finally(() => lock(""));
  }, [journeyPage.nextCursor, loadJourneys, lock, t]);

  /* Varem kirjutatu jääb alles: alustamine avaneb sellega, mis siin vahekaardis
     pooleli jäi (vana leht viskas koostatud ülevaate ja soovi siin ära). */
  const handleStartNew = useCallback(() => {
    if (busyRef.current) return;
    setMode("start");
    setStepKey("describe");
    setNotice(null);
    setArchiveArmedId("");
    setRestored(startDirty(live.current));
  }, []);

  const leaveStart = useCallback(() => {
    draftStore()?.removeItem(JOURNEY_DRAFT_ROW);
    setMode("list");
    setStepKey("describe");
    setSituation("");
    setDraft(EMPTY_DRAFT);
    setBuiltFor("");
    createActionIdRef.current = "";
    titleEditedRef.current = false;
    setNotice(null);
    setRestored(false);
    setDeclineArmed(false);
    setJourneyStepInUrl("");
  }, [draftStore]);

  /* Loobumine viskab kirjutatu ära: kui midagi on kirjas, küsib see teist
     vajutust samal nupul ja tagajärg seisab vaate all servas. */
  const pressDecline = useCallback(() => {
    if (busyRef.current) return;
    if (!startDirty(live.current)) {
      leaveStart();
      return;
    }
    if (!declineArmed) {
      armedAt.current = Date.now();
      setDeclineArmed(true);
      return;
    }
    if (pressTooSoon(armedAt.current)) return;
    leaveStart();
  }, [declineArmed, leaveStart]);

  /* Kirjelduselt edasi liikudes koostatakse ülevaade (kui vaja). Samm ise ei
     hüppa tagasi: kui ülevaadet ei saa, ütleb vaade seda. */
  const handleStepChange = useCallback((_index, step) => {
    const key = step?.key || "describe";
    setStepKey(key);
    setDeclineArmed(false);
    if (key !== "describe") void buildDraft();
  }, [buildDraft]);

  /* Nupp „Koosta ülevaade": sama mis edasi liikumine, aga tühja kirjelduse
     korral ütleb vaade, mis puudu on. Loendi nupp „Alusta Teekonda" seisab samas
     kohas: topeltklõpsu teine vajutus ei koosta midagi. */
  const pressBuild = useCallback(async () => {
    if (busyRef.current || pressTooSoon(shownAt.current)) return;
    if (!live.current.situation.trim()) {
      setNotice({ view: "describe", tone: "risk", text: t("journey.start.need_situation") });
      situationInputRef.current?.focus?.({ preventScroll: true });
      return;
    }
    if (await buildDraft()) setStepKey("overview");
  }, [buildDraft, t]);

  const changeSituation = useCallback((value) => {
    setSituation(value);
    setRestored(false);
    setDeclineArmed(false);
    setNotice((current) => (current?.view === "describe" || current?.view === "build" ? null : current));
  }, []);

  const changeTitle = useCallback((value) => {
    titleEditedRef.current = true;
    setDraft((current) => ({ ...current, title: value }));
    setNotice((current) => (current?.view === "overview" ? null : current));
  }, []);

  const changeWish = useCallback((value) => {
    setDraft((current) => withWish(current, value));
    setRestored(false);
  }, []);

  const hrefOfJourney = useCallback((row) => localizePath(`/teekond/${encodeURIComponent(row.id)}`, locale), [locale]);
  /* Tavaline vajutus avab Teekonna lehe sees; uue vahekaardi vajutus jääb brauserile. */
  const openJourney = useCallback((event, row) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    pushWithTransition(router, hrefOfJourney(row));
  }, [hrefOfJourney, router]);

  const frame = (children) => {
    const content = (
      <div className={shared.page} ref={rootRef}>
        {children}
      </div>
    );
    if (embedded) return content;
    /* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale (töölaua sees
       annab selle töölaud ise). */
    return (
      <>
        <h1 className="sr-only">{t("journey.title", "Teekond")}</h1>
        {content}
      </>
    );
  };

  if (status === "loading" || !isRoleResolved) return frame(<WaitingView t={t} />);

  if (status !== "authenticated") {
    /* Pärast sisselogimist tuleb inimene samale lehele tagasi. */
    return frame(<SignedOutView t={t} loginHref={loginHref(embedded ? "/vestlus?workspace=journey" : "/teekond")} />);
  }

  if (!isClientRole) {
    return frame(<RoleView t={t} sheet={roleWorkspace(normalizedRole)} hrefOf={(href) => localizePath(href, locale)} />);
  }

  if (mode === "list") {
    if (!listLoaded) return frame(<WaitingView t={t} />);
    const more = boardMore(journeyPage, journeys.length);
    return frame(
      <BoardView
        t={t}
        rows={rows}
        filter={filter}
        onFilter={(value) => {
          setWantedGroup(value);
          setArchiveArmedId("");
        }}
        empty={filter.empty && !listFault}
        fault={listFault}
        onRetry={loadFirst}
        notice={notice?.view === "list" ? notice : null}
        archive={{
          armedId: archiveArmedId,
          busyId: busy.startsWith("archive:") ? busy.slice(8) : "",
          onPress: pressArchive,
          onCancel: cancelArchive
        }}
        more={more ? { ...more, busy: busy === "more", onMore: handleLoadMore } : null}
        hrefOf={hrefOfJourney}
        onOpen={openJourney}
        onStart={handleStartNew}
      />
    );
  }

  const states = startStepStates({ situation, draft, builtFor });
  const steps = START_STEPS.map((key) => ({
    key,
    label: t(`journey.start.steps.${key}.title`),
    short: t(`journey.start.steps.${key}.short`),
    state: states[key]
  }));
  const noticed = draftNoticed(draft);
  /* Ülevaate vaated ütlevad ise, kui ülevaadet ei ole: seda koostatakse, kirjeldus
     on tühi või koostamine ei õnnestunud. */
  const stale = draftStale({ situation, draft, builtFor });
  const pending = !stale
    ? null
    : busy === "build"
      ? { state: "building" }
      : notice?.view === "build"
        ? { state: "failed", text: notice.text }
        : { state: situation.trim() ? "waiting" : "empty" };
  const toDescribe = () => setStepKey("describe");
  const decline = { armed: declineArmed, onPress: pressDecline };
  const noticeOf = (view) => (notice?.view === view ? notice : null);

  return frame(
    <>
      <div className={shared.live} aria-live="polite">
        {leaveAsked ? (
          <p className={shared.notice} role="alert">
            {t("journey.start.leave_asked")}
          </p>
        ) : restored ? (
          <p className={shared.notice}>{t("journey.autosave.restored")}</p>
        ) : null}
      </div>
      <StepFlight label={t("journey.start.label")} steps={steps} activeKey={stepKey} onStepChange={handleStepChange}>
        {(step, _index, flight) => {
          const glow = flight?.isActive !== false;
          if (step.key === "describe") {
            return (
              <DescribeView
                t={t}
                value={situation}
                onChange={changeSituation}
                fieldRef={situationInputRef}
                notice={noticeOf("describe") || noticeOf("build")}
                busy={busy === "build"}
                decline={decline}
                onBuild={pressBuild}
                glow={glow}
              />
            );
          }
          if (step.key === "overview") {
            return (
              <OverviewView
                t={t}
                pending={pending}
                onDescribe={toDescribe}
                onBuild={buildDraft}
                title={draft.title}
                onTitle={changeTitle}
                noticed={noticed}
                notice={noticeOf("overview")}
              />
            );
          }
          if (step.key === "ahead") return <AheadView t={t} pending={pending} onDescribe={toDescribe} onBuild={buildDraft} noticed={noticed} />;
          if (step.key === "wish") return <WishView t={t} value={draftWish(draft)} limit={JOURNEY_TEXT_LIMITS.personWish} onChange={changeWish} />;
          return (
            <SaveView
              t={t}
              pending={pending || (draftReady(draft) ? null : { state: "empty" })}
              onDescribe={toDescribe}
              onBuild={buildDraft}
              notice={noticeOf("save")}
              decline={decline}
              save={{ busy: busy === "save", onSave: handleSaveDraft }}
              glow={glow}
            />
          );
        }}
      </StepFlight>
    </>
  );
}
