import { isLegalSource as isRagLegalSource } from "../rag/sourceMetadata.js";

// Stable identifiers for already stored conversation sources and feedback.
export function isLegalSource(source = {}) {
  return isRagLegalSource({ source_type: source?.sourceType || source?.source_type });
}

export function getSourceAttributionId(source = {}, index = 0) {
  const legalId =
    isLegalSource(source)
      ? source?.id || source?.key || source?.chunk_id || source?.chunkId
      : "";
  const raw =
    legalId ||
    source?.source_id ||
    source?.sourceId ||
    source?.id ||
    source?.key ||
    source?.url ||
    source?.url_canonical ||
    source?.urlCanonical ||
    source?.source_url ||
    source?.sourceUrl ||
    source?.official_url ||
    source?.officialUrl ||
    source?.official_website ||
    source?.officialWebsite ||
    source?.metadata?.official_website ||
    source?.metadata?.officialWebsite ||
    source?.short_ref ||
    source?.title ||
    `source_${index}`;
  return String(raw || `source_${index}`).trim() || `source_${index}`;
}
