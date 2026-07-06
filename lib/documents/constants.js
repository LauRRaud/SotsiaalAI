export const DOCUMENT_LIST_LIMIT = 50
export const ARTIFACT_LIST_LIMIT = 10
export const ARTIFACT_LIST_LIMIT_ALL = 50
export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024
export const MAX_ARTIFACT_CONTENT_LENGTH = 120_000
export const MAX_ARTIFACT_SOURCE_DOCUMENTS = 10
export const MAX_DOCX_TEMPLATE_ENTRIES = 512
export const MAX_DOCX_TEMPLATE_TOTAL_UNCOMPRESSED_BYTES = 16 * 1024 * 1024

export const DOCUMENT_KIND_VALUES = [
  "TEMPLATE",
  "MATERIAL",
  "OTHER",
  "CALL_AUDIO_RECORDING",
  "CALL_TRANSCRIPT",
  "AUDIO_TRANSCRIPT",
  "TRANSCRIPT_SUMMARY",
  "UPLOADED_AUDIO_SOURCE"
]
export const TEMPLATE_FOR_VALUES = [
  "REPORT_DRAFT",
  "CASE_BRIEF",
  "MEETING_SUMMARY",
  "CHECKLIST",
  "LETTER_DRAFT",
  "OTHER"
]
export const AGENT_ARTIFACT_TYPE_VALUES = [
  "MEETING_SUMMARY",
  "TRANSCRIPT_SUMMARY",
  "CASE_SUMMARY",
  "PRE_ASSESSMENT_SUMMARY",
  "STAR_HELPER",
  "CASE_BRIEF",
  "REPORT_DRAFT",
  "ACTION_PLAN",
  "CHECKLIST",
  "LETTER_DRAFT",
  "OTHER"
]
export const AGENT_ARTIFACT_STATUS_VALUES = ["DRAFT", "FINAL"]

export const ALLOWED_DOCUMENT_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"]
}

export const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
export const PDF_MIME_TYPE = "application/pdf"
export const ARTIFACT_DOWNLOAD_FORMATS = ["docx", "pdf"]

export const FALLBACK_DOCS_STORAGE_DIR = "tmp/documents"
