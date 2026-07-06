export const DEFAULT_ANALYZE_MAX_UPLOAD_MB = 25;

const DEFAULT_ANALYZE_ALLOWED_MIME = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/html",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

export const DEFAULT_ANALYZE_ALLOWED_MIME_CSV = DEFAULT_ANALYZE_ALLOWED_MIME.join(",");

const MIME_ACCEPT_TOKENS = {
  "application/pdf": ["application/pdf", ".pdf"],
  "text/plain": ["text/plain", ".txt"],
  "text/markdown": ["text/markdown", ".md", ".markdown"],
  "text/html": ["text/html", ".html", ".htm"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".docx"
  ]
};

function parseAnalyzeAllowedMime(rawValue) {
  const parsed = String(rawValue || "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length ? Array.from(new Set(parsed)) : [...DEFAULT_ANALYZE_ALLOWED_MIME];
}

export function readAnalyzeMaxUploadMb(value, fallback = DEFAULT_ANALYZE_MAX_UPLOAD_MB) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function inferAnalyzeMimeFromFileName(fileName) {
  const name = String(fileName || "").trim().toLowerCase();
  if (!name) return "";
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "text/markdown";
  if (name.endsWith(".html") || name.endsWith(".htm")) return "text/html";
  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "";
}

export function resolveAnalyzeMimeType({
  mimeTypeFromRequest = "",
  mimeTypeFromFile = "",
  fileName = "",
  allowedMime = DEFAULT_ANALYZE_ALLOWED_MIME
} = {}) {
  const allowedSet = new Set(parseAnalyzeAllowedMime(allowedMime.join ? allowedMime.join(",") : allowedMime));
  const candidates = [
    String(mimeTypeFromRequest || "").trim().toLowerCase(),
    String(mimeTypeFromFile || "").trim().toLowerCase(),
    inferAnalyzeMimeFromFileName(fileName)
  ];
  return candidates.find(mime => mime && allowedSet.has(mime)) || "";
}

export function buildAnalyzeAcceptAttr(allowedMimeList = DEFAULT_ANALYZE_ALLOWED_MIME) {
  const tokens = new Set();
  for (const mime of parseAnalyzeAllowedMime(
    Array.isArray(allowedMimeList) ? allowedMimeList.join(",") : allowedMimeList
  )) {
    const acceptTokens = MIME_ACCEPT_TOKENS[mime] || [mime];
    for (const token of acceptTokens) {
      tokens.add(token);
    }
  }
  return Array.from(tokens).join(",");
}
