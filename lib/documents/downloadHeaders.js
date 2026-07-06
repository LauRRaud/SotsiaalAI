export function toAsciiDownloadFileName(value, fallback = "document") {
  const normalized = String(value || "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "")
    .trim();
  return normalized || fallback;
}
