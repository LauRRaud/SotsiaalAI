"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { localizePath } from "@/lib/localizePath";

function formatDate(value, locale) {
  try { return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)); } catch { return ""; }
}

export default function PersonalSearchPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [state, setState] = useState("idle");
  const [results, setResults] = useState([]);
  const abortRef = useRef(null);
  const requestRef = useRef(0);

  const search = useCallback(async (nextQuery) => {
    const normalized = String(nextQuery || "").trim();
    abortRef.current?.abort();
    if (!normalized) { setResults([]); setState("idle"); return; }
    const token = ++requestRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setState("loading");
    try {
      const response = await fetch(`/api/otsi?q=${encodeURIComponent(normalized)}`, { cache: "no-store", signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (token !== requestRef.current) return;
      if (!response.ok || payload?.ok !== true) throw new Error(payload?.messageKey || "api.search.unavailable");
      setResults(Array.isArray(payload.results) ? payload.results : []);
      setState(Array.isArray(payload.results) && payload.results.length ? "results" : "empty");
    } catch (error) {
      if (error?.name === "AbortError" || token !== requestRef.current) return;
      setState("error");
    }
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);
  const onSubmit = (event) => { event.preventDefault(); search(query); };

  return (
    <main className="personal-search" lang={locale}>
      <SubpageHeader showBack onBack={() => router.push(localizePath("/vestlus", locale))}>{t("personal_search.title", "Minu otsing")}</SubpageHeader>
      <p>{t("personal_search.intro", "Otsi oma vestlusi, Teekondi ja dokumente pealkirja järgi.")}</p>
      <form role="search" onSubmit={onSubmit}>
        <label htmlFor="personal-search-query">{t("personal_search.label", "Otsing")}</label>
        <div>
          <input id="personal-search-query" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} autoComplete="off" />
          <button type="submit">{t("personal_search.submit", "Otsi")}</button>
        </div>
      </form>
      <p role="status" aria-live="polite" aria-atomic="true">
        {state === "loading" ? t("personal_search.loading", "Otsin sinu objekte…") : ""}
        {state === "empty" ? t("personal_search.empty", "Vasteid ei leitud.") : ""}
      </p>
      {state === "error" ? (
        <div role="alert">
          <p>{t("personal_search.error", "Otsingut ei saanud praegu teha. Proovi uuesti.")}</p>
          <button type="button" onClick={() => search(query)}>{t("personal_search.retry", "Proovi uuesti")}</button>
        </div>
      ) : null}
      {state === "results" ? (
        <ol aria-label={t("personal_search.results", "Otsingutulemused")}>
          {results.map((item, index) => (
            <li key={`${item.kind}-${index}`}>
              <a href={localizePath(item.href, locale)}>
                <span>{item.title}</span>
                <span>{t(`personal_search.kinds.${item.kind}`, item.kind)}</span>
                <span>{item.status ? t(`personal_search.status.${String(item.status).toLowerCase()}`, item.status) : ""}</span>
                <time dateTime={item.updatedAt || undefined}>{formatDate(item.updatedAt, locale)}</time>
              </a>
            </li>
          ))}
        </ol>
      ) : null}
    </main>
  );
}
