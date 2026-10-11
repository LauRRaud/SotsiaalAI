"use client";

/**
 * Supervisiooni protsessi laud (Q2.6 vaated 3/3b/4/6/7/8/10): tee `/supervisioon/[id]`.
 *
 * KUJU (09.10). Leht oli klaaskast klaaspaneeli sees: korratud pealkiri, märgid,
 * sakiriba ja iga saki all üks pikk veerg kaarte ning lehe lõpus „ohutsoon".
 * Nüüd on see laud sammulaval (`components/stage/StepFlight.jsx`) nagu
 * supervisiooni avaleht ja juhtumi vaade: protsess avaneb kõigi osade vaates
 * (iga osa plaat ütleb oma seisu sõnadega) ja osa avaneb omaette vaates. Osad ei
 * ole sammud, seepärast annab leht lavale `parts`.
 *
 * OSAD. Protsess, kontrakt, osalejad, eeskamber, jagatud teemad, kohtumised,
 * kokkuvõtted, kapp ning lõpus sulgemine (superviisor) või lahkumine (osaleja);
 * suletud protsessil seisab ees osa „Suletud". Millised osad vaatajal on, otsustab
 * `processPartKeys` serveri lippude järgi. Iga osa olek ja päringud on tema
 * hoidjas (`./*Panel.jsx`), vaated failides ./process/*Views.jsx, read ja reeglid
 * failis ./process/processRows.js.
 *
 * `?ala=` ON PÜSIANKUR. Teavitused ja „Jätka siit" sihivad osa otse
 * (`?ala=kokkuvotted&summary=<id>`): ankruga tee avab laua selles osas, ankruta
 * tee kõigi osade vaates. Kui inimene liigub teise ossa, kirjutatakse ankur
 * aadressiribale ümber (`replaceState`), nii et värskendamine ja kopeeritud link
 * jõuavad samasse kohta. Vana leht tegi igast sakivajutusest ajalookirje; laual
 * vahetub osa ka kerides ja iga kerimine ei ole navigatsioon.
 *
 * KUTSUTU näeb ainult kontrakti: server annab talle piiratud kaardi ja siin
 * joonistatakse selle asemel kutse (`./SupervisionInvitedCard.jsx`).
 *
 * VÄRSKENDUS EI VISKA LAUALT VÄLJA. Vana leht asendas iga ebaõnnestunud
 * uuestilaadimise (ka kokkuvõtete taustavärskenduse) vealehega ja pooleli
 * kirjutatud tekst kadus. Nüüd jääb laud ette ja lava kohal on lause; vealeht
 * tuleb ainult siis, kui ligipääs on päriselt kadunud (401, 404).
 *
 * SUPERVISIOONI V0 LEPING ütles „EI uut lõuendimootorit, EI Flight/3D" (SUP-P10).
 * Omanik otsustas 09.10, et kõik alamlehed lähevad sammulavale. Uut mootorit
 * siin ei ole: lava on platvormi olemasolev lend, mis vähendatud liikumise
 * korral vahetab vaateid ristsulandusega. Privaatsusmärgid ja kõik nähtavuse
 * reeglid on samad, mis enne.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import Button from "@/components/ui/Button";

import ContractPanel from "./ContractPanel";
import EeskamberPanel from "./EeskamberPanel";
import KappPanel from "./KappPanel";
import MeetingsPanel from "./MeetingsPanel";
import ParticipantsPanel from "./ParticipantsPanel";
import SummariesPanel from "./SummariesPanel";
import SupervisionInvitedCard from "./SupervisionInvitedCard";
import TopicsPanel from "./TopicsPanel";
import { Problem } from "./entry/EntryBits";
import { SUPERVISION_HOME_HREF, outcomeHref } from "./entry/entryRows";
import { ProcessHead } from "./process/ProcessBits";
import { CloseEntryView, ClosedView, LeaveView, ProcessView } from "./process/ProcessViews";
import styles from "./process/process.module.css";
import {
  PART,
  closeHref,
  closureFacts,
  conflictNotice,
  isClosed,
  markedPart,
  needsContractAcceptance,
  partFromSearch,
  processFacts,
  processHead,
  processParts,
  searchWithPart
} from "./process/processRows";
import usePartRequest from "./process/usePartRequest";
import usePrivateItems from "./process/usePrivateItems";
import { supervisionMessage, supervisionRequest } from "./supervisionClient";

const INVITED_ROLE = "KUT";

/**
 * Osa teatab lehele, kas ta on parajasti ees. Lava ütleb sammu vahetust ainult
 * siis, kui number muutub: kõigi osade vaatesse minekut ja sealt sama osa
 * uuesti avamist ta ei teata. Leht peab aga teadma, milline osa on päriselt ees
 * (aadressiriba ankur, kokkuvõtete värskendus).
 */
function PartMark({ name, active, onChange }) {
  useEffect(() => {
    onChange(name, active);
  }, [active, name, onChange]);
  return null;
}

