"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import { localizePath } from "@/lib/localizePath";

import styles from "./search.module.css";

function formatDate(value, locale) {
  try { return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)); } catch { return ""; }
}

export default function PersonalSearchPage() {
  const { t, locale } = useI18n();
  /* Kataloog annab puuduva sõna asemel võtme enda: tundmatu liik või seis jääb
     siis näitamata, mitte ei jõua võtmena ekraanile. */
  const word = (key) => {
    const text = t(key);
    return text === key ? "" : text;
  };
  const [query, setQuery] = useState("");
  const [state, setState] = useState("idle");
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState({ hasMore: false, nextCursor: null });
  const [unavailableKinds, setUnavailableKinds] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const abortRef = useRef(null);
  const requestRef = useRef(0);

  const search = useCallback(async (nextQuery, { append = false, cursor = null } = {}) => {
    const normalized = String(nextQuery || "").trim();
    abortRef.current?.abort();
    if (!normalized) {
      setResults([]);
      setPagination({ hasMore: false, nextCursor: null });
      setUnavailableKinds([]);
      setState("idle");
      return;
    }
    const token = ++requestRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    if (append) setLoadingMore(true);
    else setState("loading");
    try {
      const response = await fetch("/api/otsi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalized, cursor }),
        cache: "no-store",
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (token !== requestRef.current) return;
      if (!response.ok || payload?.ok !== true) throw new Error(payload?.messageKey || "api.search.unavailable");
      const nextResults = Array.isArray(payload.results) ? payload.results : [];
      setResults((current) => {
        if (!append) return nextResults;
        const byTarget = new Map(current.map((item) => [`${item.kind}:${item.href}`, item]));
        nextResults.forEach((item) => byTarget.set(`${item.kind}:${item.href}`, item));
        return Array.from(byTarget.values());
      });
      setPagination({
        hasMore: Boolean(payload?.pagination?.hasMore),
        nextCursor: payload?.pagination?.nextCursor || null
      });
      setUnavailableKinds(Array.isArray(payload?.unavailableKinds) ? payload.unavailableKinds : []);
      setState(append || nextResults.length ? "results" : "empty");
    } catch (error) {
      if (error?.name === "AbortError" || token !== requestRef.current) return;
      setState("error");
    } finally {
      if (token === requestRef.current) setLoadingMore(false);
    }
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);
  const onSubmit = (event) => { event.preventDefault(); search(query); };

  const status = state === "loading" ? t("personal_search.loading") : state === "empty" ? t("personal_search.empty") : "";

  /* Lehe nimi on all kiirmenüüs: paneel algab sellega, mida siit otsida saab.
     Leht on lame (üks väli ja selle tulemused), sammulava siin ei ole. */
  return (
    <section className={styles.page} lang={locale}>
      <h1 className="sr-only">{t("personal_search.title")}</h1>
      <StepPanel title={t("personal_search.title")} question={t("personal_search.intro")}>
        <div className={styles.stack}>
          <Form role="search" className={styles.search} onSubmit={onSubmit}>
            <div className={styles.field}>
              <Input
                id="personal-search-query"
                aria-label={t("personal_search.label")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={120}
                autoComplete="off"
              />
            </div>
            <Button type="submit" size="sm" variant="primary" disabled={state === "loading"}>
              {t("personal_search.submit")}
            </Button>
          </Form>
          <p className={styles.status} aria-live="polite" aria-atomic="true">
            {status}
          </p>
          {state === "error" ? (
            <div className={styles.fault}>
              <p className={styles.faultText} role="alert">
                {t("personal_search.error")}
              </p>
              <Button type="button" size="sm" variant="secondary" onClick={() => search(query)}>
                {t("personal_search.retry")}
              </Button>
            </div>
          ) : null}
          {unavailableKinds.length ? (
            <p className={styles.faultText} role="alert">
              {t("personal_search.partial", { kinds: unavailableKinds.map((kind) => word(`personal_search.kinds.${kind}`)).filter(Boolean).join(", ") })}
            </p>
          ) : null}
          {state === "results" ? (
            <>
              <ol className={styles.rows} aria-label={t("personal_search.results")}>
                {results.map((item) => {
                  const kind = word(`personal_search.kinds.${item.kind}`);
                  const itemStatus = item.status ? word(`personal_search.status.${String(item.status).toLowerCase()}`) : "";
                  return (
                    <li className={styles.rowItem} key={`${item.kind}:${item.href}`}>
                      <a className={styles.row} href={localizePath(item.href, locale)}>
                        {/* Pealkiri on TEKST: sisu tuleb React'i lapsena, mitte HTML-ina. */}
                        <span className={styles.rowTitle}>{item.title || word(`personal_search.untitled.${item.kind}`) || kind}</span>
                        <span className={styles.rowMeta}>
                          <span className={styles.kind}>{[kind, itemStatus].filter(Boolean).join(" · ")}</span>
                          <time className={styles.time} dateTime={item.updatedAt || undefined}>
                            {formatDate(item.updatedAt, locale)}
                          </time>
                        </span>
                        <span className={styles.open} aria-hidden="true">
                          ›
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ol>
              {pagination.hasMore ? (
                <div className={styles.more}>
                  <Button type="button" size="sm" variant="secondary" disabled={loadingMore} onClick={() => search(query, { append: true, cursor: pagination.nextCursor })}>
                    {loadingMore ? t("personal_search.loading_more") : t("personal_search.load_more")}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </StepPanel>
    </section>
  );
}
