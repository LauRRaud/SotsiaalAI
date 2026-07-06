"use client";

import { localizeInternalHtmlLinks } from "@/lib/localizeHtmlLinks";

export default function RichText({
  value,
  as: Component = "span",
  className,
  replacements = {},
  locale
}) {
  if (!value) return null;
  const resolvedLocale =
    typeof locale === "string" && locale.trim()
      ? locale.trim()
      : typeof document !== "undefined" && document?.documentElement?.lang
        ? String(document.documentElement.lang).trim()
        : "et";
  let html = value;
  Object.entries(replacements).forEach(([tag, replacement]) => {
    if (!replacement) return;
    const {
      open = "",
      close = ""
    } = typeof replacement === "string" ? {
      open: replacement,
      close: ""
    } : replacement;
    const openRe = new RegExp(`<${tag}>`, "g");
    const closeRe = new RegExp(`</${tag}>`, "g");
    html = html.replace(openRe, open).replace(closeRe, close);
  });
  html = localizeInternalHtmlLinks(html, resolvedLocale);
  return <Component className={className} dangerouslySetInnerHTML={{
    __html: html
  }} />;
}
