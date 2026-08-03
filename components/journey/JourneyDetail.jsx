"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import Form from "@/components/ui/Form";
import { localizePath } from "@/lib/localizePath";
import { buildServiceMapHandoff } from "@/lib/journey/serviceMapHandoff";
import { buildAssistiveDevicesHandoff } from "@/lib/journey/assistiveDevices";
import { buildHelpMediationHandoff } from "@/lib/journey/helpMediationHandoff";
import { buildHealthContactQuestionsDraft, hasHealthContactSignal } from "@/lib/journey/healthContact";
import { pushWithTransition } from "@/lib/routeTransition";

const PRIMARY_PATH_VALUES = Object.freeze([
  "SERVICE_MAP",
  "PRE_INQUIRY",
  "DOCUMENT",
  "HELP_REQUEST",
  "ROOM",
  "HEALTH_CONTACT",
  "COMBINED_SOCIAL_HEALTH",
  "GENERAL_SUPPORT",
  "UNKNOWN"
]);

function formatDate(value, locale = "et") {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function downloadJourneyText(journey, filename = "journey.txt") {
  const sections = [
    journey?.title,
    journey?.summary,
    (journey?.domains || []).join("\n"),
    (journey?.missingInfo || []).join("\n"),
    (journey?.suggestedActions || []).map((item) => typeof item === "string" ? item : item?.title).filter(Boolean).join("\n")
  ].filter(Boolean);
  const url = URL.createObjectURL(new Blob([sections.join("\n\n")], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function primaryPathLabel(t, value) {
  return t(`journey.primary_paths.${value || "UNKNOWN"}`, t("journey.primary_paths.UNKNOWN", "Not clear yet"));
}

function statusLabel(t, status) {
  const fallback = status === "ARCHIVED"
    ? "arhiveeritud"
    : status === "DRAFT"
      ? "info täpsustamisel"
      : "alustatud";
  return t(`journey.status.${status || "ACTIVE"}`, fallback);
}

function textToLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToText(value) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      return item?.title || "";
    })
    .filter(Boolean)
    .join("\n");
}

function actionsToText(value) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => item?.title || item)
    .filter(Boolean)
    .join("\n");
}

function textToActions(value) {
  return textToLines(value).map((title) => ({ title }));
}

function createFormState(journey) {
  return {
    title: journey?.title || "",
    summary: journey?.summary || "",
    primaryPath: journey?.primaryPath || "UNKNOWN",
    domains: arrayToText(journey?.domains),
    missingInfo: arrayToText(journey?.missingInfo),
    suggestedActions: actionsToText(journey?.suggestedActions)
  };
}

function readContextObject(context, key) {
  const value = context && typeof context === "object" && !Array.isArray(context)
    ? context[key]
    : null;
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readContextArray(context, key) {
  const value = context && typeof context === "object" && !Array.isArray(context)
    ? context[key]
    : null;
  return Array.isArray(value) ? value : [];
}

function normalizeDisplayItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : item?.title || item?.name || item?.label || item?.id || ""))
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function getJourneyLifeDomains(journey) {
  const domains = normalizeDisplayItems(readContextArray(journey?.context, "lifeDomains"));
  return domains.length ? domains : ["igapäevaelu toimingud", "võrgustik ja kõrvalabi"];
}

function hasMunicipalitySignal(journey, serviceMapHandoff) {
  if (serviceMapHandoff?.filters?.municipalityName) return true;
  const context = journey?.context && typeof journey.context === "object" && !Array.isArray(journey.context)
    ? journey.context
    : {};
  return Boolean(context.municipalityText || context.municipalityId || context.municipality || context.county || context.region);
}

function buildHelpOfferMatchApiHref(handoff) {
  if (!handoff?.hasPracticalNeed) return "";
  const params = new URLSearchParams();
  params.set("type", "HELP_OFFER");
  params.set("limit", "1");
  const keyword = handoff.taxonomy?.needTags?.[0] || handoff.categoryCode || "";
  if (keyword) params.set("q", keyword);
  if (handoff.municipalityName) params.set("municipalityName", handoff.municipalityName);
  return `/api/service-map/entries?${params.toString()}`;
}

function journeyActivityItems(journey, t, locale) {
  const contextItems = readContextArray(journey?.context, "activityLog")
    .map((item) => ({
      title: typeof item === "string" ? item : item?.title || "",
      date: typeof item === "object" ? item?.date || item?.createdAt || "" : ""
    }))
    .filter((item) => item.title);
  const base = [
    {
      title: t("journey.activity.created", "teekond loodud"),
      date: journey?.createdAt
    },
    {
      title: t("journey.activity.saved", "ülevaade salvestatud"),
      date: journey?.updatedAt
    }
  ];
  return [...base, ...contextItems].slice(0, 8).map((item) => ({
    ...item,
    dateLabel: formatDate(item.date, locale)
  }));
}

