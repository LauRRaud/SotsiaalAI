export const WORKER_FRAMEWORK_KEY = "WORKER_DATA_PROCESSING";
// New public copy; historical documents and acceptance records retain their old version.
// The signed ASiC-E is a previous version and must not be rewritten.
export const WORKER_FRAMEWORK_VERSION = "2026-10-03";
export const WORKER_FRAMEWORK_ACCEPTANCE_TYPE = "WORKER_ACK";
export const WORKER_FRAMEWORK_ACCEPTANCE_SOURCE = "REGISTER_FLOW";
export const WORKER_FRAMEWORK_ACCOUNT_ACCEPTANCE_SOURCE = "ACCOUNT_FRAMEWORK_PAGE";
export const WORKER_FRAMEWORK_REVIEW_STORAGE_KEY = "worker_framework_review_opened_at:2026-10-03";
export const WORKER_FRAMEWORK_SIGNED_DOWNLOAD_STORAGE_KEY = "worker_framework_signed_downloaded_at:2026-10-03";
export const WORKER_FRAMEWORK_REGISTER_CONTEXT_STORAGE_KEY = "worker_framework_register_context";
export const WORKER_FRAMEWORK_REGISTER_ACK_STORAGE_KEY = "worker_framework_register_ack:2026-10-03";
const WORKER_FRAMEWORK_DOCX_HREF = "/legal/sotsiaal-pro-framework-et-2026-10-03.docx";
export const WORKER_FRAMEWORK_SIGNED_HREF = "/legal/sotsiaalai_tooalase_kasutuse_raamleping.asice";
const WORKER_FRAMEWORK_DOCX_HREFS = {
  et: WORKER_FRAMEWORK_DOCX_HREF,
  en: "/legal/sotsiaal-pro-framework-en-2026-10-03.docx",
  ru: "/legal/sotsiaal-pro-framework-ru-2026-10-03.docx"
};

export function getWorkerFrameworkDocxHref(locale = "et") {
  return WORKER_FRAMEWORK_DOCX_HREFS[locale] || WORKER_FRAMEWORK_DOCX_HREFS.et;
}

export function normalizeOptionalTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}
