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
 *
 * KUJU (09.10). Leht oli üks veerg: pealkiri, loomise vorm ja selle all loend.
 * Nüüd on korraga ees üks asi: juhtumite loend seisu filtriga või uue juhtumi
 * vorm. Need vahetuvad kohapeal (nagu välitöö avalehel), mitte sammulaval:
 * loend ja vorm ei ole kaks järjestikust sammu. Lehe nimi on kiirmenüüs. Vaated
 * on failis ./cases/CaseListViews.jsx, kujundus selle kõrval, ridade sisu
 * failis ./caseViews.js. Siin on andmed, päringud ja see, mis vaateid olekuga
 * seob. Avatud juhtum (`CaseWorkDetail`) on osadena sammulaval.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import { useI18n } from "@/components/i18n/I18nProvider";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";

import CaseWorkDetail from "./CaseWorkDetail";
import { CaseCreateView, CaseListView } from "./cases/CaseListViews";
import styles from "./cases/cases.module.css";
import { mergeCaseRows, planCaseNavigation, readCaseIdFromSearch } from "./caseListState";
import { caseFilterOptions, caseListQuery, caseListRows } from "./caseViews";
import { caseWorkRequest, fromLocalInputValue, newClientActionKey } from "./caseWorkClient";

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

  /* Loendi filter: juhtumi seis. Filtreerib SERVER (`retentionState`), mitte
     pind: loend on pagineeritud ja laaditud ridade seast sõelumine jätaks
     mulje, et järgmistel lehtedel selle seisuga juhtumeid ei ole. */
  const [filter, setFilter] = useState("ALL");
  /* Loendi laadimise järjekorranumber. Filtri vahetus teeb uue päringu enne,
     kui eelmine vastas: hiljem saabunud vana vastus ei tohi uut loendit üle
     kirjutada ega „näita rohkem" lisada ridu teise filtri loendile. */
  const loadSeqRef = useRef(0);

  /* Milline vaade on ees: "list" või "create". */
  const [view, setView] = useState("list");
  /* Vaate vahetusel kaob nupp, mida vajutati („Loo juhtum", „Loobu"), ja
     klaviatuuri fookus koos sellega: fookus läheb vormi esimesele väljale või
     loendi pealkirjale. Esimesel joonistusel fookust ei võeta. */
  const shellRef = useRef(null);
  const shownView = useRef(view);
  useEffect(() => {
    if (shownView.current === view) return;
    shownView.current = view;
    const target = shellRef.current?.querySelector(view === "create" ? "input:not(:disabled)" : "[data-step-heading]");
    target?.focus({ preventScroll: true });
  }, [view]);

  const [displayName, setDisplayName] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [nextContact, setNextContact] = useState("");
  const [creating, setCreating] = useState(false);
  /* Loomise viga seisab loomise vaates, loendi viga loendi juures: üks ühine
     teade oleks pärast vaadeteks jagamist alati vales kohas. */
  const [createErrorKey, setCreateErrorKey] = useState(null);
  const createFormId = useId();
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
      /* Täislaadimine alustab uut järjekorda; „näita rohkem" kuulub selle
         järjekorra juurde, mille ajal ta käivitati. */
      const seq = append ? loadSeqRef.current : (loadSeqRef.current += 1);
      setState("loading");
      setErrorKey(null);
      try {
        const body = await caseWorkRequest(`/cases?${caseListQuery({ limit: PAGE_SIZE, cursor, filter })}`, { locale });
        if (seq !== loadSeqRef.current) return;
        /* Liitmine käib ID järgi (SOL-CW-10): sama kursoriga vastus ei tohi
           samu ridu kaks korda loendisse panna. */
        setCases((previous) => (append ? mergeCaseRows(previous, body.items || []) : body.items || []));
        setNextCursor(body.nextCursor || null);
        setState("ready");
      } catch (error) {
        if (seq !== loadSeqRef.current) return;
        setErrorKey(error?.messageKey || "casework.page.load_error");
        setState("error");
      }
    },
    [filter, locale]
  );

  useEffect(() => {
    if (!allowed) return;
    load();
  }, [allowed, load]);

  /* Teise seisu valimisel ei tohi eelmise filtri read ekraanile jääda, kuni
     uus loend laadib: nad näeksid välja nagu uue filtri tulemus. */
  const changeFilter = useCallback(
    (next) => {
      if (next === filter) return;
      setCases([]);
      setNextCursor(null);
      setFilter(next);
    },
    [filter]
  );

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
      setCreateErrorKey(null);
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
        /* Loodud juhtum avaneb kohe; loendisse naastes on ees loend, mitte
           tühi loomise vorm. */
        setView("list");
        await load();
        if (body?.case?.id) openCase(body.case.id);
      } catch (error) {
        setCreateErrorKey(error?.messageKey || "casework.errors.unexpected");
      } finally {
        setCreating(false);
      }
    },
    [displayName, externalRef, load, locale, nextContact, openCase]
  );

  const rows = useMemo(
    () => caseListRows(cases, { t, locale }).map((row) => ({ ...row, onOpen: () => openCase(row.id) })),
    [cases, locale, openCase, t]
  );
  const filterOptions = useMemo(() => caseFilterOptions(t), [t]);

  if (!isRoleResolved) return null;

  if (!allowed) {
    return (
      <section className={styles.shell}>
        <p className={styles.quiet}>{t("casework.page.not_allowed", "")}</p>
      </section>
    );
  }

  if (selectedId) {
    return (
      <section className={styles.shell}>
        {/* `key` ON GARANTII, mitte optimeerimine: brauseri Back/Forward võib viia
            ühest juhtumist otse teise. Ilma temata jääks detail samaks komponendiks
            ja juhtumis A pooleli jäänud põhjuse või punkti saaks salvestada juhtumi
            B alla (sama reegel mis märkme ja ettevalmistuse redaktoril). */}
        <CaseWorkDetail key={selectedId} caseId={selectedId} onBack={() => openCase(null)} onChanged={() => load()} />
      </section>
    );
  }

  /* LOEND JA UUE JUHTUMI VORM VAHETUVAD KOHAPEAL, ilma sammulavata: need ei ole
     kaks järjestikust sammu (kiirmenüü „1/2" ja nool viiksid loendist otse
     tühja vormi). Nii teeb ka välitöö avaleht. Pooleli vorm jääb alles, kui
     inimene vahepeal loendit vaatab. */
  return (
    <section className={styles.shell} ref={shellRef}>
      {/* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale. */}
      <h1 className="sr-only">{t("casework.page.title", "")}</h1>

      {view === "create" ? (
        <CaseCreateView
          t={t}
          formId={createFormId}
          fields={{
            displayName,
            onDisplayName: changeField(setDisplayName),
            externalRef,
            onExternalRef: changeField(setExternalRef),
            nextContact,
            onNextContact: changeField(setNextContact)
          }}
          onSubmit={createCase}
          onCancel={() => setView("list")}
          busy={creating}
          errorText={createErrorKey ? t(createErrorKey, "") : ""}
        />
      ) : (
        <CaseListView
          t={t}
          filter={{ value: filter, options: filterOptions, onChange: changeFilter }}
          status={state}
          rows={rows}
          emptyText={t(filter === "ALL" ? "casework.page.empty" : "casework.page.empty_filtered", "")}
          errorText={errorKey ? t(errorKey, "") : ""}
          onRetry={() => load()}
          /* „Näita rohkem" kannab serveri cursor'it ja on laadimise ajal
             keelatud (SOL-CW-10). */
          more={nextCursor ? { busy: state === "loading", onClick: () => load({ cursor: nextCursor, append: true }) } : null}
          onCreate={() => setView("create")}
        />
      )}
    </section>
  );
}
