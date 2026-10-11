"use client";

/**
 * Minu jagamised: kõik, mida inimene on platvormil jaganud või mida tema kohta
 * jagada soovitakse, koos otsuste ja tagasivõttudega.
 *
 * KUJU (09.10, omaniku kujundusreeglid). Leht oli üks pikk veerg: nähtav
 * pealkiri ja kaksteist sektsiooni üksteise all, iga kirje omaette kõrge kaart.
 * Nüüd on leht sammulava (`components/stage/StepFlight.jsx`) laua kujul: see
 * avaneb kõigi osade ülevaates (iga plaat ütleb sõnadega, mis seal ootab, või
 * miks osa on tühi) ja osa avaneb omaette vaates madala loendina. Osad ei ole
 * sammud, seepärast annab leht lavale `parts` ja oma sõnad („Kõik jagamised").
 *
 * Osa sees vahetub sisu kohapeal: loend, avatud kirje ja (eelpöördumisel)
 * paranduse vorm. Vaated on failis ./desk/SharingsViews.jsx, read ja reeglid
 * failis ./desk/sharingRows.js. Siin on andmed, päringud ja see, mis vaateid
 * olekuga seob.
 *
 * MIS JÄI SAMAKS. Iga päring (aadress, keha, päised), iga lukk ja iga
 * laadimise haru: leht laadib kõik osad korraga aadressilt /api/my-sharings,
 * laadimata osa saab eraldi uuesti proovida ja eelpöördumiste järgmine
 * lehekülg laaditakse ainult sellele osale. Nõusoleku ja privaatsuse laused
 * (kes näeb, kust tuli, kui kaua kehtib; mida tagasivõtt ei tee; mida
 * jagatakse ja mida mitte) on sõna-sõnalt samad.
 *
 * MIS ON TEISITI (ja miks):
 *  - Tagasivõtt, kutse tühistamine ja ruumist lahkumine küsisid kinnitust
 *    eraldi aknas. Nüüd küsib nupp teist vajutust ja sama tagajärje lause
 *    seisab nupu kõrval.
 *  - Kiireloomulise abipalve tagasivõtt ja ettepaneku otsus (nõustun või ei
 *    nõustu) läksid teele ühe vajutusega. Kumbagi ei saa inimene siin tagasi
 *    pöörata, seepärast küsivad ka need teist vajutust.
 *  - Seisu sõna tuleb loendist: kood, millel sõna ei ole, ei jõua ekraanile.
 *  - Teade tegevuse õnnestumise kohta seisab laua kohal ja jääb ette järgmise
 *    tegevuseni; viga on selles vaates, kus tegevus tehti.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { localizePath } from "@/lib/localizePath";
import { pushWithTransition } from "@/lib/routeTransition";

import { CorrectionView, DeskLead, ItemView, PartSwap, PartView, PrivacyView, SharingsShell, TileSummary } from "./desk/SharingsViews";
import {
  CONFIRMED_ACTIONS,
  CORRECTION_LIMITS,
  SECTION_ORDER,
  SECTION_TEXTS,
  correctionProblem,
  deskLead,
  isUnavailable,
  opensItems,
  refusalIsGeneric,
  refusalMeansChanged,
  shareErrorText,
  urgentErrorText,
  sharingParts,
  sharingRow,
  sharingRows,
  sharingSheet
} from "./desk/sharingRows";

/* Lause, mille leht ise kokku pani (serveri vastusest või kataloogist). Kõik
   muu, mis püütakse (võrk katkes, brauseri enda ingliskeelne tekst), saab
   kataloogi üldise lause: brauseri teksti ekraanile ei lasta. */
class SaidError extends Error {}

/**
 * Keeldumise lause. Kui leht laaditi keeldumise peale uuesti, ei kutsu lause
 * enam vaadet värskendama (see on juba värske): serveri üldise „seis on
 * muutunud, värskenda vaadet” asemel öeldakse, et vaade on nüüd värske.
 */
function refusalText({ status, payload, t }) {
  if (refusalIsGeneric(status, payload?.messageKey || payload?.message)) return t("my_sharings.errors.state_changed");
  return resolveApiMessage({ payload, t, fallbackKey: "my_sharings.errors.action_failed" });
}
const said = (error, fallback) => (error instanceof SaidError && error.message ? error.message : fallback);

