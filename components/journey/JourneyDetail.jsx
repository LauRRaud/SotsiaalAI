"use client";

/**
 * Avatud Teekond: laud, mille iga osa on üks asi.
 *
 * KUJU (10.10). Leht oli üks pikk veerg vanal ühisel kihil (1536 × 640 aknas
 * 6091 px sisu 522 px paneelis): soov, sammud, hinnang, paberleht, paus, rada,
 * teenusekaart, eelpöördumine, jätkumise vorm, muutmise vorm ja kustutamine
 * seisid üksteise all. Nüüd avaneb leht ülevaates (kõik osad plaatidena, igaühel
 * oma seis) ja osa avaneb omaette vaates. See on platvormi sammulava
 * (`components/stage/StepFlight.jsx`) laua kujul: osad ei ole sammud, kiirmenüüs
 * on nupp kogu laua juurde ja avatud osa nimi.
 *
 * SEE FAIL hoiab Teekonda, teeb lehe päringud ja seob osad lavaga. Osade vaated
 * on failis ./detail/DeskParts.jsx; sammud, hinnang ja paus teevad oma päringud
 * ise (./JourneySteps.jsx, ./JourneyAssessment.jsx, ./JourneyClosure.jsx).
 * Reeglid (osade seis, jagamise valikud, vormide seis) on failis
 * ./detail/journeyDesk.js.
 *
 * TEADE JA VIGA. Õnnestunud tegevuse teade seisab laua KOHAL ja jääb ette
 * järgmise tegevuseni; viga seisab selle osa all servas, kus tegevus tehti.
 *
 * SALVESTAMATA TEKST. Osa teatab, kui selles on muudetud teksti (soov, samm,
 * märge, lõpusõna, jätkumise vorm, olukorra muutmine). Siis peab lahkumise teed,
 * mida leht ise ei joonista (kiirmenüü tagasinool, Esc, akna sulgemine), kinni
 * värav `lib/panelLeaveGuard.js`. Osast osasse liikudes tekst ei kao: lava hoiab
 * kõik osad alles.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import JourneyAssessment from "@/components/journey/JourneyAssessment";
import JourneyClosure from "@/components/journey/JourneyClosure";
import JourneySteps from "@/components/journey/JourneySteps";
import { localizePath } from "@/lib/localizePath";
import { buildServiceMapHandoff } from "@/lib/journey/serviceMapHandoff";
import { buildAssistiveDevicesHandoff } from "@/lib/journey/assistiveDevices";
import { journeyErrorText } from "@/lib/journey/errorText";
import { buildHelpMediationHandoff } from "@/lib/journey/helpMediationHandoff";
import { buildHealthContactQuestionsDraft, hasHealthContactSignal } from "@/lib/journey/healthContact";
import { todayInEstonia } from "@/lib/journey/stepRules";
import { reconcileSuggestedActionTitles } from "@/lib/journey/suggestedActions";
import { setPanelLeaveGuard, twoPressLeaveGuard } from "@/lib/panelLeaveGuard";
import { pushWithTransition } from "@/lib/routeTransition";
import { loginHref } from "@/lib/safeNextPath";

import { Chip } from "./detail/DeskBits";
import { ContinuityPart, DataPart, HelpPart, RoadPart, SentPart, SharePart, SituationPart, WishPart } from "./detail/DeskParts";
import styles from "./detail/detail.module.css";
import {
  DESK_PARTS,
  HELP_REQUEST_DEFAULT_SHARE,
  PRE_INQUIRY_DEFAULT_SHARE,
  ROAD_STATE_KEYS,
  dayOf,
  deskTiles,
  helpCategoryKey,
  helpKinds,
  helpOfferMatchHref,
  helpRequestShareOptions,
  isArchived,
  journeyLifeDomains,
  journeyStateKey,
  preInquiryShareOptions,
  relatedCounts,
  reviewedShareHref,
  shareBlockKey,
  startTarget,
  textToLines,
  toggleKey
} from "./detail/journeyDesk";
import shared from "./journey.module.css";

async function downloadJourneyExport(journey, filename = "journey.json") {
  const response = await fetch(`/api/journeys/${encodeURIComponent(journey.id)}/export`, { cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "journeys.errors.export_failed");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/* Abi liigi sõna; tundmatu kood annab üldise sõna, mitte koodi enda. */
function helpCategoryWord(t, code) {
  const key = helpCategoryKey(code);
  const word = t(key);
  return word === key ? t(helpCategoryKey("OTHER")) : word;
}

function hasMunicipalitySignal(journey, serviceMapHandoff) {
  if (serviceMapHandoff?.filters?.municipalityName) return true;
  const context = journey?.context && typeof journey.context === "object" && !Array.isArray(journey.context)
    ? journey.context
    : {};
  return Boolean(context.municipalityText || context.municipalityId || context.municipality || context.county || context.region);
}

function toNullableBoolean(value) {
  if (value === "YES") return true;
  if (value === "NO") return false;
  return null;
}

