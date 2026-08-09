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

import { useCallback, useEffect, useRef, useState } from "react";

import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import { useI18n } from "@/components/i18n/I18nProvider";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";

import CaseWorkDetail from "./CaseWorkDetail";
import { mergeCaseRows, planCaseNavigation, readCaseIdFromSearch } from "./caseListState";
import {
  caseLabelText,
  caseWorkRequest,
  fromLocalInputValue,
  newClientActionKey,
  retentionLabelKey
} from "./caseWorkClient";

const PAGE_SIZE = 25;

/** Töötaja rollid — sama hulk mis `lib/casework/routes.js` väraval. */
const WORKER_ROLES = new Set(["SOCIAL_WORKER", "SERVICE_PROVIDER"]);

export default function CaseWorkShell() {
  const { t, locale } = useI18n();
  const { effectiveRole, isRoleResolved } = useEffectiveRole();
  const allowed = WORKER_ROLES.has(String(effectiveRole || "").toUpperCase());

  /* ⓘ SISU TULEB LEHELT, mitte staatilisest marsruudikaardist. Juhend elab
     `lib/dashboardInfoContent.js`-is võtme `casework` all ja avaneb kiirmenüüs
     lehe nime kõrval. Ilma selle kutseta oleks pind ainus koht platvormil, kus
     ⓘ vaikib — ja juhtumi piirid (ei ole register · ei anta üle · kliendiviite
     kustutamine on lõplik) on täpselt see, mida ei tohi jätta kasutaja enda
     avastada. */
  usePanelInfoSlot({ infoId: "casework" });

  const [cases, setCases] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [state, setState] = useState("loading");
  const [errorKey, setErrorKey] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  /* Mitu ajalookirjet oleme ISE lisanud (SOL-CW-09). Otselingiga saabunud
     kasutaja juures ei tohi „tagasi" viia teda platvormilt välja. */
  const pushedDepthRef = useRef(0);

  const [displayName, setDisplayName] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [nextContact, setNextContact] = useState("");
  const [creating, setCreating] = useState(false);
  /* Loomistunnus (SOL-CW-12). Keelatud nupp katab ainult topeltklõpsu ÜHES
     brauseris; võrgu timeout ja kliendi korduskatse jõuavad serverini nii, et
     nupp on juba vabastatud. Võti elab REF-is, mitte state'is: tema muutus ei
     tohi vormi uuesti renderdada, ja saatmise hetkel peab kehtima viimane
     väärtus, mitte renderdusse kinni jäänud. */
  const actionKeyRef = useRef(null);

  /**
   * Väljamuutja, mis tühistab ka loomistunnuse.
   *
   * VÕTI ON SEOTUD SELLE SISUGA, mida kasutaja parasjagu saadab. Muutmata
   * sisuga korduskatse peab jõudma sama juhtumini; muudetud sisu on uus tegu ja
   * peab saama uue võtme — vana võtme all annaks server 409 („sama tunnus teise
   * sisuga"), mis oleks kasutajale arusaamatu ja tema töö kinni panek.
   */
  const changeField = (setter) => (event) => {
    actionKeyRef.current = null;
    setter(event.target.value);
  };

  const load = useCallback(
    async ({ cursor = null, append = false } = {}) => {
      setState("loading");
      setErrorKey(null);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (cursor) params.set("cursor", cursor);
        const body = await caseWorkRequest(`/cases?${params.toString()}`, { locale });
        /* Liitmine käib ID järgi (SOL-CW-10): sama kursoriga vastus ei tohi
           samu ridu kaks korda loendisse panna. */
        setCases((previous) => (append ? mergeCaseRows(previous, body.items || []) : body.items || []));
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

  /* Valitud juhtum tuleb URL-ist ja läheb URL-i tagasi. `pushState`, MITTE
     `replaceState` (SOL-CW-09): juhtumi avamine ON navigatsioon ja Back peab
     viima loendisse. `replaceState` kirjutas loendi ajalookirje üle ja Back
     viis eelmisele LEHELE. */
  useEffect(() => {
    setSelectedId(readCaseIdFromSearch(window.location.search));

    /* Ilma `popstate` kuulajata jääks Back/Forward URL-i muutma, aga vaade
       samaks — kaks tõde ühe asja kohta. */
    const onPopState = () => {
      pushedDepthRef.current = Math.max(0, pushedDepthRef.current - 1);
      setSelectedId(readCaseIdFromSearch(window.location.search));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openCase = useCallback((id) => {
    const plan = planCaseNavigation({
      href: window.location.href,
      currentId: selectedId,
      nextId: id,
      pushedDepth: pushedDepthRef.current
    });
    if (plan.action === "none") return;
    if (plan.action === "back") {
      /* Vaate muudab `popstate` kuulaja — nii jäävad URL ja vaade ühte tõtte
         ka siis, kui kasutaja vajutab brauseri nuppu, mitte meie oma. */
      window.history.back();
      return;
    }
    setSelectedId(id || null);
    if (plan.action === "push") {
      pushedDepthRef.current += 1;
      window.history.pushState(null, "", plan.url);
    } else {
      window.history.replaceState(null, "", plan.url);
    }
  }, [selectedId]);

  const createCase = useCallback(
    async (event) => {
      event.preventDefault();
      setCreating(true);
      setErrorKey(null);
      try {
        /* SAMA VÕTI kuni sisu püsib: korduskatse peab jõudma sama juhtumini,
           mitte tegema teist. Uus võti sünnib alles siis, kui eelmine tegu on
           lõpetatud või sisu muutunud. */
        if (!actionKeyRef.current) actionKeyRef.current = newClientActionKey();
        const body = await caseWorkRequest("/cases", {
          method: "POST",
          locale,
          body: {
            clientDisplayName: displayName.trim() || null,
            clientExternalRef: externalRef.trim() || null,
            nextContactAt: fromLocalInputValue(nextContact),
            clientActionId: actionKeyRef.current
          }
        });
        actionKeyRef.current = null;
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
              onChange={changeField(setDisplayName)}
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
              onChange={changeField(setExternalRef)}
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
              onChange={changeField(setNextContact)}
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

      {/* Nupp on laadimise ajal KEELATUD (SOL-CW-10): kiire topeltvajutus
          saatis kaks sama kursoriga päringut ja lisas samad read kaks korda. */}
      {nextCursor ? (
        <button
          className="cw-button"
          type="button"
          disabled={state === "loading"}
          onClick={() => load({ cursor: nextCursor, append: true })}
        >
          {t("casework.page.load_more", "")}
        </button>
      ) : null}
    </section>
  );
}