export default function SupervisionProcessPage({ processId }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPart = partFromSearch(searchParams.get("ala"));
  const summaryId = searchParams.get("summary") || "";

  const [process, setProcess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  /* Viimase teo tulemus (konflikt, lahkumine): jääb lava kohale järgmise teoni. */
  const [notice, setNotice] = useState("");
  /* Ebaõnnestunud värskendus: kaob, kui järgmine värskendus õnnestub. */
  const [refreshError, setRefreshError] = useState("");
  const [outcomeId, setOutcomeId] = useState("");
  /* Avatud osa võti; tühi tähendab kõigi osade vaadet. */
  const [part, setPart] = useState(urlPart);
  const loadedRef = useRef(false);

  const load = useCallback(
    async (signal) => {
      try {
        const { ok, status, payload } = await supervisionRequest(`/api/supervision/processes/${encodeURIComponent(processId)}`, { signal });
        if (signal?.aborted) return;
        if (!ok) {
          const message = supervisionMessage({ status, payload, t });
          if (loadedRef.current && status !== 401 && status !== 404) {
            setRefreshError(message);
            return;
          }
          loadedRef.current = false;
          setProcess(null);
          setLoadError(message);
          return;
        }
        loadedRef.current = Boolean(payload?.process);
        setLoadError("");
        setRefreshError("");
        setProcess(payload?.process || null);
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) return;
        if (loadedRef.current) setRefreshError(t("supervision.errors.load_failed"));
        else setLoadError(t("supervision.errors.load_failed"));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [processId, t]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /* Õnnestunud tegu: vana teade (konflikt, mis ammu lahenes) ei jää lava
     kohale seisma. Konflikt ise laeb `load`-iga ja jätab oma teate ette. */
  const reload = useCallback(async () => {
    setNotice("");
    await load();
  }, [load]);

  /** 409: ütle lava kohal, mis juhtus, ja too värske seis (Q2.6 konfliktiseis). */
  const handleConflict = useCallback(
    async (payload) => {
      setNotice(conflictNotice(payload, t));
      await load();
    },
    [load, t]
  );

  const closed = isClosed(process);
  /* Laud on liikmel; kutsutu näeb kutset. */
  const desk = Boolean(process) && process.viewerRole !== INVITED_ROLE;
  const privateItems = usePrivateItems(processId, t, desk);

  // M12 pakk on PRIVAATNE ega tule protsessi vastusega: suletud vaates otsime
  // OMA pakkide loendist selle protsessi oma (Q2.6 vaade 10).
  useEffect(() => {
    if (!closed) return undefined;
    const controller = new AbortController();
    void (async () => {
      const { ok, payload } = await supervisionRequest("/api/supervision/outcomes", { signal: controller.signal }).catch(() => ({
        ok: false,
        payload: {}
      }));
      if (!ok) return;
      const mine = (payload?.outcomes || []).find((row) => row.processId === processId);
      if (mine?.id) setOutcomeId(mine.id);
    })();
    return () => controller.abort();
  }, [closed, processId]);

  const parts = useMemo(() => (desk ? processParts({ process, privateItems, t, locale }) : []), [desk, locale, privateItems, process, t]);
  const partKeys = parts.map((item) => item.key).join("|");

  /* Aadress → osa. Reageerime ainult siis, kui aadressiriba päriselt seda
     ankrut kannab: meie enda kirjutatud ankur jõuab siia hilinenult tagasi ja
     kiire kerimise ajal ei tohi vana kaja inimest eelmisse ossa tagasi viia. */
  useEffect(() => {
    const live = partFromSearch(new URLSearchParams(window.location.search).get("ala"));
    if (live === urlPart) setPart(urlPart);
  }, [urlPart]);

  /* Osa → aadress. `replaceState`, mitte `router.push`: osa vahetub ka kerides. */
  useEffect(() => {
    if (!desk) return;
    const next = searchWithPart(window.location.search, part);
    if (next === window.location.search) return;
    window.history.replaceState(null, "", `${window.location.pathname}${next}${window.location.hash}`);
  }, [desk, part]);

  /* Ankur, mida sellel vaatajal ei ole (nt lahkumise osa pärast lahkumist), tähendab kõigi osade vaadet. */
  useEffect(() => {
    if (desk && part && !partKeys.split("|").includes(part)) setPart("");
  }, [desk, part, partKeys]);

  const markPart = useCallback((key, active) => {
    setPart((current) => markedPart(current, key, active));
  }, []);

  const leaving = usePartRequest({ t, onReload: load, onConflict: handleConflict });
  const runLeave = leaving.run;
  const participationId = process?.myParticipation?.id || "";
  const leave = useCallback(async () => {
    if (!participationId) return;
    const ok = await runLeave("leave", `/api/supervision/participations/${encodeURIComponent(participationId)}/leave`);
    if (ok) setNotice(t("supervision.leave.done"));
  }, [participationId, runLeave, t]);

  if (loading) {
    return (
      <section className={styles.shell}>
        <p className={styles.quiet}>{t("supervision.common.loading")}</p>
      </section>
    );
  }

  if (loadError || !process) {
    return (
      <section className={styles.shell}>
        <h1 className="sr-only">{t("supervision.meta.title")}</h1>
        <div className={styles.state}>
          <Problem text={loadError || t("supervision.common.notFound")} />
          <div className={styles.actions}>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setLoading(true);
                setLoadError("");
                void load();
              }}
            >
              {t("supervision.common.retry")}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => router.push(SUPERVISION_HOME_HREF)}>
              {t("supervision.invited.toHome")}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // Vaade 3b: kutsutu näeb AINULT kontrakti (KUT-serializer).
  if (!desk) {
    return <SupervisionInvitedCard onDone={load} process={process} />;
  }

  const keys = parts.map((item) => item.key);
  const openIndex = keys.indexOf(part);
  const pendingContract = needsContractAcceptance(process);

  const renderPart = (step, flight) => {
    /* Lava hoiab kõik osad lehel, aga põhinupp joonistab oma läike eraldi
       pinnale ja brauser lubab neid korraga piiratud arvu: läige on ainult ees
       oleval osal. */
    const glow = flight?.isActive !== false;
    switch (step.key) {
      case PART.CLOSED:
        return (
          <ClosedView
            t={t}
            glow={glow}
            lines={closureFacts(process, { t, locale })}
            onPack={outcomeId ? () => router.push(outcomeHref(outcomeId)) : null}
          />
        );
      case PART.PROCESS:
        return <ProcessView t={t} facts={processFacts(process, { t })} />;
      case PART.CONTRACT:
        return <ContractPanel process={process} onReload={reload} onConflict={handleConflict} glow={glow} />;
      case PART.PARTICIPANTS:
        return <ParticipantsPanel process={process} onReload={reload} onConflict={handleConflict} glow={glow} />;
      /* Eeskamber hoiab OMA kirjeloendit ja lahendab CAS-konflikti ise:
         protsessi vastust see ei puuduta, seega onConflict siia ei kuulu. */
      case PART.ANTECHAMBER:
        return <EeskamberPanel process={process} items={privateItems} glow={glow} />;
      case PART.TOPICS:
        return <TopicsPanel process={process} onReload={reload} onConflict={handleConflict} onAntechamber={() => setPart(PART.ANTECHAMBER)} />;
      case PART.MEETINGS:
        return <MeetingsPanel process={process} onReload={reload} onConflict={handleConflict} glow={glow} />;
      case PART.SUMMARIES:
        return (
          <SummariesPanel
            process={process}
            onReload={reload}
            onConflict={handleConflict}
            selectedSummaryId={summaryId}
            active={Boolean(flight?.isActive)}
            glow={glow}
          />
        );
      case PART.CABINET:
        return <KappPanel process={process} />;
      case PART.CLOSE:
        return <CloseEntryView t={t} glow={glow} onPreview={() => router.push(closeHref(processId))} />;
      case PART.LEAVE:
        return <LeaveView t={t} note={leaving.message} busy={Boolean(leaving.busy)} onLeave={leave} />;
      default:
        return null;
    }
  };

  const liveText = [notice, refreshError].filter(Boolean).join(" ");

  return (
    <section className={styles.shell}>
      <ProcessHead head={processHead(process, { t })} backText={t("supervision.process.toHome")} onBack={() => router.push(SUPERVISION_HOME_HREF)} />

      {/* Teated seisavad lava KOHAL, mitte ühe osa sees: need käivad kogu protsessi
          kohta ja peavad olema näha igas osas. Ekraanilugejale ütleb need välja
          püsiv peidetud rida (tühjast nähtavaks muutuv ala jääks lugemata). */}
      <p className="sr-only" aria-live="polite">
        {liveText}
      </p>
      <div className={styles.notices}>
        {notice ? <p className={styles.notice}>{notice}</p> : null}
        {refreshError ? <p className={styles.notice}>{refreshError}</p> : null}
        {pendingContract && part !== PART.CONTRACT ? (
          <p className={styles.notice} data-tone="wait">
            <span>{t("supervision.contract.pendingContract")}</span>
            <button type="button" className={styles.textButton} onClick={() => setPart(PART.CONTRACT)}>
              {t("supervision.process.openContract")}
            </button>
          </p>
        ) : null}
      </div>

      <StepFlight flat
        /* Osade loend muutub, kui protsess suletakse või osaleja lahkub: siis
           ehitatakse lava uuesti ja avatakse samas osas, kui see on alles. */
        key={partKeys}
        label={t("supervision.meta.title")}
        steps={parts}
        parts
        startWide={openIndex < 0}
        initialIndex={Math.max(0, openIndex)}
        activeKey={openIndex >= 0 ? part : undefined}
        texts={{
          all: t("supervision.process.all"),
          position: (current, total, label) => t("supervision.process.position", { current, total, label })
        }}
      >
        {(step, index, flight) => (
          <>
            <PartMark name={step.key} active={Boolean(flight?.isActive)} onChange={markPart} />
            {renderPart(step, flight)}
          </>
        )}
      </StepFlight>
    </section>
  );
}