function mergeUniqueTextItems(existing, additions, maxItems = 12) {
  const result = [];
  const seen = new Set();
  for (const item of [...(Array.isArray(existing) ? existing : []), ...additions]) {
    const text = typeof item === "string" ? item : item?.title || "";
    const normalized = String(text || "").trim();
    const key = normalized.toLocaleLowerCase("et");
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

function mergeUniqueActions(existing, additions, maxItems = 8) {
  const result = [];
  const seen = new Set();
  for (const action of [...(Array.isArray(existing) ? existing : []), ...additions]) {
    const title = typeof action === "string" ? action : action?.title || "";
    const type = typeof action === "object" ? action?.type || "" : "";
    const normalizedTitle = String(title || "").trim();
    const normalizedType = String(type || "").trim();
    const key = `${normalizedType}:${normalizedTitle}`.toLocaleLowerCase("et");
    if (!normalizedTitle || seen.has(key)) continue;
    seen.add(key);
    result.push({
      title: normalizedTitle,
      ...(normalizedType ? { type: normalizedType } : {})
    });
    if (result.length >= maxItems) break;
  }
  return result;
}

function buildContinuityMissingInfo(form, t) {
  const missing = [];
  if (!form.serviceName.trim()) missing.push(t("journey.serviceContinuity.missingServiceName", "teenuse või toe nimetus"));
  if (!form.currentProvider.trim()) missing.push(t("journey.serviceContinuity.missingCurrentProvider", "praegune teenuseosutaja või kontakt"));
  if (!form.municipality.trim()) missing.push(t("journey.serviceContinuity.missingMunicipality", "KOV või piirkond"));
  if (form.knownEndDate === "YES" && !form.endDate.trim()) missing.push(t("journey.serviceContinuity.missingEndDate", "teadaolev lõppkuupäev"));
  if (!form.hasDecisionOrPlan) missing.push(t("journey.serviceContinuity.missingDecisionOrPlan", "otsus, teenuseplaan, leping, kiri või muu dokument"));
  if (!form.kovAlreadyInvolved && !form.providerAlreadyInvolved) missing.push(t("journey.serviceContinuity.missingContactAlreadyInvolved", "kas KOV või teenuseosutaja on juba kaasatud"));
  return missing;
}

function continuityMissingInfoLabels(t) {
  return new Set([
    t("journey.serviceContinuity.missingServiceName", "teenuse või toe nimetus"),
    t("journey.serviceContinuity.missingCurrentProvider", "praegune teenuseosutaja või kontakt"),
    t("journey.serviceContinuity.missingMunicipality", "KOV või piirkond"),
    t("journey.serviceContinuity.missingEndDate", "teadaolev lõppkuupäev"),
    t("journey.serviceContinuity.missingDecisionOrPlan", "otsus, teenuseplaan, leping, kiri või muu dokument"),
    t("journey.serviceContinuity.missingContactAlreadyInvolved", "kas KOV või teenuseosutaja on juba kaasatud")
  ].map((item) => String(item || "").trim().toLocaleLowerCase("et")));
}

function buildContinuityActions(form, t) {
  const actions = [
    {
      type: "CREATE_PRE_INQUIRY",
      title: t("journey.serviceContinuity.actionPreInquiry", "Koosta eelpöördumine")
    },
    {
      type: "OPEN_SERVICE_MAP",
      title: t("journey.serviceContinuity.actionServiceMap", "Ava teenusekaart")
    }
  ];
  if (form.hasDecisionOrPlan === "YES" || form.documentAttached === "NO") {
    actions.push({
      type: "ADD_DOCUMENT",
      title: t("journey.serviceContinuity.actionAddDocument", "Lisa dokument analüüsiks")
    });
  }
  if (form.currentProvider.trim()) {
    actions.push({
      type: "CONTACT_PROVIDER",
      title: t("journey.serviceContinuity.actionContactProvider", "Täpsusta teenuseosutajaga")
    });
  }
  if (form.municipality.trim()) {
    actions.push({
      type: "CONTACT_KOV",
      title: t("journey.serviceContinuity.actionContactKov", "Täpsusta KOV-iga")
    });
  }
  return actions;
}

/**
 * Eelvaade: mida saaja näeks, kui inimene võtab eelpöördumisse kaasa valitud
 * osad. Server paneb teksti kokku; midagi ei salvestata. Küsitakse ainult siis,
 * kui osa on ees (`enabled`): lava hoiab kõik osad alles ja muidu läheks päring
 * teele juba lehe avamisel.
 */
function usePreInquiryPreview(journey, selectedShareKeys, enabled) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!enabled || !journey?.id) return undefined;
    const controller = new AbortController();
    fetch(`/api/journeys/${encodeURIComponent(journey.id)}/pre-inquiry-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareKeys: selectedShareKeys }),
      signal: controller.signal
    })
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => { if (!controller.signal.aborted && payload?.ok) setPreview(payload.prefill || null); })
      .catch(() => { if (!controller.signal.aborted) setPreview(null); });
    return () => controller.abort();
  }, [enabled, journey?.id, selectedShareKeys]);
  return preview;
}

/** Sama abisoovi kohta: mis läheks kuulutuse mustandisse. */
function useHelpRequestPreview(journey, selectedShareKeys, enabled) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!enabled || !journey?.id) return undefined;
    const controller = new AbortController();
    fetch(`/api/journeys/${encodeURIComponent(journey.id)}/help-request-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareKeys: selectedShareKeys }),
      signal: controller.signal
    })
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => {
        if (!controller.signal.aborted) setPreview(payload?.ok ? payload.prefill || null : null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setPreview(null);
      });
    return () => controller.abort();
  }, [enabled, journey?.id, selectedShareKeys]);
  return preview;
}

