import { useEffect, useMemo, useRef, useState } from "react";
import { collapsePages, formatSourceLabel, isSyntheticEvidenceRef, normalizePageRange } from "../utils/sources.js";

const RAG_SOURCE_TYPE_HINTS = new Set([
  "national_law",
  "law",
  "kov_regulation",
  "municipal_regulation",
  "regulation",
  "state_guide",
  "municipality_kov",
  "municipality_service",
  "kov_service_info",
  "kov_service",
  "kov_web",
  "municipality_web",
  "official_form",
  "application_form",
  "web_form",
  "pdf_form",
  "official_contact",
  "contact_page",
  "journal_article",
  "organization_profile",
  "practice_example",
  "project_description",
  "personal_story",
  "opinion",
  "historical_source",
  "methodology_guide",
  "quality_guideline",
  "service_standard",
  "template",
  "faq",
  "partner_service_info"
]);

function normalizeIdentityText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[.!?\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isIdentityQuestionText(text = "") {
  const normalized = normalizeIdentityText(text);
  if (!normalized) return false;
  return (
    /\b(kes sa oled|kes te olete|mis sa oled|who are you|what are you)\b/.test(normalized) ||
    /\b(mis assistent sa oled|milline assistent sa oled|what assistant are you)\b/.test(normalized) ||
    /\b(?:(?:kas )?oled(?: sa)? (?:chatgpt|openai|sotsiaalai)|kas sa oled (?:chatgpt|openai|sotsiaalai)|are you (?:chatgpt|openai|sotsiaalai)|(?:chatgpt|openai|sotsiaalai) assistent)\b/.test(normalized) ||
    /^(?:chatgpt|openai|sotsiaalai)(?:\s+assistent)?$/.test(normalized)
  );
}

function isSourceFreeIdentityAnswer(text = "") {
  const normalized = normalizeIdentityText(text);
  return (
    normalized === "olen sotsiaalai vestlusassistent" ||
    normalized === "i am the sotsiaalai chat assistant" ||
    normalized === "im the sotsiaalai chat assistant" ||
    normalized === "я чат-ассистент sotsiaalai"
  );
}

function getDisplayedMessageSources(message) {
  if (Array.isArray(message?.displayed_sources)) return message.displayed_sources;
  if (Array.isArray(message?.displayedSources)) return message.displayedSources;
  return Array.isArray(message?.sources) ? message.sources : [];
}

function getSourceType(src) {
  return typeof src?.sourceType === "string"
    ? src.sourceType
    : typeof src?.source_type === "string"
      ? src.source_type
      : typeof src?.origin === "string"
        ? src.origin
        : typeof src?.type === "string"
          ? src.type
          : "";
}

function getSourceUrl(src) {
  return typeof src?.url === "string" && src.url.trim()
    ? src.url.trim()
    : typeof src?.url_canonical === "string" && src.url_canonical.trim()
      ? src.url_canonical.trim()
      : typeof src?.urlCanonical === "string" && src.urlCanonical.trim()
        ? src.urlCanonical.trim()
        : typeof src?.source_url === "string" && src.source_url.trim()
          ? src.source_url.trim()
          : typeof src?.sourceUrl === "string" && src.sourceUrl.trim()
            ? src.sourceUrl.trim()
            : typeof src?.official_url === "string" && src.official_url.trim()
              ? src.official_url.trim()
              : typeof src?.officialUrl === "string" && src.officialUrl.trim()
                ? src.officialUrl.trim()
                : typeof src?.official_website === "string" && src.official_website.trim()
                  ? src.official_website.trim()
                  : typeof src?.officialWebsite === "string" && src.officialWebsite.trim()
                    ? src.officialWebsite.trim()
                    : typeof src?.metadata?.url === "string" && src.metadata.url.trim()
                      ? src.metadata.url.trim()
                      : typeof src?.metadata?.url_canonical === "string" && src.metadata.url_canonical.trim()
                        ? src.metadata.url_canonical.trim()
                        : typeof src?.metadata?.urlCanonical === "string" && src.metadata.urlCanonical.trim()
                          ? src.metadata.urlCanonical.trim()
                          : typeof src?.metadata?.source_url === "string" && src.metadata.source_url.trim()
                            ? src.metadata.source_url.trim()
                            : typeof src?.metadata?.sourceUrl === "string" && src.metadata.sourceUrl.trim()
                              ? src.metadata.sourceUrl.trim()
                              : typeof src?.metadata?.official_url === "string" && src.metadata.official_url.trim()
                                ? src.metadata.official_url.trim()
                                : typeof src?.metadata?.officialUrl === "string" && src.metadata.officialUrl.trim()
                                  ? src.metadata.officialUrl.trim()
                                  : typeof src?.metadata?.official_website === "string" && src.metadata.official_website.trim()
                                    ? src.metadata.official_website.trim()
                                    : typeof src?.metadata?.officialWebsite === "string" && src.metadata.officialWebsite.trim()
                                      ? src.metadata.officialWebsite.trim()
                                      : "";
}

function isDbSource(src, uploadName = "") {
  if (!src) return false;
  const fileName = typeof src.fileName === "string" ? src.fileName.trim().toLowerCase() : "";
  if (uploadName && fileName && fileName === uploadName) return false;
  const sourceType = getSourceType(src).trim().toLowerCase();
  if (sourceType.includes("ephemeral")) return false;
  if (sourceType.includes("upload")) return false;
  const hasKnownSourceType = RAG_SOURCE_TYPE_HINTS.has(sourceType);
  const hasDbHint =
    sourceType.includes("rag") ||
    hasKnownSourceType ||
    !!getSourceUrl(src) ||
    !!src.short_ref ||
    !!src.journalTitle ||
    !!src.source_id ||
    !!src.sourceId ||
    !!src.canonical_item_id ||
    !!src.canonicalItemId ||
    Array.isArray(src.authors) && src.authors.length > 0;
  if (!hasDbHint && fileName) return false;
  return hasDbHint;
}

function getSourceKey(src, fallback) {
  return src?.key ||
    src?.source_id ||
    src?.sourceId ||
    src?.id ||
    src?.canonical_item_id ||
    src?.canonicalItemId ||
    getSourceUrl(src) ||
    fallback;
}

export function collectMessageSources(message, uploadPreview) {
  const map = new Map();
  const uploadName = typeof uploadPreview?.fileName === "string" ? uploadPreview.fileName.trim().toLowerCase() : "";
  const sources = getDisplayedMessageSources(message);
  sources.forEach((src, idx) => {
    if (!isDbSource(src, uploadName)) return;
    const url = getSourceUrl(src);
    const rawLabel = typeof src?.label === "string" ? src.label.trim() : "";
    const label =
      rawLabel && !isSyntheticEvidenceRef(rawLabel)
        ? rawLabel
        : formatSourceLabel(src && typeof src === "object" ? src : { title: "Allikas" });
    const pageText = normalizePageRange(src?.pageRange) || collapsePages([...(Array.isArray(src?.pages) ? src.pages : []), ...(src?.page ? [src.page] : [])]);
    const section = typeof src?.section === "string" ? src.section : undefined;
    const key = getSourceKey(src, `${label}-${pageText || ""}-${idx}`);
    const existing = map.get(key) || {
      key,
      label,
      pageText,
      section,
      allUrls: [],
      occurrences: 0
    };
    if (url && !existing.allUrls.includes(url)) existing.allUrls.push(url);
    existing.occurrences += 1;
    map.set(key, existing);
  });
  return Array.from(map.values());
}

export function collectLatestAnswerSources(messages, uploadPreview) {
  const messageList = Array.isArray(messages) ? messages : [];
  let latestAssistantMessage = null;
  let latestAssistantIndex = -1;
  for (let i = messageList.length - 1; i >= 0; i -= 1) {
    const role = String(messageList[i]?.role || "").toLowerCase();
    if (role !== "ai" && role !== "assistant") continue;
    latestAssistantMessage = messageList[i];
    latestAssistantIndex = i;
    break;
  }
  let previousUserMessage = null;
  for (let i = latestAssistantIndex - 1; i >= 0; i -= 1) {
    const role = String(messageList[i]?.role || "").toLowerCase();
    if (role !== "user" && role !== "client" && role !== "member") continue;
    previousUserMessage = messageList[i];
    break;
  }
  const latestAnswerText = String(latestAssistantMessage?.text || "").trim();
  if (
    isSourceFreeIdentityAnswer(latestAnswerText) ||
    (
      isIdentityQuestionText(previousUserMessage?.text) &&
      (!latestAnswerText || isSourceFreeIdentityAnswer(latestAnswerText))
    )
  ) {
    return [];
  }
  return collectMessageSources(latestAssistantMessage, uploadPreview);
}

export function collectConversationSources(messages, uploadPreview) {
  const map = new Map();
  const uploadName = typeof uploadPreview?.fileName === "string" ? uploadPreview.fileName.trim().toLowerCase() : "";
  const messageList = Array.isArray(messages) ? messages : [];

  messageList.forEach((message, index) => {
    const role = String(message?.role || "").toLowerCase();
    if (role !== "ai" && role !== "assistant") return;

    let previousUserMessage = null;
    for (let i = index - 1; i >= 0; i -= 1) {
      const previousRole = String(messageList[i]?.role || "").toLowerCase();
      if (previousRole !== "user" && previousRole !== "client" && previousRole !== "member") continue;
      previousUserMessage = messageList[i];
      break;
    }

    const answerText = String(message?.text || "").trim();
    if (
      isSourceFreeIdentityAnswer(answerText) ||
      (
        isIdentityQuestionText(previousUserMessage?.text) &&
        (!answerText || isSourceFreeIdentityAnswer(answerText))
      )
    ) {
      return;
    }

    const sources = getDisplayedMessageSources(message);
    sources.forEach((src, idx) => {
      if (!isDbSource(src, uploadName)) return;
      const url = getSourceUrl(src);
      const rawLabel = typeof src?.label === "string" ? src.label.trim() : "";
      const label =
        rawLabel && !isSyntheticEvidenceRef(rawLabel)
          ? rawLabel
          : formatSourceLabel(src && typeof src === "object" ? src : { title: "Allikas" });
      const pageText = normalizePageRange(src?.pageRange) || collapsePages([...(Array.isArray(src?.pages) ? src.pages : []), ...(src?.page ? [src.page] : [])]);
      const section = typeof src?.section === "string" ? src.section : undefined;
      const key = getSourceKey(src, `${label}-${pageText || ""}-${index}-${idx}`);
      const existing = map.get(key) || {
        key,
        label,
        pageText,
        section,
        allUrls: [],
        occurrences: 0
      };
      if (url && !existing.allUrls.includes(url)) existing.allUrls.push(url);
      existing.occurrences += 1;
      map.set(key, existing);
    });
  });

  return Array.from(map.values());
}

export function useConversationSources({
  messages,
  showSourcesPanel,
  uploadPreview
}) {
  const [sourcesPulse, setSourcesPulse] = useState(false);
  const sourcesPulseTimerRef = useRef(null);
  const prevSourcesSignatureRef = useRef("");
  const latestAnswerSources = useMemo(() => {
    return collectLatestAnswerSources(messages, uploadPreview);
  }, [messages, uploadPreview]);
  const allConversationSources = useMemo(() => {
    return collectConversationSources(messages, uploadPreview);
  }, [messages, uploadPreview]);
  const conversationSources = latestAnswerSources;
  const conversationSourcesSignature = useMemo(() => {
    return conversationSources
      .map((source, index) => source?.key || source?.label || index)
      .join("|");
  }, [conversationSources]);
  const hasConversationSources = latestAnswerSources.length > 0 || allConversationSources.length > 0;
  const hasAllConversationSources = allConversationSources.length > 0;
  useEffect(() => {
    const currentCount = conversationSources.length;
    const prevSignature = prevSourcesSignatureRef.current;
    prevSourcesSignatureRef.current = conversationSourcesSignature;
    if (!showSourcesPanel && currentCount > 0 && conversationSourcesSignature !== prevSignature) {
      setSourcesPulse(true);
      if (sourcesPulseTimerRef.current) {
        window.clearTimeout(sourcesPulseTimerRef.current);
      }
      sourcesPulseTimerRef.current = window.setTimeout(() => {
        setSourcesPulse(false);
      }, 1000);
    }
    return () => {
      if (sourcesPulseTimerRef.current) {
        window.clearTimeout(sourcesPulseTimerRef.current);
      }
    };
  }, [conversationSources.length, conversationSourcesSignature, showSourcesPanel]);
  return {
    conversationSources,
    latestAnswerSources,
    allConversationSources,
    hasConversationSources,
    hasAllConversationSources,
    sourcesPulse
  };
}
