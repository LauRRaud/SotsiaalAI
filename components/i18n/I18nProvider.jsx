"use client";

import React, { createContext, use, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { hasTexts } from "@/lib/i18n/catalogLoader";
import { loadCatalog, readCatalog, refreshCatalog } from "./catalogs";
const I18nContext = createContext(null);
function get(obj, path, fallback) {
  if (!obj) return fallback;
  const parts = String(path).split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];else return fallback;
  }
  return cur;
}
function interpolate(template, vars) {
  if (!template || !vars || typeof template !== "string") return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => Object.prototype.hasOwnProperty.call(vars, k) && vars[k] != null ? String(vars[k]) : m);
}

/**
 * KUST KATALOOG TULEB. Kataloogi ei anta enam atribuudina (nii kirjutati umbes
 * 800 kB teksti iga lehe HTML-i sisse). Lehe enda keele kataloog on käes enne
 * esimest joonistust (`readCatalog`, vt ./catalogs.js): brauseris pani selle
 * kohale lehe lõpu skript, serveris on see serveri mälus. Nii joonistab server
 * lehe päris tekstidega ja brauser elustab selle samade tekstidega.
 *
 * VARUTEE. Kui lehe skript ei jõudnud kohale (päring ebaõnnestus), laaditakse
 * keelefail eraldi ja `use` ootab selle ära: serveri joonistatud leht jääb
 * seni ette ja tõlkimata võtmeid ei näidata. See on erand, mitte tavaline tee:
 * oodates teeb React brauseris tühja tööd. Lubadus hoitakse olekus, sest `use`
 * peab igal joonistusel saama sama lubaduse.
 */
export default function I18nProvider({
  initialLocale = "et",
  children
}) {
  const [locale, setLocaleState] = useState(initialLocale);
  const [ready] = useState(() => readCatalog(initialLocale));
  const [pending] = useState(() => (ready ? null : loadCatalog(initialLocale)));
  const loaded = ready || use(pending);
  /* Hiljem vahetatud kataloog: keelevahetuse eelvaade ja salvestatud keel
     (ligipääsetavuse aken kutsub `setMessages`), teise keelega värskendatud leht
     või uuesti õnnestunud laadimine. */
  const [replaced, setReplaced] = useState(null);
  const dict = replaced || loaded;
  const liveRef = useRef(null);
  const missingKeysRef = useRef(new Set());
  const t = useCallback((key, arg2, arg3) => {
    const hasVars = arg2 && typeof arg2 === "object" && !Array.isArray(arg2);
    const vars = hasVars ? arg2 : arg3 && typeof arg3 === "object" ? arg3 : undefined;
    const fallback = hasVars ? typeof arg3 === "string" ? arg3 : "" : typeof arg2 === "string" ? arg2 : "";
    const val = get(dict, key, undefined);
    if (val == null) {
      if (process.env.NODE_ENV !== "production" && !missingKeysRef.current.has(key)) {
        missingKeysRef.current.add(key);
        console.warn(`[i18n] missing key: ${key}`);
      }
      return interpolate(fallback || key, vars);
    }
    return vars ? interpolate(String(val), vars) : val;
  }, [dict]);
  const announce = useCallback(msg => {
    const el = liveRef.current;
    if (!el) return;
    el.textContent = "";
    setTimeout(() => {
      el.textContent = msg;
    }, 30);
  }, []);
  const setLocale = useCallback(async nextLocale => {
    if (!nextLocale || nextLocale === locale) return;
    try {
      document.documentElement.setAttribute("lang", nextLocale);
    } catch {}
    try {
      localStorage.setItem("NEXT_LOCALE", nextLocale);
    } catch {}
    try {
      document.cookie = `NEXT_LOCALE=${encodeURIComponent(nextLocale)}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
    setLocaleState(nextLocale);
    const languageName = get(dict, `common.languages.${nextLocale}`, nextLocale);
    const template = get(dict, "common.language_changed", "Language changed: {language}");
    announce(template.replace("{language}", languageName));
  }, [locale, dict, announce]);
  /* Tühi kataloog ei asenda olemasolevat: ebaõnnestunud laadimine ei tohi
     tekste ekraanilt ära võtta. */
  const setMessages = useCallback(nextMessages => {
    setReplaced(hasTexts(nextMessages) ? nextMessages : null);
  }, []);
  /* Leht tuli serverist teise keelega kui see, millega ta avati (keel vahetati
     ja leht värskendati): võetakse selle keele kataloog. Esimesel korral on
     õige kataloog juba käes. */
  const shownLocaleRef = useRef(initialLocale);
  useEffect(() => {
    if (!initialLocale) return undefined;
    setLocaleState(initialLocale);
    try {
      document.documentElement.setAttribute("lang", initialLocale);
    } catch {}
    if (shownLocaleRef.current === initialLocale) return undefined;
    shownLocaleRef.current = initialLocale;
    let live = true;
    refreshCatalog(initialLocale).then(next => {
      if (live && hasTexts(next)) setReplaced(next);
    });
    return () => {
      live = false;
    };
  }, [initialLocale]);
  /* Kataloogi laadimine ebaõnnestus (võrk katkes): leht töötab varutekstidega
     ja proovib ühe korra uuesti. */
  const emptyAtMount = !hasTexts(loaded);
  useEffect(() => {
    if (!emptyAtMount) return undefined;
    let live = true;
    const timer = setTimeout(() => {
      refreshCatalog(shownLocaleRef.current).then(next => {
        if (live && hasTexts(next)) setReplaced(next);
      });
    }, 4000);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [emptyAtMount]);
  const value = useMemo(() => ({
    locale,
    messages: dict,
    t,
    setLocale,
    setMessages
  }), [locale, dict, t, setLocale, setMessages]);
  return <I18nContext.Provider value={value}>
      <div ref={liveRef} aria-live="polite" aria-atomic="true" style={{
      position: "absolute",
      width: 1,
      height: 1,
      overflow: "hidden",
      clip: "rect(0 0 0 0)"
    }} />
      {children}
    </I18nContext.Provider>;
}
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