export default function JourneyDetail({ journeyId, startWith: requestedStart = "" }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { status } = useSession();
  const [journey, setJourney] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loadFault, setLoadFault] = useState("");
  /* Mis lehe päring käib: "" | "save" | "wish" | "continuity" | "reopen" | "delete" | "export" | "more". */
  const [busy, setBusy] = useState("");
  /* Viga kuulub selle osa juurde, kus tegevus tehti: { part, text }. */
  const [fault, setFault] = useState(null);
  const [notice, setNotice] = useState("");
  const [leaveAsked, setLeaveAsked] = useState(false);
  const [dirtyParts, setDirtyParts] = useState({});
  /* Tuleb lehelt (aadressi `?alusta=`), mitte brauseri aadressiribalt: lehe sees
     liikudes ei ole aadress esimesel joonistusel veel uus. „Salvesta ja koosta
     eelpöördumine" avab jagamise valiku kohe. */
  const target = startTarget(requestedStart);
  const [partKey, setPartKey] = useState(target?.part || null);
  const [healthDraftOpen, setHealthDraftOpen] = useState(false);
  const [healthQuestionsDraft, setHealthQuestionsDraft] = useState("");
  const [healthCopied, setHealthCopied] = useState(false);
  const [preInquiryShareKeys, setPreInquiryShareKeys] = useState(PRE_INQUIRY_DEFAULT_SHARE);
  const [thirdPartyAcknowledged, setThirdPartyAcknowledged] = useState(false);
  const [helpRequestShareKeys, setHelpRequestShareKeys] = useState(null);
  const [helpRequestViewOpen, setHelpRequestViewOpen] = useState(false);
  const [helpOfferMatchCount, setHelpOfferMatchCount] = useState(null);
  const [helpOfferMatchLoading, setHelpOfferMatchLoading] = useState(false);
  const busyRef = useRef("");
  const noticeRef = useRef(null);

  /* Pärast laadimist võetakse märge aadressilt ära, et lehe uuendamine ei avaks
     sama osa uuesti. */
  useEffect(() => {
    if (!target || !journey?.id) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("alusta");
      window.history.replaceState(window.history.state, "", url);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [target, journey?.id]);

  const archived = isArchived(journey);
  const serviceMapHandoff = useMemo(
    () => (journey ? buildServiceMapHandoff(journey) : null),
    [journey]
  );
  const assistiveDevicesHandoff = useMemo(
    () => (journey ? buildAssistiveDevicesHandoff(journey) : null),
    [journey]
  );
  const serviceMapHref = serviceMapHandoff?.href
    ? localizePath(serviceMapHandoff.href, locale)
    : localizePath("/teenusekaart", locale);
  const helpMediationHandoff = useMemo(
    () => (journey ? buildHelpMediationHandoff(journey) : null),
    [journey]
  );
  const helpOfferMatchApiHref = useMemo(
    () => helpOfferMatchHref(helpMediationHandoff),
    [helpMediationHandoff]
  );
  const helpOffersHref = localizePath(helpMediationHandoff?.viewOffersHref || "/teenusekaart?type=HELP_OFFER", locale);
  const helpRequestsHref = localizePath(helpMediationHandoff?.browseRequestsHref || "/teenusekaart?type=HELP_REQUEST", locale);
  const createHelpRequestHref = localizePath(helpMediationHandoff?.createRequestHref || "/vestlus?workflow=help_request", locale);
  const createHelpOfferHref = localizePath(helpMediationHandoff?.createOfferHref || "/vestlus?workflow=help_offer", locale);
  const preInquiryHref = journeyId
    ? localizePath(`/eelpoordumised?fromJourney=${encodeURIComponent(journeyId)}&workspaceRole=CLIENT`, locale)
    : localizePath("/eelpoordumised", locale);
  const documentsHref = localizePath("/documents", locale);
  const showHealthContact = useMemo(
    () => (journey ? hasHealthContactSignal(journey) : false),
    [journey]
  );
  const hasHelpOfferMatches = Number(helpOfferMatchCount) > 0;
  const kinds = useMemo(
    () => helpKinds({
      hasPracticalNeed: Boolean(helpMediationHandoff?.hasPracticalNeed),
      hasAssistiveDeviceNeed: Boolean(assistiveDevicesHandoff?.hasAssistiveDeviceNeed),
      hasHealthSignal: showHealthContact
    }),
    [assistiveDevicesHandoff?.hasAssistiveDeviceNeed, helpMediationHandoff?.hasPracticalNeed, showHealthContact]
  );

  /* Jagamise valikud: ainult see, mis Teekonnas olemas on. Abisoovi vaikimisi
     valik sõltub Teekonnast, seega arvutatakse see esimesel korral. */
  const preInquiryOptions = useMemo(
    () => preInquiryShareOptions(journey, { hasAssistiveDeviceNeed: Boolean(assistiveDevicesHandoff?.hasAssistiveDeviceNeed) }),
    [assistiveDevicesHandoff?.hasAssistiveDeviceNeed, journey]
  );
  const helpRequestOptions = useMemo(() => helpRequestShareOptions(journey, helpMediationHandoff), [helpMediationHandoff, journey]);
  const helpRequestSelected = useMemo(
    () => helpRequestShareKeys || helpRequestOptions.filter((option) => HELP_REQUEST_DEFAULT_SHARE.includes(option.value)).map((option) => option.value),
    [helpRequestOptions, helpRequestShareKeys]
  );
  const preInquiryPreview = usePreInquiryPreview(journey, preInquiryShareKeys, partKey === "share");
  const helpRequestPreview = useHelpRequestPreview(journey, helpRequestSelected, partKey === "help" && helpRequestViewOpen);
  const helpRequestPreviewText = [
    helpRequestPreview?.draft?.description,
    /* Abi liik sõnana (sama kataloog mis abikuulutustel), mitte serveri koodina. */
    helpRequestPreview?.draft?.categoryCode ? `${t("journey.helpMediation.share.category", "abi liik")}: ${helpCategoryWord(t, helpRequestPreview.draft.categoryCode)}` : "",
    helpRequestPreview?.municipalityLabel ? `${t("journey.helpMediation.share.region", "piirkond")}: ${helpRequestPreview.municipalityLabel}` : "",
    helpRequestPreview?.draft?.availabilityOrStart,
    helpRequestPreview?.draft?.conditions
  ].filter(Boolean).join("\n");

  /* /teekond/[id] EI ole PanelFrame'i marsruudikaardis — ilma selle
     registreerimiseta jääks leht hoopis ilma ⓘ-ta. */
  usePanelInfoSlot({
    infoId: "journey",
    title: t("journey.title", "Teekond"),
    label: t("journey.info.label", "Open journey info")
  });

  const lock = useCallback((value) => {
    busyRef.current = value;
    setBusy(value);
  }, []);

  const loadJourney = useCallback(async () => {
    if (status !== "authenticated" || !journeyId) return;
    setLoadFault("");
    setNotFound(false);

    const response = await fetch(`/api/journeys/${encodeURIComponent(journeyId)}`, {
      cache: "no-store"
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 404) {
      setNotFound(true);
      setJourney(null);
      return;
    }
    if (!response.ok || !payload.ok) {
      throw new Error(journeyErrorText(t, payload.message, t("journey.messages.load_failed", "Loading the journey failed.")));
    }
    setJourney(payload.journey || null);
  }, [journeyId, status, t]);

  /* Brauseri enda veateksti (võrgutõrge) ei näidata: lause tuleb kataloogist. */
  const loadFirst = useCallback(() => {
    loadJourney().catch((loadError) => {
      const known = loadError instanceof Error && !(loadError instanceof TypeError) ? loadError.message : "";
      setLoadFault(known || t("journey.messages.load_failed", "Loading the journey failed."));
    });
  }, [loadJourney, t]);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadFirst();
  }, [loadFirst, status]);

  useEffect(() => {
    if (!helpOfferMatchApiHref) {
      setHelpOfferMatchCount(null);
      setHelpOfferMatchLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setHelpOfferMatchLoading(true);
    setHelpOfferMatchCount(null);

    fetch(helpOfferMatchApiHref, {
      cache: "no-store",
      signal: controller.signal
    })
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => {
        if (controller.signal.aborted) return;
        const entries = Array.isArray(payload?.entries) ? payload.entries : [];
        setHelpOfferMatchCount(entries.length);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setHelpOfferMatchCount(0);
      })
      .finally(() => {
        if (!controller.signal.aborted) setHelpOfferMatchLoading(false);
      });

    return () => controller.abort();
  }, [helpOfferMatchApiHref]);

  /* Õnnestunud tegevus: teade laua kohale (jääb ette järgmise tegevuseni). */
  const done = useCallback((text) => {
    setFault(null);
    setNotice(text);
  }, []);
  const begin = useCallback((kind) => {
    lock(kind);
    setFault(null);
    setNotice("");
  }, [lock]);

  const handleSave = useCallback(async (form) => {
    if (busyRef.current) return false;
    begin("save");

    try {
      const response = await fetch(`/api/journeys/${encodeURIComponent(journeyId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: form.title,
          summary: form.summary,
          primaryPath: form.primaryPath,
          domains: textToLines(form.domains),
          missingInfo: textToLines(form.missingInfo),
          riskSignals: textToLines(form.riskSignals),
          suggestedActions: reconcileSuggestedActionTitles(journey?.suggestedActions, form.suggestedActions),
          expectedUpdatedAt: journey?.updatedAt
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setFault({ part: "situation", text: journeyErrorText(t, payload.message, t("journey.messages.save_failed", "Saving the journey failed.")) });
        return false;
      }
      setJourney(payload.journey);
      done(t("journey.messages.updated", "Journey updated."));
      return true;
    } catch {
      setFault({ part: "situation", text: t("journey.messages.save_failed", "Saving the journey failed.") });
      return false;
    } finally {
      lock("");
    }
  }, [begin, done, journey?.suggestedActions, journey?.updatedAt, journeyId, lock, t]);

  /* Paus või lõpetamine (K1-f): osa saadab päringu ise ja annab siia uue seisu. */
  const handleClosed = useCallback((nextJourney, kind) => {
    setJourney(nextJourney);
    done(kind === "FINISHED"
      ? t("journey.closure.finished_notice", "Teekond on lõpetatud.")
      : t("journey.closure.paused_notice", "Teekond on pausil."));
  }, [done, t]);

  const handleReopen = useCallback(async () => {
    if (busyRef.current || !journeyId || journey?.status !== "ARCHIVED") return;
    begin("reopen");
    try {
      const response = await fetch(`/api/journeys/${encodeURIComponent(journeyId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE", expectedUpdatedAt: journey.updatedAt })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setFault({ part: "closure", text: journeyErrorText(t, payload.message, t("journey.messages.reopen_failed", "Teekonna taasavamine ebaõnnestus.")) });
        return;
      }
      setJourney(payload.journey);
      done(t("journey.messages.reopened", "Teekond taasavati."));
    } catch {
      setFault({ part: "closure", text: t("journey.messages.reopen_failed", "Teekonna taasavamine ebaõnnestus.") });
    } finally {
      lock("");
    }
  }, [begin, done, journey?.status, journey?.updatedAt, journeyId, lock, t]);

  const handleDelete = useCallback(async () => {
    if (busyRef.current || !journeyId) return;
    begin("delete");
    try {
      const response = await fetch(`/api/journeys/${encodeURIComponent(journeyId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setFault({ part: "data", text: journeyErrorText(t, payload.message, t("journey.messages.delete_failed", "Teekonna kustutamine ebaõnnestus.")) });
        lock("");
        return;
      }
      /* Kustutatud Teekonnal ei ole enam midagi kinni hoida. */
      setDirtyParts({});
      pushWithTransition(router, localizePath("/teekond", locale));
    } catch {
      setFault({ part: "data", text: t("journey.messages.delete_failed", "Teekonna kustutamine ebaõnnestus.") });
      lock("");
    }
  }, [begin, journeyId, locale, lock, router, t]);

  const handleExport = useCallback(async () => {
    if (busyRef.current || !journey) return;
    begin("export");
    try {
      await downloadJourneyExport(journey, `teekond-${journey.id}.json`);
    } catch (exportError) {
      setFault({ part: "data", text: journeyErrorText(t, exportError.message, t("journey.messages.export_failed", "Eksport ebaõnnestus.")) });
    } finally {
      lock("");
    }
  }, [begin, journey, lock, t]);

  /* Soovi salvestamine: kogu kontekst läheb kaasa nagu teenuse jätkumise kontrollil,
     sest server asendab konteksti tervikuna. Tühi tekst eemaldab soovi. */
  const handleSaveWish = useCallback(async (value) => {
    if (busyRef.current || !journey || !journeyId) return false;
    const wish = String(value || "").trim();
    const context = { ...(journey.context || {}) };
    if (wish) context.personWish = wish;
    else delete context.personWish;
    begin("wish");
    try {
      const response = await fetch(`/api/journeys/${encodeURIComponent(journeyId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, expectedUpdatedAt: journey.updatedAt })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setFault({ part: "wish", text: journeyErrorText(t, payload.message, t("journey.messages.save_failed", "Saving the journey failed.")) });
        return false;
      }
      setJourney(payload.journey);
      done(wish ? t("journey.wish.saved", "Sinu soov on salvestatud.") : t("journey.wish.removed", "Soov on eemaldatud."));
      return true;
    } catch {
      setFault({ part: "wish", text: t("journey.messages.save_failed", "Saving the journey failed.") });
      return false;
    } finally {
      lock("");
    }
  }, [begin, done, journey, journeyId, lock, t]);

  const handleLoadMorePreInquiries = useCallback(async () => {
    const cursor = journey?.linkedPreInquiriesPage?.nextCursor;
    if (busyRef.current || !journeyId || !cursor) return;
    begin("more");
    try {
      const response = await fetch(
        `/api/journeys/${encodeURIComponent(journeyId)}/linked-pre-inquiries?cursor=${encodeURIComponent(cursor)}&limit=25`,
        { cache: "no-store" }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setFault({ part: "sent", text: journeyErrorText(t, payload.message, t("journey.messages.load_failed", "Loading the journey failed.")) });
        return;
      }
      setJourney((current) => ({
        ...current,
        linkedPreInquiries: [...(current?.linkedPreInquiries || []), ...(payload.page?.items || [])],
        linkedPreInquiriesPage: payload.page
      }));
    } catch {
      setFault({ part: "sent", text: t("journey.messages.load_failed", "Loading the journey failed.") });
    } finally {
      lock("");
    }
  }, [begin, journey?.linkedPreInquiriesPage?.nextCursor, journeyId, lock, t]);

  const handleSaveContinuity = useCallback(async (continuityForm) => {
    if (busyRef.current || !journey || !journeyId) return false;
    begin("continuity");

    const serviceContinuity = {
      serviceName: continuityForm.serviceName.trim(),
      currentProvider: continuityForm.currentProvider.trim(),
      municipality: continuityForm.municipality.trim(),
      hasExistingService: toNullableBoolean(continuityForm.hasExistingService),
      knownEndDate: toNullableBoolean(continuityForm.knownEndDate),
      endDate: continuityForm.knownEndDate === "YES" ? continuityForm.endDate.trim() : "",
      hasDecisionOrPlan: toNullableBoolean(continuityForm.hasDecisionOrPlan),
      documentAttached: toNullableBoolean(continuityForm.documentAttached),
      kovAlreadyInvolved: toNullableBoolean(continuityForm.kovAlreadyInvolved),
      providerAlreadyInvolved: toNullableBoolean(continuityForm.providerAlreadyInvolved),
      userGoal: continuityForm.userGoal.trim(),
      updatedAt: new Date().toISOString()
    };
    const missingInfo = buildContinuityMissingInfo(continuityForm, t);
    const continuityMissingLabels = continuityMissingInfoLabels(t);
    const existingMissingInfo = Array.isArray(journey.missingInfo)
      ? journey.missingInfo.filter((item) => !continuityMissingLabels.has(String(item || "").trim().toLocaleLowerCase("et")))
      : [];
    const suggestedActions = buildContinuityActions(continuityForm, t);
    const riskSignal = t(
      "journey.serviceContinuity.riskSignal",
      "Kasutaja märkis, et olemasolev teenus või tugi võib vajada jätkumise täpsustamist."
    );

    try {
      const response = await fetch(`/api/journeys/${encodeURIComponent(journeyId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          context: {
            ...(journey.context || {}),
            serviceContinuity
          },
          riskSignals: mergeUniqueTextItems(journey.riskSignals, [riskSignal], 8),
          missingInfo: mergeUniqueTextItems(existingMissingInfo, missingInfo, 12),
          suggestedActions: mergeUniqueActions(journey.suggestedActions, suggestedActions, 8),
          expectedUpdatedAt: journey.updatedAt
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setFault({ part: "continuity", text: journeyErrorText(t, payload.message, t("journey.messages.save_failed", "Saving the journey failed.")) });
        return false;
      }
      setJourney(payload.journey);
      done(t("journey.serviceContinuity.saved", "Teenuse jätkumise kontroll salvestati Teekonda."));
      return true;
    } catch {
      setFault({ part: "continuity", text: t("journey.messages.save_failed", "Saving the journey failed.") });
      return false;
    } finally {
      lock("");
    }
  }, [begin, done, journey, journeyId, lock, t]);

  const handleCreateHealthQuestions = useCallback(() => {
    if (!journey) return;
    setHealthQuestionsDraft(buildHealthContactQuestionsDraft(journey, {
      title: t("journey.healthContact.questionsDraftTitle", "Küsimused tervisekontaktile"),
      situationLabel: t("journey.healthContact.draftSituationLabel", "Kirjeldan lühidalt oma olukorda:"),
      situationPlaceholder: t("journey.healthContact.draftSituationPlaceholder", "[lisa lühike olukorra kirjeldus]"),
      clarificationLabel: t("journey.healthContact.draftClarificationLabel", "Soovin täpsustada:"),
      clarificationPlaceholder: t("journey.healthContact.draftClarificationPlaceholder", "[lisa, mida soovid tervisekontaktiga täpsustada]"),
      contactQuestion: t("journey.healthContact.draftContactQuestion", "Kas peaksin selle küsimusega pöörduma perearstikeskuse, tervisekeskuse või ametliku tervisenõu kontakti poole?"),
      preparationQuestion: t("journey.healthContact.draftPreparationQuestion", "Milline info või dokument oleks enne pöördumist kasulik ette valmistada?"),
      dailyLifeQuestion: t("journey.healthContact.draftDailyLifeQuestion", "Kas see teema võib mõjutada minu igapäevast toimetulekut, tööd, õppimist või olemasolevat tuge?")
    }));
    setHealthDraftOpen(true);
    setHealthCopied(false);
  }, [journey, t]);

  /* Küsimused jäävad inimese kätte: neid ei salvestata ega saadeta. Kopeerimine
     on tee need siit kaasa võtta. */
  const handleCopyHealthQuestions = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(healthQuestionsDraft);
      setHealthCopied(true);
    } catch {
      setFault({ part: "help", text: t("journey.desk.help.copy_failed") });
    }
  }, [healthQuestionsDraft, t]);

  /* Osa teatab salvestamata tekstist: üks kindel funktsioon osa kohta, et osa
     efekt ei käivituks iga joonistuse peale. */
  const dirtySetters = useMemo(
    () => Object.fromEntries(DESK_PARTS.map((key) => [key, (dirty) => setDirtyParts((current) => (Boolean(current[key]) === Boolean(dirty) ? current : { ...current, [key]: Boolean(dirty) }))])),
    []
  );
  const dirty = Object.values(dirtyParts).some(Boolean);

  /* Salvestamata tekst ja lahkumise teed, mida leht ise ei joonista: esimene
     lahkumine jääb kinni ja laua kohal seisab põhjus, teine lahkub. */
  useEffect(() => {
    if (!dirty) return undefined;
    const leave = twoPressLeaveGuard({
      onAsk: () => setLeaveAsked(true),
      onClear: () => setLeaveAsked(false)
    });
    const release = setPanelLeaveGuard(leave);
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      release();
      leave.clear();
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty]);

  /* Tagasi Teekondade loendisse lehe sees (uue vahekaardi vajutus jääb
     brauserile). Teistele lehtedele viivad lingid on tavalised lingid: need lehed
     loevad oma aadressi esimesel joonistusel. */
  const openInApp = useCallback((event, href) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    pushWithTransition(router, href);
  }, [router]);

  const frame = (children) => (
    <section className={styles.page}>
      {/* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale. */}
      <h1 className="sr-only">{journey?.title || t("journey.title", "Teekond")}</h1>
      {children}
    </section>
  );
  const listHref = localizePath("/teekond", locale);
  const backToList = (
    <Button as="a" href={listHref} size="sm" variant="secondary" onClick={(event) => openInApp(event, listHref)}>
      {t("journey.desk.all_journeys")}
    </Button>
  );

  if (status === "loading") {
    return frame(
      <StepPanel title={t("journey.title", "Teekond")}>
        <p className={shared.quiet} aria-live="polite">
          {t("journey.messages.loading", "Laen teekonda...")}
        </p>
      </StepPanel>
    );
  }

  if (status !== "authenticated") {
    /* Pärast sisselogimist tuleb inimene sama Teekonna juurde tagasi. */
    return frame(
      <StepPanel
        title={t("journey.title", "Teekond")}
        lead={t("journey.messages.auth_required", "The journey is private. Log in to continue.")}
        actions={
          <Button as="a" href={loginHref(`/teekond/${encodeURIComponent(journeyId)}`)} size="sm" variant="primary">
            {t("journey.actions.login", "Log in")}
          </Button>
        }
      />
    );
  }

  if (notFound) {
    return frame(
      <StepPanel title={t("journey.messages.not_found_title", "Teekonda ei leitud")} question={t("journey.messages.not_found_title", "Teekonda ei leitud")} lead={t("journey.messages.not_found", "This journey is not available or does not belong to your account.")} actions={backToList} />
    );
  }

  if (!journey) {
    return frame(
      loadFault ? (
        <div className={shared.fault}>
          <p className={shared.faultText} role="alert">
            {loadFault}
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={loadFirst}>
            {t("journey.board.retry")}
          </Button>
        </div>
      ) : (
        <StepPanel title={t("journey.title", "Teekond")}>
          <p className={shared.quiet} aria-live="polite">
            {t("journey.messages.loading", "Laen teekonda...")}
          </p>
        </StepPanel>
      )
    );
  }

  const today = todayInEstonia(new Date());
  const levelWord = (level) => t(`journey.assessment.levels.${level}`);
  const tiles = deskTiles(journey, { t, today, helpKinds: kinds, levelWord }).map((tile) => ({
    ...tile,
    summary: tile.attention ? <span className={styles.tileNews}>{tile.summaryText}</span> : tile.summaryText
  }));
  const indexOfPart = (key) => DESK_PARTS.indexOf(key);
  const faultOf = (part) => (fault?.part === part ? fault.text : "");
  const hasMunicipality = hasMunicipalitySignal(journey, serviceMapHandoff);
  const links = {
    serviceMap: serviceMapHref,
    documents: documentsHref,
    preInquiry: preInquiryHref,
    helpOffers: helpOffersHref,
    helpRequests: helpRequestsHref,
    createHelpOffer: createHelpOfferHref
  };
  const blockKey = shareBlockKey(preInquiryShareKeys, thirdPartyAcknowledged);
  const reviewedPreInquiryHref = reviewedShareHref(preInquiryHref, preInquiryShareKeys);
  const stateKey = journeyStateKey(journey);
  const closure = journey.closure?.current || null;

  return frame(
    <>
      {/* `aria-live`, mitte status-roll: ühine paneelikiht joonistab iga
          status-rolliga elemendi omal moel. Ala on alati olemas, et
          ekraanilugeja kuuleks, kui teade sinna ilmub. */}
      <div className={shared.live} aria-live="polite">
        {leaveAsked ? (
          <p className={shared.notice} role="alert">
            {t("journey.desk.leave_asked")}
          </p>
        ) : notice ? (
          <p className={shared.notice} tabIndex={-1} ref={noticeRef}>
            {notice}
          </p>
        ) : null}
      </div>
      <StepFlight
        label={t("journey.title", "Teekond")}
        steps={tiles}
        startWide
        parts
        activeKey={partKey}
        onStepChange={(_index, step) => setPartKey(step?.key || null)}
        texts={{
          all: t("journey.desk.all"),
          position: (current, total, label) => t("journey.desk.position", { current, total, label })
        }}
        wideLead={
          <div className={styles.lead}>
            <div className={styles.leadMain}>
              <p className={styles.leadTitle}>{journey.title}</p>
              <p className={styles.leadMeta}>
                <Chip tone={archived ? "wait" : undefined}>{t(stateKey)}</Chip>
                <span className={shared.time}>{t("journey.labels.updated_at", { date: dayOf(journey.updatedAt) })}</span>
                <span className={shared.small}>{archived && closure?.resumeDue ? t("journey.closure.resume_due") : t("journey.desk.private")}</span>
              </p>
            </div>
            {backToList}
          </div>
        }
      >
        {(part, _index, flight) => {
          const desk = { glow: flight?.isActive !== false, setDirty: dirtySetters[part.key] };
          const goShare = () => flight.goTo(indexOfPart("share"));
          switch (part.key) {
            case "situation":
              return <SituationPart t={t} journey={journey} archived={archived} lifeDomains={journeyLifeDomains(journey)} busy={busy === "save"} error={faultOf("situation")} onSave={handleSave} desk={desk} />;
            case "wish":
              return <WishPart t={t} journey={journey} archived={archived} busy={busy === "wish"} error={faultOf("wish")} onSave={handleSaveWish} desk={desk} />;
            case "steps":
              return <JourneySteps journey={journey} t={t} desk={desk} onStepsChange={(steps) => setJourney((current) => (current ? { ...current, steps } : current))} />;
            case "feeling":
              return <JourneyAssessment journey={journey} t={t} desk={desk} onAssessmentsChange={(assessments) => setJourney((current) => (current ? { ...current, assessments } : current))} />;
            case "sent":
              return (
                <SentPart
                  t={t}
                  journey={journey}
                  hrefOf={(item) => localizePath(`/eelpoordumised?openInquiry=${encodeURIComponent(item.id)}&workspaceRole=CLIENT`, locale)}
                  more={journey.linkedPreInquiriesPage?.hasMore ? { busy: busy === "more", onMore: handleLoadMorePreInquiries } : null}
                  error={faultOf("sent")}
                  related={relatedCounts(journey).map((group) => ({ key: group.key, label: t(group.labelKey), value: String(group.count) }))}
                  onShare={goShare}
                />
              );
            case "share":
              return (
                <SharePart
                  t={t}
                  share={{
                    options: preInquiryOptions.map((option) => ({ value: option.value, label: t(option.labelKey) })),
                    selected: preInquiryShareKeys,
                    onToggle: (key) => setPreInquiryShareKeys((current) => toggleKey(current, key)),
                    previewText: preInquiryPreview?.situation || preInquiryPreview?.topic || ""
                  }}
                  ack={{ needed: preInquiryShareKeys.includes("personContext"), checked: thirdPartyAcknowledged, onChange: setThirdPartyAcknowledged }}
                  blockKey={blockKey}
                  href={reviewedPreInquiryHref}
                  desk={desk}
                />
              );
            case "help":
              return (
                <HelpPart
                  t={t}
                  kinds={kinds}
                  initial={target?.part === "help" ? target.view : ""}
                  map={{ hasFilter: Boolean(serviceMapHandoff?.hasFilter), hasMunicipality }}
                  mediation={{
                    loading: helpOfferMatchLoading,
                    hasMatches: hasHelpOfferMatches,
                    noRegion: !helpMediationHandoff?.municipalityName,
                    serviceHint: Boolean(helpMediationHandoff?.taxonomy?.relatedServiceCategories?.length)
                  }}
                  devices={{ items: assistiveDevicesHandoff?.devices || [] }}
                  health={{
                    draftOpen: healthDraftOpen,
                    draft: healthQuestionsDraft,
                    copied: healthCopied,
                    onCreate: handleCreateHealthQuestions,
                    onChange: (value) => {
                      setHealthQuestionsDraft(value);
                      setHealthCopied(false);
                    },
                    onCopy: handleCopyHealthQuestions
                  }}
                  requestShare={{
                    options: helpRequestOptions.map((option) => ({ value: option.value, label: t(option.labelKey) })),
                    selected: helpRequestSelected,
                    onToggle: (key) => setHelpRequestShareKeys(toggleKey(helpRequestSelected, key)),
                    previewText: helpRequestPreviewText,
                    href: reviewedShareHref(createHelpRequestHref, helpRequestSelected),
                    onView: setHelpRequestViewOpen
                  }}
                  links={links}
                  error={faultOf("help")}
                  onShare={goShare}
                  desk={desk}
                />
              );
            case "continuity":
              return (
                <ContinuityPart
                  t={t}
                  journey={journey}
                  archived={archived}
                  busy={busy === "continuity"}
                  error={faultOf("continuity")}
                  rules={{ missing: (form) => buildContinuityMissingInfo(form, t), actions: (form) => buildContinuityActions(form, t) }}
                  onSave={handleSaveContinuity}
                  links={links}
                  desk={desk}
                />
              );
            case "road":
              return <RoadPart t={t} journey={journey} stateWord={(state) => t(ROAD_STATE_KEYS[state] || ROAD_STATE_KEYS.todo)} />;
            case "closure":
              return <JourneyClosure journey={journey} busy={Boolean(busy)} onClosed={handleClosed} onReopen={handleReopen} t={t} desk={desk} />;
            default:
              return <DataPart t={t} locale={locale} journey={journey} busy={busy} error={faultOf("data")} onExport={handleExport} onDelete={handleDelete} />;
          }
        }}
      </StepFlight>
    </>
  );
}
