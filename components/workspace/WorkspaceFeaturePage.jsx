"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ChatComposer from "@/components/alalehed/chat/ChatComposer";
import ChatMessageItem from "@/components/alalehed/chat/ChatMessageItem";
import ConversationView from "@/components/alalehed/chat/ConversationView";
import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import DocumentsDropdown from "@/components/documents/DocumentsDropdown";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { DashboardInfoTrigger } from "@/components/ui/DashboardInfoOverlay";
import Checkbox from "@/components/ui/Checkbox";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import OptionCard from "@/components/ui/OptionCard";
import { localizePath } from "@/lib/localizePath";
import { preInquiryAvailabilityNotices, serviceAvailabilityPresentation } from "@/lib/serviceAvailabilityUi";
import { normalizePreInquiryJourneySharedInfo } from "@/lib/preInquiryJourneySharedInfo";
import { normalizePreInquiryReceiverChecklist } from "@/lib/preInquiryReceiverWorkflow";
import {
  PRE_INQUIRY_ASSESSMENT_PATHS,
  PRE_INQUIRY_CONSENT_OPTIONS,
  PRE_INQUIRY_DOMAIN_DEFINITIONS,
  PRE_INQUIRY_SCREEN_OPTIONS,
  PRE_INQUIRY_SUBJECT_OPTIONS,
  PRE_INQUIRY_URGENCY_OPTIONS,
  buildPreInquiryAssessmentAssistContext,
  buildPreInquiryAssessmentDraftSummary,
  buildPreInquiryAssessmentExportText,
  buildPreInquiryAssessmentReview,
  buildPreInquiryAssessmentSituation,
  buildPreInquiryDownloadContent,
  createEmptyPreInquiryAssessmentState,
  getPreInquiryQuestionFollowUpQuestions,
  normalizePreInquiryAssessmentState
} from "@/lib/preInquiriesQuestionnaire";
import { buildRoomChatPath } from "@/lib/roomPath";
import { pushWithTransition } from "@/lib/routeTransition";
import AdminRoleViewCycleButton from "./AdminRoleViewCycleButton";
import ServiceMapLeaflet from "./ServiceMapLeaflet";

const CHAT_WORKSPACE_RESTORE_STORAGE_KEY = "__SOTSIAALAI_CHAT_WORKSPACE_RESTORE__";
const SERVICE_MAP_ENTRIES_FETCH_LIMIT = 2000;
const SERVICE_MAP_RESULT_BUTTON_LIMIT = 56;

// Kujundus stripitud (Fable 5 teeb visuaali). Allesjäänud klassikonstandid on
// tühjendatud; kasutuskohad jäävad alles, et struktuur ja loogika säiliksid.
const bodyTextClassName = "";
const receivingCheckboxLabelClassName = "";
const serviceMapChoiceCardClassName = "";

const ADMIN_WORKSPACE_ROLES = Object.freeze([
  "CLIENT",
  "SOCIAL_WORKER",
  "SERVICE_PROVIDER"
]);

const PRE_INQUIRY_WORKFLOW_STEPS = Object.freeze([
  { id: "collect", label: "Täpsusta eelinfot" },
  { id: "review", label: "Eelinfo ülevaade" },
  { id: "recipient", label: "Adressaat" },
  { id: "preview", label: "Pöördumise eelvaade" },
  { id: "saved", label: "Minu eelpöördumised" }
]);

const PRE_INQUIRY_START_OPTIONS = Object.freeze([
  {
    id: "find_recipient",
    title: "Aita mul leida, kelle poole pöörduda",
    description: "Kirjelda olukorda. SotsiaalAI küsib vajadusel täpsustusi ja aitab leida sobiva KOV kontakti, lastekaitse kontakti või teenuseosutaja."
  },
  {
    id: "known_contact",
    title: "Mul on kontakt juba olemas",
    description: "Vali kontakt Teenusekaardilt või otsi adressaati nime, KOV-i, teenuse või piirkonna järgi."
  },
  {
    id: "journey",
    title: "Jätkan Teekonnast",
    description: "Kasuta oma privaatses Teekonnas salvestatud infot ja vali, mida soovid eelpöördumises jagada."
  }
]);

function readText(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

function normalizeWorkspaceRole(role) {
  const normalized = String(role || "").trim().toUpperCase();
  return ADMIN_WORKSPACE_ROLES.includes(normalized) ? normalized : "SOCIAL_WORKER";
}

function readRequestedWorkspaceRole() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search || "");
  const value = params.get("workspaceRole");
  return value ? normalizeWorkspaceRole(value) : "";
}

function roleLabel(t, role) {
  if (role === "CLIENT") {
    return readText(t, "workspace_feature_pages.roles.client", "Pöörduja");
  }
  if (role === "SERVICE_PROVIDER") {
    return readText(t, "workspace_feature_pages.roles.service_provider", "Teenuseosutaja");
  }
  return readText(t, "workspace_feature_pages.roles.social_worker", "Sotsiaaltöötaja");
}

function workspaceReturn(locale, router, options = {}) {
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(
        CHAT_WORKSPACE_RESTORE_STORAGE_KEY,
        JSON.stringify({ ts: Date.now() })
      );
    } catch {}
  }
  pushWithTransition(router, localizePath("/vestlus", locale), {
    ...options
  });
}

function clearServiceMapPageState() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("service-map-page-active");
  document.body?.classList.remove("service-map-page-active");
}

function getWorkspaceFeatureInfoId(featureKey, activeRole) {
  if (featureKey === "service_map") return "service_map";
  if (featureKey === "service_profile") return "service_profile";
  if (featureKey === "pre_inquiries") {
    return activeRole === "CLIENT" ? "pre_inquiry" : "intake";
  }
  return "workspace";
}