const EMPTY_SHARINGS = Object.freeze({
  preInquiries: [],
  rooms: [],
  roomSummaries: [],
  invites: [],
  helpListings: [],
  mentoringPreparations: [],
  networkShares: [],
  outgoingNetworkShares: [],
  urgentRequests: [],
  wellbeingSupportShares: [],
  serviceReportShares: [],
  privateRecords: []
});

const SHARING_SECTION_KEYS = Object.freeze(Object.keys(EMPTY_SHARINGS));

/* Teine vajutus peab tulema selle aja sees. Aken on pikem kui mujal (8 s):
   tagajärje lause nupu kõrval on siin kaks lauset ja selle lugemine ei tohi
   kellaga võidu käia. */
const CONFIRM_MS = 20000;
/* Lühim vahe esimese ja teise vajutuse vahel: topeltklõps on alla selle. */
const CONFIRM_MIN_GAP_MS = 400;
const NO_NOTICE = Object.freeze({ text: "", tone: "" });

/* Tagasivõtt, kutse tühistamine ja lahkumine: kuhu päring läheb ja mis on
   selle kehas. Neli tegevust, üks rada (`runAction`). */
const ACTION_REQUESTS = Object.freeze({
  recall: (item) => ({
    url: `/api/pre-inquiries/${encodeURIComponent(item.id)}/recall`,
    body: { expectedUpdatedAt: item.updatedAt }
  }),
  revoke: (item, locale) => ({
    url: `/api/invites/${encodeURIComponent(item.id)}/revoke`,
    body: { locale }
  }),
  mentoringRecall: (item) => ({
    url: `/api/mentoring/relations/${encodeURIComponent(item.relationId)}/preparation`,
    body: { action: "recall", noteId: item.id }
  }),
  leave: (item, locale) => ({
    url: `/api/rooms/${encodeURIComponent(item.id)}/leave`,
    body: { locale }
  })
});

function emptySectionMeta() {
  return Object.fromEntries(SHARING_SECTION_KEYS.map((key) => [key, {
    status: "EMPTY",
    errorCode: null,
    paging: { complete: true, hasMore: false, limit: null }
  }]));
}