function createServiceContinuityState(journey) {
  const continuity = readContextObject(journey?.context, "serviceContinuity");
  return {
    serviceName: continuity.serviceName || "",
    currentProvider: continuity.currentProvider || "",
    municipality: continuity.municipality || "",
    hasExistingService: continuity.hasExistingService === false ? "NO" : continuity.hasExistingService === true ? "YES" : "",
    knownEndDate: continuity.knownEndDate === false ? "NO" : continuity.knownEndDate === true ? "YES" : "",
    endDate: continuity.endDate || "",
    hasDecisionOrPlan: continuity.hasDecisionOrPlan === false ? "NO" : continuity.hasDecisionOrPlan === true ? "YES" : "",
    documentAttached: continuity.documentAttached === true ? "YES" : continuity.documentAttached === false ? "NO" : "",
    kovAlreadyInvolved: continuity.kovAlreadyInvolved === true ? "YES" : continuity.kovAlreadyInvolved === false ? "NO" : "",
    providerAlreadyInvolved: continuity.providerAlreadyInvolved === true ? "YES" : continuity.providerAlreadyInvolved === false ? "NO" : "",
    userGoal: continuity.userGoal || ""
  };
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

function ContentList({ title, items, emptyText }) {
  const normalized = Array.isArray(items) ? items : [];
  return (
    <section>
      <h2>{title}</h2>
      {normalized.length ? (
        <div>
          {normalized.map((item, index) => {
            const label = typeof item === "string" ? item : item?.title || "";
            return label ? (
              <span key={`${label}-${index}`}>
                {label}
              </span>
            ) : null;
          })}
        </div>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  );
}

function JourneyRoadmap({ journey, t }) {
  const steps = [
    { title: t("journey.roadmap.situation", "Olukord kirjeldatud"), state: "done" },
    { title: t("journey.roadmap.saved", "Ülevaade salvestatud"), state: "done" },
    { title: t("journey.roadmap.contact", "Kontakt või teenus otsitud"), state: journey?.primaryPath === "SERVICE_MAP" ? "next" : "todo" },
    { title: t("journey.roadmap.pre_inquiry", "Eelpöördumine koostatud"), state: journey?.primaryPath === "PRE_INQUIRY" ? "next" : "todo" },
    { title: t("journey.roadmap.response", "Vastus või jätkusuhtlus"), state: "todo" },
    { title: t("journey.roadmap.next", "Järgmine samm"), state: "todo" }
  ];

  const stateLabels = {
    done: t("journey.roadmap.done", "tehtud"),
    current: t("journey.roadmap.current", "pooleli"),
    next: t("journey.roadmap.next_recommended", "järgmine soovitatud samm"),
    todo: t("journey.roadmap.todo", "mitte alustatud")
  };

  return (
    <section>
      <div>
        <h2>
          {t("journey.roadmap.title", "Teekonnarada")}
        </h2>
        <span>{statusLabel(t, journey?.status)}</span>
      </div>
      <ol aria-label={t("journey.roadmap.title", "Teekonnarada")}>
        {steps.map((step, index) => {
          const done = step.state === "done";
          return (
            <li key={step.title}>
              <span>
                {done ? "✓" : index + 1}
              </span>
              <span>{step.title}</span>
              <span>{stateLabels[step.state]}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ActivityHistory({ journey, t, locale }) {
  const items = journeyActivityItems(journey, t, locale);
  return (
    <section>
      <h2>
        {t("journey.activity.title", "Tehtud sammud")}
      </h2>
      <ol>
        {items.map((item, index) => (
          <li key={`${item.title}-${index}`}>
            <span>{item.title}</span>
            {item.dateLabel ? <span>{item.dateLabel}</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function preInquiryStatusLabel(t, status) {
  const normalized = String(status || "").toUpperCase();
  return t(
    `journey.related.pre_inquiry_status.${normalized}`,
    t("journey.related.pre_inquiry_status.DRAFT", "mustand")
  );
}

function LinkedPreInquiries({ journey, t, locale }) {
  const items = Array.isArray(journey?.linkedPreInquiries) ? journey.linkedPreInquiries : [];

  if (!items.length) {
    return (
      <p>
        {t(
          "journey.related.pre_inquiries_empty",
          "Kui alustad sellest teekonnast eelpöördumise, ilmub see siia koos teema ja staatusega."
        )}
      </p>
    );
  }

  return (
    <ul>
      {items.map((item) => {
        const topic = String(item?.topic || "").trim()
          || t("journey.related.pre_inquiry_untitled", "Eelpöördumine");
        const href = localizePath(
          `/eelpoordumised?openInquiry=${encodeURIComponent(item.id)}&workspaceRole=CLIENT`,
          locale
        );
        return (
          <li key={item.id}>
            <span>{topic}</span>
            <span>{preInquiryStatusLabel(t, item?.status)}</span>
            <Button as="a" href={href} variant="linkBrand">
              {t("journey.related.open", "Ava")}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function RelatedObjectsPanel({ journey, t, locale }) {
  const context = journey?.context && typeof journey.context === "object" && !Array.isArray(journey.context)
    ? journey.context
    : {};
  const groups = [
    ["linkedDocumentIds", t("journey.related.documents", "Seotud dokumendid")],
    ["linkedServiceMapEntryIds", t("journey.related.service_contacts", "Seotud teenusekaardi kontaktid")],
    ["linkedHelpRequestIds", t("journey.related.help_requests", "Seotud abisoovid")],
    ["linkedHelpOfferIds", t("journey.related.help_offers", "Seotud abipakkumised")],
    ["linkedRoomIds", t("journey.related.rooms", "Seotud ruumid")]
  ];

  return (
    <section>
      <h2>
        {t("journey.related.title", "Seotud asjad")}
      </h2>
      <div>
        <div>
          <h3>{t("journey.related.pre_inquiries", "Seotud eelpöördumised")}</h3>
          <LinkedPreInquiries journey={journey} t={t} locale={locale} />
        </div>
        {groups.map(([key, title]) => {
          const items = normalizeDisplayItems(context[key]);
          return (
            <div key={key}>
              <h3>{title}</h3>
              {items.length ? (
                <div>
                  {items.map((item) => <span key={item}>{item}</span>)}
                </div>
              ) : (
                <p>
                  {t("journey.related.empty", "Siia ilmuvad eelpöördumised, dokumendid või kontaktid, mille seod selle teekonnaga.")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PreInquirySharePanel({ journey, href, t }) {
  const assistiveDevices = buildAssistiveDevicesHandoff(journey);
  const [selectedShareKeys, setSelectedShareKeys] = useState(["summary", "domains", "missingInfo"]);
  const [preview, setPreview] = useState(null);
  const [thirdPartyAcknowledged, setThirdPartyAcknowledged] = useState(false);
  const selectedPersonContext = selectedShareKeys.includes("personContext");
  const reviewedHref = useMemo(() => {
    const selected = selectedShareKeys.filter(Boolean);
    const [path, query = ""] = String(href || "").split("?");
    const params = new URLSearchParams(query);
    params.set("shareReview", "1");
    if (selected.length) params.set("share", selected.join(","));
    else params.delete("share");
    const serialized = params.toString();
    return serialized ? `${path}?${serialized}` : path;
  }, [href, selectedShareKeys]);
  const toggleShareKey = (key) => {
    setSelectedShareKeys((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ));
  };
  const shareOptions = [
    ["summary", t("journey.share.summary", "olukorra kokkuvõte"), Boolean(journey?.summary)],
    ["domains", t("journey.share.domains", "seotud teemad"), Boolean(journey?.domains?.length)],
    ["missingInfo", t("journey.share.missing_info", "puuduolev info"), Boolean(journey?.missingInfo?.length)],
    ...(assistiveDevices.hasAssistiveDeviceNeed
      ? [["assistiveDevices", t("journey.share.assistive_devices", "abivahendid ja kohandused"), true]]
      : []),
    ["wish", t("journey.share.wish", "inimese soov"), Boolean(journey?.context?.personWish)],
    ["personContext", t("journey.share.person_context", "kolmanda isiku kontekst"), Boolean(journey?.context?.personContext)],
    ["serviceContinuity", t("journey.share.service_continuity", "teenuse jätkumise info"), Boolean(journey?.context?.serviceContinuity)],
    ["municipality", t("journey.share.municipality", "KOV või piirkond"), Boolean(journey?.context?.municipality || journey?.context?.municipalityName)],
    ["document", t("journey.share.document", "seotud dokument"), Boolean(journey?.context?.contextNote)],
    ["title", t("journey.share.title_field", "Teekonna pealkiri"), Boolean(journey?.title)]
  ];

  useEffect(() => {
    if (!journey?.id) return undefined;
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
  }, [journey?.id, selectedShareKeys]);

  return (
    <section>
      <div>
        <h3>
          {t("journey.share.title", "Vali, millist infot soovid eelpöördumises kasutada.")}
        </h3>
        <p>
          {t("journey.share.privacy", "Teekonnast ei jagata automaatselt kogu infot. Vaatad järgmises sammus teksti üle enne saatmist.")}
        </p>
      </div>
      <div>
        {shareOptions.filter(([, , present]) => present).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={selectedShareKeys.includes(key)}
              onChange={() => toggleShareKey(key)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {selectedPersonContext ? (
        <label>
          <input type="checkbox" checked={thirdPartyAcknowledged} onChange={(event) => setThirdPartyAcknowledged(event.target.checked)} />
          <span>{t("journey.share.person_context_ack", "Kinnitan, et mul on õigus seda teise isiku teavet jagada.")}</span>
        </label>
      ) : null}
      <section aria-live="polite">
        <h4>{t("journey.share.recipient_preview", "Adressaat näeb")}</h4>
        <pre>{preview?.situation || preview?.topic || t("journey.share.empty_preview", "Valitud Teekonna sisu ei lisata.")}</pre>
      </section>
      <div>
        <Button as="a" href={reviewedHref} disabled={!selectedShareKeys.length || (selectedPersonContext && !thirdPartyAcknowledged)}>
          {t("journey.share.continue", "Jätka eelpöördumise koostamisega")}
        </Button>
      </div>
    </section>
  );
}

function HelpRequestSharePanel({ journey, href, t }) {
  const [selectedShareKeys, setSelectedShareKeys] = useState(["summary", "category", "region", "ownWords"]);
  const reviewedHref = useMemo(() => {
    const selected = selectedShareKeys.filter(Boolean);
    const [path, query = ""] = String(href || "").split("?");
    const params = new URLSearchParams(query);
    params.set("shareReview", "1");
    if (selected.length) params.set("share", selected.join(","));
    else params.delete("share");
    const serialized = params.toString();
    return serialized ? `${path}?${serialized}` : path;
  }, [href, selectedShareKeys]);
  const toggleShareKey = (key) => {
    setSelectedShareKeys((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ));
  };
  const shareOptions = [
    ["summary", t("journey.helpMediation.share.summary", "olukorra lühikokkuvõte"), Boolean(journey?.summary)],
    ["category", t("journey.helpMediation.share.category", "abi liik"), true],
    ["region", t("journey.helpMediation.share.region", "piirkond"), true],
    ["timing", t("journey.helpMediation.share.timing", "aeg või sagedus"), false],
    ["conditions", t("journey.helpMediation.share.conditions", "tingimused"), false],
    ["ownWords", t("journey.helpMediation.share.ownWords", "kasutaja enda sõnastatud vajadus"), true]
  ];

  return (
    <section>
      <div>
        <h3>
          {t("journey.helpMediation.share.title", "Vali, millist infot soovid abisoovis kasutada.")}
        </h3>
        <p>
          {t("journey.helpMediation.share.privacy", "Kogu Teekonda ei kopeerita kuulutusse. Vaatad abisoovi enne avaldamist üle ja kinnitad eraldi, mida kaardil näidatakse.")}
        </p>
      </div>
      <div>
        {shareOptions.map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={selectedShareKeys.includes(key)}
              onChange={() => toggleShareKey(key)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <div>
        <Button as="a" href={reviewedHref} disabled={!selectedShareKeys.length}>
          {t("journey.helpMediation.share.continue", "Alusta abisoovi")}
        </Button>
      </div>
    </section>
  );
}

function FormListField({ id, label, value, onChange, t }) {
  return (
    <div>
      <label htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("journey.labels.one_item_per_line", "One item per line")}
      />
    </div>
  );
}

function ContinuityTextField({ id, label, value, onChange, placeholder = "", type = "text" }) {
  return (
    <div>
      <label htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function ContinuityChoiceField({ id, label, value, onChange, t }) {
  return (
    <div>
      <label htmlFor={id}>
        {label}
      </label>
      <Dropdown
        id={id}
        value={value}
        onChange={onChange}
        ariaLabel={label}
        options={[
          { value: "", label: t("journey.serviceContinuity.unknown", "Ei tea veel") },
          { value: "YES", label: t("journey.serviceContinuity.yes", "Jah") },
          { value: "NO", label: t("journey.serviceContinuity.no", "Ei") }
        ]}
      />
    </div>
  );
}

export default function JourneyDetail({ journeyId }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { status } = useSession();
  const [journey, setJourney] = useState(null);
  const [form, setForm] = useState(createFormState(null));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [continuityOpen, setContinuityOpen] = useState(false);
  const [continuityForm, setContinuityForm] = useState(createServiceContinuityState(null));
  const [healthDraftOpen, setHealthDraftOpen] = useState(false);
  const [healthQuestionsDraft, setHealthQuestionsDraft] = useState("");
  const [assistivePreInquiryShareOpen, setAssistivePreInquiryShareOpen] = useState(false);
  const [preInquiryShareOpen, setPreInquiryShareOpen] = useState(false);
  const [helpRequestShareOpen, setHelpRequestShareOpen] = useState(false);
  const [assistiveHelpRequestShareOpen, setAssistiveHelpRequestShareOpen] = useState(false);
  const [helpOfferMatchCount, setHelpOfferMatchCount] = useState(null);
  const [helpOfferMatchLoading, setHelpOfferMatchLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);

  const updatedAt = useMemo(() => formatDate(journey?.updatedAt, locale), [journey?.updatedAt, locale]);
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
    () => buildHelpOfferMatchApiHref(helpMediationHandoff),
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
  const continuity = useMemo(
    () => readContextObject(journey?.context, "serviceContinuity"),
    [journey?.context]
  );
  const continuityMissingInfo = useMemo(
    () => buildContinuityMissingInfo(continuityForm, t),
    [continuityForm, t]
  );
  const continuityActions = useMemo(
    () => buildContinuityActions(continuityForm, t),
    [continuityForm, t]
  );
  const hasContinuity = useMemo(
    () => Object.keys(continuity).some((key) => continuity[key] !== "" && continuity[key] !== null && continuity[key] !== undefined),
    [continuity]
  );
  const showHealthContact = useMemo(
    () => (journey ? hasHealthContactSignal(journey) : false),
    [journey]
  );
  const lifeDomains = useMemo(() => getJourneyLifeDomains(journey), [journey]);
  const serviceMapHasMunicipality = useMemo(
    () => hasMunicipalitySignal(journey, serviceMapHandoff),
    [journey, serviceMapHandoff]
  );
  const hasHelpOfferMatches = Number(helpOfferMatchCount) > 0;

  const handleBack = useCallback(() => {
    pushWithTransition(router, localizePath("/teekond", locale));
  }, [locale, router]);

  /* /teekond/[id] EI ole PanelFrame'i marsruudikaardis — ilma selle
     registreerimiseta jääks leht hoopis ilma ⓘ-ta. */
  usePanelInfoSlot({
    infoId: "journey",
    title: t("journey.title", "Teekond"),
    label: t("journey.info.label", "Open journey info")
  });

  const loadJourney = useCallback(async () => {
    if (status !== "authenticated" || !journeyId) return;
    setError("");
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
      throw new Error(payload.message || t("journey.messages.load_failed", "Loading the journey failed."));
    }
    setJourney(payload.journey || null);
    setForm(createFormState(payload.journey));
    setContinuityForm(createServiceContinuityState(payload.journey));
  }, [journeyId, status, t]);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadJourney().catch((loadError) => {
      setError(loadError.message || t("journey.messages.load_failed", "Loading the journey failed."));
    });
  }, [loadJourney, status, t]);

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

  const updateForm = useCallback((field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }, []);

  const updateContinuityForm = useCallback((field, value) => {
    setContinuityForm((current) => ({
      ...current,
      [field]: value
    }));
  }, []);

  const handleSave = useCallback(async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

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
          suggestedActions: textToActions(form.suggestedActions),
          expectedUpdatedAt: journey?.updatedAt
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || t("journey.messages.save_failed", "Saving the journey failed."));
      }
      setJourney(payload.journey);
      setForm(createFormState(payload.journey));
      setContinuityForm(createServiceContinuityState(payload.journey));
      setEditing(false);
      setNotice(t("journey.messages.updated", "Journey updated."));
    } catch (saveError) {
      setError(saveError.message || t("journey.messages.save_failed", "Saving the journey failed."));
    } finally {
      setBusy(false);
    }
  }, [form, journey?.updatedAt, journeyId, t]);

  const handleArchive = useCallback(async () => {
    if (!journeyId || journey?.status === "ARCHIVED") return;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/journeys/${encodeURIComponent(journeyId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: "ARCHIVED", expectedUpdatedAt: journey.updatedAt })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || t("journey.messages.archive_failed", "Archiving the journey failed."));
      }
      setJourney(payload.journey);
      setForm(createFormState(payload.journey));
      setContinuityForm(createServiceContinuityState(payload.journey));
      setEditing(false);
      setNotice(t("journey.messages.archived", "Journey archived."));
    } catch (archiveError) {
      setError(archiveError.message || t("journey.messages.archive_failed", "Archiving the journey failed."));
    } finally {
      setBusy(false);
    }
  }, [journey?.status, journey?.updatedAt, journeyId, t]);

  const handleReopen = useCallback(async () => {
    if (!journeyId || journey?.status !== "ARCHIVED") return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/journeys/${encodeURIComponent(journeyId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE", expectedUpdatedAt: journey.updatedAt })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.message || t("journey.messages.reopen_failed", "Teekonna taasavamine ebaõnnestus."));
      setJourney(payload.journey); setDeleteArmed(false);
      setNotice(t("journey.messages.reopened", "Teekond taasavati."));
    } catch (reopenError) { setError(reopenError.message); } finally { setBusy(false); }
  }, [journey?.status, journey?.updatedAt, journeyId, t]);

  const handleDelete = useCallback(async () => {
    if (!journeyId) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/journeys/${encodeURIComponent(journeyId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.message || t("journey.messages.delete_failed", "Teekonna kustutamine ebaõnnestus."));
      pushWithTransition(router, localizePath("/teekond", locale));
    } catch (deleteError) { setError(deleteError.message); setBusy(false); }
  }, [journeyId, locale, router, t]);

  const handleCancelEdit = useCallback(() => {
    setForm(createFormState(journey));
    setEditing(false);
    setError("");
  }, [journey]);

  const handleSaveContinuity = useCallback(async (event) => {
    event.preventDefault();
    if (!journey || !journeyId) return;
    setBusy(true);
    setError("");
    setNotice("");

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
          suggestedActions: mergeUniqueActions(journey.suggestedActions, suggestedActions, 8)
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || t("journey.messages.save_failed", "Saving the journey failed."));
      }
      setJourney(payload.journey);
      setForm(createFormState(payload.journey));
      setContinuityForm(createServiceContinuityState(payload.journey));
      setNotice(t("journey.serviceContinuity.saved", "Teenuse jätkumise kontroll salvestati Teekonda."));
    } catch (continuityError) {
      setError(continuityError.message || t("journey.messages.save_failed", "Saving the journey failed."));
    } finally {
      setBusy(false);
    }
  }, [continuityForm, journey, journeyId, t]);

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
  }, [journey, t]);

  if (status === "loading") {
    return (
      <main>
        <div>
          <div>
            <SubpageHeader
              onBack={handleBack}
              backAriaLabel={t("journey.actions.back_to_list", "Back to journey")}
              showBack={false}
              holdPressedVisualDisabled
            >
              {t("journey.title", "Teekond")}
            </SubpageHeader>
            <p>{t("journey.messages.loading", "Laen teekonda...")}</p>
          </div>
        </div>
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main>
        <div>
          <div>
            <SubpageHeader
              onBack={handleBack}
              backAriaLabel={t("journey.actions.back_to_list", "Back to journey")}
              showBack={false}
              holdPressedVisualDisabled
            >
              {t("journey.title", "Teekond")}
            </SubpageHeader>
            <section>
              <div>
                <h1>{t("journey.title", "Teekond")}</h1>
              </div>
              <p>
                {t("journey.messages.auth_required", "The journey is private. Log in to continue.")}
              </p>
              <Button as="a" href="/vestlus?login=1">
                {t("journey.actions.login", "Log in")}
              </Button>
            </section>
          </div>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main>
        <div>
          <div>
            <SubpageHeader
              onBack={handleBack}
              backAriaLabel={t("journey.actions.back_to_list", "Back to journey")}
              showBack={false}
              holdPressedVisualDisabled
            >
              {t("journey.title", "Teekond")}
            </SubpageHeader>
            <section>
              <h1>{t("journey.messages.not_found_title", "Teekonda ei leitud")}</h1>
              <p>
                {t("journey.messages.not_found", "This journey is not available or does not belong to your account.")}
              </p>
              <Button onClick={handleBack} variant="linkBrand">
                {t("journey.actions.back_to_list", "Back to journey")}
              </Button>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="journey-page">
      <div className="journey-shell">
        <div className="journey-content">
          <SubpageHeader
            onBack={handleBack}
            backAriaLabel={t("journey.actions.back_to_list", "Back to journey")}
            showBack={false}
            holdPressedVisualDisabled
          >
            {t("journey.title", "Teekond")}
          </SubpageHeader>

          {error ? <p role="alert">{error}</p> : null}
          {notice ? <p role="status">{notice}</p> : null}

          {!journey ? (
            <p>{t("journey.messages.loading", "Laen teekonda...")}</p>
          ) : (
            <>
              <section>
                <div>
                  <div>
                    <div>
                      {t("journey.header.eyebrow", "Private journey layer")}
                    </div>
                    <h1>
                      {journey.title}
                    </h1>
                    <div>
                      <span>
                        {t("journey.labels.private", "Private")}
                      </span>
                      <span>{statusLabel(t, journey.status)}</span>
                      <span>{primaryPathLabel(t, journey.primaryPath)}</span>
                      {updatedAt ? (
                        <span>
                          {t("journey.labels.updated_at", { date: updatedAt }, "Updated {date}")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <Button variant="primary" onClick={() => setEditing((current) => !current)} disabled={busy}>
                      {editing ? t("journey.actions.close_edit", "Close editing") : t("journey.actions.edit", "Edit")}
                    </Button>
                    {journey.status !== "ARCHIVED" ? (
                      <Button variant="danger" onClick={handleArchive} disabled={busy}>
                        {t("journey.actions.archive", "Archive")}
                      </Button>
                    ) : (
                      <Button onClick={handleReopen} disabled={busy}>
                        {t("journey.actions.reopen", "Taasava")}
                      </Button>
                    )}
                    <Button onClick={() => downloadJourneyText(journey, `teekond-${journey.id}.txt`)} disabled={busy}>
                      {t("journey.actions.export", "Ekspordi tekstina")}
                    </Button>
                    {!deleteArmed ? (
                      <Button variant="danger" onClick={() => setDeleteArmed(true)} disabled={busy}>
                        {t("journey.actions.delete", "Kustuta jäädavalt")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </section>

              {deleteArmed ? (
                <section className="journey-risk-card" role="alertdialog" aria-labelledby="journey-delete-title">
                  <h2 id="journey-delete-title">{t("journey.delete.title", "Kustuta Teekond jäädavalt?")}</h2>
                  <p>{t("journey.delete.body", "Teekonna privaatne sisu kustub. Seotud eelpöördumised jäävad alles, kuid side Teekonnaga katkeb. Soovitame enne eksportida.")}</p>
                  <Button onClick={() => downloadJourneyText(journey, `teekond-${journey.id}.txt`)}>
                    {t("journey.actions.export", "Ekspordi tekstina")}
                  </Button>
                  <Button variant="danger" onClick={handleDelete} disabled={busy}>
                    {t("journey.delete.confirm", "Jah, kustuta jäädavalt")}
                  </Button>
                  <Button variant="linkBrand" onClick={() => setDeleteArmed(false)} disabled={busy}>
                    {t("journey.actions.cancel", "Tühista")}
                  </Button>
                </section>
              ) : null}

              <section>
                <h2>
                  {t("journey.privacy.title", "Teekond on privaatne")}
                </h2>
                <p>
                  {t("journey.privacy.description", "Midagi ei jagata enne sinu kinnitust. Teised näevad ainult seda infot, mille sa hiljem eraldi kinnitad ja jagad.")}
                </p>
              </section>

              <JourneyRoadmap journey={journey} t={t} />

              <section>
                <div>
                  <div>
                    <h2>
                      {t("journey.service_map.title", "Ava teenusekaart nende teemade põhjal")}
                    </h2>
                    <p>
                      {serviceMapHandoff?.hasFilter
                        ? t("journey.service_map.filtered_description", "Teenusekaart avaneb teekonna teemade ja piirkonna signaalidega.")
                        : t("journey.service_map.fallback_description", "Teenusekaart avaneb üldvaates. Täpsemaks avamiseks lisa KOV või piirkond.")}
                    </p>
                    {!serviceMapHasMunicipality ? (
                      <p>
                        {t("journey.service_map.missing_municipality", "Teenusekaardi täpsemaks avamiseks lisa KOV või piirkond.")}
                      </p>
                    ) : null}
                    <p>
                      {t("journey.service_map.privacy_note", "Teenusekaart ei jaga sinu teekonda ühegi osapoolega. See aitab leida sobiva kontakti või järgmise sammu.")}
                    </p>
                  </div>
                  <Button as="a" href={serviceMapHref}>
                    {t("journey.service_map.open", "Ava teenusekaart")}
                  </Button>
                </div>
              </section>

              {assistiveDevicesHandoff?.hasAssistiveDeviceNeed ? (
                <section>
                  <div>
                    <div>
                      <div>
                        <h2>
                          {t("journey.assistiveDevices.title", "Abivahendid ja kohandused")}
                        </h2>
                        <p>
                          {t("journey.assistiveDevices.description", "Siia saab koondada info abivahendite, kodukohanduse või abivahendi kasutamise toe kohta.")}
                        </p>
                        <p>
                          {t("journey.assistiveDevices.safetyNote", "SotsiaalAI ei määra ametlikult abivahendit ega otsusta hüvitamist. Vajadusel täpsusta sobivust KOV-i, spetsialisti, rehabilitatsioonimeeskonna või abivahendi teenuseosutajaga.")}
                        </p>
                      </div>
                      <div>
                        <Button as="a" href={serviceMapHref} variant="linkBrand">
                          {t("journey.service_map.open", "Ava teenusekaart")}
                        </Button>
                        <Button type="button" onClick={() => setAssistivePreInquiryShareOpen((current) => !current)}>
                          {t("journey.pre_inquiry.open", "Koosta eelpöördumine")}
                        </Button>
                        <Button as="a" href={documentsHref} variant="linkBrand">
                          {t("journey.assistiveDevices.addDocument", "Lisa dokument")}
                        </Button>
                        <Button type="button" variant="primary" onClick={() => setAssistiveHelpRequestShareOpen((current) => !current)}>
                          {t("journey.assistiveDevices.createPracticalHelpRequest", "Loo abisoov praktiliseks abiks")}
                        </Button>
                      </div>
                    </div>
                    <div>
                      {assistiveDevicesHandoff.devices.map((item) => (
                        <div key={item.id}>
                          <div>
                            <strong>{item.name}</strong>
                            <span>{t(`journey.assistiveDevices.status.${item.status}`, item.status)}</span>
                          </div>
                          {item.supportNeed ? <p>{item.supportNeed}</p> : null}
                          {item.relatedNeedTags?.length ? (
                            <div>
                              {item.relatedNeedTags.map((tag) => <span key={tag}>{tag}</span>)}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {assistivePreInquiryShareOpen ? (
                      <PreInquirySharePanel journey={journey} href={preInquiryHref} t={t} />
                    ) : null}
                    {assistiveHelpRequestShareOpen ? (
                      <HelpRequestSharePanel journey={journey} href={createHelpRequestHref} t={t} />
                    ) : null}
                  </div>
                </section>
              ) : null}

              {helpMediationHandoff?.hasPracticalNeed ? (
                <section>
                  <div>
                    <div>
                      <h2>
                        {t("journey.helpMediation.title", "Abivahendus")}
                      </h2>
                      <p>
                        {helpOfferMatchLoading
                          ? t("journey.helpMediation.checkingOffers", "Kontrollin sobivaid abipakkumisi...")
                          : hasHelpOfferMatches
                            ? t("journey.helpMediation.offersFoundHint", "Sinu kirjeldus viitab praktilisele abivajadusele. Leidsime võimalikke abipakkumisi, mida saad vaadata.")
                            : t("journey.helpMediation.noOffersHint", "Sinu kirjeldus viitab praktilisele abivajadusele. Praegu sobivaid abipakkumisi ei leitud, kuid saad luua abisoovi.")}
                      </p>
                      {!helpMediationHandoff.municipalityName ? (
                        <p>
                          {t("journey.helpMediation.noRegionHint", "Piirkonna lisamine aitab sobivaid abipakkumisi täpsemalt leida.")}
                        </p>
                      ) : null}
                      <p>
                        {t("journey.helpMediation.privacy", "Teekond ei avalda midagi automaatselt. Abisoovi loomisel valid eraldi, millise info kaasa võtad ja mida kaardil näidatakse.")}
                      </p>
                      {helpMediationHandoff.taxonomy?.relatedServiceCategories?.length ? (
                        <p>
                          {t("journey.helpMediation.serviceHint", "Sarnase vajadusega võib olla seotud ka KOV teenus või teenuseosutaja kontakt.")}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      {hasHelpOfferMatches ? (
                        <Button as="a" href={helpOffersHref} variant="linkBrand">
                          {t("journey.helpMediation.viewOffers", "Vaata abipakkumisi")}
                        </Button>
                      ) : null}
                      <Button type="button" onClick={() => setHelpRequestShareOpen((current) => !current)}>
                        {t("journey.helpMediation.createRequest", "Loo abisoov")}
                      </Button>
                      <Button as="a" href={helpRequestsHref} variant="linkBrand">
                        {t("journey.helpMediation.viewRequests", "Vaata abisoove")}
                      </Button>
                      <Button as="a" href={createHelpOfferHref} variant="linkBrand">
                        {t("journey.helpMediation.createOffer", "Loo abipakkumine")}
                      </Button>
                    </div>
                  </div>
                  {helpRequestShareOpen ? (
                    <HelpRequestSharePanel journey={journey} href={createHelpRequestHref} t={t} />
                  ) : null}
                </section>
              ) : null}

              <section>
                <div>
                  <div>
                    <h2>
                      {t("journey.pre_inquiry.title", "Koosta eelpöördumine selle olukorra põhjal")}
                    </h2>
                    <p>
                      {t("journey.pre_inquiry.description", "Enne eelpöördumise koostamist valid, millist teekonna infot soovid kaasa võtta. Saad teksti enne saatmist üle vaadata ja muuta.")}
                    </p>
                    <p>
                      {t("journey.pre_inquiry.privacy_note", "Teekonda ei jagata automaatselt. Vastuvõtja näeb ainult sinu kinnitatud eelpöördumist.")}
                    </p>
                  </div>
                  <Button type="button" onClick={() => setPreInquiryShareOpen((current) => !current)}>
                    {t("journey.pre_inquiry.open", "Koosta eelpöördumine")}
                  </Button>
                </div>
                {preInquiryShareOpen ? (
                  <PreInquirySharePanel journey={journey} href={preInquiryHref} t={t} />
                ) : null}
              </section>

              <section>
                <div>
                  <div>
                    <h2>
                      {t("journey.serviceContinuity.title", "Teenuse jätkumise kontroll")}
                    </h2>
                    <p>
                      {t("journey.serviceContinuity.description", "Kui sul on olemasolev teenus, tugi, otsus või plaan, mis võib vajada jätkumise täpsustamist, saad siin info korrastada ja vajadusel koostada eelpöördumise.")}
                    </p>
                    <p>
                      {t("journey.serviceContinuity.notOfficialAssessment", "See on info korrastamise abivahend, mitte ametlik hinnang, otsus ega teenuse määramine. Pädev asutus või spetsialist hindab ja otsustab.")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setContinuityOpen((current) => !current)}
                    disabled={busy}
                  >
                    {continuityOpen
                      ? t("journey.serviceContinuity.close", "Sulge kontroll")
                      : t("journey.serviceContinuity.open", "Teenuse jätkumise kontroll")}
                  </Button>
                </div>

                {hasContinuity ? (
                  <div>
                    <h3>
                      {t("journey.serviceContinuity.summaryTitle", "Teenuse jätkumise kokkuvõte")}
                    </h3>
                    <div>
                      {continuity.serviceName ? (
                        <span>{continuity.serviceName}</span>
                      ) : null}
                      {continuity.currentProvider ? (
                        <span>{continuity.currentProvider}</span>
                      ) : null}
                      {continuity.municipality ? (
                        <span>{continuity.municipality}</span>
                      ) : null}
                      {continuity.endDate ? (
                        <span>
                          {t("journey.serviceContinuity.endDateValue", { date: continuity.endDate }, "Lõppkuupäev: {date}")}
                        </span>
                      ) : null}
                    </div>
                    <p>
                      {continuity.userGoal || t("journey.serviceContinuity.existingSummaryEmpty", "Kasutaja eesmärk vajab veel täpsustamist.")}
                    </p>
                    {continuityMissingInfo.length ? (
                      <div>
                        <p>
                          {t("journey.serviceContinuity.missingInfo", "Puuduolev info")}
                        </p>
                        <div>
                          {continuityMissingInfo.map((item) => (
                            <span key={item}>{item}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <p>
                      {t("journey.serviceContinuity.privacyNote", "Kontrolli info jääb sinu privaatse Teekonna konteksti. Seda ei jagata spetsialisti, teenuseosutaja ega ruumi liikmetega enne sinu teadlikku kinnitamist.")}
                    </p>
                    <div>
                      <Button as="a" href={preInquiryHref}>
                        {t("journey.serviceContinuity.createPreInquiry", "Koosta eelpöördumine")}
                      </Button>
                      <Button as="a" href={documentsHref} variant="linkBrand">
                        {t("journey.serviceContinuity.addDocument", "Lisa dokument analüüsiks")}
                      </Button>
                      <Button as="a" href={serviceMapHref} variant="linkBrand">
                        {t("journey.serviceContinuity.openServiceMap", "Ava teenusekaart")}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {continuityOpen ? (
                  <Form onSubmit={handleSaveContinuity}>
                    <div>
                      <ContinuityTextField
                        id="journey-continuity-service-name"
                        label={t("journey.serviceContinuity.serviceName", "Teenuse või toe nimetus")}
                        value={continuityForm.serviceName}
                        onChange={(value) => updateContinuityForm("serviceName", value)}
                        placeholder={t("journey.serviceContinuity.serviceNamePlaceholder", "Näiteks koduteenus, tugiisik, rehabilitatsioon")}
                      />
                      <ContinuityTextField
                        id="journey-continuity-provider"
                        label={t("journey.serviceContinuity.currentProvider", "Praegune teenuseosutaja või kontakt")}
                        value={continuityForm.currentProvider}
                        onChange={(value) => updateContinuityForm("currentProvider", value)}
                        placeholder={t("journey.serviceContinuity.currentProviderPlaceholder", "Teenuseosutaja, KOV kontakt või muu osapool")}
                      />
                      <ContinuityTextField
                        id="journey-continuity-municipality"
                        label={t("journey.serviceContinuity.municipality", "KOV või piirkond")}
                        value={continuityForm.municipality}
                        onChange={(value) => updateContinuityForm("municipality", value)}
                        placeholder={t("journey.serviceContinuity.municipalityPlaceholder", "Näiteks Tartu linn või oma vald")}
                      />
                      <ContinuityTextField
                        id="journey-continuity-end-date"
                        label={t("journey.serviceContinuity.endDate", "Lõppkuupäev, kui teada")}
                        value={continuityForm.endDate}
                        onChange={(value) => updateContinuityForm("endDate", value)}
                        placeholder={t("journey.serviceContinuity.endDatePlaceholder", "Kuupäev või vaba kirjeldus")}
                      />
                    </div>

                    <div>
                      <ContinuityChoiceField
                        id="journey-continuity-existing"
                        label={t("journey.serviceContinuity.hasExistingService", "Kas teenus või tugi on praegu olemas?")}
                        value={continuityForm.hasExistingService}
                        onChange={(value) => updateContinuityForm("hasExistingService", value)}
                        t={t}
                      />
                      <ContinuityChoiceField
                        id="journey-continuity-known-end-date"
                        label={t("journey.serviceContinuity.knownEndDate", "Kas lõppkuupäev on teada?")}
                        value={continuityForm.knownEndDate}
                        onChange={(value) => updateContinuityForm("knownEndDate", value)}
                        t={t}
                      />
                      <ContinuityChoiceField
                        id="journey-continuity-decision"
                        label={t("journey.serviceContinuity.hasDecisionOrPlan", "Kas olemas on otsus, plaan, leping, kiri või muu dokument?")}
                        value={continuityForm.hasDecisionOrPlan}
                        onChange={(value) => updateContinuityForm("hasDecisionOrPlan", value)}
                        t={t}
                      />
                      <ContinuityChoiceField
                        id="journey-continuity-document"
                        label={t("journey.serviceContinuity.documentAttached", "Kas dokument on juba platvormile lisatud?")}
                        value={continuityForm.documentAttached}
                        onChange={(value) => updateContinuityForm("documentAttached", value)}
                        t={t}
                      />
                      <ContinuityChoiceField
                        id="journey-continuity-kov"
                        label={t("journey.serviceContinuity.kovAlreadyInvolved", "Kas KOV on juba kaasatud?")}
                        value={continuityForm.kovAlreadyInvolved}
                        onChange={(value) => updateContinuityForm("kovAlreadyInvolved", value)}
                        t={t}
                      />
                      <ContinuityChoiceField
                        id="journey-continuity-provider-involved"
                        label={t("journey.serviceContinuity.providerAlreadyInvolved", "Kas teenuseosutaja on juba kaasatud?")}
                        value={continuityForm.providerAlreadyInvolved}
                        onChange={(value) => updateContinuityForm("providerAlreadyInvolved", value)}
                        t={t}
                      />
                    </div>

                    <div>
                      <label htmlFor="journey-continuity-user-goal">
                        {t("journey.serviceContinuity.userGoal", "Mida soovid täpsustada või ette valmistada?")}
                      </label>
                      <textarea
                        id="journey-continuity-user-goal"
                        value={continuityForm.userGoal}
                        onChange={(event) => updateContinuityForm("userGoal", event.target.value)}
                        placeholder={t("journey.serviceContinuity.userGoalPlaceholder", "Näiteks soovin saada selgust, küsida jätkumise võimalust, koostada eelpöördumise või lisada dokumendi analüüsiks.")}
                      />
                    </div>

                    <div>
                      <p>
                        {t("journey.serviceContinuity.nextSteps", "Võimalikud järgmised sammud")}
                      </p>
                      <div>
                        {continuityActions.map((action) => (
                          <span key={`${action.type || ""}-${action.title}`}>
                            {action.title}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Button type="submit" disabled={busy}>
                        {t("journey.serviceContinuity.save", "Salvesta kontroll")}
                      </Button>
                      <Button type="button" variant="linkBrand" onClick={() => setContinuityOpen(false)} disabled={busy}>
                        {t("journey.serviceContinuity.close", "Sulge kontroll")}
                      </Button>
                    </div>
                  </Form>
                ) : null}
              </section>

              {showHealthContact ? (
                <section>
                  <div>
                    <div>
                      <h2>
                        {t("journey.healthContact.title", "Tervisekontakti võimalus")}
                      </h2>
                      <p>
                        {t("journey.healthContact.description", "Sinu kirjelduses võib olla tervisega seotud küsimus. Esmane järgmine samm võib olla perearstikeskus, tervisekeskus või ametlik tervisenõu kontakt.")}
                      </p>
                      <p>
                        {t("journey.healthContact.notMedicalAdvice", "SotsiaalAI ei anna meditsiinilist hinnangut, diagnoosi ega ravisoovitust, kuid saab aidata küsimused selgelt sõnastada. Kui on vahetu oht, tuleb pöörduda hädaabinumbrile või erakorralise abi poole.")}
                      </p>
                    </div>
                    <Button type="button" variant="primary" onClick={handleCreateHealthQuestions} disabled={busy}>
                      {t("journey.healthContact.createQuestions", "Koosta küsimused tervisekontaktile")}
                    </Button>
                  </div>

                  <p>
                    {t("journey.healthContact.privateNote", "Küsimused jäävad sinu kätte. Neid ei saadeta automaatselt perearstikeskusele, tervisekeskusele ega muule osapoolele.")}
                  </p>

                  <div>
                    <Button as="a" href={serviceMapHref} variant="linkBrand">
                      {t("journey.healthContact.openServiceMap", "Ava teenusekaart")}
                    </Button>
                    <Button as="a" href={documentsHref} variant="linkBrand">
                      {t("journey.serviceContinuity.addDocument", "Lisa dokument analüüsiks")}
                    </Button>
                    <Button as="a" href={preInquiryHref} variant="linkBrand">
                      {t("journey.healthContact.createPreInquiry", "Koosta eelpöördumine")}
                    </Button>
                  </div>

                  {healthDraftOpen ? (
                    <div>
                      <label htmlFor="journey-health-contact-draft">
                        {t("journey.healthContact.questionsDraftTitle", "Küsimused tervisekontaktile")}
                      </label>
                      <textarea
                        id="journey-health-contact-draft"
                        value={healthQuestionsDraft}
                        onChange={(event) => setHealthQuestionsDraft(event.target.value)}
                      />
                      <p>
                        {t("journey.healthContact.noAutomaticSharing", "Mustandit ei saadeta automaatselt. Vaata tekst üle, muuda seda vajadusel ja otsusta ise, kas kasutad seda väljaspool platvormi.")}
                      </p>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {editing ? (
                <Form onSubmit={handleSave}>
                  <div>
                    <label htmlFor="journey-detail-title">
                      {t("journey.labels.title", "Title")}
                    </label>
                    <input
                      id="journey-detail-title"
                      value={form.title}
                      onChange={(event) => updateForm("title", event.target.value)}
                      maxLength={160}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="journey-detail-summary">
                      {t("journey.labels.summary", "Situation summary")}
                    </label>
                    <textarea
                      id="journey-detail-summary"
                      value={form.summary}
                      onChange={(event) => updateForm("summary", event.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="journey-detail-primary-path">
                      {t("journey.labels.primary_path", "Primary direction")}
                    </label>
                    <Dropdown
                      id="journey-detail-primary-path"
                      value={form.primaryPath || "UNKNOWN"}
                      onChange={(next) => updateForm("primaryPath", next)}
                      ariaLabel={t("journey.labels.primary_path", "Primary direction")}
                      options={PRIMARY_PATH_VALUES.map((value) => ({
                        value,
                        label: primaryPathLabel(t, value)
                      }))}
                    />
                  </div>

                  <div>
                    <FormListField
                      id="journey-detail-domains"
                      label={t("journey.labels.domains", "Related topics")}
                      value={form.domains}
                      onChange={(value) => updateForm("domains", value)}
                      t={t}
                    />
                    <FormListField
                      id="journey-detail-missing-info"
                      label={t("journey.labels.missing_info", "Missing information")}
                      value={form.missingInfo}
                      onChange={(value) => updateForm("missingInfo", value)}
                      t={t}
                    />
                    <FormListField
                      id="journey-detail-actions"
                      label={t("journey.labels.suggested_actions", "Suggested next steps")}
                      value={form.suggestedActions}
                      onChange={(value) => updateForm("suggestedActions", value)}
                      t={t}
                    />
                  </div>

                  <div>
                    <Button type="submit" disabled={busy}>
                      {t("journey.actions.save_changes", "Save changes")}
                    </Button>
                    <Button variant="linkBrand" onClick={handleCancelEdit} disabled={busy}>
                      {t("journey.actions.cancel", "Cancel")}
                    </Button>
                  </div>
                </Form>
              ) : (
                <>
                  <section>
                    <h2>
                      {t("journey.labels.summary", "Situation summary")}
                    </h2>
                    <p>{journey.summary}</p>
                  </section>

                  <div>
                    <ContentList
                      title={t("journey.labels.domains", "Seotud teemad")}
                      items={journey.domains}
                      emptyText={t("journey.messages.empty_domains", "Seotud teemasid ei ole veel lisatud.")}
                    />
                    <ContentList
                      title={t("journey.review.life_domains", "Eluvaldkonnad")}
                      items={lifeDomains}
                      emptyText={t("journey.review.empty_life_domains", "Eluvaldkonnad täpsustuvad hiljem.")}
                    />
                    <ContentList
                      title={t("journey.labels.missing_info", "Puuduolev info")}
                      items={journey.missingInfo}
                      emptyText={t("journey.messages.empty_missing_info", "Puuduolevat infot ei ole veel lisatud.")}
                    />
                    <ContentList
                      title={t("journey.labels.risk_signals", "Ettevaatlikud tähelepanekud")}
                      items={journey.riskSignals}
                      emptyText={t("journey.messages.empty_risk_signals", "Ettevaatlikke tähelepanekuid ei ole lisatud.")}
                    />
                    <ContentList
                      title={t("journey.labels.suggested_actions", "Võimalikud järgmised sammud")}
                      items={journey.suggestedActions}
                      emptyText={t("journey.messages.empty_suggested_actions", "Järgmised sammud täpsustuvad hiljem.")}
                    />
                  </div>
                  <div>
                    <ActivityHistory journey={journey} t={t} locale={locale} />
                    <RelatedObjectsPanel journey={journey} t={t} locale={locale} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
