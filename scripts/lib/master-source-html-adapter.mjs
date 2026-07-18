import crypto from "node:crypto";

import { buildKnowledgeMetadataFromSourceMasterRecord } from "./source-master-knowledge-docs.mjs";

export function normalizeHtmlOrTopicText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}

export function contentHashForHtmlOrTopic(text) {
  return crypto.createHash("sha256").update(normalizeHtmlOrTopicText(text).toLocaleLowerCase("et"), "utf8").digest("hex");
}

export function masterSourceDocumentId(sourceId, version) {
  return `master-source:${String(sourceId).trim()}:v${Number(version)}`;
}

export function buildHtmlOrTopicIngestPayload({ record, html, checkedAt, version, finalUrl, supersedesDocId = null }) {
  const text = normalizeHtmlOrTopicText(html);
  if (!text) throw new TypeError("master_source_html_text_empty");
  const contentHash = contentHashForHtmlOrTopic(text);
  const docId = masterSourceDocumentId(record.source_id, version);
  const metadata = buildKnowledgeMetadataFromSourceMasterRecord(record, {
    checkedAt,
    docId,
    canonicalSourceId: `master-source:${record.source_id}`,
    contentHash,
    sourceFormat: "html",
    sourceOriginType: "source_master_html_or_topic",
    sourceUrl: finalUrl || record.url,
    urlCanonical: finalUrl || record.normalized_url || record.url
  });
  return {
    doc_id: docId,
    text,
    metadata: {
      ...metadata,
      version: Number(version),
      is_current_version: true,
      supersedes_doc_id: supersedesDocId || null,
      source_status: "active"
    },
    contentHash
  };
}