function SectionCard({ title, children, className }) {
  return (
    <section className={className}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function ServiceProfileSection({ title, children, className }) {
  return (
    <section className={className}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Label({ children, className }) {
  return (
    <label className={cn(className)}>
      {children}
    </label>
  );
}

function PreInquiryAssessmentReviewSection({ t, title, review, situation = "", note = "" }) {
  if (!review) return null;
  const situationText = String(situation || "").trim();
  const concernQuestions = [...review.concernQuestions, ...review.unknownQuestions];

  return (
    <SectionCard title={title}>
      {note ? <p className={bodyTextClassName}>{note}</p> : null}

      <div>
        <div>
          <p>
            {readText(t, "workspace_feature_pages.pre_inquiries.assessment.review_path", "Valitud rada")}
          </p>
          <p>{review.pathTitle}</p>
        </div>
        <div>
          <p>
            {readText(t, "workspace_feature_pages.pre_inquiries.assessment.review_progress", "Põhiküsimuste ülevaade")}
          </p>
          {review.progress.totalPrimaryCount ? (
            <p>
              {`${review.progress.answeredPrimaryCount} / ${review.progress.totalPrimaryCount} ${readText(t, "workspace_feature_pages.pre_inquiries.assessment.review_answered", "vastatud")}`}
            </p>
          ) : (
            <p>
              {readText(t, "workspace_feature_pages.pre_inquiries.assessment.review_without_questionnaire", "Selles rajas jääb eelinfo olukorra kirjelduse ja valitud taustandmete juurde.")}
            </p>
          )}
        </div>
      </div>

      {review.subjectLines.length ? (
        <dl>
          {review.subjectLines.map((line) => (
            <div key={line.label}>
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {review.riskMessage ? (
        <p>
          {review.riskMessage}
        </p>
      ) : null}

      {situationText ? (
        <div>
          <h3>
            {readText(t, "workspace_feature_pages.pre_inquiries.assessment.review_situation", "Olukorra kirjeldus")}
          </h3>
          <p>{situationText}</p>
        </div>
      ) : null}

      {concernQuestions.length ? (
        <div>
          <h3>
            {readText(t, "workspace_feature_pages.pre_inquiries.assessment.review_concerns", "Mured ja täpsustamist vajavad küsimused")}
          </h3>
          {concernQuestions.map((question) => (
            <article key={question.id}>
              <div>
                <p>
                  {`${question.domainTitle} / ${question.title}`}
                </p>
                <span>
                  {question.answerLabel}
                </span>
              </div>
              <p>{question.question}</p>
              {question.followUpAnswers.length ? (
                <div>
                  {question.followUpAnswers.map((answer) => (
                    <div key={`${question.id}-${answer.question}`}>
                      <p>{answer.question}</p>
                      <p>{answer.answer}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {review.strengthQuestions.length ? (
        <div>
          <h3>
            {readText(t, "workspace_feature_pages.pre_inquiries.assessment.review_strengths", "Toimivad vastused ja tugevused")}
          </h3>
          <div>
            {review.strengthQuestions.map((question) => (
              <article key={question.id}>
                <div>
                  <p>
                    {`${question.domainTitle} / ${question.title}`}
                  </p>
                  <span>
                    {question.answerLabel}
                  </span>
                </div>
                <p>{question.question}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {review.progress.unansweredPrimaryCount ? (
        <details>
          <summary>
            {`${readText(t, "workspace_feature_pages.pre_inquiries.assessment.review_unanswered", "Vastamata põhiküsimused")} (${review.progress.unansweredPrimaryCount})`}
          </summary>
          <div>
            {review.unansweredQuestions.map((question) => (
              <p key={question.id}>
                {`${question.domainTitle} / ${question.title}`}
              </p>
            ))}
          </div>
        </details>
      ) : null}

      {review.supportLines.length || review.possibleDirections.length ? (
        <div>
          {review.supportLines.length ? (
            <dl>
              {review.supportLines.map((line) => (
                <div key={line.label}>
                  <dt>{line.label}</dt>
                  <dd>{line.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {review.possibleDirections.length ? (
            <div>
              <p>
                {readText(t, "workspace_feature_pages.pre_inquiries.assessment.review_directions", "Võimalikud teenuse- või kontaktisuunad")}
              </p>
              <p>{review.possibleDirections.join(", ")}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}

function AdminRoleSelector({ t, locale = "et", value, onChange, className }) {
  const handleRoleChanged = (user = {}) => {
    onChange(normalizeWorkspaceRole(user?.effectiveRole || user?.adminViewRole));
  };

  return (
    <div className={className}>
      <AdminRoleViewCycleButton
        t={t}
        locale={locale}
        value={value}
        onRoleChanged={handleRoleChanged}
        ariaLabel={readText(t, "workspace_feature_pages.admin_role.label", "Admini tööroll")}
      />
    </div>
  );
}

function ServiceMapPanelToggleIcon({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={open ? "M5 15L12 8L19 15" : "M5 9L12 16L19 9"}
        stroke="var(--service-map-toggle-arrow-color, var(--back-arrow-color, #c57171))"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}

function formatDate(value, locale = "et") {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function buildLocalPreInquiryDraft({ topic, situation, recipient, assessmentDraftSummary = "" }) {
  const subject = topic?.trim() || "Eelpöördumine";
  const greeting = recipient?.title
    ? `Lugupeetud ${recipient.title}`
    : "Tere";
  const details = [
    situation?.trim() || "",
    assessmentDraftSummary?.trim() || ""
  ].filter(Boolean).join("\n\n");
  const lines = [
    greeting,
    "",
    `Soovin pöörduda teemal: ${subject}.`,
    "",
    "Olukorra kirjeldus ja eelkaardistus:",
    details,
    "",
    recipient?.type === "SERVICE_PROVIDER"
      ? "Palun andke teada, kas teie teenus võiks sellises olukorras sobida ning millised on tingimused, vabad ajad ja vajadusel suunamise või otsuse nõuded."
      : "Palun aidata välja selgitada, millised toetused või teenused võiksid minu olukorras sobida ning millised oleksid järgmised sammud.",
    "",
    "Lugupidamisega"
  ].filter((line, index, source) => line || source[index - 1] !== "");
  return lines.join("\n");
}

function getPreInquiryChannelLabel(t, channel) {
  if (channel === "EXTERNAL_EMAIL") {
    return readText(t, "workspace_feature_pages.pre_inquiries.delivery.external_email", "E-post");
  }
  return readText(t, "workspace_feature_pages.pre_inquiries.delivery.internal", "SotsiaalAI sisene");
}

function getPreInquiryRecipientTypeLabel(t, entry) {
  if (entry?.type === "SERVICE_PROVIDER") {
    return readText(t, "workspace_feature_pages.pre_inquiries.recipient.provider", "Teenuseosutaja");
  }
  if (entry?.type === "KOV_GENERAL_CONTACT") {
    return readText(t, "workspace_feature_pages.pre_inquiries.recipient.kov_general", "KOV üldkontakt");
  }
  return readText(t, "workspace_feature_pages.pre_inquiries.recipient.kov", "KOV kontakt");
}

function getPreInquiryRecipientSubtitle(entry) {
  if (!entry) return "";
  if (entry.type === "SERVICE_PROVIDER") {
    return entry.description || entry.providerProfile?.shortDescription || entry.providerServices?.join(", ") || "";
  }
  return entry.description || entry.address || "Sotsiaalvaldkonna kontakt";
}

function getPreInquiryRecipientRegion(entry) {
  return [
    entry?.municipalityName,
    entry?.county,
    entry?.providerProfile?.serviceArea,
    entry?.address
  ].filter(Boolean).join(" · ");
}

function getPreInquiryRecipientReason(entry, fallback = "") {
  if (entry?.routingReason) return entry.routingReason;
  if (entry?.type === "SERVICE_PROVIDER") {
    const services = entry.providerProfile?.services || entry.providerProfile?.serviceItems?.map((item) => item.name).filter(Boolean) || [];
    if (services.length) {
      return `Võib sobida, sest profiilis on seotud teenused: ${services.slice(0, 3).join(", ")}.`;
    }
    return "Võib sobida teenuseosutajana, kui kirjeldatud olukord kattub teenuse vastuvõtutingimustega.";
  }
  if (entry?.type === "KOV_GENERAL_CONTACT") {
    return "Võib sobida KOV üldkontaktina, kui vajad abi õige sotsiaalvaldkonna või lastekaitse kontakti leidmisel.";
  }
  return fallback || "Võib sobida piirkonna sotsiaalvaldkonna esmase kontaktina.";
}

function getPreInquiryReferralNotice(entry) {
  const serviceItems = entry?.providerProfile?.serviceItems || [];
  const requiresReferral = serviceItems.some((item) => (
    item?.requiresKovAssessment ||
    item?.requiresKovDecision ||
    item?.requiresSkaReferral ||
    item?.requiresSpecialistReferral
  ));
  if (!requiresReferral) return "";
  return "Selle teenuse saamine võib vajada KOV-i otsust, SKA suunamist või spetsialisti hinnangut.";
}

function getPreInquiryStatusLabel(status) {
  switch (status) {
    case "READY":
      return "valmis ülevaatamiseks";
    case "SENT":
      return "saadetud";
    case "DOWNLOADED":
      return "alla laaditud";
    case "ARCHIVED":
      return "arhiveeritud";
    case "DRAFT":
    default:
      return "koostamisel";
  }
}

function buildPreInquiryDownloadName(topic) {
  const slug = String(topic || "eelpoordumine")
    .toLocaleLowerCase("et")
    .replace(/[^a-z0-9õäöüšž]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  return `${slug || "eelpoordumine"}.txt`;
}

function downloadTextFile(content, filename) {
  if (!String(content || "").trim() || typeof window === "undefined") return false;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  return true;
}

function buildPreInquiryReplyMailto(inquiry) {
  const email = String(inquiry?.author?.email || "").trim();
  if (!email) return "";
  const subject = inquiry?.topic
    ? `Vastus eelpöördumisele: ${inquiry.topic}`
    : "Vastus eelpöördumisele";
  const body = [
    "Tere",
    "",
    "Kirjutan seoses teie eelpöördumisega.",
    "",
    inquiry?.situation ? `Teie kirjeldus:\n${inquiry.situation}` : "",
    "",
    "Lugupidamisega"
  ].filter(Boolean).join("\n");
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildPreInquiryRecipientMailto({ recipient, topic, draft, situation }) {
  const email = String(recipient?.email || "").trim();
  if (!email) return "";
  const subject = String(topic || "Pöördumine").trim();
  const body = String(draft || buildLocalPreInquiryDraft({ topic, situation, recipient }) || "").trim();
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function isKovServiceMapEntry(entry) {
  return entry?.type === "KOV_SOCIAL_CONTACT" || entry?.type === "KOV_GENERAL_CONTACT";
}

function serviceMapEntryMatchesType(entry, entryType) {
  if (!entryType || entryType === "ALL") return true;
  if (entryType === "SERVICES_CONTACTS") return entry?.type !== "HELP_REQUEST" && entry?.type !== "HELP_OFFER";
  if (entryType === "HELP_LISTINGS") return entry?.type === "HELP_REQUEST" || entry?.type === "HELP_OFFER";
  if (entryType === "HELP_REQUEST" || entryType === "HELP_OFFER") return entry?.type === entryType;
  if (entryType === "KOV_SOCIAL_CONTACT" || entryType === "KOV_CONTACT") return isKovServiceMapEntry(entry);
  return entry?.type === entryType;
}

function getInquiryJourneySharedInfo(inquiry) {
  return normalizePreInquiryJourneySharedInfo(inquiry?.assessmentState?.sharedJourneyInfo);
}

function filterJourneySharedInfoForPreInquiry(sharedInfo, selections = []) {
  const normalized = normalizePreInquiryJourneySharedInfo(sharedInfo);
  if (!normalized) return null;
  const selected = new Set(selections);
  const next = {
    ...normalized,
    summary: selected.has("summary") ? normalized.summary : "",
    domains: selected.has("domains") ? normalized.domains : [],
    missingInfo: selected.has("missingInfo") ? normalized.missingInfo : [],
    suggestedActions: selected.has("personWish") ? normalized.suggestedActions : [],
    primaryPath: selected.has("domains") ? normalized.primaryPath : "",
    contextNote: selected.has("document") ? normalized.contextNote : "",
    userConfirmed: true
  };
  return normalizePreInquiryJourneySharedInfo(next);
}

function isProviderInquiry(inquiry) {
  return inquiry?.recipientType === "SERVICE_PROVIDER" || inquiry?.recipientEntry?.type === "SERVICE_PROVIDER";
}

function JourneySharedInfoBlock({ info, t, audience = "client", serviceLabel = "" }) {
  const sharedInfo = normalizePreInquiryJourneySharedInfo(info);
  if (!sharedInfo) return null;

  const list = (items) => (Array.isArray(items) ? items.filter(Boolean) : []);
  const domains = list(sharedInfo.domains);
  const missingInfo = list(sharedInfo.missingInfo);
  const suggestedActions = list(sharedInfo.suggestedActions);
  const isProviderAudience = audience === "provider" || audience === "providerClient";
  const titleKey = isProviderAudience ? "journey.providerContext.title" : "journey.sharedInfo.title";
  const titleFallback = isProviderAudience ? "Teenusega seotud eelinfo" : "Teekonnast tulnud eelinfo";
  const privacyKey =
    audience === "provider"
      ? "journey.providerContext.privacyNote"
      : audience === "providerClient"
        ? "journey.providerContext.clientPrivacyNote"
        : audience === "receiver"
          ? "journey.sharedInfo.receiverPrivacyNote"
          : "journey.sharedInfo.clientPrivacyNote";
  const privacyFallback =
    audience === "provider"
      ? "Näed ainult selle teenusega seotud kinnitatud eelinfot. Privaatset Teekonda ja assistendivestlust ei jagata automaatselt."
      : audience === "providerClient"
        ? "Teenuseosutaja näeb ainult seda infot, mille kinnitad ja saadad konkreetse teenuse kohta. Sinu privaatset Teekonda ega assistendivestlust ei jagata automaatselt."
        : audience === "receiver"
          ? "Näed ainult kasutaja kinnitatud eelpöördumise infot. Privaatset Teekonda ja assistendivestlust ei jagata automaatselt."
          : "Spetsialist näeb ainult seda infot, mille kinnitasid eelpöördumise saatmisel. Privaatset Teekonda ei jagata automaatselt.";

  return (
    <div>
      <div>
        <p>
          {readText(t, titleKey, titleFallback)}
        </p>
        <p>
          {readText(t, privacyKey, privacyFallback)}
        </p>
      </div>
      {sharedInfo.summary ? (
        <div>
          <p>
            {readText(t, isProviderAudience ? "journey.providerContext.summary" : "journey.sharedInfo.summary", isProviderAudience ? "Olukorra teenusega seotud lühikokkuvõte" : "Olukorra kokkuvõte")}
          </p>
          <p>{sharedInfo.summary}</p>
        </div>
      ) : null}
      {isProviderAudience && serviceLabel ? (
        <div>
          <p>
            {readText(t, "journey.providerContext.serviceQuestion", "Seotud teenus või profiil")}
          </p>
          <p>{serviceLabel}</p>
        </div>
      ) : null}
      {sharedInfo.primaryPath ? (
        <div>
          <p>{readText(t, "journey.sharedInfo.primaryPath", "Võimalik valitud suund")}</p>
          <p>
            {readText(t, `journey.primary_paths.${sharedInfo.primaryPath}`, sharedInfo.primaryPath)}
          </p>
        </div>
      ) : null}
      {domains.length ? (
        <div>
          <p>{readText(t, "journey.sharedInfo.domains", "Seotud teemad")}</p>
          <div>
            {domains.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      ) : null}
      {missingInfo.length ? (
        <div>
          <p>
            {readText(t, isProviderAudience ? "journey.providerContext.missingInfo" : "journey.sharedInfo.missingInfo", isProviderAudience ? "Teenuse täpsustamiseks võib olla vaja" : "Võimalikud täpsustamist vajavad andmed")}
          </p>
          <ul>
            {missingInfo.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
      {suggestedActions.length ? (
        <div>
          <p>
            {readText(t, isProviderAudience ? "journey.providerContext.nextStep" : "journey.sharedInfo.nextStep", "Kasutaja soovitud järgmine samm")}
          </p>
          <ul>
            {suggestedActions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
      {sharedInfo.contextNote ? (
        <div>
          <p>{readText(t, "journey.sharedInfo.contextNote", "Eelpöördumise koostamisel kasutatud lühikontekst")}</p>
          <p>{sharedInfo.contextNote}</p>
        </div>
      ) : null}
    </div>
  );
}

function PreInquiriesSurface({ t, locale = "et", activeRole = "SOCIAL_WORKER", isAdmin = false, currentUserId = "", embedded = false }) {
  const router = useRouter();
  const chatWindowRef = useRef(null);
  const inputBarRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const composerDraftApiRef = useRef(null);
  const [activeInquiryId, setActiveInquiryId] = useState("");
  const [journeySourceId, setJourneySourceId] = useState("");
  const [topic, setTopic] = useState("");
  const [situation, setSituation] = useState("");
  const [recipientType, setRecipientType] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [entries, setEntries] = useState([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [draft, setDraft] = useState("");
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantMessage, setAssistantMessage] = useState("");
  const [assistantReasoning, setAssistantReasoning] = useState("");
  const [assistantWarnings, setAssistantWarnings] = useState([]);
  const [assistantRoutingConfidence, setAssistantRoutingConfidence] = useState(null);
  const [assessmentLifeDomains, setAssessmentLifeDomains] = useState([]);
  const [assessmentTargetGroups, setAssessmentTargetGroups] = useState([]);
  const [assessmentQuestions, setAssessmentQuestions] = useState([]);
  const [assessmentState, setAssessmentState] = useState(() => createEmptyPreInquiryAssessmentState());
  const [assistantSuggestions, setAssistantSuggestions] = useState([]);
  const [showMoreContacts, setShowMoreContacts] = useState(false);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assisting, setAssisting] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [acceptingInquiryId, setAcceptingInquiryId] = useState("");
  const [openingRoomInquiryId, setOpeningRoomInquiryId] = useState("");
  const [savingReceiverWorkflowId, setSavingReceiverWorkflowId] = useState("");
  const [receiverNoteDraft, setReceiverNoteDraft] = useState("");
  const [receiverChecklistDraft, setReceiverChecklistDraft] = useState([]);
  const [acceptsPreInquiries, setAcceptsPreInquiries] = useState(false);
  const [draftTouched, setDraftTouched] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savePrivacyPrompt, setSavePrivacyPrompt] = useState(null);
  const [workflowMode, setWorkflowMode] = useState("");
  const [activeWorkflowStep, setActiveWorkflowStep] = useState("collect");
  const [assessmentPathChosen, setAssessmentPathChosen] = useState(false);
  const [journeyShareSelections, setJourneyShareSelections] = useState(["summary", "domains", "personWish", "missingInfo"]);
  const journeyPrefillLoadedRef = useRef(false);
  const recipientPrefillLoadedRef = useRef(false);
  const openInquiryLoadedRef = useRef(false);
  const handleOpenInquiryRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [entriesResponse, inquiriesResponse, preferencesResponse] = await Promise.all([
          fetch(`/api/service-map/entries?limit=${SERVICE_MAP_ENTRIES_FETCH_LIMIT}&includeUnlocated=1&includeNeedsReview=1`, { cache: "no-store" }),
          fetch("/api/pre-inquiries", { cache: "no-store" }),
          fetch("/api/pre-inquiries/preferences", { cache: "no-store" })
        ]);
        const entriesPayload = await entriesResponse.json().catch(() => ({}));
        const inquiriesPayload = await inquiriesResponse.json().catch(() => ({}));
        const preferencesPayload = await preferencesResponse.json().catch(() => ({}));
        if (!entriesResponse.ok) {
          // Tõlge ESIMESENA — API message võib olla toores võtmestring
          throw new Error(readText(t, "workspace_feature_pages.service_map.errors.load_failed", entriesPayload?.message || "Recipients could not be loaded."));
        }
        if (!inquiriesResponse.ok) {
          throw new Error(inquiriesPayload?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.load_failed", "Pre-inquiries could not be loaded."));
        }
        if (!preferencesResponse.ok) {
          throw new Error(preferencesPayload?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.preferences_load_failed", "Preferences could not be loaded."));
        }
        if (!cancelled) {
          setEntries(Array.isArray(entriesPayload?.entries) ? entriesPayload.entries : []);
          setInquiries(Array.isArray(inquiriesPayload?.inquiries) ? inquiriesPayload.inquiries : []);
          setAcceptsPreInquiries(Boolean(preferencesPayload?.preferences?.acceptsPreInquiries));
        }
      } catch (loadError) {
        if (!cancelled) {
          setEntries([]);
          setInquiries([]);
          setError(loadError?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.load_failed", "Pre-inquiries could not be loaded."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const recipientEntries = useMemo(() => {
    const query = recipientQuery.trim().toLocaleLowerCase("et");
    return entries.filter((entry) => {
      const isProvider = entry.type === "SERVICE_PROVIDER";
      if (recipientType === "SERVICE_PROVIDER" && !isProvider) return false;
      if (recipientType === "KOV_CONTACT" && isProvider) return false;
      if (!query) return true;
      return [
        entry.title,
        entry.email,
        entry.phone,
        entry.address,
        entry.municipalityName,
        entry.county,
        entry.providerProfile?.organizationName,
        ...(entry.providerProfile?.services || [])
      ].join(" ").toLocaleLowerCase("et").includes(query);
    });
  }, [entries, recipientQuery, recipientType]);

  const selectedRecipient = useMemo(
    () => entries.find((entry) => entry.id === selectedRecipientId) || null,
    [entries, selectedRecipientId]
  );
  const normalizedAssessmentState = useMemo(
    () => normalizePreInquiryAssessmentState(assessmentState),
    [assessmentState]
  );
  const assessmentSituation = useMemo(
    () => buildPreInquiryAssessmentSituation(normalizedAssessmentState),
    [normalizedAssessmentState]
  );
  const assessmentDraftSummary = useMemo(
    () => buildPreInquiryAssessmentDraftSummary(normalizedAssessmentState),
    [normalizedAssessmentState]
  );
  const assessmentAssistContext = useMemo(
    () => buildPreInquiryAssessmentAssistContext(normalizedAssessmentState),
    [normalizedAssessmentState]
  );
  const effectiveAssessmentSituation = assessmentPathChosen ? assessmentSituation : "";
  const effectiveSituation = situation.trim() || effectiveAssessmentSituation;
  const selectedRecipientMailto = useMemo(
    () => buildPreInquiryRecipientMailto({
      recipient: selectedRecipient,
      topic,
      draft,
      situation: effectiveSituation
    }),
    [draft, effectiveSituation, selectedRecipient, topic]
  );
  // THE canonical downloadable text for the editor's current state — same helper
  // the saved-records list and the server-side change check use, so "what was
  // downloaded" and "did it change" can never drift apart (A3 Sol round: point 4).
  const assessmentExportText = useMemo(
    () => buildPreInquiryDownloadContent({
      assessmentState: normalizedAssessmentState,
      topic,
      situation: effectiveSituation,
      userEditedDraft: draft,
      selectedRecipientName: selectedRecipient?.title || ""
    }),
    [draft, effectiveSituation, normalizedAssessmentState, selectedRecipient?.title, topic]
  );
  const assessmentReview = useMemo(
    () => buildPreInquiryAssessmentReview(normalizedAssessmentState, { topic }),
    [normalizedAssessmentState, topic]
  );

  const assistantConversationText = useMemo(() => {
    const lines = [];
    const lead = String(assistantMessage || assistantReasoning || "").trim();
    const tags = [...assessmentLifeDomains, ...assessmentTargetGroups];
    const urgentWarnings = assistantWarnings.filter((warning) => (
      /112|vahetu|kiire|oht|kriisi/i.test(String(warning || ""))
    ));
    const otherWarnings = assistantWarnings.filter((warning) => (
      warning && !urgentWarnings.includes(warning)
    ));

    if (lead) lines.push(lead);
    if (tags.length) {
      lines.push("", `Märksõnad: ${tags.join(", ")}`);
    }
    const questionAuditLines = assessmentQuestions.map((question) => `- ${question}`);
    const nextQuestionLine = questionAuditLines[0] || "";
    if (nextQuestionLine) {
      lines.push(
        "",
        "Vasta järgmistele küsimustele:",
        nextQuestionLine
      );
    }
    if (urgentWarnings.length) {
      lines.push(
        "",
        ...urgentWarnings.map((warning) => `Kiire abi: ${warning}`)
      );
    }
    if (otherWarnings.length) {
      lines.push(
        "",
        ...otherWarnings.map((warning) => `Oluline: ${warning}`)
      );
    }

    return lines.join("\n").trim();
  }, [
    assistantMessage,
    assistantReasoning,
    assistantWarnings,
    assessmentLifeDomains,
    assessmentQuestions,
    assessmentTargetGroups
  ]);

  const recommendedRecipients = useMemo(() => {
    const hasManualSearch = Boolean(recipientQuery.trim());
    const source = assistantSuggestions.length
      ? assistantSuggestions
      : hasManualSearch
        ? recipientEntries
        : [];
    const seen = new Set();
    return source.filter((entry) => {
      if (!entry?.id || seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
  }, [assistantSuggestions, recipientEntries, recipientQuery]);

  const visibleRecommendedRecipients = showMoreContacts
    ? recommendedRecipients.slice(0, 12)
    : recommendedRecipients.slice(0, 3);

  const conversationItems = useMemo(() => {
    const items = [];
    if (situation.trim()) {
      items.push(
        <ChatMessageItem
          key="pre-inquiry-user-situation"
          role="user"
          text={situation}
          t={t}
        />
      );
    }
    if (assistantConversationText.trim()) {
      items.push(
        <ChatMessageItem
          key="pre-inquiry-assistant-message"
          role="ai"
          text={assistantConversationText}
          t={t}
        />
      );
    }
    if (assisting) {
      items.push(
        <ChatMessageItem
          key="pre-inquiry-assisting"
          role="ai"
          text={readText(t, "workspace_feature_pages.pre_inquiries.actions.assisting", "Otsin...")}
          t={t}
        />
      );
    }
    return items;
  }, [assistantConversationText, assisting, situation, t]);

  const receivedInquiries = useMemo(() => {
    if (!currentUserId) return [];
    return inquiries.filter((inquiry) => inquiry.recipientOwnerId === currentUserId);
  }, [currentUserId, inquiries]);

  const authoredInquiries = useMemo(() => {
    if (!currentUserId) return inquiries;
    return inquiries.filter((inquiry) => inquiry.authorId === currentUserId);
  }, [currentUserId, inquiries]);

  const savedInquiries = isAdmin ? inquiries : authoredInquiries;
  const isRecipientRole = activeRole === "SOCIAL_WORKER" || activeRole === "SERVICE_PROVIDER";
  const receiverInquiries = isAdmin && isRecipientRole ? inquiries : receivedInquiries;
  const showReceivedInquiries = isRecipientRole;
  const activeReceivedInquiry = activeInquiryId
    ? receiverInquiries.find((inquiry) => inquiry.id === activeInquiryId) || null
    : receiverInquiries[0] || null;
  const activeReceivedJourneySharedInfo = useMemo(
    () => getInquiryJourneySharedInfo(activeReceivedInquiry),
    [activeReceivedInquiry]
  );
  const activeReceivedJourneySharedInfoAudience =
    activeRole === "SERVICE_PROVIDER" ? "provider" : "receiver";
  const shouldShowActiveReceivedJourneySharedInfo = Boolean(
    activeReceivedJourneySharedInfo &&
    (activeRole !== "SERVICE_PROVIDER" || isProviderInquiry(activeReceivedInquiry))
  );
  const activeDraftJourneySharedInfo = useMemo(
    () => normalizePreInquiryJourneySharedInfo(normalizedAssessmentState.sharedJourneyInfo),
    [normalizedAssessmentState.sharedJourneyInfo]
  );
  const activeDraftJourneySharedInfoAudience =
    recipientType === "SERVICE_PROVIDER" || selectedRecipient?.type === "SERVICE_PROVIDER"
      ? "providerClient"
      : "client";
  const selectedAssessmentPath = PRE_INQUIRY_ASSESSMENT_PATHS.find((path) => path.id === normalizedAssessmentState.path) || PRE_INQUIRY_ASSESSMENT_PATHS[0];
  const preInquiryOverviewRows = useMemo(() => {
    const rows = [
      ["Kelle kohta pöördumine käib", normalizedAssessmentState.subject.concernsAbout],
      ["Kes pöördub", normalizedAssessmentState.subject.consentStatus === "Pöördun enda kohta" ? "Inimene ise" : normalizedAssessmentState.subject.consentStatus],
      ["KOV või piirkond", normalizedAssessmentState.subject.municipalityText || normalizedAssessmentState.routing?.contactSearchInput?.municipalityText],
      ["Kiireloomulisus", normalizedAssessmentState.subject.urgency],
      ["Nõusolek või pöördumise alus", normalizedAssessmentState.subject.consentStatus],
      ["Olukorra kokkuvõte", effectiveSituation],
      ["Olemasolev abi", normalizedAssessmentState.supportContext.existingSupport],
      ["Kas abist piisab", normalizedAssessmentState.supportContext.supportAdequacy],
      ["Inimese enda soov", normalizedAssessmentState.supportContext.personWish],
      ["Seotud teemad", [...assessmentLifeDomains, ...assessmentTargetGroups].filter(Boolean).join(", ")],
      ["Eluvaldkonnad", assessmentReview?.possibleDirections?.join(", ")]
    ];
    return rows.filter(([, value]) => String(value || "").trim());
  }, [
    assessmentLifeDomains,
    assessmentReview?.possibleDirections,
    assessmentTargetGroups,
    effectiveSituation,
    normalizedAssessmentState
  ]);
  const preInquiryMissingInfo = useMemo(() => {
    const missing = [];
    if (!assessmentPathChosen) missing.push("eelkaardistuse viis");
    if (!normalizedAssessmentState.subject.municipalityText?.trim()) missing.push("KOV või piirkond");
    if (!effectiveSituation.trim()) missing.push("lühike olukorra kirjeldus");
    if (!normalizedAssessmentState.subject.concernsAbout?.trim()) missing.push("kelle kohta pöördumine käib");
    if (!normalizedAssessmentState.subject.urgency?.trim()) missing.push("kas olukord on kiire");
    if (!normalizedAssessmentState.subject.consentStatus?.trim()) missing.push("nõusolek või pöördumise alus");
    if (!selectedRecipient) missing.push("adressaat");
    return missing;
  }, [
    assessmentPathChosen,
    effectiveSituation,
    normalizedAssessmentState.subject.concernsAbout,
    normalizedAssessmentState.subject.consentStatus,
    normalizedAssessmentState.subject.municipalityText,
    normalizedAssessmentState.subject.urgency,
    selectedRecipient
  ]);
  const canUseJourneyPrefill = useMemo(() => {
    if (activeDraftJourneySharedInfo) return true;
    if (typeof window === "undefined") return false;
    return Boolean(new URLSearchParams(window.location.search || "").get("fromJourney"));
  }, [activeDraftJourneySharedInfo]);
  const selectedRecipientReferralNotice = getPreInquiryReferralNotice(selectedRecipient);
  const selectedRecipientAvailabilityNotices = useMemo(
    () => preInquiryAvailabilityNotices(selectedRecipient, t),
    [selectedRecipient, t]
  );
  const selectedRecipientSupportsPlatform =
    selectedRecipient?.deliveryChannel === "INTERNAL" ||
    selectedRecipient?.providerProfile?.acceptsPlatformPreInquiries === true;
  const selectedRecipientSupportsEmail =
    Boolean(selectedRecipientMailto) ||
    selectedRecipient?.providerProfile?.acceptsEmailPreInquiries !== false ||
    Boolean(selectedRecipient?.email);
  const activeReceivedInquiryAssessmentReview = useMemo(
    () => activeReceivedInquiry?.assessmentState
      ? buildPreInquiryAssessmentReview(activeReceivedInquiry.assessmentState, {
          topic: activeReceivedInquiry.topic || ""
        })
      : null,
    [activeReceivedInquiry]
  );

  useEffect(() => {
    if (!activeReceivedInquiry) {
      setReceiverNoteDraft("");
      setReceiverChecklistDraft([]);
      return;
    }
    setReceiverNoteDraft(activeReceivedInquiry.receiverNote || "");
    setReceiverChecklistDraft(normalizePreInquiryReceiverChecklist(
      activeReceivedInquiry.receiverChecklist,
      activeReceivedInquiry
    ));
  }, [activeReceivedInquiry]);

  useEffect(() => {
    if (draftTouched) return;
    setDraft(buildLocalPreInquiryDraft({
      topic,
      situation: situation.trim() || (assessmentDraftSummary ? "" : effectiveSituation),
      recipient: selectedRecipient,
      assessmentDraftSummary: assessmentDraftSummary
    }));
  }, [assessmentDraftSummary, draftTouched, effectiveSituation, selectedRecipient, situation, topic]);

  useEffect(() => {
    if (journeyPrefillLoadedRef.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromJourney = String(params.get("fromJourney") || "").trim();
    if (!fromJourney) return;
    const shareKeys = String(params.get("share") || "")
      .split(/[,;\s]+/u)
      .map((item) => item.trim())
      .filter(Boolean);

    journeyPrefillLoadedRef.current = true;
    let cancelled = false;

    async function loadJourneyPrefill() {
      setNotice("");
      setError("");
      try {
        const response = await fetch(`/api/journeys/${encodeURIComponent(fromJourney)}/pre-inquiry-draft`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            shareKeys
          }),
          cache: "no-store"
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.message || readText(t, "workspace_feature_pages.pre_inquiries.journey_prefill.load_failed", "Journey prefill could not be loaded."));
        }
        if (cancelled) return;
        const prefill = payload?.prefill || {};
        const nextAssessmentState = createEmptyPreInquiryAssessmentState();
        nextAssessmentState.subject.municipalityText = String(prefill.municipality || "");
        nextAssessmentState.supportContext.personWish = String(prefill.personContext || "");
        nextAssessmentState.routing.contactSearchInput.municipalityText = String(prefill.municipality || "");
        nextAssessmentState.sharedJourneyInfo = normalizePreInquiryJourneySharedInfo(prefill.sharedJourneyInfo);

        setActiveInquiryId("");
        setJourneySourceId(String(prefill.sourceJourneyId || fromJourney || ""));
        setTopic(String(prefill.topic || ""));
        setSituation(String(prefill.situation || ""));
        setRecipientType(["KOV_CONTACT", "SERVICE_PROVIDER"].includes(prefill.recipientType) ? prefill.recipientType : "");
        setRecipientQuery(String(prefill.municipality || ""));
        setSelectedRecipientId("");
        setDraft(String(prefill.suggestedMessageDraft || ""));
        setAssistantInput("");
        setAssistantMessage("");
        setAssistantReasoning("");
        setAssistantWarnings([]);
        setAssistantRoutingConfidence(null);
        setAssessmentLifeDomains([]);
        setAssessmentTargetGroups([]);
        setAssessmentQuestions([]);
        setAssessmentState(normalizePreInquiryAssessmentState(nextAssessmentState));
        setAssistantSuggestions([]);
        setShowMoreContacts(false);
        setDraftTouched(Boolean(prefill.suggestedMessageDraft));
        setSavePrivacyPrompt(null);
        setWorkflowMode("journey");
        setActiveWorkflowStep("journey");
        setAssessmentPathChosen(false);
        setJourneyShareSelections(["summary", "domains", "personWish", "missingInfo"]);
        setNotice(readText(t, "workspace_feature_pages.pre_inquiries.journey_prefill.loaded", "A pre-inquiry draft was prepared from the journey. Review and edit it before sending."));
      } catch (prefillError) {
        if (!cancelled) {
          setError(prefillError?.message || readText(t, "workspace_feature_pages.pre_inquiries.journey_prefill.load_failed", "Journey prefill could not be loaded."));
        }
      }
    }

    void loadJourneyPrefill();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (recipientPrefillLoadedRef.current || typeof window === "undefined" || !entries.length) return;
    const params = new URLSearchParams(window.location.search || "");
    const requestedRecipientId = [
      "recipientEntryId",
      "serviceMapEntryId",
      "entryId",
      "recipientId",
      "selectedRecipientId"
    ].map((key) => String(params.get(key) || "").trim()).find(Boolean);
    if (!requestedRecipientId) return;

    const entry = entries.find((item) => item.id === requestedRecipientId);
    if (!entry) return;
    recipientPrefillLoadedRef.current = true;
    setSelectedRecipientId(entry.id);
    setRecipientType(entry.type === "SERVICE_PROVIDER" ? "SERVICE_PROVIDER" : "KOV_CONTACT");
    setRecipientQuery(entry.municipalityName || entry.county || entry.title || "");
    setAssessmentState((current) => {
      const normalized = normalizePreInquiryAssessmentState(current);
      return normalizePreInquiryAssessmentState({
        ...normalized,
        subject: {
          ...normalized.subject,
          municipalityText: entry.municipalityName || entry.county || ""
        },
        routing: {
          ...normalized.routing,
          contactSearchInput: {
            ...normalized.routing?.contactSearchInput,
            municipalityText: entry.municipalityName || entry.county || ""
          }
        }
      });
    });
    setWorkflowMode("known_contact");
    setActiveWorkflowStep("collect");
    setAssessmentPathChosen(false);
    setNotice("Valitud adressaat on eelpöördumise töövoogu kaasa võetud. Saad seda enne saatmist muuta.");
  }, [entries]);

  // Deep-link from a journey's "Seotud eelpöördumised" list: open the requested
  // authored inquiry once the list has loaded. handleOpenInquiry is reached via a
  // ref so the effect only depends on `inquiries`.
  handleOpenInquiryRef.current = handleOpenInquiry;
  useEffect(() => {
    if (openInquiryLoadedRef.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    const requestedId = String(params.get("openInquiry") || "").trim();
    if (!requestedId) return;
    const inquiry = inquiries.find((item) => item.id === requestedId);
    if (inquiry) {
      openInquiryLoadedRef.current = true;
      handleOpenInquiryRef.current?.(inquiry);
      return;
    }

    // The visible list is capped, so a valid journey back-link may point to an
    // older authored inquiry that is not in the first page. Load that exact
    // inquiry instead of leaving the "Ava" action as a silent no-op.
    openInquiryLoadedRef.current = true;
    let cancelled = false;
    async function loadRequestedInquiry() {
      const response = await fetch(`/api/pre-inquiries/${encodeURIComponent(requestedId)}`, {
        cache: "no-store"
      }).catch(() => null);
      const payload = await response?.json().catch(() => ({}));
      const requestedInquiry = payload?.inquiry || null;
      if (
        cancelled ||
        !response?.ok ||
        !requestedInquiry ||
        (currentUserId && requestedInquiry.authorId !== currentUserId)
      ) {
        return;
      }
      setInquiries((current) => [
        requestedInquiry,
        ...current.filter((item) => item.id !== requestedInquiry.id)
      ]);
      handleOpenInquiryRef.current?.(requestedInquiry);
    }
    loadRequestedInquiry();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, inquiries]);

  function updateAssessmentState(updater) {
    setAssessmentState((current) => {
      const normalized = normalizePreInquiryAssessmentState(current);
      const next = typeof updater === "function" ? updater(normalized) : updater;
      return normalizePreInquiryAssessmentState(next);
    });
    setDraftTouched(false);
  }

  function handleAssessmentPathChange(pathId) {
    setAssessmentPathChosen(true);
    updateAssessmentState((current) => ({
      ...createEmptyPreInquiryAssessmentState(pathId),
      subject: current.subject,
      supportContext: current.supportContext
    }));
  }

  function updateAssessmentSubject(field, value) {
    if (field === "municipalityText" && !recipientQuery.trim()) {
      setRecipientQuery(value);
    }
    updateAssessmentState((current) => ({
      ...current,
      subject: {
        ...current.subject,
        [field]: value
      }
    }));
  }

  function updateAssessmentSupport(field, value) {
    updateAssessmentState((current) => ({
      ...current,
      supportContext: {
        ...current.supportContext,
        [field]: value
      }
    }));
  }

  function updatePrimaryQuestionAnswer(domainId, questionId, screenAnswer) {
    updateAssessmentState((current) => ({
      ...current,
      domains: current.domains.map((domain) => (
        domain.id === domainId
          ? {
              ...domain,
              primaryAnswers: domain.primaryAnswers.map((primaryAnswer) => (
                primaryAnswer.id === questionId
                  ? {
                      ...primaryAnswer,
                      screenAnswer,
                      followUpAnswers: screenAnswer === "INDEPENDENT" || screenAnswer === "NOT_APPLICABLE"
                        ? {}
                        : primaryAnswer.followUpAnswers
                    }
                  : primaryAnswer
              ))
            }
          : domain
      ))
    }));
  }

  function updatePrimaryQuestionFollowUpAnswer(domainId, questionId, question, answer) {
    updateAssessmentState((current) => ({
      ...current,
      domains: current.domains.map((domain) => (
        domain.id === domainId
          ? {
              ...domain,
              primaryAnswers: domain.primaryAnswers.map((primaryAnswer) => (
                primaryAnswer.id === questionId
                  ? {
                      ...primaryAnswer,
                      followUpAnswers: {
                        ...primaryAnswer.followUpAnswers,
                        [question]: answer
                      }
                    }
                  : primaryAnswer
              ))
            }
          : domain
      ))
    }));
  }

  function handleNewInquiry() {
    setActiveInquiryId("");
    setJourneySourceId("");
    setTopic("");
    setSituation("");
    setRecipientType("");
    setRecipientQuery("");
    setSelectedRecipientId("");
    setDraft("");
    setAssistantInput("");
    setAssistantMessage("");
    setAssistantReasoning("");
    setAssistantWarnings([]);
    setAssistantRoutingConfidence(null);
    setAssessmentLifeDomains([]);
    setAssessmentTargetGroups([]);
    setAssessmentQuestions([]);
    setAssessmentState(createEmptyPreInquiryAssessmentState());
    setAssistantSuggestions([]);
    setShowMoreContacts(false);
    setDraftTouched(false);
    setWorkflowMode("");
    setActiveWorkflowStep("collect");
    setAssessmentPathChosen(false);
    setJourneyShareSelections(["summary", "domains", "personWish", "missingInfo"]);
    setNotice("");
    setError("");
  }

  function handleOpenInquiry(inquiry) {
    setActiveInquiryId(inquiry.id || "");
    setJourneySourceId("");
    setTopic(inquiry.topic || "");
    setSituation(inquiry.situation || "");
    setRecipientType(inquiry.recipientType || "");
    setRecipientQuery("");
    setSelectedRecipientId(inquiry.recipientEntryId || "");
    setDraft(inquiry.userEditedDraft || inquiry.generatedDraft || "");
    setAssistantInput("");
    setAssistantMessage("");
    setAssistantReasoning("");
    setAssistantWarnings([]);
    setAssistantRoutingConfidence(null);
    setAssessmentLifeDomains([]);
    setAssessmentTargetGroups([]);
    setAssessmentQuestions([]);
    setAssessmentState(normalizePreInquiryAssessmentState(inquiry.assessmentState || createEmptyPreInquiryAssessmentState()));
    setAssistantSuggestions([]);
    setShowMoreContacts(false);
    setDraftTouched(true);
    setWorkflowMode("existing");
    setActiveWorkflowStep("preview");
    setAssessmentPathChosen(Boolean(inquiry.assessmentState?.path));
    setJourneyShareSelections(["summary", "domains", "personWish", "missingInfo"]);
    setNotice("");
    setError("");
  }

  async function handleSave(event, options = {}) {
    event?.preventDefault?.();
    const saveSituation = situation.trim() || effectiveAssessmentSituation;
    const nextStatus = options?.status || "DRAFT";
    if (saving || !saveSituation.trim()) return;

    setSaving(true);
    setNotice("");
    setError("");
    setSavePrivacyPrompt(null);

    try {
      const assessmentStateForSave = normalizePreInquiryAssessmentState({
        ...normalizedAssessmentState,
        sharedJourneyInfo: filterJourneySharedInfoForPreInquiry(
          normalizedAssessmentState.sharedJourneyInfo,
          journeyShareSelections
        )
      });
      const response = await fetch(activeInquiryId ? `/api/pre-inquiries/${activeInquiryId}` : "/api/pre-inquiries", {
        method: activeInquiryId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          topic,
          situation: saveSituation,
          assessmentState: assessmentStateForSave,
          recipientType,
          recipientEntryId: selectedRecipient?.id || null,
          selectedRecipientName: selectedRecipient?.title || "",
          selectedRecipientEmail: selectedRecipient?.email || "",
          userEditedDraft: draft,
          status: nextStatus,
          privacyDecision: options?.privacyDecision,
          // Persist the Teekond -> eelpöördumine link only when creating from a
          // journey prefill. On edits (PATCH) the existing link is left intact.
          ...(!activeInquiryId && journeySourceId ? { sourceJourneyId: journeySourceId } : {})
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 409 && payload?.needsPrivacyConfirmation) {
        setSavePrivacyPrompt({
          warning: payload?.warning,
          redactedText: payload?.redactedText || "",
          findings: Array.isArray(payload?.findings) ? payload.findings : [],
          allowOriginal: Boolean(payload?.allowOriginal)
        });
        return;
      }
      if (!response.ok) {
        throw new Error(payload?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.save_failed", "Pre-inquiry could not be saved."));
      }
      const inquiry = payload?.inquiry || null;
      if (inquiry) {
        setInquiries((current) => [inquiry, ...current.filter((item) => item.id !== inquiry.id)]);
        setActiveInquiryId(inquiry.id || "");
        setJourneySourceId("");
        setTopic(inquiry.topic || topic);
        setSituation(inquiry.situation || situation);
        setAssessmentState(normalizePreInquiryAssessmentState(inquiry.assessmentState || normalizedAssessmentState));
        setDraft(inquiry.userEditedDraft || inquiry.generatedDraft || draft);
        setDraftTouched(true);
      }
      setNotice(nextStatus === "SENT"
        ? readText(t, "workspace_feature_pages.pre_inquiries.send_success", "Eelpöördumine saadetud.")
        : readText(t, "workspace_feature_pages.pre_inquiries.save_success", "Pre-inquiry saved."));
    } catch (saveError) {
      const message = saveError?.message === "pre_inquiries.errors.internal_recipient_required"
        ? readText(t, "workspace_feature_pages.pre_inquiries.errors.internal_recipient_required", "Platvormis saatmiseks vali kontakt, kelle konto võtab eelpöördumisi vastu.")
        : saveError?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.save_failed", "Pre-inquiry could not be saved.");
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function handleEditSaveText() {
    setSavePrivacyPrompt(null);
  }

  function handleSaveRedacted() {
    void handleSave(null, {
      privacyDecision: {
        action: "use_redacted"
      }
    });
  }

  function handleSaveOriginal() {
    void handleSave(null, {
      privacyDecision: {
        action: "send_original"
      }
    });
  }

  async function handleCopy() {
    if (!draft.trim() || typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(draft);
    setNotice(readText(t, "workspace_feature_pages.pre_inquiries.copy_success", "Draft copied."));
  }

  // A3: mark a SAVED pre-inquiry DOWNLOADED (author-only, server-enforced). The
  // saved snapshot's updatedAt is sent so the server marks ONLY that exact version
  // (version-safety; a stale snapshot -> 409). Any failure (409 / network) is
  // silent: the file already downloaded and we must never surface a misleading
  // DOWNLOADED state (semantics #10).
  async function markSavedInquiryDownloaded(inquiry) {
    const inquiryId = String(inquiry?.id || "").trim();
    if (!inquiryId) return;
    try {
      const response = await fetch(`/api/pre-inquiries/${encodeURIComponent(inquiryId)}/downloaded`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: inquiry?.updatedAt || null })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.inquiry) {
        setInquiries((current) => current.map((item) => (item.id === payload.inquiry.id ? payload.inquiry : item)));
      }
    } catch {
      // network error — leave the inquiry status as-is.
    }
  }

  async function handleDownload() {
    const content = assessmentExportText;
    // A3 point 10: only proceed once the file has actually downloaded.
    if (!downloadTextFile(content, buildPreInquiryDownloadName(topic))) return;
    setNotice(readText(t, "workspace_feature_pages.pre_inquiries.download_success", "Draft downloaded."));
    // An unsaved draft (no id) stays a plain file download with no global state.
    if (!activeInquiryId) return;
    const saved = inquiries.find((item) => item.id === activeInquiryId) || null;
    if (!saved) return;
    // Mark DOWNLOADED only when the editor matches the saved snapshot EXACTLY.
    // With unsaved edits the downloaded file differs from the stored record, so we
    // must not mark it (A3 Sol round: point 1). The saved snapshot is what the
    // server would version-check against.
    if (content !== buildPreInquiryDownloadContent(saved)) return;
    await markSavedInquiryDownloaded(saved);
  }

  // A3: the saved-records list "Laadi alla" downloads the canonical text of the
  // STORED snapshot (which is, by definition, the saved version) and marks it
  // DOWNLOADED through the same version-safe flow (A3 Sol round: point 1).
  async function handleDownloadSavedInquiry(inquiry) {
    if (!inquiry) return;
    const content = buildPreInquiryDownloadContent(inquiry);
    if (!downloadTextFile(content, buildPreInquiryDownloadName(inquiry.topic))) return;
    setNotice(readText(t, "workspace_feature_pages.pre_inquiries.download_success", "Draft downloaded."));
    await markSavedInquiryDownloaded(inquiry);
  }

  async function handleArchiveAuthoredInquiry(inquiry) {
    const inquiryId = String(inquiry?.id || "").trim();
    if (!inquiryId || saving || inquiry.status === "SENT" || inquiry.status === "ARCHIVED") return;
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`/api/pre-inquiries/${encodeURIComponent(inquiryId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          topic: inquiry.topic || "",
          situation: inquiry.situation || "",
          assessmentState: inquiry.assessmentState || null,
          recipientType: inquiry.recipientType || "",
          recipientEntryId: inquiry.recipientEntryId || null,
          selectedRecipientName: inquiry.selectedRecipientName || "",
          selectedRecipientEmail: inquiry.selectedRecipientEmail || "",
          userEditedDraft: inquiry.userEditedDraft || inquiry.generatedDraft || inquiry.situation || "",
          status: "ARCHIVED"
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.save_failed", "Pre-inquiry could not be saved."));
      }
      if (payload?.inquiry) {
        setInquiries((current) => current.map((item) => item.id === inquiryId ? payload.inquiry : item));
      }
      setNotice(readText(t, "workspace_feature_pages.pre_inquiries.archive_success", "Eelpöördumine arhiveeriti."));
    } catch (archiveError) {
      setError(archiveError?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.save_failed", "Pre-inquiry could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  function handleDownloadReceivedInquiry(inquiry) {
    if (!inquiry) return;
    const content = inquiry.assessmentState
      ? buildPreInquiryAssessmentExportText(inquiry.assessmentState, {
          topic: inquiry.topic || "",
          situation: inquiry.situation || "",
          draft: inquiry.userEditedDraft || inquiry.generatedDraft || "",
          recipientName: inquiry.selectedRecipientName || ""
        })
      : inquiry.userEditedDraft || inquiry.generatedDraft || inquiry.situation || "";
    if (downloadTextFile(content, buildPreInquiryDownloadName(inquiry.topic))) {
      setNotice(readText(t, "workspace_feature_pages.pre_inquiries.received_download", "Eelpöördumise eelinfo alla laaditud."));
    }
  }

  async function handleSavePreferences() {
    if (savingPreferences) return;
    setSavingPreferences(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/pre-inquiries/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ acceptsPreInquiries })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.preferences_save_failed", "Preferences could not be saved."));
      }
      setAcceptsPreInquiries(Boolean(payload?.preferences?.acceptsPreInquiries));
      setNotice(readText(t, "workspace_feature_pages.pre_inquiries.preferences_save_success", "Preferences saved."));
    } catch (preferencesError) {
      setError(preferencesError?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.preferences_save_failed", "Preferences could not be saved."));
    } finally {
      setSavingPreferences(false);
    }
  }

  async function handleAcceptInquiry(inquiry) {
    const inquiryId = String(inquiry?.id || "").trim();
    if (!inquiryId || acceptingInquiryId || ["READY", "ARCHIVED"].includes(inquiry?.status)) return;
    setAcceptingInquiryId(inquiryId);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`/api/pre-inquiries/${encodeURIComponent(inquiryId)}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.accept_failed", "Eelpöördumist ei saanud vastu võtta."));
      }
      const updated = payload?.inquiry || null;
      if (updated) {
        setInquiries((current) => current.map((item) => item.id === updated.id ? updated : item));
      }
      setNotice(readText(t, "workspace_feature_pages.pre_inquiries.accept_success", "Eelpöördumine on vastuvõetud."));
    } catch (acceptError) {
      setError(acceptError?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.accept_failed", "Eelpöördumist ei saanud vastu võtta."));
    } finally {
      setAcceptingInquiryId("");
    }
  }

  async function handleOpenInquiryRoom(inquiry) {
    const inquiryId = String(inquiry?.id || "").trim();
    if (!inquiryId || openingRoomInquiryId) return;
    setOpeningRoomInquiryId(inquiryId);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`/api/pre-inquiries/${encodeURIComponent(inquiryId)}/room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.room_failed", "Vestlusruumi ei saanud avada."));
      }
      const roomId = payload?.room?.id || payload?.roomId || "";
      if (!roomId) {
        throw new Error(readText(t, "workspace_feature_pages.pre_inquiries.errors.room_failed", "Vestlusruumi ei saanud avada."));
      }
      pushWithTransition(router, buildRoomChatPath(roomId, locale));
    } catch (roomError) {
      setError(roomError?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.room_failed", "Vestlusruumi ei saanud avada."));
    } finally {
      setOpeningRoomInquiryId("");
    }
  }

  function updateReceiverChecklistItem(itemId, checked) {
    setReceiverChecklistDraft((current) => current.map((item) => (
      item.id === itemId ? { ...item, checked } : item
    )));
  }

  async function handleSaveReceiverWorkflow(inquiry, status = "") {
    const inquiryId = String(inquiry?.id || "").trim();
    if (!inquiryId || savingReceiverWorkflowId) return;
    setSavingReceiverWorkflowId(inquiryId);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`/api/pre-inquiries/${encodeURIComponent(inquiryId)}/workflow`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          receiverNote: receiverNoteDraft,
          receiverChecklist: receiverChecklistDraft,
          status: status || inquiry.status || "READY",
          expectedUpdatedAt: inquiry.updatedAt
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.workflow_save_failed", "Vastuvõtja tööplaani ei saanud salvestada."));
      }
      const updated = payload?.inquiry || null;
      if (updated) {
        setInquiries((current) => current.map((item) => item.id === updated.id ? updated : item));
      }
      setNotice(readText(t, "workspace_feature_pages.pre_inquiries.workflow_save_success", "Vastuvõtja tööplaan salvestati."));
    } catch (workflowError) {
      setError(workflowError?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.workflow_save_failed", "Vastuvõtja tööplaani ei saanud salvestada."));
    } finally {
      setSavingReceiverWorkflowId("");
    }
  }

  async function handleAskAssistant(event, overrideMessage = "", options = {}) {
    event?.preventDefault();
    const message = String(overrideMessage || assistantInput).trim();
    const baseSituation = situation.trim() || effectiveAssessmentSituation;
    if (assisting || (!message && !baseSituation.trim())) return;
    const shouldAppendMessage = options.appendMessage !== false;
    const nextSituation = shouldAppendMessage
      ? [baseSituation, message].filter(Boolean).join(baseSituation && message ? "\n\n" : "")
      : baseSituation;
    const assistantMessageForAssessment = shouldAppendMessage ? message : "";
    setAssisting(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/pre-inquiries/assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          topic,
          situation: nextSituation,
          assistantMessage: assistantMessageForAssessment,
          municipality: assessmentAssistContext.municipality,
          selectedNeedAreas: assessmentAssistContext.selectedNeedAreas,
          urgencyLevel: assessmentAssistContext.urgencyLevel,
          recipientType,
          activeRole,
          privacyDecision: options.privacyDecision
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.assist_failed", "Assistant could not prepare the pre-inquiry."));
      }
      const suggestions = Array.isArray(payload?.recommendedRecipients)
        ? payload.recommendedRecipients
        : Array.isArray(payload?.suggestions)
          ? payload.suggestions
          : [];
      setSituation(nextSituation);
      setAssistantInput("");
      setAssistantMessage(payload?.message || "");
      setAssistantReasoning(payload?.reasoningText || payload?.message || "");
      setAssistantWarnings(Array.isArray(payload?.warnings) ? payload.warnings : []);
      setAssistantRoutingConfidence(payload?.routingConfidence
        ? {
            level: payload.routingConfidence,
            label: payload.routingConfidenceLabel || "",
            text: payload.routingConfidenceText || ""
          }
        : null);
      setAssessmentLifeDomains(Array.isArray(payload?.lifeDomains) ? payload.lifeDomains : []);
      setAssessmentTargetGroups(Array.isArray(payload?.targetGroups) ? payload.targetGroups : []);
      setAssessmentQuestions(Array.isArray(payload?.clarifyingQuestions) ? payload.clarifyingQuestions : []);
      setAssistantSuggestions(suggestions);
      setShowMoreContacts(false);
      if (payload?.draftBody || payload?.draft) {
        setDraft(payload.draftBody || payload.draft);
        setDraftTouched(true);
      } else {
        setDraft("");
        setDraftTouched(false);
      }
      const firstSuggestion = suggestions[0] || null;
      if (firstSuggestion?.id) {
        setSelectedRecipientId(firstSuggestion.id);
        setRecipientType(firstSuggestion.type === "SERVICE_PROVIDER" ? "SERVICE_PROVIDER" : "KOV_CONTACT");
      } else {
        setSelectedRecipientId("");
      }
    } catch (assistError) {
      setError(assistError?.message || readText(t, "workspace_feature_pages.pre_inquiries.errors.assist_failed", "Assistant could not prepare the pre-inquiry."));
    } finally {
      setAssisting(false);
    }
  }

  async function handleComposerSend(message, options = {}) {
    setAssistantInput(String(message || ""));
    await handleAskAssistant({
      preventDefault() {}
    }, String(message || ""), options);
    return true;
  }

  function handleStartWorkflow(mode) {
    setWorkflowMode(mode);
    setNotice("");
    setError("");
    if (mode === "known_contact") {
      setActiveWorkflowStep("recipient");
      return;
    }
    if (mode === "journey") {
      setActiveWorkflowStep("journey");
      return;
    }
    setActiveWorkflowStep("collect");
  }

  function handleSelectRecipient(entry) {
    if (!entry?.id) return;
    setSelectedRecipientId(entry.id);
    setRecipientType(entry.type === "SERVICE_PROVIDER" ? "SERVICE_PROVIDER" : "KOV_CONTACT");
    setDraftTouched(false);
    setActiveWorkflowStep("preview");
  }

  if (!isRecipientRole && !workflowMode) {
    return (
      <div>
        <section>
          <div>
            <h1>
              Koosta eelpöördumine
            </h1>
            <p>
              Eelpöördumine aitab olukorra arusaadavalt kirja panna ja valida, kelle poole pöörduda. See ei ole ametlik hindamine ega teenuse määramise otsus.
            </p>
          </div>
          <div>
            {PRE_INQUIRY_START_OPTIONS.map((option) => {
              const disabled = option.id === "journey" && !canUseJourneyPrefill;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  aria-disabled={disabled ? "true" : "false"}
                  onClick={() => !disabled && handleStartWorkflow(option.id)}
                >
                  <span>{option.title}</span>
                  <span>{option.description}</span>
                  {disabled ? (
                    <span>
                      Teekonnast jätkamiseks ava eelpöördumine konkreetse Teekonna vaatest.
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  if (isRecipientRole) {
    return (
      <div>
        <div>
          <p className={bodyTextClassName}>
            {`${roleLabel(t, activeRole)} · ${readText(t, "workspace_feature_pages.pre_inquiries.receiver_workspace", "Eelpöördumiste vastuvõtt")}`}
          </p>
        </div>

        {loading ? <p className={bodyTextClassName}>{readText(t, "workspace_feature_pages.pre_inquiries.loading", "Laen eelpöördumisi...")}</p> : null}
        {error ? (
          <p>
            {error}
          </p>
        ) : null}
        {notice ? (
          <p>
            {notice}
          </p>
        ) : null}

        <SectionCard flat={embedded} title={readText(t, "workspace_feature_pages.pre_inquiries.sections.receiving_settings", "Vastuvõtt")}>
          {activeRole === "SOCIAL_WORKER" ? (
            <div>
              <Checkbox
                checked={acceptsPreInquiries}
                onChange={(value) => setAcceptsPreInquiries(Boolean(value))}
                label={
                  <span className={receivingCheckboxLabelClassName}>
                    {readText(t, "workspace_feature_pages.pre_inquiries.receiving.accepts_platform", "Võtan eelpöördumisi platvormil vastu")}
                  </span>
                }
              />
              <p>
                {isAdmin
                  ? readText(t, "workspace_feature_pages.pre_inquiries.receiving.admin_note", "Admini testvaade; salvestus käib ainult sinu kontole.")
                  : readText(t, "workspace_feature_pages.pre_inquiries.receiving.note", "Lubab sinu kontole adresseeritud eelpöördumised platvormis vastu võtta.")}
              </p>
              <Button type="button" size="sm" disabled={savingPreferences} onClick={handleSavePreferences}>
                {savingPreferences
                  ? readText(t, "workspace_feature_pages.pre_inquiries.actions.saving", "Salvestan...")
                  : readText(t, "workspace_feature_pages.pre_inquiries.actions.save_preferences", "Salvesta vastuvõtt")}
              </Button>
            </div>
          ) : (
            <p className={bodyTextClassName}>
              {readText(t, "workspace_feature_pages.pre_inquiries.receiving.provider_note", "Vastuvõtukanalid on teenuseprofiilis. Siin kuvatakse sulle adresseeritud eelpöördumised.")}
            </p>
          )}
        </SectionCard>

        <SectionCard flat={embedded} title={readText(t, "workspace_feature_pages.pre_inquiries.sections.received", "Saabunud eelpöördumised")}>
          <div>
            {receiverInquiries.length ? receiverInquiries.map((inquiry) => (
              <article key={inquiry.id}>
                <div>
                  <div>
                    <h3>{inquiry.topic || readText(t, "workspace_feature_pages.pre_inquiries.untitled", "Pealkirjata")}</h3>
                    <p>
                      {[
                        inquiry.author?.email,
                        inquiry.selectedRecipientName,
                        formatDate(inquiry.updatedAt, locale)
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span>
                    {inquiry.status || "DRAFT"}
                  </span>
                </div>
                <p>
                  {inquiry.situation}
                </p>
                <div>
                  <Button type="button" size="sm" onClick={() => handleOpenInquiry(inquiry)}>
                    {readText(t, "workspace_feature_pages.pre_inquiries.actions.open", "Ava")}
                  </Button>
                  <Button type="button" size="sm" disabled={acceptingInquiryId === inquiry.id || ["READY", "ARCHIVED"].includes(inquiry.status)} onClick={() => handleAcceptInquiry(inquiry)}>
                    {acceptingInquiryId === inquiry.id
                      ? readText(t, "workspace_feature_pages.pre_inquiries.actions.saving", "Salvestan...")
                      : readText(t, "workspace_feature_pages.pre_inquiries.actions.accept", "Märgi vastuvõetuks")}
                  </Button>
                  <Button type="button" size="sm" disabled={openingRoomInquiryId === inquiry.id || !inquiry.authorId} onClick={() => handleOpenInquiryRoom(inquiry)}>
                    {openingRoomInquiryId === inquiry.id
                      ? readText(t, "workspace_feature_pages.pre_inquiries.actions.opening_room", "Avan...")
                      : readText(t, "workspace_feature_pages.pre_inquiries.actions.open_room", "Ava vestlusruum")}
                  </Button>
                  {buildPreInquiryReplyMailto(inquiry) ? (
                    <a href={buildPreInquiryReplyMailto(inquiry)}>
                      {readText(t, "workspace_feature_pages.pre_inquiries.actions.write_email", "Kirjuta e-kiri")}
                    </a>
                  ) : null}
                </div>
              </article>
            )) : (
              <p className={bodyTextClassName}>{readText(t, "workspace_feature_pages.pre_inquiries.empty_received", "Sulle adresseeritud eelpöördumised ilmuvad siia, kui vastuvõtt on lubatud ja adressaat on kontoga seotud.")}</p>
            )}
          </div>
        </SectionCard>

        {activeReceivedInquiry ? (
          <SectionCard flat={embedded} title={readText(t, "workspace_feature_pages.pre_inquiries.sections.selected_received", "Valitud eelpöördumine")}>
            <div>
              <div>
                <p>{activeReceivedInquiry.topic || readText(t, "workspace_feature_pages.pre_inquiries.untitled", "Pealkirjata")}</p>
                <Button type="button" size="sm" onClick={() => handleDownloadReceivedInquiry(activeReceivedInquiry)}>
                  {readText(t, "workspace_feature_pages.pre_inquiries.received_download", "Laadi eelinfo alla")}
                </Button>
              </div>
              <p className={bodyTextClassName}>{activeReceivedInquiry.situation}</p>
              {shouldShowActiveReceivedJourneySharedInfo ? (
                <JourneySharedInfoBlock info={activeReceivedJourneySharedInfo} t={t} audience={activeReceivedJourneySharedInfoAudience} serviceLabel={activeReceivedInquiry.selectedRecipientName || ""} />
              ) : null}
              {activeReceivedInquiry.assessmentState ? (
                <ServiceProfileTextarea
                  readOnly
                  value={buildPreInquiryAssessmentExportText(activeReceivedInquiry.assessmentState, {
                    topic: activeReceivedInquiry.topic || "",
                    situation: activeReceivedInquiry.situation || "",
                    draft: activeReceivedInquiry.userEditedDraft || activeReceivedInquiry.generatedDraft || "",
                    recipientName: activeReceivedInquiry.selectedRecipientName || ""
                  })}
                />
              ) : null}
              {activeReceivedInquiry.userEditedDraft || activeReceivedInquiry.generatedDraft ? (
                <ServiceProfileTextarea readOnly value={activeReceivedInquiry.userEditedDraft || activeReceivedInquiry.generatedDraft || ""} />
              ) : null}
            </div>
          </SectionCard>
        ) : null}

        {activeReceivedInquiry ? (
          <SectionCard flat={embedded} title={readText(t, "workspace_feature_pages.pre_inquiries.sections.receiver_workflow", "Vastuvõtja tööplaan")}>
            <p className={bodyTextClassName}>
              {readText(t, "workspace_feature_pages.pre_inquiries.receiver_workflow_note", "Kasuta seda plokki kohtumise või järgmise kontakti ettevalmistamiseks. Märkmed on nähtavad vastuvõtja töövaates, mitte pöörduja mustandis.")}
            </p>
            <div>
              {receiverChecklistDraft.map((item) => (
                <Checkbox
                  key={item.id}
                  name={`receiver-workflow-${item.id}`}
                  checked={item.checked}
                  onChange={(checked) => updateReceiverChecklistItem(item.id, checked)}
                  label={item.label}
                />
              ))}
            </div>
            <Label>
              <span>{readText(t, "workspace_feature_pages.pre_inquiries.fields.receiver_note", "Sisemine märge")}</span>
              <ServiceProfileTextarea
                value={receiverNoteDraft}
                onChange={(event) => setReceiverNoteDraft(event.target.value)}
                placeholder={readText(t, "workspace_feature_pages.pre_inquiries.placeholders.receiver_note", "Mida on vaja enne järgmist kontakti täpsustada või ette valmistada?")}
              />
            </Label>
            <div>
              <Button type="button" size="sm" disabled={savingReceiverWorkflowId === activeReceivedInquiry.id} onClick={() => handleSaveReceiverWorkflow(activeReceivedInquiry)}>
                {savingReceiverWorkflowId === activeReceivedInquiry.id
                  ? readText(t, "workspace_feature_pages.pre_inquiries.actions.saving", "Salvestan...")
                  : readText(t, "workspace_feature_pages.pre_inquiries.actions.save_workflow", "Salvesta tööplaan")}
              </Button>
              <Button type="button" size="sm" disabled={savingReceiverWorkflowId === activeReceivedInquiry.id || activeReceivedInquiry.status === "READY"} onClick={() => handleSaveReceiverWorkflow(activeReceivedInquiry, "READY")}>
                {readText(t, "workspace_feature_pages.pre_inquiries.actions.mark_ready", "Märgi vastuvõetuks")}
              </Button>
              <Button type="button" size="sm" variant="primary" disabled={savingReceiverWorkflowId === activeReceivedInquiry.id || activeReceivedInquiry.status === "ARCHIVED"} onClick={() => handleSaveReceiverWorkflow(activeReceivedInquiry, "ARCHIVED")}>
                {readText(t, "workspace_feature_pages.pre_inquiries.actions.archive", "Arhiveeri")}
              </Button>
            </div>
          </SectionCard>
        ) : null}

        {activeReceivedInquiryAssessmentReview ? (
          <PreInquiryAssessmentReviewSection
            t={t}
            title={readText(t, "workspace_feature_pages.pre_inquiries.sections.received_assessment_review", "Eelkaardistuse struktureeritud eelinfo")}
            review={activeReceivedInquiryAssessmentReview}
            situation={activeReceivedInquiry?.situation || ""}
            note={readText(t, "workspace_feature_pages.pre_inquiries.assessment.receiver_review_note", "Siin on eelpöördumise vastused struktureeritud kujul. Tekstiekspordi saad kasutada siis, kui vajad tervet eelinfot ühe kopeeritava plokina.")}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <Button type="button" size="sm" onClick={handleNewInquiry}>
        {readText(t, "workspace_feature_pages.pre_inquiries.actions.new", "Uus")}
      </Button>

      {loading ? <p className={bodyTextClassName}>{readText(t, "workspace_feature_pages.pre_inquiries.loading", "Laen eelpöördumisi...")}</p> : null}
      {error ? (
        <p>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p>
          {notice}
        </p>
      ) : null}

      <div aria-label="Eelpöördumise sammud">
        {PRE_INQUIRY_WORKFLOW_STEPS.map((step, index) => (
          <button
            key={step.id}
            type="button"
            data-active={activeWorkflowStep === step.id ? "true" : undefined}
            onClick={() => setActiveWorkflowStep(step.id)}
          >
            <span>{index + 1}</span>
            <strong>{step.label}</strong>
          </button>
        ))}
      </div>

      <div>
        <aside>
          <div>
            <h2>Eelinfo ülevaade</h2>
            <p>
              Siin näed infot, mida kasutatakse pöördumise koostamiseks. Enne saatmist saad kõike muuta.
            </p>
          </div>
          {preInquiryOverviewRows.length ? (
            <dl>
              {preInquiryOverviewRows.slice(0, 8).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>
              Eelinfo täitub töövoo käigus.
            </p>
          )}
          {preInquiryMissingInfo.length ? (
            <div>
              <p>
                Need andmed võivad aidata sobivamat kontakti leida, kuid sa ei pea kõike lisama.
              </p>
              <ul>
                {preInquiryMissingInfo.slice(0, 6).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}
        </aside>
        <div>

      {activeWorkflowStep === "journey" ? (
        <SectionCard flat={embedded} title="Vali, mida soovid eelpöördumises kasutada">
          <p className={bodyTextClassName}>
            Teekonna info on privaatne. Märgi ainult need osad, mida soovid selle eelpöördumise koostamisel kasutada.
          </p>
          {activeDraftJourneySharedInfo ? (
            <JourneySharedInfoBlock info={activeDraftJourneySharedInfo} t={t} audience={activeDraftJourneySharedInfoAudience} serviceLabel={selectedRecipient?.title || ""} />
          ) : (
            <p className={bodyTextClassName}>Teekonna kokkuvõtet ei ole veel kaasa tulnud. Ava eelpöördumine konkreetse Teekonna vaatest või jätka uut eelpöördumist.</p>
          )}
          <div>
            {[
              ["summary", "olukorra kokkuvõte"],
              ["domains", "seotud teemad"],
              ["personWish", "inimese soov"],
              ["missingInfo", "puuduolev info"],
              ["document", "seotud dokument või kontekst"]
            ].map(([id, label]) => (
              <Checkbox
                key={id}
                checked={journeyShareSelections.includes(id)}
                onChange={(checked) => {
                  setJourneyShareSelections((current) => checked
                    ? [...new Set([...current, id])]
                    : current.filter((item) => item !== id));
                }}
                label={label}
              />
            ))}
          </div>
          <div>
            <Button type="button" size="sm" variant="primary" onClick={() => setActiveWorkflowStep("recipient")}>
              Vali adressaat
            </Button>
            <Button type="button" size="sm" onClick={() => setActiveWorkflowStep("collect")}>
              Täpsusta eelinfot
            </Button>
          </div>
        </SectionCard>
      ) : null}

      {activeWorkflowStep === "collect" ? (
      <>
      <SectionCard flat={embedded} title="Aitan sul pöördumise ette valmistada">
        <p className={bodyTextClassName}>
          Tere. Kirjelda lühidalt, mis olukord on. Sa ei pea kõike õigesti sõnastama. Küsin vajadusel ainult neid täpsustusi, mis aitavad pöördumise selgemaks teha ja sobiva kontakti leida.
        </p>
        <p className={bodyTextClassName}>
          {readText(t, "workspace_feature_pages.pre_inquiries.assessment.note", "Eelkaardistus ei ole ametlik abivajaduse hindamine ega teenuse määramise otsus. See aitab olukorda läbi mõelda ja pöördumist ette valmistada.")}
        </p>
        {assessmentPathChosen ? (
        <div>
          <div>
            <span>{readText(t, "workspace_feature_pages.pre_inquiries.fields.assessment_path", "Eelkaardistuse viis")}</span>
            <DocumentsDropdown
              ariaLabel={readText(t, "workspace_feature_pages.pre_inquiries.fields.assessment_path", "Eelkaardistuse viis")}
              portal
              value={normalizedAssessmentState.path}
              onChange={handleAssessmentPathChange}
              options={PRE_INQUIRY_ASSESSMENT_PATHS.map((path) => ({ value: path.id, label: path.title }))}
            />
            {selectedAssessmentPath?.description ? (
              <span>{selectedAssessmentPath.description}</span>
            ) : null}
          </div>
        </div>
        ) : (
          <div>
            {PRE_INQUIRY_ASSESSMENT_PATHS.map((path) => (
              <button
                key={path.id}
                type="button"
                onClick={() => handleAssessmentPathChange(path.id)}
              >
                <span>{path.title}</span>
                <span>{path.description}</span>
              </button>
            ))}
          </div>
        )}

        {assessmentPathChosen ? (
        <>
        <div>
          <div>
            <span>{readText(t, "workspace_feature_pages.pre_inquiries.fields.concerns_about", "Kelle kohta pöördumine käib")}</span>
            <DocumentsDropdown
              ariaLabel={readText(t, "workspace_feature_pages.pre_inquiries.fields.concerns_about", "Kelle kohta pöördumine käib")}
              portal
              value={normalizedAssessmentState.subject.concernsAbout}
              onChange={(value) => updateAssessmentSubject("concernsAbout", value)}
              options={PRE_INQUIRY_SUBJECT_OPTIONS.map((option) => ({ value: option, label: option }))}
            />
          </div>
          <div>
            <span>{readText(t, "workspace_feature_pages.pre_inquiries.fields.urgency", "Kiireloomulisus")}</span>
            <DocumentsDropdown
              ariaLabel={readText(t, "workspace_feature_pages.pre_inquiries.fields.urgency", "Kiireloomulisus")}
              portal
              value={normalizedAssessmentState.subject.urgency}
              onChange={(value) => updateAssessmentSubject("urgency", value)}
              options={PRE_INQUIRY_URGENCY_OPTIONS.map((option) => ({ value: option, label: option }))}
            />
          </div>
          <div>
            <span>{readText(t, "workspace_feature_pages.pre_inquiries.fields.consent", "Nõusolek või pöördumise alus")}</span>
            <DocumentsDropdown
              ariaLabel={readText(t, "workspace_feature_pages.pre_inquiries.fields.consent", "Nõusolek või pöördumise alus")}
              portal
              value={normalizedAssessmentState.subject.consentStatus}
              onChange={(value) => updateAssessmentSubject("consentStatus", value)}
              options={PRE_INQUIRY_CONSENT_OPTIONS.map((option) => ({ value: option, label: option }))}
            />
          </div>
          <Label>
            <span>{readText(t, "workspace_feature_pages.pre_inquiries.fields.municipality", "KOV või piirkond")}</span>
            <ServiceProfileInput
              value={normalizedAssessmentState.subject.municipalityText}
              onChange={(event) => updateAssessmentSubject("municipalityText", event.target.value)}
              placeholder={readText(t, "workspace_feature_pages.pre_inquiries.placeholders.municipality", "Näiteks Tallinn, Põltsamaa vald või piirkond")}
            />
          </Label>
        </div>

        {normalizedAssessmentState.riskGate.userVisibleMessage ? (
          <p>
            {normalizedAssessmentState.riskGate.userVisibleMessage}
          </p>
        ) : null}
        {normalizedAssessmentState.subject.concernsAbout === "Lapse või noore kohta" && normalizedAssessmentState.path !== "QUICK_DESCRIPTION" ? (
          <p>
            {readText(t, "workspace_feature_pages.pre_inquiries.assessment.child_note", "See eelkaardistus lähtub praegu täisealise inimese eluvaldkondade põhiküsimustest. Lapse või noore olukorra puhul kirjelda mure kindlasti ka oma sõnadega; eraldi lapse ja pere eelkaardistus vajab oma küsimustikku.")}
          </p>
        ) : null}

        <Label>
          <span>{readText(t, "workspace_feature_pages.pre_inquiries.fields.situation", "Olukorra kirjeldus inimese sõnadega")}</span>
          <ServiceProfileTextarea
            value={situation}
            onChange={(event) => {
              setSituation(event.target.value);
              setDraftTouched(false);
            }}
            placeholder={readText(t, "workspace_feature_pages.pre_inquiries.placeholders.situation", "Kirjelda lühidalt, mis olukord vajab abi. Teenuse nime ei pea teadma.")}
          />
        </Label>

        {normalizedAssessmentState.path !== "QUICK_DESCRIPTION" ? (
          <details>
            <summary>{readText(t, "workspace_feature_pages.pre_inquiries.assessment.domains_title", "Eluvaldkonnad")}</summary>
            <div>
            {PRE_INQUIRY_DOMAIN_DEFINITIONS.map((definition) => {
              const domain = normalizedAssessmentState.domains.find((item) => item.id === definition.id) || {};
              return (
                <div key={definition.id}>
                  <div>
                    <h4>{definition.title}</h4>
                    <p>{definition.helperText}</p>
                  </div>
                  <div>
                    {definition.primaryQuestions.map((primaryQuestion) => {
                      const primaryAnswer = domain.primaryAnswers?.find((answer) => answer.id === primaryQuestion.id) || {};
                      const followUpQuestions = getPreInquiryQuestionFollowUpQuestions(
                        primaryQuestion,
                        normalizedAssessmentState.path,
                        primaryAnswer.screenAnswer
                      );
                      return (
                        <div key={primaryQuestion.id}>
                          <div>
                            <p>{primaryQuestion.title}</p>
                            <p>{primaryQuestion.question}</p>
                          </div>
                          <div>
                            {PRE_INQUIRY_SCREEN_OPTIONS.map((option) => (
                              <OptionCard
                                key={option.value}
                                type="radio"
                                name={`pre-inquiry-question-${definition.id}-${primaryQuestion.id}`}
                                value={option.value}
                                checked={primaryAnswer.screenAnswer === option.value}
                                onChange={() => updatePrimaryQuestionAnswer(definition.id, primaryQuestion.id, option.value)}
                                fitTextLines={2}
                              >
                                <span>{option.label}</span>
                              </OptionCard>
                            ))}
                          </div>
                          {followUpQuestions.length ? (
                            <div>
                              {followUpQuestions.map((question) => (
                                <Label key={question}>
                                  <span>{question}</span>
                                  <ServiceProfileTextarea
                                    value={primaryAnswer.followUpAnswers?.[question] || ""}
                                    onChange={(event) => updatePrimaryQuestionFollowUpAnswer(definition.id, primaryQuestion.id, question, event.target.value)}
                                    placeholder={readText(t, "workspace_feature_pages.pre_inquiries.placeholders.follow_up", "Vasta oma sõnadega. Võid jätta tühjaks, kui ei tea.")}
                                  />
                                </Label>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            </div>
          </details>
        ) : null}

        <details>
          <summary>{readText(t, "workspace_feature_pages.pre_inquiries.assessment.extra_details", "Lisainfo ja taust")}</summary>
          <div>
          <Label>
            <span>{readText(t, "workspace_feature_pages.pre_inquiries.fields.existing_support", "Olemasolev abi")}</span>
            <ServiceProfileTextarea
              value={normalizedAssessmentState.supportContext.existingSupport}
              onChange={(event) => updateAssessmentSupport("existingSupport", event.target.value)}
              placeholder={readText(t, "workspace_feature_pages.pre_inquiries.placeholders.existing_support", "Kes või mis praegu aitab?")}
            />
          </Label>
          <Label>
            <span>{readText(t, "workspace_feature_pages.pre_inquiries.fields.support_adequacy", "Kas abist piisab")}</span>
            <ServiceProfileTextarea
              value={normalizedAssessmentState.supportContext.supportAdequacy}
              onChange={(event) => updateAssessmentSupport("supportAdequacy", event.target.value)}
              placeholder={readText(t, "workspace_feature_pages.pre_inquiries.placeholders.support_adequacy", "Näiteks piisab, ei piisa või abistaja on ülekoormatud")}
            />
          </Label>
          <Label>
            <span>{readText(t, "workspace_feature_pages.pre_inquiries.fields.person_wish", "Inimese enda soov")}</span>
            <ServiceProfileTextarea
              value={normalizedAssessmentState.supportContext.personWish}
              onChange={(event) => updateAssessmentSupport("personWish", event.target.value)}
              placeholder={readText(t, "workspace_feature_pages.pre_inquiries.placeholders.person_wish", "Mida inimene ise kõige rohkem soovib?")}
            />
          </Label>
          </div>
        </details>
        </>
        ) : null}
      </SectionCard>

      <div>
        <Button type="button" size="sm" variant="primary" onClick={() => setActiveWorkflowStep("review")}>
          Vaata eelinfo üle
        </Button>
        <Button type="button" size="sm" onClick={() => setActiveWorkflowStep("recipient")}>
          Vali adressaat
        </Button>
      </div>
      </>
      ) : null}

      <details open style={{ display: activeWorkflowStep === "review" ? undefined : "none" }}>
        <summary>{readText(t, "workspace_feature_pages.pre_inquiries.sections.assessment_review", "Vaata eelinfo üle")}</summary>
      <PreInquiryAssessmentReviewSection
        t={t}
        title={readText(t, "workspace_feature_pages.pre_inquiries.sections.assessment_review", "Vaata eelinfo üle")}
        review={assessmentReview}
        situation={effectiveSituation}
        note={readText(t, "workspace_feature_pages.pre_inquiries.assessment.review_note", "Ülevaade koondab täpselt need eelkaardistuse vastused ja täpsustused, mis lähevad salvestatud eelpöördumise ning allalaaditava eelinfo juurde.")}
      />
      </details>
      <details open style={{ display: activeWorkflowStep === "collect" ? undefined : "none" }}>
        <summary>Täpsusta eelinfot</summary>
      <SectionCard flat={embedded} title="Aita pöördumist selgemaks teha">
        <div>
          <div>
            <div>
              <ConversationView
                t={t}
                chatWindowRef={chatWindowRef}
                isStreamingAny={assisting}
                hiddenCount={0}
                pageSize={0}
                onRevealOlder={() => {}}
                canHideOlder={false}
                onHideOlder={() => {}}
                onJumpToBottom={() => {}}
                messageItems={conversationItems}
                mainClassName="documents-agent-conversation-main"
                windowClassName="documents-agent-conversation-window"
                isMobile={false}
                isLightTheme
              />
            </div>

            <div>
              <div>
                <ChatComposer
                  t={t}
                  locale={locale}
                  isLightTheme
                  hideTools
                  embedded
                  forcePlaceholderVisible
                  placeholderText=""
                  acceptAttr=""
                  ensureAnalysisPanelVisible={() => {}}
                  fileInputRef={fileInputRef}
                  onFileChange={() => {}}
                  inputBarRef={inputBarRef}
                  inputRef={inputRef}
                  onFocusInput={() => setInputFocused(true)}
                  onBlurInput={() => setInputFocused(false)}
                  isGenerating={assisting}
                  isStreamingAny={false}
                  isRoomMode={false}
                  roomBlocked={false}
                  roomAuthRequired={false}
                  onStop={() => {}}
                  onSend={handleComposerSend}
                  voiceEnabled={false}
                  recording={false}
                  recordingPulse={false}
                  handleMic={() => {}}
                  draftApiRef={composerDraftApiRef}
                  inputFocused={inputFocused}
                  isMobile={false}
                  activeModeKey="pre_inquiry"
                />
              </div>
            </div>
          </div>
        </div>

        {activeRole === "SOCIAL_WORKER" ? (
          <div>
            <Checkbox
              checked={acceptsPreInquiries}
              onChange={(value) => setAcceptsPreInquiries(Boolean(value))}
              label={
                <span className={receivingCheckboxLabelClassName}>
                  {readText(t, "workspace_feature_pages.pre_inquiries.receiving.accepts_platform", "Võtan eelpöördumisi platvormil vastu")}
                </span>
              }
            />
            <p>
              {isAdmin
                ? readText(t, "workspace_feature_pages.pre_inquiries.receiving.admin_note", "Admini testvaade; salvestus käib ainult sinu kontole.")
                : readText(t, "workspace_feature_pages.pre_inquiries.receiving.note", "Lubab sinu kontole adresseeritud eelpöördumised platvormis vastu võtta.")}
            </p>
            <Button type="button" size="sm" disabled={savingPreferences} onClick={handleSavePreferences}>
              {savingPreferences
                ? readText(t, "workspace_feature_pages.pre_inquiries.actions.saving", "Salvestan...")
                : readText(t, "workspace_feature_pages.pre_inquiries.actions.save_preferences", "Salvesta vastuvõtt")}
            </Button>
          </div>
        ) : null}
      </SectionCard>
      </details>

      <div style={{ display: activeWorkflowStep === "recipient" || activeWorkflowStep === "preview" ? undefined : "none" }}>
      {activeWorkflowStep === "recipient" ? (
      <SectionCard flat={embedded} title={readText(t, "workspace_feature_pages.pre_inquiries.sections.recipient", "Sobivad kontaktid")}>
        <p className={bodyTextClassName}>
          {readText(t, "workspace_feature_pages.pre_inquiries.recipients_lead", "Kontaktid tulevad teenusekaardi struktureeritud andmekihist pärast seda, kui olukord, piirkond ja soovitud pöördumise suund on piisavalt selged. SotsiaalAI ei ole selles nimekirjas eelpöördumise adressaat.")}
        </p>
        <div>
          <div role="group" aria-label={readText(t, "workspace_feature_pages.pre_inquiries.fields.recipient_type", "Adressaadi tüüp")}>
            {[
              ["KOV_CONTACT", readText(t, "workspace_feature_pages.pre_inquiries.recipient.kov", "KOV kontakt")],
              ["SERVICE_PROVIDER", readText(t, "workspace_feature_pages.pre_inquiries.recipient.provider", "Teenuseosutaja")]
            ].map(([value, label]) => (
              <OptionCard
                key={value}
                type="checkbox"
                name="pre-inquiry-recipient-type"
                value={value}
                checked={recipientType === value}
                showIndicator={false}
                onChange={() => {
                  setRecipientType((current) => current === value ? "" : value);
                  setSelectedRecipientId("");
                  setShowMoreContacts(false);
                  setDraftTouched(false);
                }}
                fitTextLines={2}
              >
                <span>{label}</span>
              </OptionCard>
            ))}
          </div>
          <Label>
            <span>{readText(t, "workspace_feature_pages.pre_inquiries.fields.recipient_search", "Otsi adressaati")}</span>
            <ServiceProfileInput value={recipientQuery} onChange={(event) => setRecipientQuery(event.target.value)} placeholder={readText(t, "workspace_feature_pages.pre_inquiries.placeholders.recipient", "KOV, teenuseosutaja või piirkond")} />
          </Label>
        </div>
        {assistantRoutingConfidence ? (
          <div>
            <p>
              {readText(t, "workspace_feature_pages.pre_inquiries.routing.confidence", "Kontaktisoovituse kindlus")}
            </p>
            <p>
              {assistantRoutingConfidence.label || assistantRoutingConfidence.level}
            </p>
            {assistantRoutingConfidence.text ? (
              <p>{assistantRoutingConfidence.text}</p>
            ) : null}
          </div>
        ) : null}
        <div>
          {visibleRecommendedRecipients.length ? visibleRecommendedRecipients.map((entry) => {
            const isSelectedRecipient = selectedRecipientId === entry.id;
            return (
              <article
                key={entry.id}
                className="pre-inquiry-recipient-card"
                data-selected={isSelectedRecipient ? "true" : undefined}
              >
                <span>
                  <span>{entry.title}</span>
                  <span>
                    {getPreInquiryRecipientTypeLabel(t, entry)}
                  </span>
                </span>
                <span>{getPreInquiryRecipientSubtitle(entry)}</span>
                <span>
                  {getPreInquiryRecipientReason(entry)}
                </span>
                {entry.routingReason ? (
                  <span>
                    {entry.routingReason}
                  </span>
                ) : null}
                {getPreInquiryRecipientRegion(entry) ? (
                  <span>
                    {getPreInquiryRecipientRegion(entry)}
                  </span>
                ) : null}
                <span>
                  {[
                    getPreInquiryChannelLabel(t, entry.deliveryChannel),
                    entry.email,
                    entry.municipalityName || entry.county
                  ].filter(Boolean).join(" · ")}
                </span>
                {isSelectedRecipient ? (
                  <span>
                    {readText(t, "workspace_feature_pages.pre_inquiries.recipient.selected", "Valitud kontakt")}
                  </span>
                ) : null}
                {getPreInquiryReferralNotice(entry) ? (
                  <span>
                    {getPreInquiryReferralNotice(entry)}
                  </span>
                ) : null}
                {preInquiryAvailabilityNotices(entry, t).map(({ service, presentation }) => (
                  <span
                    key={`${service.id || service.name}-availability`}
                    className="pre-inquiry-recipient-card__availability"
                    data-tone={presentation.tone}
                    role="status"
                  >
                    {presentation.icon} {service.name}: {presentation.label}. {presentation.ageText}. {presentation.warning}
                  </span>
                ))}
                <span>
                  <Button type="button" size="sm" onClick={() => handleSelectRecipient(entry)}>
                    Vali see kontakt
                  </Button>
                  <Button as="a" href={localizePath(`/teenusekaart?entryId=${encodeURIComponent(entry.id)}`, locale)} size="sm" variant="linkBrand">
                    Vaata teenusekaardil
                  </Button>
                  {entry.providerProfileId ? (
                    <Button as="a" href={localizePath(`/teenuseprofiil?profileId=${encodeURIComponent(entry.providerProfileId)}`, locale)} size="sm" variant="linkBrand">
                      Vaata profiili
                    </Button>
                  ) : null}
                </span>
              </article>
            );
          }) : (
            <p className={bodyTextClassName}>Kontaktide soovitamiseks lisa v?hemalt piirkond v?i KOV ning l?hike olukorra kirjeldus.</p>
          )}
          {recommendedRecipients.length > 3 ? (
            <Button type="button" size="sm" onClick={() => setShowMoreContacts((value) => !value)}>
              {showMoreContacts
                ? readText(t, "workspace_feature_pages.pre_inquiries.actions.show_less_contacts", "Näita vähem")
                : readText(t, "workspace_feature_pages.pre_inquiries.actions.show_more_contacts", "Vaata rohkem kontakte")}
            </Button>
          ) : null}
        </div>
      </SectionCard>
      ) : null}

      <div className={cn(activeWorkflowStep !== "preview" && "hidden")}>
      <SectionCard flat={embedded} title="Pöördumise eelvaade">
        <Label>
          <span>{readText(t, "workspace_feature_pages.pre_inquiries.fields.topic", "Teema")}</span>
          <ServiceProfileInput value={topic} onChange={(event) => { setTopic(event.target.value); setDraftTouched(false); }} placeholder={readText(t, "workspace_feature_pages.pre_inquiries.placeholders.topic", "Lühike pealkiri")} />
        </Label>
        <ServiceProfileTextarea value={draft} onChange={(event) => { setDraft(event.target.value); setDraftTouched(true); }} placeholder={readText(t, "workspace_feature_pages.pre_inquiries.placeholders.draft", "Koostatud pöördumise tekst")} />
        {activeDraftJourneySharedInfo ? (
          <JourneySharedInfoBlock info={activeDraftJourneySharedInfo} t={t} audience={activeDraftJourneySharedInfoAudience} serviceLabel={selectedRecipient?.title || ""} />
        ) : null}
        {savePrivacyPrompt ? (
          <div>
            <p>
              {savePrivacyPrompt.warning || readText(t, "privacy.confirmation.warning", "Tekst sisaldab isikuandmeid. Vali enne jatkamist, kuidas neid toodelda.")}
            </p>
            {savePrivacyPrompt.findings?.length ? (
              <p>
                {readText(t, "privacy.confirmation.detected", "Leitud:")}{" "}
                {savePrivacyPrompt.findings.map((finding) => finding?.label).filter(Boolean).join(", ")}
              </p>
            ) : null}
            {savePrivacyPrompt.redactedText ? (
              <p>
                {savePrivacyPrompt.redactedText}
              </p>
            ) : null}
            <div>
              <Button type="button" size="sm" variant="primary" onClick={handleEditSaveText}>
                {readText(t, "privacy.confirmation.actions.edit", "Muudan teksti")}
              </Button>
              <Button type="button" size="sm" onClick={handleSaveRedacted} disabled={saving}>
                {readText(t, "privacy.confirmation.actions.send_redacted", "Saada maskeeritult")}
              </Button>
              {savePrivacyPrompt.allowOriginal ? (
                <Button type="button" size="sm" variant="primary" onClick={handleSaveOriginal} disabled={saving}>
                  {readText(t, "privacy.confirmation.actions.send_original", "Saada siiski")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div>
          <p>Midagi ei saadeta automaatselt.</p>
          <p>
            Enne kinnitamist kontrolli adressaati, saatmise viisi, pöördumise teksti ja eelinfot. Platvormisisene pöördumine jõuab vastuvõtja Pöördumiste vaatesse; e-kirja tekst avaneb sinu e-posti rakenduses ülevaatamiseks.
          </p>
          {selectedRecipient ? (
            <p>
              Adressaat: {selectedRecipient.title}. Saatmise viis: {selectedRecipientSupportsPlatform ? "platvormisisene eelpöördumine" : selectedRecipientSupportsEmail ? "e-kirja tekst" : "salvestamine, kopeerimine või allalaadimine"}.
            </p>
          ) : null}
          {selectedRecipientReferralNotice ? (
            <p>{selectedRecipientReferralNotice} Sa saad teenuseosutajalt küsida lisainfot või pöörduda KOV-i poole.</p>
          ) : null}
          {selectedRecipientAvailabilityNotices.map(({ service, presentation }) => (
            <p key={`${service.id || service.name}-preview-availability`} role="status">
              {presentation.icon} {service.name}: {presentation.label}. {presentation.ageText}. {presentation.warning}
            </p>
          ))}
        </div>
        <div>
          {selectedRecipientMailto ? (
            <Button as="a" href={selectedRecipientMailto} size="sm">
              {readText(t, "workspace_feature_pages.pre_inquiries.actions.open_email", "Ava e-kirjana")}
            </Button>
          ) : null}
          <Button type="button" size="sm" disabled={saving || !effectiveSituation.trim()} onClick={handleSave}>
            {saving
              ? readText(t, "workspace_feature_pages.pre_inquiries.actions.saving", "Salvestan...")
              : readText(t, "workspace_feature_pages.pre_inquiries.actions.save", "Salvesta eelpöördumine")}
          </Button>
          {selectedRecipientId && selectedRecipientSupportsPlatform ? (
            <Button type="button" size="sm" disabled={saving || !effectiveSituation.trim()} onClick={(event) => handleSave(event, { status: "SENT" })}>
              {saving
                ? readText(t, "workspace_feature_pages.pre_inquiries.actions.saving", "Salvestan...")
                : readText(t, "workspace_feature_pages.pre_inquiries.actions.send_internal", "Saada platvormis")}
            </Button>
          ) : null}
          <Button type="button" size="sm" disabled={!draft.trim()} onClick={handleCopy}>{readText(t, "workspace_feature_pages.pre_inquiries.actions.copy", "Kopeeri tekst")}</Button>
          <Button type="button" size="sm" disabled={!draft.trim() && !effectiveSituation.trim()} onClick={handleDownload}>{readText(t, "workspace_feature_pages.pre_inquiries.actions.download", "Laadi alla")}</Button>
        </div>
      </SectionCard>
      </div>
      </div>

      {showReceivedInquiries ? (
        <SectionCard flat={embedded} title={readText(t, "workspace_feature_pages.pre_inquiries.sections.received", "Saabunud eelpöördumised")}>
          <div>
            {receivedInquiries.length ? receivedInquiries.map((inquiry) => (
              <article key={inquiry.id}>
                <div>
                  <h3>{inquiry.topic || readText(t, "workspace_feature_pages.pre_inquiries.untitled", "Pealkirjata")}</h3>
                  <p>
                    {[
                      inquiry.author?.email,
                      inquiry.selectedRecipientName,
                      formatDate(inquiry.updatedAt)
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div>
                  <span>
                    {getPreInquiryChannelLabel(t, inquiry.deliveryChannel)}
                  </span>
                  <Button type="button" size="sm" onClick={() => handleOpenInquiry(inquiry)}>
                    {readText(t, "workspace_feature_pages.pre_inquiries.actions.open", "Ava")}
                  </Button>
                </div>
              </article>
            )) : (
              <p className={bodyTextClassName}>{readText(t, "workspace_feature_pages.pre_inquiries.empty_received", "Sulle adresseeritud eelpöördumised ilmuvad siia, kui vastuvõtt on lubatud ja adressaat on kontoga seotud.")}</p>
            )}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard flat={embedded} className={cn(activeWorkflowStep !== "saved" && "hidden")} title={readText(t, "workspace_feature_pages.pre_inquiries.sections.saved", "Minu eelpöördumised")}>
        <div>
          {savedInquiries.length ? savedInquiries.map((inquiry) => (
            <article key={inquiry.id}>
              <div>
                <h3>{inquiry.topic || readText(t, "workspace_feature_pages.pre_inquiries.untitled", "Pealkirjata")}</h3>
                <p>
                  {[
                    inquiry.selectedRecipientName,
                    inquiry.selectedRecipientEmail,
                    inquiry.createdAt ? `loodud ${formatDate(inquiry.createdAt, locale)}` : "",
                    inquiry.updatedAt ? `muudetud ${formatDate(inquiry.updatedAt, locale)}` : ""
                  ].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div>
                <span>
                  {getPreInquiryStatusLabel(inquiry.status)}
                </span>
                <span>
                  {getPreInquiryChannelLabel(t, inquiry.deliveryChannel)}
                </span>
                <Button type="button" size="sm" onClick={() => handleOpenInquiry(inquiry)}>
                  {readText(t, "workspace_feature_pages.pre_inquiries.actions.open", "Ava")}
                </Button>
                <Button type="button" size="sm" variant="primary" onClick={() => handleOpenInquiry(inquiry)}>
                  Muuda
                </Button>
                <Button type="button" size="sm" variant="primary" onClick={() => navigator?.clipboard?.writeText(inquiry.userEditedDraft || inquiry.generatedDraft || inquiry.situation || "")}>
                  Kopeeri
                </Button>
                <Button type="button" size="sm" variant="primary" onClick={() => handleDownloadSavedInquiry(inquiry)}>
                  Laadi alla
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={saving || inquiry.status === "SENT" || inquiry.status === "ARCHIVED"}
                  onClick={() => handleArchiveAuthoredInquiry(inquiry)}
                >
                  {readText(t, "workspace_feature_pages.pre_inquiries.actions.archive", "Arhiveeri")}
                </Button>
              </div>
            </article>
          )) : (
            <p className={bodyTextClassName}>{readText(t, "workspace_feature_pages.pre_inquiries.empty_saved", "Sul ei ole veel salvestatud eelpöördumisi.")}</p>
          )}
        </div>
      </SectionCard>
        </div>
      </div>
    </div>
  );
}

function hasServiceMapCoordinates(entry) {
  const latitude = Number(entry?.latitude);
  const longitude = Number(entry?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function readInitialServiceMapFilters() {
  if (typeof window === "undefined") {
    return { keyword: "", region: "", entryType: "KOV_SOCIAL_CONTACT" };
  }
  const params = new URLSearchParams(window.location.search || "");
  const entryType = String(params.get("type") || "KOV_SOCIAL_CONTACT").trim().toUpperCase();
  const normalizedEntryType =
    entryType === "SERVICES_CONTACTS"
      ? "KOV_SOCIAL_CONTACT"
      : entryType === "HELP_REQUEST" || entryType === "HELP_OFFER"
        ? "HELP_LISTINGS"
        : entryType;
  return {
    keyword: params.get("q") || params.get("keyword") || "",
    region: params.get("municipalityName") || params.get("municipality") || params.get("county") || "",
    entryType: ["KOV_SOCIAL_CONTACT", "SERVICE_PROVIDER", "HELP_LISTINGS"].includes(normalizedEntryType) ? normalizedEntryType : "KOV_SOCIAL_CONTACT"
  };
}

function ServiceMapSurface({
  t,
  locale = "et",
  activeRole = "SOCIAL_WORKER",
  isAdmin = false,
  onRoleChange,
  onBack
}) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [region, setRegion] = useState("");
  const [entryType, setEntryType] = useState("KOV_SOCIAL_CONTACT");
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [isMobilePanel, setIsMobilePanel] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const workspaceRef = useRef(null);
  const filtersShellRef = useRef(null);
  const keywordPlaceholder = readText(t, "workspace_feature_pages.service_map.placeholders.keyword", "Service, contact or need");
  const regionPlaceholder = readText(t, "workspace_feature_pages.service_map.placeholders.region", "Municipality or county");

  useEffect(() => {
    const initialFilters = readInitialServiceMapFilters();
    if (initialFilters.keyword) setKeyword(initialFilters.keyword);
    if (initialFilters.region) setRegion(initialFilters.region);
    if (initialFilters.entryType !== "KOV_SOCIAL_CONTACT") setEntryType(initialFilters.entryType);
  }, []);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return undefined;
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("service-map-page-active");
    body?.classList.add("service-map-page-active");
    return () => {
      clearServiceMapPageState();
    };
  }, []);

  /* Tagasi-nupud eemaldatud vaatest (paneeli × + Esc); puhastus jääb
     unmount-efekti kanda. */
  const _handleServiceMapBack = useCallback(() => {
    clearServiceMapPageState();
    onBack?.();
  }, [onBack]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    const workspace = workspaceRef.current;
    const filtersShell = filtersShellRef.current;
    if (!workspace || !filtersShell) return undefined;

    const syncPanelHeight = () => {
      const height = filtersShell.getBoundingClientRect().height;
      if (Number.isFinite(height) && height > 0) {
        workspace.style.setProperty("--service-map-panel-height", `${height.toFixed(2)}px`);
      }
    };

    syncPanelHeight();
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncPanelHeight) : null;
    resizeObserver?.observe(filtersShell);
    window.addEventListener("resize", syncPanelHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncPanelHeight);
      workspace.style.removeProperty("--service-map-panel-height");
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const syncPanelMode = () => {
      const nextIsMobile = mobileQuery.matches;
      setIsMobilePanel(nextIsMobile);
      if (!nextIsMobile) setPanelOpen(true);
    };
    syncPanelMode();
    mobileQuery.addEventListener?.("change", syncPanelMode);
    return () => mobileQuery.removeEventListener?.("change", syncPanelMode);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadEntries() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/service-map/entries?limit=${SERVICE_MAP_ENTRIES_FETCH_LIMIT}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          // Tõlge ESIMESENA — API message võib olla toores võtmestring
          throw new Error(readText(t, "workspace_feature_pages.service_map.errors.load_failed", payload?.message || "Map entries could not be loaded."));
        }
        if (!cancelled) setEntries(Array.isArray(payload?.entries) ? payload.entries : []);
      } catch (loadError) {
        if (!cancelled) {
          setEntries([]);
          setError(loadError?.message || readText(t, "workspace_feature_pages.service_map.errors.load_failed", "Map entries could not be loaded."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadEntries();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const filteredEntries = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase("et");
    const regionQuery = region.trim().toLocaleLowerCase("et");
    return entries.filter((entry) => {
      if (!serviceMapEntryMatchesType(entry, entryType)) return false;
      const haystack = [
        entry.title,
        entry.description,
        entry.address,
        entry.categoryLabel,
        entry.helpTypeLabel,
        entry.timeTypeLabel,
        entry.regionLabel,
        entry.availabilityOrStart,
        entry.compensationDetails,
        ...(entry.targetGroupLabels || []),
        ...(entry.needTags || []),
        ...(entry.relatedServiceCategories || []),
        ...(entry.lifeDomains || []),
        ...(entry.deliveryModes || []),
        entry.providerProfile?.organizationName,
        ...(entry.providerProfile?.services || []),
        ...(entry.providerProfile?.serviceCategories || []),
        ...(entry.providerProfile?.targetGroups || []),
        ...(entry.providerProfile?.serviceItems || [])
          .filter((service) => service?.mapVisible !== false && String(service?.status || "PUBLISHED").toUpperCase() === "PUBLISHED")
          .flatMap((service) => [
            service?.name,
            service?.description,
            service?.category,
            service?.priceDescription,
            ...(service?.targetGroups || [])
          ])
      ].join(" ").toLocaleLowerCase("et");
      const regionText = [
        entry.municipalityName,
        entry.municipality?.displayName,
        entry.county,
        entry.address,
        entry.serviceArea,
        entry.regionLabel,
        entry.providerProfile?.serviceArea,
        ...(entry.providerProfile?.serviceAreas || []),
        ...(entry.providerProfile?.serviceItems || [])
          .filter((service) => service?.mapVisible !== false && String(service?.status || "PUBLISHED").toUpperCase() === "PUBLISHED")
          .map((service) => service?.serviceArea)
      ].join(" ").toLocaleLowerCase("et");
      return (!query || haystack.includes(query)) && (!regionQuery || regionText.includes(regionQuery));
    });
  }, [entries, entryType, keyword, region]);

  const mappableEntries = useMemo(
    () => filteredEntries.filter((entry) => hasServiceMapCoordinates(entry)),
    [filteredEntries]
  );

  useEffect(() => {
    if (!selectedEntryId) return;
    if (!filteredEntries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId("");
    }
  }, [filteredEntries, selectedEntryId]);

  const handleKeywordChange = useCallback((event) => {
    setSelectedEntryId("");
    setKeyword(event.target.value);
  }, []);

  const handleRegionChange = useCallback((event) => {
    setSelectedEntryId("");
    setRegion(event.target.value);
  }, []);

  const handleEntryTypeChange = useCallback((event) => {
    setSelectedEntryId("");
    setEntryType(event.target.value);
  }, []);

  const handleSelectEntry = useCallback((entryId) => {
    setSelectedEntryId(entryId);
    if (entryId && isMobilePanel) setPanelOpen(false);
  }, [isMobilePanel]);

  const handleConnectHelpMapEntry = useCallback(async (entry) => {
    if (!entry || (entry.type !== "HELP_REQUEST" && entry.type !== "HELP_OFFER")) return;
    if (entry.isOwn) {
      setError(readText(t, "workspace_feature_pages.service_map.errors.own_help_listing", "See on sinu enda kuulutus."));
      return;
    }

    setError("");
    try {
      const ownKind = entry.type === "HELP_REQUEST" ? "offer" : "request";
      const optionsResponse = await fetch(`/api/help/listings?kind=${encodeURIComponent(ownKind)}&scope=mine&status=OPEN&locale=${encodeURIComponent(locale)}&limit=20`, {
        cache: "no-store"
      });
      const optionsPayload = await optionsResponse.json().catch(() => ({}));
      const ownListing = Array.isArray(optionsPayload?.items) ? optionsPayload.items[0] : null;
      if (!optionsResponse.ok || optionsPayload?.ok === false || !ownListing?.id) {
        throw new Error(readText(t, "workspace_feature_pages.service_map.errors.no_counterpart_listing", "Ühenduse loomiseks peab sul olema vastav avatud abisoov või abipakkumine."));
      }

      const payload = entry.type === "HELP_REQUEST"
        ? { requestId: entry.listingId, offerId: ownListing.id }
        : { requestId: ownListing.id, offerId: entry.listingId };
      const response = await fetch("/api/help/matches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok === false || !body?.match) {
        throw new Error(readText(t, "workspace_feature_pages.service_map.errors.connect_failed", "Ühenduse loomine ebaõnnestus."));
      }

      const roomTarget = body?.match?.roomId ? buildRoomChatPath(body.match.roomId, locale) : "";
      if (roomTarget) {
        pushWithTransition(router, roomTarget);
      }
    } catch (connectError) {
      setError(connectError?.message || readText(t, "workspace_feature_pages.service_map.errors.connect_failed", "Ühenduse loomine ebaõnnestus."));
    }
  }, [locale, router, t]);

  const hasResultFilter = Boolean(keyword.trim() || region.trim());
  const showResults = !loading && !error && hasResultFilter && filteredEntries.length > 0;

  return (
    <div ref={workspaceRef} className="service-map-page">
      {/* Tagasi-nooled eemaldatud (tellija 06.07 öö): paneeli × + Esc
          sulgevad; lehe ⓘ elab akna nurgas (PanelFrame). Juhtriba on
          ÜLASERVAS, kaart täidab ülejäänu. */}
      <div
        className="service-map-topbar"
        data-open={panelOpen ? "1" : "0"}
        aria-label={readText(t, "workspace_feature_pages.service_map.sections.filters", "Otsing ja filtrid")}
      >
        <div ref={filtersShellRef} className="service-map-topbar-inner">
          <div className="service-map-fields">
            <label>
              <span className="sr-only">{readText(t, "workspace_feature_pages.service_map.fields.keyword", "Keyword")}</span>
              <input
                value={keyword}
                onChange={handleKeywordChange}
                placeholder={keywordPlaceholder}
              />
            </label>
            <label>
              <span className="sr-only">{readText(t, "workspace_feature_pages.service_map.fields.region", "Region")}</span>
              <input
                value={region}
                onChange={handleRegionChange}
                placeholder={regionPlaceholder}
              />
            </label>
          </div>

          <div className="service-map-types" role="radiogroup" aria-label="Kirje liik">
            {[
              ["KOV_SOCIAL_CONTACT", readText(t, "workspace_feature_pages.service_map.types.kov", "KOV")],
              ["SERVICE_PROVIDER", readText(t, "workspace_feature_pages.service_map.types.provider", "Teenused")],
              ["HELP_LISTINGS", readText(t, "workspace_feature_pages.service_map.types.help_listings", "Abisoovid ja pakkumised")]
            ].map(([value, label]) => (
              <OptionCard
                key={value}
                type="radio"
                name="service-map-entry-type"
                value={value}
                checked={entryType === value}
                onChange={handleEntryTypeChange}
                className={serviceMapChoiceCardClassName}
              >
                <span>{label}</span>
              </OptionCard>
            ))}
          </div>

          {showResults ? (
            <div className="service-map-results" aria-label={readText(t, "workspace_feature_pages.service_map.results", "Tulemused")}>
              {filteredEntries.slice(0, SERVICE_MAP_RESULT_BUTTON_LIMIT).map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  data-selected={selectedEntryId === entry.id ? "true" : "false"}
                  onClick={() => handleSelectEntry(entry.id)}
                >
                  <span>{entry.title}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="service-map-toggle"
          aria-expanded={panelOpen}
          aria-label={panelOpen
            ? readText(t, "workspace_feature_pages.service_map.actions.hide_filters", "Peida filtrid")
              : readText(t, "workspace_feature_pages.service_map.actions.show_filters", "Näita filtreid")}
          onClick={() => setPanelOpen((value) => !value)}
        >
          <ServiceMapPanelToggleIcon open={panelOpen} />
        </button>
        {isAdmin ? (
          <div className="service-map-admin">
            <AdminRoleSelector
              t={t}
              locale={locale}
              value={activeRole}
              onChange={onRoleChange}
            />
          </div>
        ) : null}
      </div>

      {error ? (
        <div role="status" aria-live="polite">
          {error}
        </div>
      ) : null}

      <div className="service-map-canvas" aria-label={readText(t, "workspace_feature_pages.service_map.sections.map", "Kaart")}>
        <ServiceMapLeaflet
          entries={mappableEntries}
          selectedEntryId={selectedEntryId}
          onSelectEntry={handleSelectEntry}
          onConnectHelpEntry={handleConnectHelpMapEntry}
          t={t}
        />
      </div>
    </div>
  );
}

function joinList(value) {
  return Array.isArray(value) ? value.join(", ") : String(value || "");
}

function splitList(value) {
  return String(value || "")
    .split(/[,;\n\r]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function toggleListValue(value, optionValue) {
  const selected = new Set(splitList(value));
  if (selected.has(optionValue)) selected.delete(optionValue);
  else selected.add(optionValue);
  return [...selected].join(", ");
}

function serviceProfileSelectedOptionLabels(value, options) {
  const selected = splitList(value);
  const labelByValue = new Map(options.map((option) => [option.value, option.label]));
  return selected.map((item) => labelByValue.get(item) || item);
}

function serviceProfileCategoryOptions(t) {
  return [
    { value: "KOV sotsiaalteenus", label: readText(t, "workspace_feature_pages.service_profile.category_options.kov_social_service", "KOV sotsiaalteenus") },
    { value: "Nõustamine ja juhendamine", label: readText(t, "workspace_feature_pages.service_profile.category_options.counselling_guidance", "Nõustamine ja juhendamine") },
    { value: "Pere, lapse ja noore tugi", label: readText(t, "workspace_feature_pages.service_profile.category_options.family_child_youth", "Pere, lapse ja noore tugi") },
    { value: "Puue, rehabilitatsioon ja abivahendid", label: readText(t, "workspace_feature_pages.service_profile.category_options.disability_rehabilitation", "Puue, rehabilitatsioon ja abivahendid") },
    { value: "Kodune abi ja hooldus", label: readText(t, "workspace_feature_pages.service_profile.category_options.home_care", "Kodune abi ja hooldus") },
    { value: "Toimetulek ja võlanõustamine", label: readText(t, "workspace_feature_pages.service_profile.category_options.coping_debt", "Toimetulek ja võlanõustamine") },
    { value: "Eluase ja turvalisus", label: readText(t, "workspace_feature_pages.service_profile.category_options.housing_safety", "Eluase ja turvalisus") },
    { value: "Transport ja liikumisabi", label: readText(t, "workspace_feature_pages.service_profile.category_options.transport", "Transport ja liikumisabi") },
    { value: "Töö, õppimine ja osalemine", label: readText(t, "workspace_feature_pages.service_profile.category_options.work_learning_participation", "Töö, õppimine ja osalemine") },
    { value: "Digi- ja asjaajamisabi", label: readText(t, "workspace_feature_pages.service_profile.category_options.digital_admin_help", "Digi- ja asjaajamisabi") },
    { value: "Muu teenus", label: readText(t, "workspace_feature_pages.service_profile.category_options.other", "Muu teenus") }
  ];
}

function serviceProfileTargetGroupOptions(t) {
  return [
    { value: "Puudega inimene", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.disabled_person", "Puudega inimene") },
    { value: "Psüühilise erivajadusega inimene", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.psychosocial_disability", "Psüühilise erivajadusega inimene") },
    { value: "Intellektipuudega inimene", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.intellectual_disability", "Intellektipuudega inimene") },
    { value: "Vaimse tervise murega inimene", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.mental_health_concern", "Vaimse tervise murega inimene") },
    { value: "Toimetulekuraskustes inimene", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.coping_difficulty", "Toimetulekuraskustes inimene") },
    { value: "Eluasemeraskustes inimene", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.housing_difficulty", "Eluasemeraskustes inimene") },
    { value: "Võlgadega inimene", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.debt_difficulty", "Võlgadega inimene") },
    { value: "Sõltuvusprobleemiga inimene", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.addiction_concern", "Sõltuvusprobleemiga inimene") },
    { value: "Vägivalla või kriisiolukorra kogemusega inimene", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.violence_crisis_experience", "Vägivalla või kriisiolukorra kogemusega inimene") },
    { value: "Hooldaja või lähedane", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.caregiver_close_person", "Hooldaja või lähedane") },
    { value: "Lapsevanem", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.parent", "Lapsevanem") },
    { value: "Pere", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.family", "Pere") },
    { value: "Eestkostja", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.guardian", "Eestkostja") },
    { value: "Töötu või tööotsija", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.unemployed_jobseeker", "Töötu või tööotsija") },
    { value: "Sotsiaalselt isoleeritud inimene", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.socially_isolated", "Sotsiaalselt isoleeritud inimene") },
    { value: "Muu sihtrühm", label: readText(t, "workspace_feature_pages.service_profile.target_group_options.other", "Muu sihtrühm") }
  ];
}

function serviceProfileLanguageOptions(t) {
  return [
    { value: "eesti", label: readText(t, "workspace_feature_pages.service_profile.language_options.et", "Eesti") },
    { value: "inglise", label: readText(t, "workspace_feature_pages.service_profile.language_options.en", "Inglise") },
    { value: "vene", label: readText(t, "workspace_feature_pages.service_profile.language_options.ru", "Vene") },
    { value: "muu", label: readText(t, "workspace_feature_pages.service_profile.language_options.other", "Muu") }
  ];
}

function serviceProfileAgeGroupOptions(t) {
  return [
    { value: "Laps", label: readText(t, "workspace_feature_pages.service_profile.age_group_options.child", "Laps") },
    { value: "Noor", label: readText(t, "workspace_feature_pages.service_profile.age_group_options.youth", "Noor") },
    { value: "Tööealine inimene", label: readText(t, "workspace_feature_pages.service_profile.age_group_options.working_age", "Tööealine inimene") },
    { value: "Täisealine inimene", label: readText(t, "workspace_feature_pages.service_profile.age_group_options.adult", "Täisealine inimene") },
    { value: "Eakas inimene", label: readText(t, "workspace_feature_pages.service_profile.age_group_options.elder", "Eakas inimene") }
  ];
}

function serviceProfileRequesterRoleOptions(t) {
  return [
    { value: "Inimene ise", label: readText(t, "workspace_feature_pages.service_profile.requester_role_options.self", "Inimene ise") },
    { value: "Lapsevanem või eestkostja", label: readText(t, "workspace_feature_pages.service_profile.requester_role_options.parent_guardian", "Lapsevanem või eestkostja") },
    { value: "Lähedane", label: readText(t, "workspace_feature_pages.service_profile.requester_role_options.close_person", "Lähedane") },
    { value: "Spetsialist", label: readText(t, "workspace_feature_pages.service_profile.requester_role_options.specialist", "Spetsialist") }
  ];
}

function serviceProfileNeedTagOptions(t) {
  return [
    { value: "Hooldusvajadus", label: readText(t, "workspace_feature_pages.service_profile.need_options.care_need", "Hooldusvajadus") },
    { value: "Toimetulekuraskus", label: readText(t, "workspace_feature_pages.service_profile.need_options.coping", "Toimetulekuraskus") },
    { value: "Hoolduskoormus", label: readText(t, "workspace_feature_pages.service_profile.need_options.caregiver_burden", "Hoolduskoormus") },
    { value: "Lapse heaolu", label: readText(t, "workspace_feature_pages.service_profile.need_options.child_wellbeing", "Lapse heaolu") },
    { value: "Vaimne tervis", label: readText(t, "workspace_feature_pages.service_profile.need_options.mental_health", "Vaimne tervis") },
    { value: "Liikumine ja transport", label: readText(t, "workspace_feature_pages.service_profile.need_options.mobility_transport", "Liikumine ja transport") },
    { value: "Asjaajamine", label: readText(t, "workspace_feature_pages.service_profile.need_options.administration", "Asjaajamine") }
  ];
}

function serviceProfileLifeDomainOptions(t) {
  return [
    { value: "Kodu ja igapäevaelu", label: readText(t, "workspace_feature_pages.service_profile.life_domain_options.home_daily", "Kodu ja igapäevaelu") },
    { value: "Tervis", label: readText(t, "workspace_feature_pages.service_profile.life_domain_options.health", "Tervis") },
    { value: "Pere ja suhted", label: readText(t, "workspace_feature_pages.service_profile.life_domain_options.family", "Pere ja suhted") },
    { value: "Haridus", label: readText(t, "workspace_feature_pages.service_profile.life_domain_options.education", "Haridus") },
    { value: "Töö ja hõive", label: readText(t, "workspace_feature_pages.service_profile.life_domain_options.work", "Töö ja hõive") },
    { value: "Eluase", label: readText(t, "workspace_feature_pages.service_profile.life_domain_options.housing", "Eluase") }
  ];
}

function serviceProfileDeliveryModeOptions(t) {
  return [
    { value: "Kohapeal", label: readText(t, "workspace_feature_pages.service_profile.delivery_mode_options.onsite", "Kohapeal") },
    { value: "Inimese kodus", label: readText(t, "workspace_feature_pages.service_profile.delivery_mode_options.home", "Inimese kodus") },
    { value: "Veebis", label: readText(t, "workspace_feature_pages.service_profile.delivery_mode_options.online", "Veebis") },
    { value: "Telefonitsi", label: readText(t, "workspace_feature_pages.service_profile.delivery_mode_options.phone", "Telefonitsi") },
    { value: "Piirkondlikult", label: readText(t, "workspace_feature_pages.service_profile.delivery_mode_options.regional", "Piirkondlikult") }
  ];
}

function serviceProfileCommunicationSupportOptions(t) {
  return [
    { value: "Lihtsas keeles selgitus", label: readText(t, "workspace_feature_pages.service_profile.communication_support_options.simple_language", "Lihtsas keeles selgitus") },
    { value: "Tõlk või keeleabi", label: readText(t, "workspace_feature_pages.service_profile.communication_support_options.interpreter", "Tõlk või keeleabi") },
    { value: "Ligipääsetav suhtlus", label: readText(t, "workspace_feature_pages.service_profile.communication_support_options.accessible", "Ligipääsetav suhtlus") }
  ];
}

function serviceProfileOrganizationTypeOptions(t) {
  return [
    { value: "", label: readText(t, "workspace_feature_pages.service_profile.organization_type_options.unspecified", "Täpsustamata") },
    { value: "MTÜ", label: readText(t, "workspace_feature_pages.service_profile.organization_type_options.ngo", "MTÜ") },
    { value: "SA", label: readText(t, "workspace_feature_pages.service_profile.organization_type_options.foundation", "SA") },
    { value: "Ettevõte", label: readText(t, "workspace_feature_pages.service_profile.organization_type_options.company", "Ettevõte") },
    { value: "Avalik asutus", label: readText(t, "workspace_feature_pages.service_profile.organization_type_options.public", "Avalik asutus") },
    { value: "Muu", label: readText(t, "workspace_feature_pages.service_profile.organization_type_options.other", "Muu") }
  ];
}

function serviceProfileServiceAreaTypeOptions(t) {
  return [
    { value: "", label: readText(t, "workspace_feature_pages.service_profile.area_type_options.unspecified", "Täpsustamata") },
    { value: "Üleriigiline", label: readText(t, "workspace_feature_pages.service_profile.area_type_options.national", "Üleriigiline") },
    { value: "Maakondlik", label: readText(t, "workspace_feature_pages.service_profile.area_type_options.county", "Maakondlik") },
    { value: "KOV põhine", label: readText(t, "workspace_feature_pages.service_profile.area_type_options.municipality", "KOV põhine") },
    { value: "Teeninduskoha põhine", label: readText(t, "workspace_feature_pages.service_profile.area_type_options.location", "Teeninduskoha põhine") },
    { value: "Veebiteenus", label: readText(t, "workspace_feature_pages.service_profile.area_type_options.online", "Veebiteenus") }
  ];
}

function serviceProfileAvailabilityOptions(t) {
  return [
    { value: "", label: readText(t, "workspace_feature_pages.service_profile.availability_options.unspecified", "Täpsustamata") },
    { value: "accepting", label: readText(t, "workspace_feature_pages.service_profile.availability_options.accepting", "Võtab uusi pöördumisi vastu") },
    { value: "waitlist", label: readText(t, "workspace_feature_pages.service_profile.availability_options.waitlist", "Ooteajaga vastuvõtt") },
    { value: "not_accepting", label: readText(t, "workspace_feature_pages.service_profile.availability_options.not_accepting", "Praegu ei võta uusi pöördumisi") }
  ];
}

function serviceProfileRequirementOptions(t) {
  return [
    { value: "", label: readText(t, "workspace_feature_pages.service_profile.requirement_options.unspecified", "Täpsustamata") },
    { value: "Ei", label: readText(t, "workspace_feature_pages.service_profile.requirement_options.no", "Ei") },
    { value: "Jah", label: readText(t, "workspace_feature_pages.service_profile.requirement_options.yes", "Jah") },
    { value: "Sõltub olukorrast", label: readText(t, "workspace_feature_pages.service_profile.requirement_options.depends", "Sõltub olukorrast") }
  ];
}

function serviceProfileContactModeOptions(t) {
  return [
    { value: "", label: readText(t, "workspace_feature_pages.service_profile.contact_mode_options.unspecified", "Täpsustamata") },
    { value: "Platvormisisene eelpöördumine", label: readText(t, "workspace_feature_pages.service_profile.contact_mode_options.platform", "Platvormisisene eelpöördumine") },
    { value: "E-post", label: readText(t, "workspace_feature_pages.service_profile.contact_mode_options.email", "E-post") },
    { value: "Telefon", label: readText(t, "workspace_feature_pages.service_profile.contact_mode_options.phone", "Telefon") },
    { value: "Veebivorm", label: readText(t, "workspace_feature_pages.service_profile.contact_mode_options.form", "Veebivorm") }
  ];
}

function createServiceProfileLocationForm(location = null, index = 0, profile = null) {
  const mapEntry = profile?.serviceMapEntry || null;
  return {
    clientId: location?.id || `location-${index + 1}`,
    label: location?.label || "",
    address: location?.address || location?.normalizedAddress || (index === 0 ? profile?.address || "" : ""),
    normalizedAddress: location?.normalizedAddress || (index === 0 ? profile?.normalizedAddress || mapEntry?.normalizedAddress || "" : ""),
    county: location?.county || profile?.county || "",
    latitude: location?.latitude ?? (index === 0 ? mapEntry?.latitude ?? "" : ""),
    longitude: location?.longitude ?? (index === 0 ? mapEntry?.longitude ?? "" : ""),
    adsObjectId: location?.adsObjectId || (index === 0 ? mapEntry?.adsObjectId || "" : ""),
    geocodingProvider: location?.geocodingProvider || location?.geocodingRaw?.provider || (index === 0 ? mapEntry?.geocodingRaw?.provider || "" : ""),
    phone: location?.phone || "",
    email: location?.email || "",
    website: location?.website || "",
    openingHours: location?.openingHours || "",
    accessibilityInfo: location?.accessibilityInfo || "",
    mapVisible: location?.mapVisible !== false,
    status: location?.status || (profile?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"),
    sortOrder: Number.isFinite(Number(location?.sortOrder)) ? Number(location.sortOrder) : index
  };
}

function createServiceProfileServiceForm(service = null, index = 0, profile = null) {
  const hasServiceContact = Boolean(
    String(service?.contactName || "").trim() ||
    String(service?.phone || "").trim() ||
    String(service?.email || "").trim() ||
    String(service?.website || "").trim()
  );
  return {
    id: service?.id || "",
    name: service?.name || "",
    description: service?.description || "",
    longDescription: service?.longDescription || "",
    includesText: service?.includesText || "",
    excludesText: service?.excludesText || "",
    additionalInfo: service?.additionalInfo || "",
    category: service?.category || "",
    categories: joinList(service?.categories),
    ageGroups: joinList(service?.ageGroups),
    targetGroups: joinList(service?.targetGroups),
    requesterRoles: joinList(service?.requesterRoles),
    needTags: joinList(service?.needTags),
    lifeDomains: joinList(service?.lifeDomains),
    deliveryModes: joinList(service?.deliveryModes),
    serviceArea: service?.serviceArea || profile?.serviceArea || "",
    serviceAreaType: service?.serviceAreaType || "",
    county: service?.county || profile?.county || "",
    municipalityIds: joinList(service?.municipalityIds),
    areaDescription: service?.areaDescription || "",
    serviceLanguages: joinList(service?.serviceLanguages),
    inquiryLanguages: joinList(service?.inquiryLanguages),
    communicationSupport: joinList(service?.communicationSupport),
    feeType: service?.feeType || profile?.feeType || "UNKNOWN",
    priceDescription: service?.priceDescription || "",
    availabilityStatus: service?.availabilityStatus || "",
    availabilityDescription: service?.availabilityDescription || "",
    availability: service?.availability || null,
    availabilityFingerprint: service?.availabilityFingerprint || "",
    directContactAllowed: service?.directContactAllowed || "",
    requiresKovAssessment: service?.requiresKovAssessment || "",
    requiresKovDecision: service?.requiresKovDecision || "",
    requiresSkaReferral: service?.requiresSkaReferral || "",
    requiresSpecialistReferral: service?.requiresSpecialistReferral || "",
    requiredDocumentsNote: service?.requiredDocumentsNote || "",
    referralNotes: service?.referralNotes || "",
    contactMode: service?.contactMode || "",
    contactStrategy: hasServiceContact ? "CUSTOM" : "ORGANIZATION",
    contactName: service?.contactName || "",
    phone: service?.phone || "",
    email: service?.email || "",
    website: service?.website || "",
    locationIds: Array.isArray(service?.locationIds) ? service.locationIds : [],
    acceptsPlatformPreInquiries: service?.acceptsPlatformPreInquiries ?? profile?.acceptsPlatformPreInquiries ?? true,
    acceptsEmailPreInquiries: service?.acceptsEmailPreInquiries ?? profile?.acceptsEmailPreInquiries ?? true,
    mapVisible: service?.mapVisible !== false,
    status: service?.status || (profile?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"),
    sortOrder: Number.isFinite(Number(service?.sortOrder)) ? Number(service.sortOrder) : index
  };
}

function createServiceProfileForm(profile = null) {
  const mapEntry = profile?.serviceMapEntry || null;
  const serviceLocations = Array.isArray(profile?.serviceLocations) && profile.serviceLocations.length
    ? profile.serviceLocations.map((location, index) => createServiceProfileLocationForm(location, index, profile))
    : (profile?.address || mapEntry?.normalizedAddress)
        ? [createServiceProfileLocationForm(null, 0, profile)]
        : [];
  const serviceItems = Array.isArray(profile?.serviceItems) && profile.serviceItems.length
    ? profile.serviceItems.map((service, index) => createServiceProfileServiceForm(service, index, profile))
    : (Array.isArray(profile?.services) ? profile.services : []).map((name, index) =>
        createServiceProfileServiceForm({ name, sortOrder: index }, index, profile)
      );
  return {
    organizationName: profile?.organizationName || "",
    organizationType: profile?.organizationType || "",
    registryCode: profile?.registryCode || "",
    shortDescription: profile?.shortDescription || "",
    longDescription: profile?.longDescription || "",
    services: joinList(profile?.services),
    serviceCategories: joinList(profile?.serviceCategories),
    targetGroups: joinList(profile?.targetGroups),
    serviceArea: profile?.serviceArea || "",
    serviceAreaMunicipalityIds: joinList(profile?.serviceAreaMunicipalityIds),
    county: profile?.county || "",
    address: profile?.address || "",
    normalizedAddress: profile?.normalizedAddress || mapEntry?.normalizedAddress || "",
    latitude: mapEntry?.latitude ?? "",
    longitude: mapEntry?.longitude ?? "",
    adsObjectId: mapEntry?.adsObjectId || "",
    geocodingProvider: mapEntry?.geocodingRaw?.provider || "",
    phone: profile?.phone || "",
    email: profile?.email || "",
    website: profile?.website || "",
    primaryContactName: profile?.primaryContactName || "",
    languages: joinList(profile?.languages),
    accessibilityInfo: profile?.accessibilityInfo || "",
    generalAccessibilityNote: profile?.generalAccessibilityNote || "",
    feeType: profile?.feeType || "UNKNOWN",
    mapVisible: Boolean(profile?.mapVisible),
    acceptsPlatformPreInquiries: profile?.acceptsPlatformPreInquiries !== false,
    acceptsEmailPreInquiries: profile?.acceptsEmailPreInquiries !== false,
    assistantRecommendationAllowed: profile?.assistantRecommendationAllowed === true,
    status: profile?.status || "DRAFT",
    serviceItems,
    serviceLocations
  };
}

function serviceProfileMapStatusText(t, mapEntry) {
  if (!mapEntry) {
    return readText(
      t,
      "workspace_feature_pages.service_profile.map_status.empty",
      "Kaardiasukoha saab ette valmistada pärast aadressi salvestamist."
    );
  }

  const geocodingStatus = String(mapEntry.geocodingStatus || "").toUpperCase();
  if (geocodingStatus === "MATCHED" || geocodingStatus === "MANUALLY_CONFIRMED") {
    return readText(
      t,
      "workspace_feature_pages.service_profile.map_status.matched",
      "Aadressil on vaste olemas ja seda saab avaldatud profiili korral teenusekaardil kuvada."
    );
  }
  if (geocodingStatus === "AMBIGUOUS") {
    return readText(
      t,
      "workspace_feature_pages.service_profile.map_status.ambiguous",
      "Aadress vajab enne kaardil kuvamist täpsustamist."
    );
  }
  if (geocodingStatus === "FAILED") {
    return readText(
      t,
      "workspace_feature_pages.service_profile.map_status.failed",
      "Aadressile ei leitud veel vastet. Markerit kaardil ei kuvata."
    );
  }
  return readText(t, "workspace_feature_pages.service_profile.map_status.pending", "Aadress ootab vastendamist.");
}

function ToggleRow({ checked, onChange, title, body, className }) {
  return (
    <Checkbox
      checked={checked}
      onChange={(value) => onChange(Boolean(value))}
      className={className}
      label={
        <span>
          <span>{title}</span>
          {body ? <span>{body}</span> : null}
        </span>
      }
    />
  );
}

function ServiceProfileGlowField({ children, className, style }) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

function ServiceProfileDropdown({ ariaLabel, value, onChange, options, openDirection = "down" }) {
  return (
    <ServiceProfileGlowField>
      <DocumentsDropdown
        ariaLabel={ariaLabel}
        value={value}
        onChange={onChange}
        options={options}
        openDirection={openDirection}
        portal
      />
    </ServiceProfileGlowField>
  );
}

function ServiceProfileChoiceChips({ value, options, onChange, ariaLabel }) {
  const selected = new Set(splitList(value));
  return (
    <div role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const checked = selected.has(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={checked ? "true" : "false"}
            onClick={() => onChange(toggleListValue(value, option.value))}
          >
            {checked ? <span aria-hidden="true">✓</span> : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ServiceProfileFieldHelp({ children }) {
  return <p>{children}</p>;
}

function ServiceProfileChipField({
  label,
  value,
  options,
  ariaLabel,
  onChange,
  selectedLabel = "",
  selectedEmptyLabel = "-"
}) {
  const selectedLabels = serviceProfileSelectedOptionLabels(value, options);
  return (
    <div>
      <span>{label}</span>
      <ServiceProfileChoiceChips
        value={value}
        options={options}
        ariaLabel={ariaLabel || label}
        onChange={onChange}
      />
      <p>
        {selectedLabels.length
          ? `${selectedLabel}: ${selectedLabels.join(", ")}`
          : `${selectedLabel}: ${selectedEmptyLabel}`}
      </p>
    </div>
  );
}

function ServiceProfileInput({ className, ...props }) {
  return (
    <ServiceProfileGlowField>
      <input
        className={className}
        {...props}
      />
    </ServiceProfileGlowField>
  );
}

function ServiceProfileTextarea({ className, ...props }) {
  return (
    <ServiceProfileGlowField className={className}>
      <textarea
        {...props}
      />
    </ServiceProfileGlowField>
  );
}

function ServiceProfileLocationChoice({ checked, onChange, children }) {
  return (
    <Checkbox
      checked={checked}
      onChange={(value) => onChange(Boolean(value))}
      label={<span>{children}</span>}
    />
  );
}

function ServiceProfileAddressInput({ t, form, onTyping, onSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const query = form.address || "";
  const selectedAddress =
    form.normalizedAddress &&
    Number.isFinite(Number(form.latitude)) &&
    Number.isFinite(Number(form.longitude))
      ? form.normalizedAddress
      : "";

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3 || selectedAddress === trimmed) {
      setSuggestions([]);
      setLoading(false);
      setError("");
      return undefined;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          query: trimmed,
          limit: "8"
        });
        if (form.county) params.set("county", form.county);
        const municipalityContext = splitList(form.serviceAreaMunicipalityIds)[0] || "";
        if (municipalityContext) params.set("municipalityName", municipalityContext);
        const response = await fetch(`/api/service-map/address-suggestions?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message || "address_suggestions_failed");
        setSuggestions(Array.isArray(payload?.suggestions) ? payload.suggestions : []);
        setOpen(true);
      } catch (suggestionError) {
        if (suggestionError?.name !== "AbortError") {
          setSuggestions([]);
          setError(readText(t, "workspace_feature_pages.service_profile.address_search.error", "Aadressisoovitusi ei saanud laadida."));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 260);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [form.county, form.serviceAreaMunicipalityIds, query, selectedAddress, t]);

  return (
    <div>
      <ServiceProfileInput
        value={query}
        autoComplete="off"
        placeholder={readText(t, "workspace_feature_pages.service_profile.address_search.placeholder", "Alusta aadressi kirjutamist")}
        onFocus={() => setOpen(true)}
        onChange={(event) => onTyping(event.target.value)}
      />
      <p>
        {readText(
          t,
          "workspace_feature_pages.service_profile.address_search.hint",
          "Kirjutamisel pakutakse ametlikke aadressivasteid. Kaardil kuvamiseks vali soovitus."
        )}
      </p>
      {open && (loading || error || suggestions.length > 0) ? (
        <div role="listbox">
          {loading ? (
            <p>
              {readText(t, "workspace_feature_pages.service_profile.address_search.loading", "Otsin aadresse...")}
            </p>
          ) : null}
          {error ? <p>{error}</p> : null}
          {!loading && !error ? suggestions.map((suggestion) => (
            <button
              key={`${suggestion.adsObjectId || suggestion.normalizedAddress}-${suggestion.latitude}-${suggestion.longitude}`}
              type="button"
              onClick={() => {
                onSelect(suggestion);
                setOpen(false);
              }}
            >
              <span>{suggestion.label || suggestion.normalizedAddress}</span>
            </button>
          )) : null}
        </div>
      ) : null}
      {selectedAddress ? (
        <p>
          {readText(t, "workspace_feature_pages.service_profile.address_search.selected", "Valitud ametlik aadressivaste:")} {selectedAddress}
        </p>
      ) : null}
    </div>
  );
}

function ServiceProfileSurface({ t }) {
  const [form, setForm] = useState(() => createServiceProfileForm());
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmingServiceId, setConfirmingServiceId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const feeOptions = useMemo(
    () => [
      { value: "UNKNOWN", label: readText(t, "workspace_feature_pages.service_profile.fee.unknown", "Täpsustamata") },
      { value: "FREE", label: readText(t, "workspace_feature_pages.service_profile.fee.free", "Tasuta") },
      { value: "PAID", label: readText(t, "workspace_feature_pages.service_profile.fee.paid", "Tasuline") },
      { value: "AGREEMENT", label: readText(t, "workspace_feature_pages.service_profile.fee.agreement", "Kokkuleppel") },
      { value: "MIXED", label: readText(t, "workspace_feature_pages.service_profile.fee.mixed", "Mitu tüüpi") }
    ],
    [t]
  );
  const statusOptions = useMemo(
    () => [
      { value: "DRAFT", label: readText(t, "workspace_feature_pages.service_profile.status.draft", "Avaldamata") },
      { value: "REVIEW", label: readText(t, "workspace_feature_pages.service_profile.status.review", "Ülevaatusel") },
      { value: "PUBLISHED", label: readText(t, "workspace_feature_pages.service_profile.status.published", "Avaldatud") },
      { value: "HIDDEN", label: readText(t, "workspace_feature_pages.service_profile.status.hidden", "Peidetud") }
    ],
    [t]
  );
  const categoryOptions = useMemo(() => serviceProfileCategoryOptions(t), [t]);
  const targetGroupOptions = useMemo(() => serviceProfileTargetGroupOptions(t), [t]);
  const languageOptions = useMemo(() => serviceProfileLanguageOptions(t), [t]);
  const ageGroupOptions = useMemo(() => serviceProfileAgeGroupOptions(t), [t]);
  const requesterRoleOptions = useMemo(() => serviceProfileRequesterRoleOptions(t), [t]);
  const needTagOptions = useMemo(() => serviceProfileNeedTagOptions(t), [t]);
  const lifeDomainOptions = useMemo(() => serviceProfileLifeDomainOptions(t), [t]);
  const deliveryModeOptions = useMemo(() => serviceProfileDeliveryModeOptions(t), [t]);
  const communicationSupportOptions = useMemo(() => serviceProfileCommunicationSupportOptions(t), [t]);
  const organizationTypeOptions = useMemo(() => serviceProfileOrganizationTypeOptions(t), [t]);
  const serviceAreaTypeOptions = useMemo(() => serviceProfileServiceAreaTypeOptions(t), [t]);
  const availabilityOptions = useMemo(() => serviceProfileAvailabilityOptions(t), [t]);
  const requirementOptions = useMemo(() => serviceProfileRequirementOptions(t), [t]);
  const contactModeOptions = useMemo(() => serviceProfileContactModeOptions(t), [t]);
  const contactStrategyOptions = useMemo(
    () => [
      { value: "ORGANIZATION", label: readText(t, "workspace_feature_pages.service_profile.contact_strategy.organization", "Kasuta organisatsiooni põhikontakti") },
      { value: "CUSTOM", label: readText(t, "workspace_feature_pages.service_profile.contact_strategy.custom", "Määra teenusele eraldi kontakt") }
    ],
    [t]
  );
  const selectedSummaryLabel = readText(t, "workspace_feature_pages.service_profile.choice_summary.selected", "Valitud");
  const selectedSummaryEmptyLabel = readText(t, "workspace_feature_pages.service_profile.choice_summary.empty", "-");

  const applyLoadedProfile = useCallback((loadedProfile) => {
    setProfile(loadedProfile || null);
    setForm(createServiceProfileForm(loadedProfile || null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/service-provider/profile", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || readText(t, "workspace_feature_pages.service_profile.errors.load_failed", "Teenuseprofiili ei saanud laadida."));
        }
        if (!cancelled) {
          const loadedProfile = payload?.profile || null;
          applyLoadedProfile(loadedProfile);
        }
      } catch (loadError) {
        if (!cancelled) {
          setProfile(null);
          setError(loadError?.message || readText(t, "workspace_feature_pages.service_profile.errors.load_failed", "Teenuseprofiili ei saanud laadida."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [applyLoadedProfile, t]);

  const updateField = useCallback((field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }, []);
  const updateServiceItem = useCallback((index, field, value) => {
    setForm((current) => ({
      ...current,
      serviceItems: current.serviceItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    }));
  }, []);
  const updateServiceLocation = useCallback((index, field, value) => {
    setForm((current) => ({
      ...current,
      serviceLocations: current.serviceLocations.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    }));
  }, []);
  const addServiceLocation = useCallback(() => {
    setForm((current) => ({
      ...current,
      serviceLocations: [
        ...current.serviceLocations,
        createServiceProfileLocationForm(null, current.serviceLocations.length, current)
      ]
    }));
  }, []);
  const removeServiceLocation = useCallback((index) => {
    setForm((current) => {
      const removed = current.serviceLocations[index]?.clientId;
      return {
        ...current,
        serviceLocations: current.serviceLocations
          .filter((_, itemIndex) => itemIndex !== index)
          .map((item, itemIndex) => ({ ...item, sortOrder: itemIndex })),
        serviceItems: current.serviceItems.map((service) => ({
          ...service,
          locationIds: (service.locationIds || []).filter((id) => id !== removed)
        }))
      };
    });
  }, []);
  const updateServiceLocationAddressTyping = useCallback((index, value) => {
    setForm((current) => ({
      ...current,
      serviceLocations: current.serviceLocations.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, address: value, normalizedAddress: "", latitude: "", longitude: "", adsObjectId: "", geocodingProvider: "" }
          : item
      )
    }));
  }, []);
  const selectServiceLocationAddress = useCallback((index, suggestion) => {
    setForm((current) => ({
      ...current,
      serviceLocations: current.serviceLocations.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              address: suggestion.normalizedAddress || suggestion.label || item.address,
              normalizedAddress: suggestion.normalizedAddress || suggestion.label || item.address,
              latitude: suggestion.latitude ?? "",
              longitude: suggestion.longitude ?? "",
              adsObjectId: suggestion.adsObjectId || "",
              geocodingProvider: suggestion.provider || "maaruum"
            }
          : item
      )
    }));
  }, []);
  const addServiceItem = useCallback(() => {
    setForm((current) => ({
      ...current,
      serviceItems: [
        ...current.serviceItems,
        createServiceProfileServiceForm(null, current.serviceItems.length, current)
      ]
    }));
  }, []);
  const removeServiceItem = useCallback((index) => {
    setForm((current) => ({
      ...current,
      serviceItems: current.serviceItems
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, sortOrder: itemIndex }))
    }));
  }, []);
  async function confirmServiceAvailability(service) {
    if (!service?.id || !service?.availabilityFingerprint || confirmingServiceId) return;
    setConfirmingServiceId(service.id);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`/api/service-provider/profile/services/${encodeURIComponent(service.id)}/availability-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: service.availabilityFingerprint })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 409) {
        const freshResponse = await fetch("/api/service-provider/profile", { cache: "no-store" });
        const freshPayload = await freshResponse.json().catch(() => ({}));
        if (freshResponse.ok) applyLoadedProfile(freshPayload?.profile || null);
        throw new Error(readText(t, "workspace_feature_pages.service_profile.errors.availability_conflict", "Kättesaadavuse info muutus vahepeal. Laadisin värske seisu; vaata see üle ja kinnita uuesti."));
      }
      if (!response.ok) {
        throw new Error(payload?.message || readText(t, "workspace_feature_pages.service_profile.errors.availability_confirmation_failed", "Kättesaadavust ei saanud kinnitada."));
      }
      applyLoadedProfile(payload?.profile || null);
      setNotice(readText(t, "workspace_feature_pages.service_profile.availability.confirmed", "Kättesaadavuse info kinnitati."));
    } catch (confirmationError) {
      setError(confirmationError?.message || readText(t, "workspace_feature_pages.service_profile.errors.availability_confirmation_failed", "Kättesaadavust ei saanud kinnitada."));
    } finally {
      setConfirmingServiceId("");
    }
  }
  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setNotice("");
    setError("");

    try {
      const primaryMapLocation =
        form.serviceLocations.find((item) =>
          item.mapVisible !== false &&
          String(item.address || item.normalizedAddress || "").trim()
        ) || form.serviceLocations.find((item) => String(item.address || item.normalizedAddress || "").trim()) || null;
      const response = await fetch("/api/service-provider/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...form,
          address: primaryMapLocation?.address || form.address,
          normalizedAddress: primaryMapLocation?.normalizedAddress || form.normalizedAddress,
          latitude: primaryMapLocation?.latitude || form.latitude,
          longitude: primaryMapLocation?.longitude || form.longitude,
          adsObjectId: primaryMapLocation?.adsObjectId || form.adsObjectId,
          geocodingProvider: primaryMapLocation?.geocodingProvider || form.geocodingProvider,
          county: primaryMapLocation?.county || form.county,
          services: [],
          serviceCategories: [],
          targetGroups: [],
          serviceAreaMunicipalityIds: splitList(form.serviceAreaMunicipalityIds),
          languages: [],
          serviceLocations: form.serviceLocations
            .map((item, index) => ({
              ...item,
              status: form.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
              sortOrder: index
            }))
            .filter((item) => String(item.address || item.normalizedAddress || item.label || "").trim()),
          serviceItems: form.serviceItems
            .map((item, index) => {
              const categories = splitList(item.categories);
              return {
                ...item,
                category: categories[0] || "",
                contactName: item.contactStrategy === "CUSTOM" ? item.contactName : "",
                phone: item.contactStrategy === "CUSTOM" ? item.phone : "",
                email: item.contactStrategy === "CUSTOM" ? item.email : "",
                website: item.contactStrategy === "CUSTOM" ? item.website : "",
                categories,
                ageGroups: splitList(item.ageGroups),
                targetGroups: splitList(item.targetGroups),
                requesterRoles: splitList(item.requesterRoles),
                needTags: splitList(item.needTags),
                lifeDomains: splitList(item.lifeDomains),
                deliveryModes: splitList(item.deliveryModes),
                municipalityIds: splitList(item.municipalityIds),
                serviceLanguages: splitList(item.serviceLanguages),
                inquiryLanguages: splitList(item.inquiryLanguages),
                communicationSupport: splitList(item.communicationSupport),
                locationIds: Array.isArray(item.locationIds) ? item.locationIds : [],
                status: form.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
                sortOrder: index
              };
            })
            .filter((item) => String(item.name || "").trim())
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || readText(t, "workspace_feature_pages.service_profile.errors.save_failed", "Teenuseprofiili ei saanud salvestada."));
      }
      const savedProfile = payload?.profile || null;
      applyLoadedProfile(savedProfile);
      setNotice(readText(t, "workspace_feature_pages.service_profile.save_success", "Teenuseprofiil salvestati."));
    } catch (saveError) {
      setError(saveError?.message || readText(t, "workspace_feature_pages.service_profile.errors.save_failed", "Teenuseprofiili ei saanud salvestada."));
    } finally {
      setSaving(false);
    }
  }

  const mapEntry = profile?.serviceMapEntry || null;
  const saveLabel = saving
    ? readText(t, "workspace_feature_pages.service_profile.actions.saving", "Salvestan...")
    : readText(t, "workspace_feature_pages.service_profile.actions.save", "Salvesta muudatused");
  const realServiceLocations = form.serviceLocations.filter((location) =>
    String(location.label || location.address || location.normalizedAddress || "").trim()
  );
  const hasPublishableService = form.serviceItems.some((service) =>
    String(service.name || "").trim() &&
    service.mapVisible !== false &&
    String(service.status || form.status || "").toUpperCase() !== "HIDDEN"
  );
  const hasMappableLocation = form.serviceLocations.some((location) =>
    location.mapVisible !== false &&
    String(location.address || location.normalizedAddress || "").trim()
  );
  const hasContact = Boolean(String(form.email || form.phone || "").trim());
  const publishChecks = [
    {
      ok: form.status === "PUBLISHED",
      text: form.status === "PUBLISHED"
        ? readText(t, "workspace_feature_pages.service_profile.publish_checks.status_published", "Profiili staatus on avaldatud.")
        : readText(t, "workspace_feature_pages.service_profile.publish_checks.status_not_published", "Muuda profiili staatus avaldatuks, kui soovid seda avalikus vaates kuvada.")
    },
    {
      ok: form.mapVisible,
      text: form.mapVisible
        ? readText(t, "workspace_feature_pages.service_profile.publish_checks.map_visible", "Profiil on teenusekaardil nähtavaks märgitud.")
        : readText(t, "workspace_feature_pages.service_profile.publish_checks.map_hidden", "Teenusekaardi nähtavus on välja lülitatud.")
    },
    {
      ok: hasPublishableService,
      text: hasPublishableService
        ? readText(t, "workspace_feature_pages.service_profile.publish_checks.service_ready", "Vähemalt üks teenus on avaldamiseks olemas.")
        : readText(t, "workspace_feature_pages.service_profile.publish_checks.service_missing", "Lisa vähemalt üks avaldatav teenus.")
    },
    {
      ok: hasMappableLocation,
      text: hasMappableLocation
        ? readText(t, "workspace_feature_pages.service_profile.publish_checks.location_ready", "Vähemalt üks teeninduskoht on kaardil nähtav ja aadressiga.")
        : readText(t, "workspace_feature_pages.service_profile.publish_checks.location_missing", "Lisa teeninduskoht koos aadressiga, kui soovid kaardimarkerit.")
    },
    {
      ok: hasContact,
      text: hasContact
        ? readText(t, "workspace_feature_pages.service_profile.publish_checks.contact_ready", "Üldine e-post või telefon on olemas.")
        : readText(t, "workspace_feature_pages.service_profile.publish_checks.contact_missing", "Lisa üldine e-post või telefon.")
    },
    {
      ok: form.assistantRecommendationAllowed,
      text: form.assistantRecommendationAllowed
        ? readText(t, "workspace_feature_pages.service_profile.publish_checks.assistant_allowed", "Assistent võib avaldatud teenuseid soovitada.")
        : readText(t, "workspace_feature_pages.service_profile.publish_checks.assistant_blocked", "Assistent ei soovita neid teenuseid enne eraldi loa andmist.")
    }
  ];

  return (
    <form onSubmit={handleSubmit}>
      {loading ? (
        <p className={bodyTextClassName}>{readText(t, "workspace_feature_pages.service_profile.loading", "Teenuseprofiili laadimine...")}</p>
      ) : null}
      {error ? (
        <p>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p>
          {notice}
        </p>
      ) : null}

      <ServiceProfileSection title={readText(t, "workspace_feature_pages.service_profile.sections.profile", "Teenuseosutaja põhainfo")}>
        <div>
          <Label>
            <span>{readText(t, "workspace_feature_pages.service_profile.fields.organization", "Organisatsiooni nimi")}</span>
            <ServiceProfileInput value={form.organizationName} onChange={(event) => updateField("organizationName", event.target.value)} />
          </Label>
          <Label>
            <span>{readText(t, "workspace_feature_pages.service_profile.fields.organization_type", "Organisatsiooni tüüp")}</span>
            <ServiceProfileDropdown
              ariaLabel={readText(t, "workspace_feature_pages.service_profile.fields.organization_type", "Organisatsiooni tüüp")}
              value={form.organizationType}
              onChange={(nextValue) => updateField("organizationType", nextValue)}
              options={organizationTypeOptions}
            />
          </Label>
          <Label>
            <span>{readText(t, "workspace_feature_pages.service_profile.fields.registry_code", "Registrikood")}</span>
            <ServiceProfileInput value={form.registryCode} onChange={(event) => updateField("registryCode", event.target.value)} />
          </Label>
        </div>
        <Label>
          <span>{readText(t, "workspace_feature_pages.service_profile.fields.short_description", "Lühikirjeldus")}</span>
          <ServiceProfileTextarea
            value={form.shortDescription}
            onChange={(event) => updateField("shortDescription", event.target.value)}
          />
        </Label>
        <Label>
          <span>{readText(t, "workspace_feature_pages.service_profile.fields.long_description", "Pikem kirjeldus")}</span>
          <ServiceProfileTextarea
            value={form.longDescription}
            onChange={(event) => updateField("longDescription", event.target.value)}
          />
        </Label>
        <div>
          <Label>
            <span>{readText(t, "workspace_feature_pages.service_profile.fields.website", "Veebileht")}</span>
            <ServiceProfileInput value={form.website} onChange={(event) => updateField("website", event.target.value)} />
          </Label>
          <Label>
            <span>{readText(t, "workspace_feature_pages.service_profile.fields.email", "Üldine e-post")}</span>
            <ServiceProfileInput type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
          </Label>
          <Label>
            <span>{readText(t, "workspace_feature_pages.service_profile.fields.phone", "Üldtelefon")}</span>
            <ServiceProfileInput value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
          </Label>
          <Label>
            <span>{readText(t, "workspace_feature_pages.service_profile.fields.primary_contact_name", "Põhikontakt")}</span>
            <ServiceProfileInput value={form.primaryContactName} onChange={(event) => updateField("primaryContactName", event.target.value)} />
          </Label>
          <Label>
            <span>{readText(t, "workspace_feature_pages.service_profile.fields.service_area", "Üldine tegevuspiirkond")}</span>
            <ServiceProfileInput value={form.serviceArea} onChange={(event) => updateField("serviceArea", event.target.value)} />
          </Label>
          <Label>
            <span>{readText(t, "workspace_feature_pages.service_profile.fields.municipalities", "KOV-id või piirkonnad")}</span>
            <ServiceProfileInput value={form.serviceAreaMunicipalityIds} onChange={(event) => updateField("serviceAreaMunicipalityIds", event.target.value)} />
          </Label>
          <Label>
            <span>{readText(t, "workspace_feature_pages.service_profile.fields.county", "Maakond")}</span>
            <ServiceProfileInput value={form.county} onChange={(event) => updateField("county", event.target.value)} />
          </Label>
          <Label>
            <span>{readText(t, "workspace_feature_pages.service_profile.fields.accessibility_info", "Üldine ligipääsetavuse info")}</span>
            <ServiceProfileTextarea
              value={form.accessibilityInfo}
              onChange={(event) => updateField("accessibilityInfo", event.target.value)}
            />
          </Label>
          <Label>
            <span>{readText(t, "workspace_feature_pages.service_profile.fields.general_accessibility_note", "Ligipääsetavuse täpsustus")}</span>
            <ServiceProfileTextarea
              value={form.generalAccessibilityNote}
              onChange={(event) => updateField("generalAccessibilityNote", event.target.value)}
            />
          </Label>
          <Label>
            <span>{readText(t, "workspace_feature_pages.service_profile.fields.status", "Profiili staatus")}</span>
            <ServiceProfileDropdown
              ariaLabel={readText(t, "workspace_feature_pages.service_profile.fields.status", "Profiili staatus")}
              value={form.status}
              onChange={(nextValue) => updateField("status", nextValue)}
              options={statusOptions}
            />
          </Label>
        </div>
      </ServiceProfileSection>

      <ServiceProfileSection title={readText(t, "workspace_feature_pages.service_profile.sections.services", "Teenused")}>
        <ServiceProfileFieldHelp>
          {readText(
            t,
            "workspace_feature_pages.service_profile.field_help.services",
            "Kirjelda siin konkreetseid teenuseid. Kategooriad, sihtrühmad, keeled ja pöördumise tingimused salvestuvad teenuse tasemele."
          )}
        </ServiceProfileFieldHelp>
        <div>
          <div>
          {form.serviceItems.length ? form.serviceItems.map((service, index) => (
            <div key={`service-item-${index}`}>
              <div>
                <p>
                  {readText(t, "workspace_feature_pages.service_profile.service_items.item_title", "Teenus")} {index + 1}
                </p>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => removeServiceItem(index)}
                >
                  {readText(t, "workspace_feature_pages.service_profile.service_items.remove", "Eemalda")}
                </Button>
              </div>
              <Label>
                <span>{readText(t, "workspace_feature_pages.service_profile.service_items.name", "Teenuse nimi")}</span>
                <ServiceProfileInput value={service.name} onChange={(event) => updateServiceItem(index, "name", event.target.value)} />
              </Label>
              <Label>
                <span>{readText(t, "workspace_feature_pages.service_profile.service_items.description", "Kirjeldus")}</span>
                <ServiceProfileTextarea
                  value={service.description}
                  onChange={(event) => updateServiceItem(index, "description", event.target.value)}
                />
              </Label>
              <div>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.long_description", "Pikem kirjeldus")}</span>
                  <ServiceProfileTextarea
                    value={service.longDescription}
                    onChange={(event) => updateServiceItem(index, "longDescription", event.target.value)}
                  />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.includes_text", "Mida teenus sisaldab")}</span>
                  <ServiceProfileTextarea
                    value={service.includesText}
                    onChange={(event) => updateServiceItem(index, "includesText", event.target.value)}
                  />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.excludes_text", "Mida teenus ei sisalda")}</span>
                  <ServiceProfileTextarea
                    value={service.excludesText}
                    onChange={(event) => updateServiceItem(index, "excludesText", event.target.value)}
                  />
                </Label>
              </div>
              <div>
                <ServiceProfileChipField
                  label={readText(t, "workspace_feature_pages.service_profile.service_items.categories", "Teenuse kategooriad")}
                  value={service.categories}
                  options={categoryOptions}
                  onChange={(nextValue) => updateServiceItem(index, "categories", nextValue)}
                  selectedLabel={selectedSummaryLabel}
                  selectedEmptyLabel={selectedSummaryEmptyLabel}
                />
                <ServiceProfileChipField
                  label={readText(t, "workspace_feature_pages.service_profile.service_items.target_groups", "Sihtrühmad")}
                  value={service.targetGroups}
                  options={targetGroupOptions}
                  onChange={(nextValue) => updateServiceItem(index, "targetGroups", nextValue)}
                  selectedLabel={selectedSummaryLabel}
                  selectedEmptyLabel={selectedSummaryEmptyLabel}
                />
                <ServiceProfileChipField
                  label={readText(t, "workspace_feature_pages.service_profile.service_items.age_groups", "Vanusegrupid")}
                  value={service.ageGroups}
                  options={ageGroupOptions}
                  onChange={(nextValue) => updateServiceItem(index, "ageGroups", nextValue)}
                  selectedLabel={selectedSummaryLabel}
                  selectedEmptyLabel={selectedSummaryEmptyLabel}
                />
                <ServiceProfileChipField
                  label={readText(t, "workspace_feature_pages.service_profile.service_items.requester_roles", "Kes võib pöörduda")}
                  value={service.requesterRoles}
                  options={requesterRoleOptions}
                  onChange={(nextValue) => updateServiceItem(index, "requesterRoles", nextValue)}
                  selectedLabel={selectedSummaryLabel}
                  selectedEmptyLabel={selectedSummaryEmptyLabel}
                />
                <ServiceProfileChipField
                  label={readText(t, "workspace_feature_pages.service_profile.service_items.need_tags", "Vajadused ja olukorrad")}
                  value={service.needTags}
                  options={needTagOptions}
                  onChange={(nextValue) => updateServiceItem(index, "needTags", nextValue)}
                  selectedLabel={selectedSummaryLabel}
                  selectedEmptyLabel={selectedSummaryEmptyLabel}
                />
                <ServiceProfileChipField
                  label={readText(t, "workspace_feature_pages.service_profile.service_items.life_domains", "Eluvaldkonnad")}
                  value={service.lifeDomains}
                  options={lifeDomainOptions}
                  onChange={(nextValue) => updateServiceItem(index, "lifeDomains", nextValue)}
                  selectedLabel={selectedSummaryLabel}
                  selectedEmptyLabel={selectedSummaryEmptyLabel}
                />
                <ServiceProfileChipField
                  label={readText(t, "workspace_feature_pages.service_profile.service_items.delivery_modes", "Osutamise viisid")}
                  value={service.deliveryModes}
                  options={deliveryModeOptions}
                  onChange={(nextValue) => updateServiceItem(index, "deliveryModes", nextValue)}
                  selectedLabel={selectedSummaryLabel}
                  selectedEmptyLabel={selectedSummaryEmptyLabel}
                />
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.service_area", "Teeninduspiirkond")}</span>
                  <ServiceProfileTextarea
                    value={service.serviceArea}
                    onChange={(event) => updateServiceItem(index, "serviceArea", event.target.value)}
                  />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.service_area_type", "Piirkonna tüüp")}</span>
                  <ServiceProfileDropdown
                    ariaLabel={readText(t, "workspace_feature_pages.service_profile.service_items.service_area_type", "Piirkonna tüüp")}
                    value={service.serviceAreaType}
                    onChange={(nextValue) => updateServiceItem(index, "serviceAreaType", nextValue)}
                    options={serviceAreaTypeOptions}
                  />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.fields.county", "Maakond")}</span>
                  <ServiceProfileInput value={service.county} onChange={(event) => updateServiceItem(index, "county", event.target.value)} />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.municipality_ids", "KOV-id või piirkonnad")}</span>
                  <ServiceProfileInput value={service.municipalityIds} onChange={(event) => updateServiceItem(index, "municipalityIds", event.target.value)} />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.area_description", "Piirkonna täpsustus")}</span>
                  <ServiceProfileTextarea
                    value={service.areaDescription}
                    onChange={(event) => updateServiceItem(index, "areaDescription", event.target.value)}
                  />
                </Label>
              </div>
              {realServiceLocations.length ? (
                <div>
                  <p>
                    {readText(t, "workspace_feature_pages.service_profile.service_items.locations", "Teeninduskohad")}
                  </p>
                  <div>
                    {realServiceLocations.map((location, locationIndex) => {
                      const locationId = location.clientId || `location-${locationIndex + 1}`;
                      const checked = (service.locationIds || []).includes(locationId);
                      return (
                        <ServiceProfileLocationChoice
                          key={locationId}
                          checked={checked}
                          onChange={(nextChecked) => {
                            const currentIds = new Set(service.locationIds || []);
                            if (nextChecked) currentIds.add(locationId);
                            else currentIds.delete(locationId);
                            updateServiceItem(index, "locationIds", [...currentIds]);
                          }}
                        >
                          {location.label || location.normalizedAddress || location.address}
                        </ServiceProfileLocationChoice>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className={bodyTextClassName}>
                  {readText(t, "workspace_feature_pages.service_profile.service_items.location_empty_hint", "Lisa esmalt teeninduskoht, kui soovid teenust kaardil kuvada. Teenus võib olla ka ilma füüsilise teeninduskohata, kui osutamise viis on veebis, telefoni teel, inimese kodus või piirkondlikult.")}
                </p>
              )}
              <div>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.fee_type", "Hinnastus")}</span>
                  <ServiceProfileDropdown
                    ariaLabel={readText(t, "workspace_feature_pages.service_profile.service_items.fee_type", "Hinnastus")}
                    value={service.feeType}
                    onChange={(nextValue) => updateServiceItem(index, "feeType", nextValue)}
                    options={feeOptions}
                  />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.price_description", "Hinna täpsustus")}</span>
                  <ServiceProfileInput value={service.priceDescription} onChange={(event) => updateServiceItem(index, "priceDescription", event.target.value)} />
                </Label>
              </div>
              <div>
                <ServiceProfileChipField
                  label={readText(t, "workspace_feature_pages.service_profile.service_items.service_languages", "Teenuse osutamise keeled")}
                  value={service.serviceLanguages}
                  options={languageOptions}
                  onChange={(nextValue) => updateServiceItem(index, "serviceLanguages", nextValue)}
                  selectedLabel={selectedSummaryLabel}
                  selectedEmptyLabel={selectedSummaryEmptyLabel}
                />
                <ServiceProfileChipField
                  label={readText(t, "workspace_feature_pages.service_profile.service_items.inquiry_languages", "Pöördumise keeled")}
                  value={service.inquiryLanguages}
                  options={languageOptions}
                  onChange={(nextValue) => updateServiceItem(index, "inquiryLanguages", nextValue)}
                  selectedLabel={selectedSummaryLabel}
                  selectedEmptyLabel={selectedSummaryEmptyLabel}
                />
                <ServiceProfileChipField
                  label={readText(t, "workspace_feature_pages.service_profile.service_items.communication_support", "Suhtlustugi")}
                  value={service.communicationSupport}
                  options={communicationSupportOptions}
                  onChange={(nextValue) => updateServiceItem(index, "communicationSupport", nextValue)}
                  selectedLabel={selectedSummaryLabel}
                  selectedEmptyLabel={selectedSummaryEmptyLabel}
                />
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.availability_status", "Kättesaadavus")}</span>
                  <ServiceProfileDropdown
                    ariaLabel={readText(t, "workspace_feature_pages.service_profile.service_items.availability_status", "Kättesaadavus")}
                    value={service.availabilityStatus}
                    onChange={(nextValue) => updateServiceItem(index, "availabilityStatus", nextValue)}
                    options={availabilityOptions.some((option) => option.value === service.availabilityStatus) || !service.availabilityStatus
                      ? availabilityOptions
                      : [
                          ...availabilityOptions,
                          {
                            value: service.availabilityStatus,
                            label: `${readText(t, "workspace_feature_pages.service_profile.availability.legacy", "Varasem kinnitamata väärtus")}: ${service.availabilityStatus}`
                          }
                        ]}
                  />
                </Label>
                <Label>
                  <span>{service.availabilityStatus === "waitlist"
                    ? readText(t, "workspace_feature_pages.service_profile.availability.wait_description", "Ligikaudne ooteaeg")
                    : readText(t, "workspace_feature_pages.service_profile.service_items.availability_description", "Kättesaadavuse täpsustus")}</span>
                  <ServiceProfileTextarea
                    value={service.availabilityDescription}
                    onChange={(event) => updateServiceItem(index, "availabilityDescription", event.target.value)}
                  />
                </Label>
                {(() => {
                  const savedService = (profile?.serviceItems || []).find((item) => item.id === service.id);
                  const presentation = serviceAvailabilityPresentation(t, savedService?.availability || service.availability);
                  const availabilityChanged = Boolean(savedService) && (
                    savedService.availabilityStatus !== service.availabilityStatus ||
                    String(savedService.availabilityDescription || "") !== String(service.availabilityDescription || "")
                  );
                  return (
                    <div className="service-profile-availability" data-tone={presentation.tone} role="status">
                      <p className="service-profile-availability__status">
                        <span aria-hidden="true">{presentation.icon}</span> {presentation.label}
                      </p>
                      <p>{presentation.ageText}</p>
                      {presentation.warning ? <p>{presentation.warning}</p> : null}
                      {availabilityChanged ? (
                        <p>{readText(t, "workspace_feature_pages.service_profile.availability.save_before_confirm", "Salvesta muudetud olek või ooteaeg enne eraldi kinnitamist.")}</p>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        disabled={!savedService?.availabilityFingerprint || availabilityChanged || Boolean(confirmingServiceId)}
                        onClick={() => confirmServiceAvailability(savedService)}
                      >
                        {confirmingServiceId === service.id
                          ? readText(t, "workspace_feature_pages.service_profile.availability.confirming", "Kinnitan...")
                          : readText(t, "workspace_feature_pages.service_profile.availability.confirm", "Kinnitan, et info kehtib")}
                      </Button>
                    </div>
                  );
                })()}
              </div>
              <div>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.direct_contact_allowed", "Otsekontakt lubatud")}</span>
                  <ServiceProfileDropdown
                    ariaLabel={readText(t, "workspace_feature_pages.service_profile.service_items.direct_contact_allowed", "Otsekontakt lubatud")}
                    value={service.directContactAllowed}
                    onChange={(nextValue) => updateServiceItem(index, "directContactAllowed", nextValue)}
                    options={requirementOptions}
                  />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.requires_kov_assessment", "Vajab KOV hindamist")}</span>
                  <ServiceProfileDropdown
                    ariaLabel={readText(t, "workspace_feature_pages.service_profile.service_items.requires_kov_assessment", "Vajab KOV hindamist")}
                    value={service.requiresKovAssessment}
                    onChange={(nextValue) => updateServiceItem(index, "requiresKovAssessment", nextValue)}
                    options={requirementOptions}
                  />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.requires_kov_decision", "Vajab KOV otsust")}</span>
                  <ServiceProfileDropdown
                    ariaLabel={readText(t, "workspace_feature_pages.service_profile.service_items.requires_kov_decision", "Vajab KOV otsust")}
                    value={service.requiresKovDecision}
                    onChange={(nextValue) => updateServiceItem(index, "requiresKovDecision", nextValue)}
                    options={requirementOptions}
                  />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.requires_ska_referral", "Vajab SKA suunamist")}</span>
                  <ServiceProfileDropdown
                    ariaLabel={readText(t, "workspace_feature_pages.service_profile.service_items.requires_ska_referral", "Vajab SKA suunamist")}
                    value={service.requiresSkaReferral}
                    onChange={(nextValue) => updateServiceItem(index, "requiresSkaReferral", nextValue)}
                    options={requirementOptions}
                  />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.requires_specialist_referral", "Vajab spetsialisti suunamist")}</span>
                  <ServiceProfileDropdown
                    ariaLabel={readText(t, "workspace_feature_pages.service_profile.service_items.requires_specialist_referral", "Vajab spetsialisti suunamist")}
                    value={service.requiresSpecialistReferral}
                    onChange={(nextValue) => updateServiceItem(index, "requiresSpecialistReferral", nextValue)}
                    options={requirementOptions}
                  />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.contact_mode", "Kontaktiviis")}</span>
                  <ServiceProfileDropdown
                    ariaLabel={readText(t, "workspace_feature_pages.service_profile.service_items.contact_mode", "Kontaktiviis")}
                    value={service.contactMode}
                    onChange={(nextValue) => updateServiceItem(index, "contactMode", nextValue)}
                    options={contactModeOptions}
                  />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.required_documents_note", "Vajalikud dokumendid")}</span>
                  <ServiceProfileTextarea
                    value={service.requiredDocumentsNote}
                    onChange={(event) => updateServiceItem(index, "requiredDocumentsNote", event.target.value)}
                  />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.referral_notes", "Pöördumise tingimused")}</span>
                  <ServiceProfileTextarea
                    value={service.referralNotes}
                    onChange={(event) => updateServiceItem(index, "referralNotes", event.target.value)}
                  />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.service_items.additional_info", "Lisainfo")}</span>
                  <ServiceProfileTextarea
                    value={service.additionalInfo}
                    onChange={(event) => updateServiceItem(index, "additionalInfo", event.target.value)}
                  />
                </Label>
              </div>
              <div>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.contact_strategy.label", "Teenuse kontakt")}</span>
                  <ServiceProfileDropdown
                    ariaLabel={readText(t, "workspace_feature_pages.service_profile.contact_strategy.label", "Teenuse kontakt")}
                    value={service.contactStrategy}
                    onChange={(nextValue) => {
                      updateServiceItem(index, "contactStrategy", nextValue);
                      if (nextValue === "ORGANIZATION") {
                        updateServiceItem(index, "contactName", "");
                        updateServiceItem(index, "phone", "");
                        updateServiceItem(index, "email", "");
                        updateServiceItem(index, "website", "");
                      }
                    }}
                    options={contactStrategyOptions}
                  />
                </Label>
                {service.contactStrategy === "CUSTOM" ? (
                  <>
                    <Label>
                      <span>{readText(t, "workspace_feature_pages.service_profile.service_items.contact_name", "Kontaktisik")}</span>
                      <ServiceProfileInput value={service.contactName} onChange={(event) => updateServiceItem(index, "contactName", event.target.value)} />
                    </Label>
                    <Label>
                      <span>{readText(t, "workspace_feature_pages.service_profile.fields.phone", "Telefon")}</span>
                      <ServiceProfileInput value={service.phone} onChange={(event) => updateServiceItem(index, "phone", event.target.value)} />
                    </Label>
                    <Label>
                      <span>{readText(t, "workspace_feature_pages.service_profile.fields.email", "E-post")}</span>
                      <ServiceProfileInput type="email" value={service.email} onChange={(event) => updateServiceItem(index, "email", event.target.value)} />
                    </Label>
                  </>
                ) : (
                  <ServiceProfileFieldHelp>
                    {readText(t, "workspace_feature_pages.service_profile.contact_strategy.inherited_help", "Eelpöördumise kontaktivalik kasutab järjekorda: teenuse kontakt, teeninduskoha kontakt, organisatsiooni põhikontakt. Selle teenuse puhul kasutatakse praegu organisatsiooni põhikontakti.")}
                  </ServiceProfileFieldHelp>
                )}
              </div>
              <div>
                <ToggleRow
                  checked={service.mapVisible}
                  onChange={(value) => updateServiceItem(index, "mapVisible", value)}
                  title={readText(t, "workspace_feature_pages.service_profile.service_items.visible_in_profile", "Nähtav kaardimarkeri all")}
                />
                <ToggleRow
                  checked={service.acceptsPlatformPreInquiries}
                  onChange={(value) => updateServiceItem(index, "acceptsPlatformPreInquiries", value)}
                  title={readText(t, "workspace_feature_pages.service_profile.pre_inquiries.accepts_platform", "Võtab vastu SotsiaalAI siseseid eelpöördumisi")}
                />
                <ToggleRow
                  checked={service.acceptsEmailPreInquiries}
                  onChange={(value) => updateServiceItem(index, "acceptsEmailPreInquiries", value)}
                  title={readText(t, "workspace_feature_pages.service_profile.pre_inquiries.accepts_email", "Lubab e-kirja koostamist")}
                />
              </div>
            </div>
          )) : (
            <p className={bodyTextClassName}>
              {readText(t, "workspace_feature_pages.service_profile.service_items.empty", "Eraldi teenuseid ei ole veel lisatud.")}
            </p>
          )}
          <Button type="button" variant="primary" onClick={addServiceItem}>
            {readText(t, "workspace_feature_pages.service_profile.service_items.add", "Lisa teenus")}
          </Button>
        </div>
        </div>
      </ServiceProfileSection>

      <ServiceProfileSection title={readText(t, "workspace_feature_pages.service_profile.sections.locations", "Teeninduskohad")}>
        <ServiceProfileFieldHelp>
          {readText(
            t,
            "workspace_feature_pages.service_profile.field_help.locations",
            "Teeninduskoht on kaardimarkeri alus. Lisa siia ainult päris teeninduskohad nime ja aadressiga."
          )}
        </ServiceProfileFieldHelp>
        <div>
          {form.serviceLocations.length ? form.serviceLocations.map((location, index) => (
            <div key={location.clientId || `location-${index}`}>
              <div>
                <p>
                  {location.label || location.normalizedAddress || location.address || readText(t, "workspace_feature_pages.service_profile.locations.new_item_title", "Uus teeninduskoht")}
                </p>
                <Button type="button" variant="danger" onClick={() => removeServiceLocation(index)}>
                  {readText(t, "workspace_feature_pages.service_profile.locations.remove", "Eemalda")}
                </Button>
              </div>
              <div>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.locations.label", "Nimetus")}</span>
                  <ServiceProfileInput value={location.label} onChange={(event) => updateServiceLocation(index, "label", event.target.value)} />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.locations.address", "Aadress")}</span>
                  <ServiceProfileAddressInput
                    t={t}
                    form={{ ...form, ...location, county: location.county || form.county }}
                    onTyping={(value) => updateServiceLocationAddressTyping(index, value)}
                    onSelect={(suggestion) => selectServiceLocationAddress(index, suggestion)}
                  />
                </Label>
              </div>
              <div>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.fields.phone", "Telefon")}</span>
                  <ServiceProfileInput value={location.phone} onChange={(event) => updateServiceLocation(index, "phone", event.target.value)} />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.fields.email", "E-post")}</span>
                  <ServiceProfileInput type="email" value={location.email} onChange={(event) => updateServiceLocation(index, "email", event.target.value)} />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.fields.website", "Veebileht")}</span>
                  <ServiceProfileInput value={location.website} onChange={(event) => updateServiceLocation(index, "website", event.target.value)} />
                </Label>
                <Label>
                  <span>{readText(t, "workspace_feature_pages.service_profile.locations.opening_hours", "Lahtiolekuajad")}</span>
                  <ServiceProfileTextarea
                    value={location.openingHours}
                    onChange={(event) => updateServiceLocation(index, "openingHours", event.target.value)}
                  />
                </Label>
              </div>
              <ToggleRow
                checked={location.mapVisible}
                onChange={(value) => updateServiceLocation(index, "mapVisible", value)}
                title={readText(t, "workspace_feature_pages.service_profile.locations.visible_on_map", "Näita teenusekaardil")}
              />
            </div>
          )) : (
            <p className={bodyTextClassName}>
              {readText(t, "workspace_feature_pages.service_profile.locations.empty", "Teeninduskohti ei ole veel lisatud.")}
            </p>
          )}
          <Button type="button" variant="primary" onClick={addServiceLocation}>
            {readText(t, "workspace_feature_pages.service_profile.locations.add", "Lisa teeninduskoht")}
          </Button>
        </div>
      </ServiceProfileSection>

      <ServiceProfileSection title={readText(t, "workspace_feature_pages.service_profile.sections.contact", "Kontakt ja eelpöördumised")}>
        <ServiceProfileFieldHelp>
          {readText(t, "workspace_feature_pages.service_profile.contact_strategy.priority_help", "Eelpöördumise kontaktivalik kasutab järjekorda: teenuse kontakt, teeninduskoha kontakt, organisatsiooni põhikontakt. Põhikontakti andmed sisesta organisatsiooni põhiinfos.")}
        </ServiceProfileFieldHelp>
        <div>
          <ToggleRow
            checked={form.acceptsPlatformPreInquiries}
            onChange={(value) => updateField("acceptsPlatformPreInquiries", value)}
            title={readText(t, "workspace_feature_pages.service_profile.pre_inquiries.accepts_platform", "Võtab vastu SotsiaalAI siseseid eelpöördumisi")}
            body={readText(t, "workspace_feature_pages.service_profile.pre_inquiries.platform_help", "Inimene saab saata sisemise eelpöördumise selle teenuseosutaja kontole.")}
          />
          <ToggleRow
            checked={form.acceptsEmailPreInquiries}
            onChange={(value) => updateField("acceptsEmailPreInquiries", value)}
            title={readText(t, "workspace_feature_pages.service_profile.pre_inquiries.accepts_email", "Lubab e-kirja koostamist")}
            body={readText(t, "workspace_feature_pages.service_profile.pre_inquiries.email_help", "Kasutaja saab koostada e-kirja eelvaate, mille ta vaatab enne saatmist üle.")}
          />
        </div>
      </ServiceProfileSection>

      <ServiceProfileSection title={readText(t, "workspace_feature_pages.service_profile.sections.publish", "Avaldamine")}>
        <div>
          <div>
            <ToggleRow
              checked={form.mapVisible}
              onChange={(value) => updateField("mapVisible", value)}
              title={readText(t, "workspace_feature_pages.service_profile.visibility.visible", "Avalda teenusekaardil")}
              body={readText(
                t,
                "workspace_feature_pages.service_profile.visibility.visible_help",
                "Teenusekaart kuvab profiili ainult siis, kui staatus on avaldatud ja vähemalt ühel kaardil nähtaval teeninduskohal on ametlik aadressivaste."
              )}
            />
            <ToggleRow
              checked={form.assistantRecommendationAllowed}
              onChange={(value) => updateField("assistantRecommendationAllowed", value)}
              title={readText(t, "workspace_feature_pages.service_profile.pre_inquiries.assistant_recommendation_allowed", "Luba assistendil avaldatud teenuseid soovitada")}
              body={readText(t, "workspace_feature_pages.service_profile.pre_inquiries.assistant_recommendation_help", "Avaldatud teenusekirjed lisatakse AI teadmuskihile ainult selle valiku korral.")}
            />
            <p className={bodyTextClassName}>
              {readText(
                t,
                "workspace_feature_pages.service_profile.publish_help",
                "Avaldamata ja ülevaatusel profiil ei ilmu teenusekaardile. Avaldatud profiil vajab markeriks ka usaldusväärset aadressivastet."
              )}
            </p>
            <div aria-label={readText(t, "workspace_feature_pages.service_profile.publish_checks.title", "Avaldamise kontroll")}>
              <p>
                {readText(t, "workspace_feature_pages.service_profile.publish_checks.title", "Avaldamise kontroll")}
              </p>
              {publishChecks.map((item) => (
                <p key={item.text}>
                  <span aria-hidden="true">{item.ok ? "✓" : "!"}</span>
                  <span>{item.text}</span>
                </p>
              ))}
            </div>
            <div>
              <p>
                {readText(t, "workspace_feature_pages.service_profile.map_status.title", "Aadressi seis")}
              </p>
              <p className={bodyTextClassName}>{serviceProfileMapStatusText(t, mapEntry)}</p>
              {mapEntry?.normalizedAddress || mapEntry?.address ? (
                <p className={bodyTextClassName}>{mapEntry.normalizedAddress || mapEntry.address}</p>
              ) : null}
            </div>
            <Button type="submit" disabled={loading || saving || !form.organizationName.trim()}>
              {saveLabel}
            </Button>
          </div>
        </div>
      </ServiceProfileSection>
    </form>
  );
}

export default function WorkspaceFeaturePage({ feature, embedded = false, onBack = null, hideHeader = false }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { data: session } = useSession();
  const {
    effectiveRole,
    isAdmin: effectiveRoleIsAdmin,
    isRoleResolved,
    refresh: refreshEffectiveRole
  } = useEffectiveRole();
  const isAdmin = Boolean(
    effectiveRoleIsAdmin ||
    session?.user?.isAdmin ||
    String(session?.user?.role || "").toUpperCase() === "ADMIN"
  );
  const [adminWorkspaceRole, setAdminWorkspaceRole] = useState("SOCIAL_WORKER");
  const [clientAuthoringRequested, setClientAuthoringRequested] = useState(false);
  const adminQueryRoleAppliedRef = useRef(false);
  const featureKey =
    feature === "service_map" || feature === "service_profile"
      ? feature
      : "pre_inquiries";

  useEffect(() => {
    setClientAuthoringRequested(
      featureKey === "pre_inquiries" && readRequestedWorkspaceRole() === "CLIENT"
    );
  }, [featureKey]);

  useEffect(() => {
    if (!isAdmin || !isRoleResolved) return;
    if (featureKey === "pre_inquiries") {
      const requestedRole = readRequestedWorkspaceRole();
      if (requestedRole) {
        if (!adminQueryRoleAppliedRef.current) {
          adminQueryRoleAppliedRef.current = true;
          setAdminWorkspaceRole(requestedRole);
        }
        return;
      }
    }
    setAdminWorkspaceRole(normalizeWorkspaceRole(effectiveRole));
  }, [effectiveRole, featureKey, isAdmin, isRoleResolved]);

  const handleAdminWorkspaceRoleChange = useCallback((nextRole) => {
    setAdminWorkspaceRole(normalizeWorkspaceRole(nextRole));
    refreshEffectiveRole();
  }, [refreshEffectiveRole]);

  const handleBack = useCallback(() => {
    if (typeof onBack === "function") {
      onBack();
      return;
    }
    if (typeof window === "undefined") {
      workspaceReturn(locale, router);
      return;
    }
    window.requestAnimationFrame(() => {
      workspaceReturn(locale, router);
    });
  }, [locale, onBack, router]);

  const title = readText(t, `workspace_feature_pages.${featureKey}.title`, "Workspace feature");
  const activeWorkspaceRole = isAdmin
    ? adminWorkspaceRole
    : clientAuthoringRequested
      ? "CLIENT"
      : normalizeWorkspaceRole(session?.user?.role);
  const showAdminRoleSelector = !embedded && isAdmin && (
    featureKey === "pre_inquiries"
  );
  const isServiceMap = featureKey === "service_map";
  const infoId = getWorkspaceFeatureInfoId(featureKey, activeWorkspaceRole);

  const content = (
    <>
      {showAdminRoleSelector ? (
        <AdminRoleSelector
          t={t}
          locale={locale}
          value={activeWorkspaceRole}
          onChange={handleAdminWorkspaceRoleChange}
        />
      ) : null}
      <div>
        <div>
          {!hideHeader ? (
            <SubpageHeader
              onBack={handleBack}
              backAriaLabel={readText(t, "workspace_feature_pages.back_to_workspace", "Back to workspace")}
              showBack={embedded || !isServiceMap}
              holdPressedVisualDisabled
              anchorBack={!embedded && isServiceMap}
              rightSlot={
                !embedded && isServiceMap ? null : (
                  <DashboardInfoTrigger
                    infoId={infoId}
                    title={title}
                  />
                )
              }
            >
              {title}
            </SubpageHeader>
          ) : null}
          {featureKey === "pre_inquiries" ? <PreInquiriesSurface t={t} locale={locale} activeRole={activeWorkspaceRole} isAdmin={isAdmin} currentUserId={session?.user?.id || ""} embedded={embedded} /> : null}
          {featureKey === "service_map" ? <ServiceMapSurface t={t} locale={locale} activeRole={activeWorkspaceRole} isAdmin={isAdmin} onRoleChange={handleAdminWorkspaceRoleChange} onBack={handleBack} /> : null}
          {featureKey === "service_profile" ? <ServiceProfileSurface t={t} /> : null}
        </div>
      </div>
    </>
  );

  if (embedded) return content;

  return (
    <section lang={locale}>
      {content}
    </section>
  );
}