export default function MySharingsPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  /* ⓘ kiirmenüüsse (lib/dashboardInfoContent → `my_sharings`). Selgitus, mis
     seni seisis pealkirja all sissejuhatusena, elab seal: info ei ole
     pealkirja alamärkus. */
  usePanelInfoSlot({ infoId: "my_sharings" });
  const [sharings, setSharings] = useState(EMPTY_SHARINGS);
  const [sectionMeta, setSectionMeta] = useState(emptySectionMeta);
  const [retryingSection, setRetryingSection] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  /* Teade laua kohal: tegevus õnnestus (või õnnestus, aga ülevaadet ei saanud
     värskendada). Jääb ette järgmise tegevuseni. */
  const [notice, setNotice] = useState(NO_NOTICE);
  /* Viga selles vaates, kus tegevus tehti. */
  const [actionError, setActionError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  /* Avatud kirje: osa võti ja kirje id. Korraga on lahti üks. */
  const [opened, setOpened] = useState(null);
  const [correction, setCorrection] = useState(null);
  const [privacyPrompt, setPrivacyPrompt] = useState(null);
  /* Teist vajutust ootav tegevus: `<tegevus>:<kirje id>`. */
  const [confirming, setConfirming] = useState("");
  const confirmTimer = useRef(0);
  const armedAt = useRef(0);
  const noticeRef = useRef(null);
  const mutationInFlightRef = useRef("");

  const armConfirm = useCallback((key) => {
    window.clearTimeout(confirmTimer.current);
    armedAt.current = Date.now();
    setConfirming(key);
    confirmTimer.current = window.setTimeout(() => setConfirming(""), CONFIRM_MS);
  }, []);
  const disarm = useCallback(() => {
    window.clearTimeout(confirmTimer.current);
    setConfirming("");
  }, []);
  useEffect(() => () => window.clearTimeout(confirmTimer.current), []);

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium", timeStyle: "short" }),
    [locale]
  );
  const formatDate = useCallback((value) => {
    if (!value) return t("my_sharings.labels.unknown_time");
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? formatter.format(date)
      : t("my_sharings.labels.unknown_time");
  }, [formatter, t]);
  /* Kaasamise lõpp on andmebaasis kuupäev (kesköö UTC järgi). Kellaajaga
     vormindaja näitas selle kõrval kellaaega „02:00" ja UTC-st läänes eelmist
     päeva: kuupäev loetakse samas ajavööndis, kus see salvestati. */
  const dayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium", timeZone: "UTC" }),
    [locale]
  );
  const formatDay = useCallback((value) => {
    if (!value) return t("my_sharings.labels.unknown_time");
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? dayFormatter.format(date)
      : t("my_sharings.labels.unknown_time");
  }, [dayFormatter, t]);
  /* Teenusaruande kuu tuleb kujul 2026-09: ekraanil on see sõnaga. Muu kujuga
     väärtus jääb nii, nagu server selle andis. */
  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale || "et", { month: "long", year: "numeric", timeZone: "UTC" }),
    [locale]
  );
  const formatMonth = useCallback((value) => {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(value || ""));
    return match ? monthFormatter.format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1))) : String(value || "");
  }, [monthFormatter]);

  const loadSharings = useCallback(async ({ signal, preserveData = false, section = null, cursor = null, append = false } = {}) => {
    if (!preserveData) setLoadError("");
    if (section) setRetryingSection(section);
    try {
      const response = section
        ? await fetch(`/api/my-sharings?section=${encodeURIComponent(section)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, {
          cache: "no-store",
          signal,
        })
        : await fetch("/api/my-sharings", { cache: "no-store", signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new SaidError(resolveApiMessage({
          payload,
          t,
          fallbackKey: "my_sharings.errors.load_failed"
        }));
      }
      const incoming = payload?.sharings && typeof payload.sharings === "object" ? payload.sharings : {};
      setSharings((current) => {
        const next = section ? { ...current } : { ...EMPTY_SHARINGS };
        for (const [key, value] of Object.entries(incoming)) {
          if (key in EMPTY_SHARINGS) {
            const items = Array.isArray(value?.items) ? value.items : [];
            next[key] = append ? [...current[key], ...items.filter((item) => !current[key].some((existing) => existing.id === item.id))] : items;
          }
        }
        return next;
      });
      setSectionMeta((current) => {
        const next = section ? { ...current } : emptySectionMeta();
        for (const [key, value] of Object.entries(incoming)) {
          if (key in EMPTY_SHARINGS) {
            next[key] = {
              status: value?.status || "EMPTY",
              errorCode: value?.errorCode || null,
              paging: value?.paging || { complete: true, hasMore: false, limit: null }
            };
          }
        }
        return next;
      });
      return true;
    } catch (error) {
      if (error?.name === "AbortError") return false;
      if (!preserveData) {
        setLoadError(said(error, t("my_sharings.errors.load_failed")));
      }
      return false;
    } finally {
      if (section) setRetryingSection("");
      if (!signal?.aborted) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSharings({ signal: controller.signal });
    return () => controller.abort();
  }, [loadSharings]);

  /* Pärast tegevust läheb fookus teatele laua kohal: nupp, mida vajutati, võib
     koos kirjega kadunud olla, ja teade on neutraalne koht (mitte järgmise
     kirje tagasivõtmise nupp). Fookus kerib teate ka nähtavale: pika teksti
     all olevat nuppu vajutanud inimene ei näeks muidu, mis juhtus. */
  useEffect(() => {
    if (!notice.text) return;
    noticeRef.current?.focus();
  }, [notice]);

  const factLabels = useMemo(() => ({
    visibility: t("my_sharings.ownership.visibility"),
    origin: t("my_sharings.ownership.origin"),
    validity: t("my_sharings.ownership.validity")
  }), [t]);

  /* Iga tegevus algab puhtalt lehelt: eelmise tegevuse teade ega viga ei jää
     uue tulemuse kõrvale seisma. */
  const resetMessages = useCallback(() => {
    setNotice(NO_NOTICE);
    setActionError("");
  }, []);

  /* Tegevus õnnestus: teade ette ja kogu ülevaade uuesti. Kui värskendus ei
     õnnestu, ütleb teade seda (muidu jääks ekraanile vana seis ilma märkuseta). */
  const finishAction = useCallback(async (doneText) => {
    setNotice({ text: doneText, tone: "ok" });
    const refreshed = await loadSharings({ preserveData: true });
    if (!refreshed) setNotice({ text: t("my_sharings.errors.refresh_failed"), tone: "risk" });
  }, [loadSharings, t]);

  /**
   * SK-V1: kiireloomulise abipalve tagasivõtt.
   *
   * Sama piir mis eelpöördumisel: kuni keegi ei ole lugenud. Serveri kontroll
   * on ülimuslik: `canRecall` siin on ainult nupu nähtavus, mitte luba.
   */
  const recallUrgentRequest = useCallback(async (request) => {
    const key = `urgent:${request.id}`;
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = key;
    setBusyKey(key);
    resetMessages();
    try {
      const response = await fetch(`/api/urgent-requests/${encodeURIComponent(request.id)}/recall`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
        body: "{}"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        /* Laud jõudis abipalve vahepeal läbi lugeda (või seda ei ole enam): leht
           laaditakse uuesti, et nupp, mis enam õnnestuda ei saa, ette ei jääks. */
        if (refusalMeansChanged(response.status)) await loadSharings({ preserveData: true });
        throw new SaidError(
          urgentErrorText(payload?.message, t) ||
            refusalText({ status: response.status, payload, t })
        );
      }
      await finishAction(t("my_sharings.notice.urgent_recalled"));
    } catch (error) {
      setActionError(said(error, t("my_sharings.errors.action_failed")));
    } finally {
      if (mutationInFlightRef.current === key) {
        mutationInFlightRef.current = "";
        setBusyKey("");
      }
    }
  }, [finishAction, loadSharings, locale, resetMessages, t]);

  /* COLLAB-P4. Suund on siin teistpidi kui ülejäänud lehel: need ei ole asjad,
     mida inimene on jaganud, vaid ettepanek jagada tema KOHTA. Ühendav mõiste
     ei ole suund, vaid „kus mu info liigub": seepärast on nad samal laual ja
     eristuvad osa nime, mitte eraldi lehega. */
  const decideNetworkShare = useCallback(async (share, decision) => {
    const key = `share:${share.id}`;
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = key;
    setBusyKey(key);
    resetMessages();
    try {
      const response = await fetch(`/api/network-shares/${encodeURIComponent(share.id)}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ui-locale": locale || "et",
          "Idempotency-Key": crypto.randomUUID()
        },
        /* Räsi on see, mille leht sai koos kuvatud tekstiga: kinnitus käib selle
           teksti kohta, mida inimene luges, mitte selle kohta, mis real vahepeal on. */
        body: JSON.stringify({ decision, expectedContentHash: share.contentHash || null })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        /* Tekst või seis on vahepeal muutunud: laadime jagamised uuesti, et inimene
           näeks seda, mille üle ta nüüd otsustab. */
        if (refusalMeansChanged(response.status)) await loadSharings({ preserveData: true });
        /* Tundmatu kood (lõppenud seanss, kiirusepiir) saab sama lause mis teistel
           tegevustel, mitte üldise „toiming ebaõnnestus”. */
        throw new SaidError(shareErrorText(payload?.message, t) || refusalText({ status: response.status, payload, t }));
      }
      await finishAction(t(decision === "CONFIRMED" ? "my_sharings.notice.share_confirmed" : "my_sharings.notice.share_declined"));
    } catch (error) {
      setActionError(said(error, t("my_sharings.errors.action_failed")));
    } finally {
      if (mutationInFlightRef.current === key) {
        mutationInFlightRef.current = "";
        setBusyKey("");
      }
    }
  }, [finishAction, loadSharings, locale, resetMessages, t]);

  /* Eelpöördumise ja mentorluse ettevalmistuse tagasivõtt, kutse tühistamine
     ja ruumist lahkumine. Kutsutakse ainult teise vajutuse pealt (`twoPress`). */
  const runAction = useCallback(async (action) => {
    const request = ACTION_REQUESTS[action?.kind];
    if (!request || mutationInFlightRef.current) return;
    const key = `${action.kind}:${action.item.id}`;
    mutationInFlightRef.current = key;
    setBusyKey(key);
    resetMessages();
    try {
      const { url, body } = request(action.item, locale);
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        /* Seis muutus vahepeal (mentor avas ettevalmistuse, saaja luges
           pöördumise, kutse võeti vastu, ruumist on juba lahkutud): leht laaditakse
           uuesti, et nupp, mida enam ei saa kasutada, ette ei jääks. */
        if (refusalMeansChanged(response.status)) await loadSharings({ preserveData: true });
        throw new SaidError(refusalText({ status: response.status, payload, t }));
      }
      await finishAction(t(CONFIRMED_ACTIONS[action.kind].done));
    } catch (error) {
      setActionError(said(error, t("my_sharings.errors.action_failed")));
    } finally {
      if (mutationInFlightRef.current === key) {
        mutationInFlightRef.current = "";
        setBusyKey("");
      }
    }
  }, [finishAction, loadSharings, locale, resetMessages, t]);

  const openCorrection = useCallback((item) => {
    disarm();
    setActionError("");
    setPrivacyPrompt(null);
    setCorrection({
      id: item.id,
      expectedUpdatedAt: item.updatedAt,
      topic: item.topic || "",
      situation: item.situation || "",
      text: item.sharedText || ""
    });
  }, [disarm]);

  const closeCorrection = useCallback(() => {
    setActionError("");
    setCorrection(null);
    setPrivacyPrompt(null);
  }, []);

  const sendCorrection = useCallback(async (privacyDecision = null) => {
    if (!correction || mutationInFlightRef.current) return;
    /* Sama kontroll, mille server teeb: tühi parandus ei lähe teele. */
    const problem = correctionProblem(correction);
    if (problem) {
      setPrivacyPrompt(null);
      setActionError(t(problem));
      return;
    }
    const key = `correct:${correction.id}`;
    mutationInFlightRef.current = key;
    setBusyKey(key);
    resetMessages();
    try {
      const response = await fetch(`/api/pre-inquiries/${encodeURIComponent(correction.id)}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: correction.expectedUpdatedAt,
          topic: correction.topic,
          situation: correction.situation,
          userEditedDraft: correction.text,
          privacyDecision
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        if (payload?.needsPrivacyConfirmation) {
          setPrivacyPrompt(payload);
          return;
        }
        throw new SaidError(resolveApiMessage({
          payload,
          t,
          fallbackKey: "my_sharings.errors.action_failed"
        }));
      }
      setCorrection(null);
      setPrivacyPrompt(null);
      await finishAction(t("my_sharings.notice.corrected"));
    } catch (error) {
      setActionError(said(error, t("my_sharings.errors.action_failed")));
    } finally {
      if (mutationInFlightRef.current === key) {
        mutationInFlightRef.current = "";
        setBusyKey("");
      }
    }
  }, [correction, finishAction, resetMessages, t]);

  /* Ühe osa uus katse ja järgmine lehekülg. Kui päring ei õnnestu, ütleb vaade
     seda: varem jäi ebaõnnestunud „Laadi veel" ilma ühegi märgita. */
  const reloadSection = useCallback(async (section, { cursor = null, append = false } = {}) => {
    setActionError("");
    const loaded = await loadSharings({ preserveData: true, section, cursor, append });
    if (!loaded) setActionError(t("my_sharings.errors.load_failed"));
  }, [loadSharings, t]);

  /* Teise osa ette tulles ei jää eelmise osa viga ega pooleli kinnitus uue
     osa külge. */
  const leavePart = useCallback(() => {
    disarm();
    setActionError("");
  }, [disarm]);

  const openItem = useCallback((section, id) => {
    disarm();
    setActionError("");
    setOpened({ section, id: String(id) });
  }, [disarm]);

  const closeItem = useCallback(() => {
    disarm();
    setActionError("");
    setOpened(null);
  }, [disarm]);

  const openedItem = useMemo(() => {
    if (!opened) return null;
    const list = Array.isArray(sharings[opened.section]) ? sharings[opened.section] : [];
    return list.find((item) => String(item.id) === opened.id) || null;
  }, [opened, sharings]);

  /* Avatud kirje kadus loendist (lahkuti ruumist, kutse võeti tagasi, osa jäi
     laadimata): avatud vaadet ei ole enam millestki joonistada, tagasi loendisse. */
  useEffect(() => {
    if (opened && !loading && !openedItem) setOpened(null);
  }, [loading, opened, openedItem]);

  const rowContext = useMemo(() => ({ t, formatDate, formatDay, formatMonth }), [formatDate, formatDay, formatMonth, t]);
  const sections = useMemo(
    () => Object.fromEntries(SECTION_ORDER.map((key) => [key, {
      rows: sharingRows(key, sharings[key], rowContext),
      status: sectionMeta[key]?.status || "EMPTY"
    }])),
    [rowContext, sectionMeta, sharings]
  );
  const parts = useMemo(() => sharingParts({ t, sections }), [sections, t]);
  const lead = deskLead({ t, parts, sections });
  /* Plaadi kokkuvõte: otsust ootava osa ees on märge sõna ja raamiga. Kõik muu,
     mida mudel osale annab (seis, märge), läheb lavale muutmata kaasa. */
  const steps = parts.map((part) => ({
    ...part,
    summary: part.flag ? <TileSummary flag={part.flag} text={part.summary} /> : part.summary
  }));

  /* Tegevus, mis küsib teist vajutust. Esimene vajutus muudab nupu sõnad ja
     toob tagajärje nupu kõrvale; teine (kuni CONFIRM_MS jooksul) teeb töö ära.
     Topeltklõps on kaks vajutust samal nupul: teine neist ei tohi kohe midagi
     teha, seepärast peab kinnitus tulema vähemalt CONFIRM_MIN_GAP_MS hiljem. */
  const twoPress = (key, name, run) => {
    const words = CONFIRMED_ACTIONS[name];
    const armed = confirming === key;
    return {
      key,
      armed,
      label: t(armed ? words.armed : words.label),
      note: armed ? t(words.consequence) : "",
      onClick: () => {
        if (!armed) return armConfirm(key);
        if (Date.now() - armedAt.current < CONFIRM_MIN_GAP_MS) return undefined;
        disarm();
        return run();
      }
    };
  };

  function renderItem(section, item, title, active) {
    const sheet = sharingSheet(section, item, rowContext);
    const { can } = sheet;
    const buttons = [];
    if (can.decide) {
      buttons.push({ ...twoPress(`shareConfirm:${item.id}`, "shareConfirm", () => void decideNetworkShare(item, "CONFIRMED")), primary: true });
      buttons.push(twoPress(`shareDecline:${item.id}`, "shareDecline", () => void decideNetworkShare(item, "DECLINED")));
    }
    if (can.recallUrgent) buttons.push(twoPress(`urgentRecall:${item.id}`, "urgentRecall", () => void recallUrgentRequest(item)));
    if (can.recall) buttons.push(twoPress(`recall:${item.id}`, "recall", () => void runAction({ kind: "recall", item })));
    if (can.leave) buttons.push(twoPress(`leave:${item.id}`, "leave", () => void runAction({ kind: "leave", item })));
    if (can.revoke) buttons.push(twoPress(`revoke:${item.id}`, "revoke", () => void runAction({ kind: "revoke", item })));
    if (can.mentoringRecall) buttons.push(twoPress(`mentoringRecall:${item.id}`, "mentoringRecall", () => void runAction({ kind: "mentoringRecall", item })));

    const actions = [];
    if (can.correct) actions.push({ key: "correct", label: t("my_sharings.actions.correct"), onClick: () => openCorrection(item) });
    if (can.relationId) {
      actions.push({
        key: "relation",
        label: t("my_sharings.mentoring.open_relation"),
        onClick: () => pushWithTransition(router, localizePath(`/mentorlus/suhe/${can.relationId}`, locale))
      });
    }

    return (
      <ItemView
        t={t}
        title={title}
        error={active ? actionError : ""}
        sheet={sheet}
        factLabels={factLabels}
        confirm={buttons.length ? { buttons, note: buttons.find((button) => button.armed)?.note || "", hint: sheet.hint } : null}
        actions={actions}
        busy={Boolean(busyKey)}
        glow={active}
        onInactive={disarm}
        onBack={closeItem}
      />
    );
  }

  const renderPart = (step, index, flight) => {
    const section = step.key;
    /* Lava hoiab kõiki osi korraga elus: viga ja põhinupu helk on ainult sellel
       osal, mis on ees. */
    const active = flight?.isActive !== false;
    const meta = sectionMeta[section];
    const error = active ? actionError : "";

    if (section === "preInquiries" && correction) {
      /* Vanal lehel seisis paranduse vorm kirje kaardi sees, rea „Kes näeb"
         all. Vaade on nüüd omaette, seepärast ütleb see ise, kellele parandus
         läheb; isikuandmete küsimuse juures on ka tekst, mille kohta küsitakse. */
      const corrected = (Array.isArray(sharings.preInquiries) ? sharings.preInquiries : []).find((item) => String(item.id) === String(correction.id));
      const visibility = corrected ? sharingRow("preInquiries", corrected, rowContext).facts?.visibility : "";
      const who = visibility ? `${factLabels.visibility}: ${visibility}` : "";
      if (privacyPrompt) {
        return (
          <PartSwap mode="privacy">
            <PrivacyView
              t={t}
              title={step.label}
              error={error}
              busy={Boolean(busyKey)}
              who={who}
              texts={[
                { key: "topic", label: t("my_sharings.correction.topic"), value: correction.topic },
                { key: "situation", label: t("my_sharings.correction.situation"), value: correction.situation },
                { key: "text", label: t("my_sharings.correction.text"), value: correction.text }
              ]}
              prompt={{
                onEdit: () => {
                  setActionError("");
                  setPrivacyPrompt(null);
                },
                onRedacted: () => void sendCorrection({ action: "use_redacted" }),
                onOriginal: privacyPrompt.allowOriginal ? () => void sendCorrection({ action: "send_original" }) : null
              }}
            />
          </PartSwap>
        );
      }
      return (
        <PartSwap mode="correction">
          <CorrectionView
            t={t}
            title={step.label}
            error={error}
            limits={CORRECTION_LIMITS}
            busy={Boolean(busyKey)}
            glow={active}
            who={who}
            form={{
              topic: correction.topic,
              situation: correction.situation,
              text: correction.text,
              onTopic: (value) => setCorrection((current) => (current ? { ...current, topic: value } : current)),
              onSituation: (value) => setCorrection((current) => (current ? { ...current, situation: value } : current)),
              onText: (value) => setCorrection((current) => (current ? { ...current, text: value } : current)),
              onSubmit: (event) => {
                event.preventDefault();
                void sendCorrection();
              },
              onCancel: closeCorrection
            }}
          />
        </PartSwap>
      );
    }

    if (opened?.section === section && openedItem) {
      return <PartSwap mode={`item:${opened.id}`}>{renderItem(section, openedItem, step.label, active)}</PartSwap>;
    }

    const paging = meta?.paging;
    const loadingSection = retryingSection === section;
    return (
      <PartSwap mode="list">
        <PartView
          t={t}
          title={step.label}
          lead={t(SECTION_TEXTS[section].help)}
          error={error}
          unavailable={
            isUnavailable(meta?.status)
              ? {
                  text: t(meta.status === "TIMEOUT" ? "my_sharings.errors.section_timeout" : "my_sharings.errors.section_unavailable"),
                  busy: loadingSection,
                  onRetry: () => void reloadSection(section)
                }
              : null
          }
          rows={sections[section].rows.map((row) => ({
            ...row,
            onOpen: opensItems(section) ? () => openItem(section, row.id) : null
          }))}
          emptyText={t(SECTION_TEXTS[section].empty)}
          /* Tagasivõtu piir kehtib iga eelpöördumise kohta: see seisab loendi
             all üks kord (varem iga kaardi peal) ja uuesti avatud kirjes. */
          note={section === "preInquiries" && sections[section].rows.length ? t("my_sharings.notice.memory") : ""}
          more={
            paging?.hasMore
              ? paging.nextCursor
                ? { busy: loadingSection, onClick: () => void reloadSection(section, { cursor: paging.nextCursor, append: true }) }
                : /* Server annab järgmise lehekülje ainult eelpöördumistele.
                     Teistes osades lõppes loend varem vaikides ära. */
                  { note: t("my_sharings.views.truncated") }
              : null
          }
          factLabels={factLabels}
        />
      </PartSwap>
    );
  };

  return (
    <SharingsShell
      title={t("my_sharings.title")}
      notice={notice}
      noticeRef={noticeRef}
      loadingText={loading ? t("my_sharings.loading") : ""}
      error={!loading ? loadError : ""}
      retryText={t("my_sharings.actions.retry")}
      onRetry={() => {
        setLoading(true);
        void loadSharings();
      }}
    >
      {!loading && !loadError ? (
        <StepFlight
          label={t("my_sharings.title")}
          steps={steps}
          startWide
          parts
          texts={{
            all: t("my_sharings.views.all"),
            position: (current, total, label) => t("my_sharings.views.position", { current, total, label })
          }}
          wideLead={lead ? <DeskLead lead={lead} /> : null}
          onStepChange={leavePart}
        >
          {renderPart}
        </StepFlight>
      ) : null}
    </SharingsShell>
  );
}
