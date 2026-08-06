"use client";

/**
 * JUHTUM-V1 (CASEWORK-P7) E6 — pind „Minu juhtumid".
 *
 * ÜKS MARSRUUT, KAKS NÄGU. Loend ja detailvaade elavad samal aadressil ja
 * valitud juhtum on URL-is (`?juhtum=<id>`): ilma selleta ei saaks töötaja
 * juhtumit järjehoidjasse panna ega brauseri tagasinupuga loendisse naasta.
 * Kaks eri marsruuti tähendaks kahte kohta, kust sama asja otsida.
 *
 * ROLLIKONTROLL ON VIISAKUS, MITTE VÄRAV. Server ütleb sama niikuinii
 * (`guardCaseWorkRequest`) ja pind ei tohi olla ainus koht, kus piir kehtib —
 * siin on ta selleks, et vale rolliga inimene näeks lauset, mitte tühja kasti.
 *
 * PAGINEERIMINE ON KOHUSTUSLIK (leping E6). Loend kasvab juhtumite, mitte
 * ekraani mõõtu; „näita rohkem" kannab serveri cursor'it, mitte lehekülje
 * numbrit — sama ajatempliga read ei tohi korduda ega kaduda.
 */

import { useCallback, useEffect, useState } from "react";

import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import { useI18n } from "@/components/i18n/I18nProvider";

import CaseWorkDetail from "./CaseWorkDetail";
import { caseLabelText, caseWorkRequest, fromLocalInputValue, retentionLabelKey } from "./caseWorkClient";

const CASE_PARAM = "juhtum";
const PAGE_SIZE = 25;

/** Töötaja rollid — sama hulk mis `lib/casework/routes.js` väraval. */
const WORKER_ROLES = new Set(["SOCIAL_WORKER", "SERVICE_PROVIDER"]);

export default function CaseWorkShell() {
  const { t, locale } = useI18n();
  const { effectiveRole, isRoleResolved } = useEffectiveRole();
  const allowed = WORKER_ROLES.has(String(effectiveRole || "").toUpperCase());

  const [cases, setCases] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [state, setState] = useState("loading");
  const [errorKey, setErrorKey] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [displayName, setDisplayName] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [nextContact, setNextContact] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    async ({ cursor = null, append = false } = {}) => {
      setState("loading");
      setErrorKey(null);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (cursor) params.set("cursor", cursor);
        const body = await caseWorkRequest(`/cases?${params.toString()}`, { locale });
        setCases((previous) => (append ? [...previous, ...(body.items || [])] : body.items || []));
        setNextCursor(body.nextCursor || null);
        setState("ready");
      } catch (error) {
        setErrorKey(error?.messageKey || "casework.page.load_error");
        setState("error");
      }
    },
    [locale]
  );

  useEffect(() => {
    if (!allowed) return;
    load();
  }, [allowed, load]);

  /* Valitud juhtum tuleb URL-ist ja läheb URL-i tagasi. `replaceState`, mitte
     marsruut: juhtumi avamine ei ole navigatsioon ja ei tohi täita ajalugu. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get(CASE_PARAM);
    if (requested) setSelectedId(requested);
  }, []);

  const openCase = useCallback((id) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set(CASE_PARAM, id);
    else url.searchParams.delete(CASE_PARAM);
    window.history.replaceState(null, "", url);
  }, []);

  const createCase = useCallback(
    async (event) => {
      event.preventDefault();
      setCreating(true);
      setErrorKey(null);
      try {
        const body = await caseWorkRequest("/cases", {
          method: "POST",
          locale,
          body: {
            clientDisplayName: displayName.trim() || null,
            clientExternalRef: externalRef.trim() || null,
            nextContactAt: fromLocalInputValue(nextContact)
          }
        });
        setDisplayName("");
        setExternalRef("");
        setNextContact("");
        await load();
        if (body?.case?.id) openCase(body.case.id);
      } catch (error) {
        setErrorKey(error?.messageKey || "casework.errors.unexpected");
      } finally {
        setCreating(false);
      }
    },
    [displayName, externalRef, load, locale, nextContact, openCase]
  );

  if (!isRoleResolved) return null;

  if (!allowed) {
    return (
      <section className="cw-shell">
        <p className="cw-empty">{t("casework.page.not_allowed", "")}</p>
      </section>
    );
  }

  if (selectedId) {
    return (
      <section className="cw-shell">
        <CaseWorkDetail caseId={selectedId} onBack={() => openCase(null)} onChanged={() => load()} />
      </section>
    );
  }

  return (
    <section className="cw-shell">
      <header className="cw-intro">
        <h1 className="cw-title">{t("casework.page.title", "")}</h1>
        {/* TOOTEPIIR ON PEALKIRJA KÕRVAL, mitte abitekstis: juhtum ei ole
            register ega ametlik toimik ja seda peab lugema enne, kui midagi
            sisestatakse. */}
        <p className="cw-subtitle">{t("casework.page.subtitle", "")}</p>
      </header>

      <section className="cw-section">
        <h2 className="cw-section-title">{t("casework.page.create_heading", "")}</h2>
        <p className="cw-hint">{t("casework.page.create_hint", "")}</p>
        <form className="cw-form cw-form--inline" onSubmit={createCase}>
          <div className="cw-field">
            <label className="cw-label" htmlFor="cw-create-display-name">
              {t("casework.page.client_display_name", "")}
            </label>
            <input
              id="cw-create-display-name"
              className="cw-input"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={120}
            />
          </div>
          <div className="cw-field">
            <label className="cw-label" htmlFor="cw-create-external-ref">
              {t("casework.page.client_external_ref", "")}
            </label>
            <input
              id="cw-create-external-ref"
              className="cw-input"
              type="text"
              value={externalRef}
              onChange={(event) => setExternalRef(event.target.value)}
              maxLength={120}
            />
          </div>
          <div className="cw-field">
            <label className="cw-label" htmlFor="cw-create-next-contact">
              {t("casework.page.next_contact", "")}
            </label>
            <input
              id="cw-create-next-contact"
              className="cw-input"
              type="datetime-local"
              value={nextContact}
              onChange={(event) => setNextContact(event.target.value)}
            />
          </div>
          <button className="cw-button" type="submit" disabled={creating}>
            {t("casework.page.create_submit", "")}
          </button>
        </form>
      </section>

      {errorKey ? (
        <p className="cw-error" role="alert">
          {t(errorKey, "")}
        </p>
      ) : null}

      {state === "loading" && !cases.length ? <p className="cw-empty">{t("casework.page.loading", "")}</p> : null}

      {state !== "loading" && !cases.length ? <p className="cw-empty">{t("casework.page.empty", "")}</p> : null}

      <ul className="cw-list">
        {cases.map((row) => (
          <li className="cw-case" key={row.id}>
            <span className="cw-case-label">{caseLabelText(row.label, t)}</span>
            <span className="cw-case-meta">
              <span className="cw-badge">{t(retentionLabelKey(row.retentionState), "")}</span>
            </span>
            <button className="cw-button" type="button" onClick={() => openCase(row.id)}>
              {t("casework.page.open", "")}
            </button>
          </li>
        ))}
      </ul>

      {nextCursor ? (
        <button className="cw-button" type="button" onClick={() => load({ cursor: nextCursor, append: true })}>
          {t("casework.page.load_more", "")}
        </button>
      ) : null}
    </section>
  );
}
