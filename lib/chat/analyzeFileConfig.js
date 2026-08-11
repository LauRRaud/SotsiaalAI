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

/**
 * SOL-CHAT-09 — SISU KINNITAB TÜÜBI, MITTE DEKLARATSIOON.
 *
 * `resolveAnalyzeMimeType()` ülal valib tüübi kolme KLIENDI antud kandidaadi seast (päringu
 * `mimeType`, brauseri `file.type`, laiend) — ükski neist ei ole tõend. Sellega sai kasutaja ise
 * otsustada, milline parser tema baite näeb: „ütlen text/plain, saadan ZIP-pommi" oli lubatud.
 *
 * See funktsioon on RAG-teenuse `upload_limits.mime_conflict()` peegel Node-poolel. Kaks väravat
 * kahes protsessis on siin põhjendatud, mitte dubleeritud: teenus kaitseb ennast ka teiste
 * kutsujate eest, marsruut hoiab ära kasuta suure faili asjatu edasisaatmise. Mõlemad on
 * fail-closed — tundmatu sisu EI kinnita ühtegi deklaratsiooni.
 *
 * @param head esimesed baidid (`Uint8Array`), vähemalt paarsada.
 * @returns konflikti põhjus või `null`, kui sisu ja deklaratsioon on kooskõlas.
 */
export function analyzeMimeConflict(head, declaredMime) {
  const declared = String(declaredMime || "").trim().toLowerCase();
  if (!declared) return "missing_declared_mime";
  const bytes = head instanceof Uint8Array ? head : new Uint8Array(head || []);
  if (!bytes.length) return "empty_file";

  const startsWith = (signature) =>
    signature.every((byte, index) => bytes[index] === byte);

  const isPdf = startsWith([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);

  if (declared === "application/pdf") {
    return isPdf ? null : "declared_pdf_but_content_is_not_pdf";
  }
  if (declared === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    // DOCX-i sisemine struktuur kontrollitakse RAG-teenuses, kus arhiiv niikuinii avatakse.
    return isZip ? null : "declared_docx_but_content_is_not_zip";
  }
  if (declared === "text/plain" || declared === "text/markdown" || declared === "text/html") {
    if (isPdf || isZip) return "declared_text_but_content_is_a_container";
    const sample = bytes.subarray(0, 4096);
    if (sample.includes(0)) return "declared_text_but_content_is_binary";
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(sample.subarray(0, sample.length - 4));
    } catch {
      return "declared_text_but_content_is_binary";
    }
    return null;
  }
  return "unsupported_declared_mime";
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
