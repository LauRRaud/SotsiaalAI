const MAX_SUMMARY_LENGTH = 3000;
const MAX_TEXT_LENGTH = 600;
const MAX_LIST_ITEMS = 8;
const ALLOWED_CONFIRMED_KEYS = new Set([
  "summary", "domains", "missingInfo", "wish", "personContext",
  "assistiveDevices", "serviceContinuity", "municipality", "document", "title"
]);

function cleanText(value, limit = MAX_TEXT_LENGTH) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, limit);
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : item?.title || item?.description || ""))
    .map((item) => cleanText(item, 240))
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS);
}

export function normalizePreInquiryJourneySharedInfo(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const summary = cleanText(value.summary, MAX_SUMMARY_LENGTH);
  const domains = normalizeList(value.domains);
  const missingInfo = normalizeList(value.missingInfo);
  const suggestedActions = normalizeList(value.suggestedActions);
  const primaryPath = cleanText(value.primaryPath, 80);
  const contextNote = cleanText(value.contextNote, 1000);
  const source = cleanText(value.source, 80) || "journey_pre_inquiry_handoff";
  const confirmedKeys = Array.isArray(value.confirmedKeys)
    ? Array.from(new Set(value.confirmedKeys.map((key) => String(key || "").trim())))
        .filter((key) => ALLOWED_CONFIRMED_KEYS.has(key))
    : [];

  if (!summary && !domains.length && !missingInfo.length && !suggestedActions.length && !primaryPath && !contextNote && !Object.hasOwn(value, "confirmedKeys")) {
    return null;
  }

  return {
    version: 1,
    source,
    confirmedKeys,
    summary,
    domains,
    missingInfo,
    suggestedActions,
    primaryPath,
    contextNote,
    userConfirmed: true
  };
}
