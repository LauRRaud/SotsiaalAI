import { localizePath } from "@/lib/localizePath";

const INTERNAL_HREF_RE = /href=(["'])(\/(?!\/)[^"'<>]*)\1/gi;

export function localizeInternalHtmlLinks(html, locale = "et") {
  if (typeof html !== "string" || !html) return html;
  return html.replace(INTERNAL_HREF_RE, (full, quote, hrefPath) => {
    const raw = String(hrefPath || "").trim();
    if (!raw) return full;
    if (raw.startsWith("/api/") || raw.startsWith("/_next/")) return full;
    const localized = localizePath(raw, locale);
    return `href=${quote}${localized}${quote}`;
  });
}

