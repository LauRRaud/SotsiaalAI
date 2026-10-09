"use client";

/**
 * JUHTUM-V1 (CASEWORK-P7) E6 — juhtumi detailvaade.
 *
 * KOLM ASJA, MIS SIIN ON TAHTLIKUD:
 *
 *   1. KIRJUTUSKAITSE ON NÄHTAV, MITTE AINULT VASTUSES. `READ_ONLY` ja
 *      `ARCHIVED` juhtumis on kirjutusnupud VÄLJAS ja lause ütleb, miks. Server
 *      keeldub nagunii (L14), aga vorm, mis laseb kirjutada ja siis vea annab,
 *      õpetab inimest arvama, et viga on tema tehtud.
 *
 *   2. KLIENDIVIITE KUSTUTAMINE ON ALLES KA SIIS. See on ainus erand
 *      kirjutuskeelust (L17): andmesubjekti õigus ei tohi jääda retention-oleku
 *      taha kinni.
 *
 *   3. RADA A EI OLE SIIN MUUDETAV. Kui juhtum on seotud platvormi kasutajaga
 *      (`clientUserId`), siis vabatekstiväljad PEAVAD olema tühjad (L11) ja
 *      nende näitamine tähendaks vormi, mille salvestamine annab alati vea.
 *      Kliendiotsingut V1-s ei ole (O-JU-4), seega rada A siit ka ei sünni.
 *
 * TEKST ON TEKST. Ükski väli ei jõua siit `dangerouslySetInnerHTML`-i — juhtumi
 * punktid on plain text ja HTML nende sees kuvatakse märkidena, mitte
 * märgistusena (testileping 38).
 *
 * KUJU (09.10): KOGU JUHTUM ja OSA ERALDI. Detail oli üks pikk veerg raamitud
 * sektsioone, mida tuli alla kerida. Nüüd on see platvormi sammulava
 * (`components/stage/StepFlight.jsx`) laua kujul, nagu Juhtumitöö laud: juhtum
 * avaneb ülevaates (kõik osad plaatidena, igaühel oma seis ühe reaga) ja osa
 * avaneb omaette vaates. Osad ei ole sammud, seepärast annab leht lavale oma
 * sõnad („Kogu juhtum", „Osa 3/12"). Päis lava kohal ütleb igas osas, milline
 * juhtum on lahti ja kas sinna saab kirjutada.
 *
 * Juhtumi enda osade vaated on failis ./cases/CaseDetailViews.jsx, kujundus
 * selle kõrval, osade loend ja ridade sisu failis ./caseViews.js. Siin on
 * andmed, päringud ja see, mis vaateid olekuga seob. Kohtumise ettevalmistus,
 * märge, heli, STAR2 järjekord ja ülekandeajalugu on omaette sektsioonid oma
 * andmetega (`MeetingPrepSection.jsx` jt): nende osa annab neile juhtumi seisu
 * ja nad joonistavad oma väikesed vaated ise (./sections).
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import Button from "@/components/ui/Button";
import { PROVENANCES, provenanceLabelKey } from "@/lib/workspaces/provenance";

import DraftSection from "./DraftSection";
import MeetingAudioSection from "./MeetingAudioSection";
import MeetingNoteSection from "./MeetingNoteSection";
import MeetingPrepSection from "./MeetingPrepSection";
import { TransferHistory } from "./TransferPanel";
import {
  BasicsView,
  CaseHead,
  ClientView,
  ItemsView,
  MaterialView,
  MissingView,
  RetentionView,
  StarView
} from "./cases/CaseDetailViews";
import { Notice } from "./cases/CaseListViews";
import styles from "./cases/cases.module.css";
import { caseParts, itemRows, missingRows, missingStatusOptions, retentionTone, retentionView } from "./caseViews";
import {
  caseLabelText,
  caseWorkRequest,
  fromLocalInputValue,
  retentionLabelKey,
  targetTypeKey,
  toLocalInputValue
} from "./caseWorkClient";

/* Kanooniline sihttüüpide register elab serveris (`lib/casework/caseWorkItem.js`)
   ja tundmatu tüüp kukub seal FAIL-CLOSED. Siin on ainult valikuloend — kui
   register kasvab, ei ava seda pind, vaid migratsioon (L15). */
const TARGET_TYPES = ["USER_DOCUMENT", "AGENT_ARTIFACT", "FIELD_VISIT"];

/* V1-s on lubatud ainult STAR2 (L6). Süsteemi nimi EI OLE tõlgitav tekst — ta on
   välise registri nimi ja peab kõigis keeltes ühtemoodi kõlama. */
const EXTERNAL_SYSTEMS = ["STAR2"];

const ITEMS_PAGE_SIZE = 25;
const MISSING_INFO_PAGE_SIZE = 50;

/* Sektsioonid, mis hoiavad oma loendit ise: ülevaade saab neilt esimese rea.
   `null` = loend ei ole veel kohal (plaat ei väida siis, et osa on tühi). */
const NO_SECTION_LISTS = Object.freeze({ prep: null, notes: null, drafts: null, transfer: null });

export default function CaseWorkDetail({ caseId, onBack, onChanged }) {
  const { t, locale } = useI18n();
  const formId = useId();

  const [record, setRecord] = useState(null);
  const [counts, setCounts] = useState({ items: 0, openMissingInfo: 0 });
  /* L7 säilituskell. Serverist, mitte pinnal arvutatud — vt `retention.js`. */
  const [retentionClock, setRetentionClock] = useState(null);
  const [state, setState] = useState("loading");
  const [errorKey, setErrorKey] = useState(null);
  const [busy, setBusy] = useState(false);

  const [items, setItems] = useState([]);
  const [itemsCursor, setItemsCursor] = useState(null);
  const [missingInfo, setMissingInfo] = useState([]);
  const [missingCursor, setMissingCursor] = useState(null);

  const [displayName, setDisplayName] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [nextContact, setNextContact] = useState("");
  const [externalSystem, setExternalSystem] = useState("");
  const [externalReference, setExternalReference] = useState("");

  const [linkType, setLinkType] = useState(TARGET_TYPES[0]);
  const [linkTargetId, setLinkTargetId] = useState("");
  /* Seotud materjali osa näitab kas loendit või sidumise vormi. */
  const [linking, setLinking] = useState(false);

  const [missingText, setMissingText] = useState("");
  const [missingProvenance, setMissingProvenance] = useState("");
  /* Puuduva info osa näitab loendit, uue punkti vormi või avatud punkti.
     `pointStatus` on avatud punktile valitud, veel salvestamata seis. */
  const [addingPoint, setAddingPoint] = useState(false);
  const [openPointId, setOpenPointId] = useState(null);
  const [pointStatus, setPointStatus] = useState(null);
  const closePoint = useCallback(() => {
    setOpenPointId(null);
    setPointStatus(null);
  }, []);

  const [retentionReason, setRetentionReason] = useState("");

  const [sectionLists, setSectionLists] = useState(NO_SECTION_LISTS);
  /* Kohtumise heli salvesti jääb tööle ka siis, kui ees on juhtumi teine osa:
     tema plaat ülevaates ütleb, kas salvestus käib. */
  const [recording, setRecording] = useState(false);
  /* Ülekandeajalugu on oma osa, aga teod sünnivad STAR2 järjekorra osas: märk
     ütleb ajaloole, et ta peab end uuesti laadima. */
  const [transferToken, setTransferToken] = useState(0);
  /* Lava ehitatakse uuesti, kui osade loend muutub (kirjutuskaitse võtab
     töömaterjali osa ära). Pärast seisu muutmist jääb töötaja elutsükli ossa,
     kust ta seisu muutis, mitte ei kuku ülevaatesse. */
  const landPartRef = useRef(null);

  const isActive = record?.retentionState === "ACTIVE";
  const isTrackA = Boolean(record?.clientUserId);
  const isErased = Boolean(record?.clientErasedAt);

  const loadCase = useCallback(async ({ form = "all" } = {}) => {
    const body = await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}`, { locale });
    setRecord(body.case || null);
    setCounts(body.counts || { items: 0, openMissingInfo: 0 });
    setRetentionClock(body.retentionClock || null);
    /* Vormiväljad tulevad ALATI serveri vastusest, mitte kohalikust mälust:
       kustutatud kliendiviide peab tühjendama ka välja, mille sisse töötaja
       parasjagu vaatab.
       ERAND: põhiandmete ja STAR-i viite salvestamine värskendab ainult oma
       osa välju (`form`). Teise, parasjagu peidetud osa pooleli muudatus ei
       tohi ühe osa salvestamisega vaikselt kaduda. */
    if (form !== "star") {
      setDisplayName(body.case?.clientDisplayName || "");
      setExternalRef(body.case?.clientExternalRef || "");
      setNextContact(toLocalInputValue(body.case?.nextContactAt));
    }
    if (form !== "basics") {
      setExternalSystem(body.case?.externalSystem || "");
      setExternalReference(body.case?.externalReference || "");
    }
  }, [caseId, locale]);

  const loadItems = useCallback(
    async ({ cursor = null, append = false } = {}) => {
      const params = new URLSearchParams({ limit: String(ITEMS_PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);
      const body = await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/items?${params.toString()}`, {
        locale
      });
      setItems((previous) => (append ? [...previous, ...(body.items || [])] : body.items || []));
      setItemsCursor(body.nextCursor || null);
    },
    [caseId, locale]
  );

  /* KOHTUMISE HELI salvestab osi ka siis, kui töötaja parasjagu vormi täidab.
     `loadCase()` kirjutaks vormiväljad serveri seisuga üle ja pooleli tekst
     kaoks; seepärast värskendatakse ainult seoste loendit ja loendurit. */
  const refreshLinkedItems = useCallback(async () => {
    await loadItems();
    setCounts((previous) => ({ ...previous, items: previous.items + 1 }));
  }, [loadItems]);

  const loadMissingInfo = useCallback(
    async ({ cursor = null, append = false } = {}) => {
      const params = new URLSearchParams({ limit: String(MISSING_INFO_PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);
      const body = await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/missing-info?${params.toString()}`, {
        locale
      });
      setMissingInfo((previous) => (append ? [...previous, ...(body.items || [])] : body.items || []));
      setMissingCursor(body.nextCursor || null);
    },
    [caseId, locale]
  );

  const loadAll = useCallback(async () => {
    setState("loading");
    setErrorKey(null);
    try {
      await Promise.all([loadCase(), loadItems(), loadMissingInfo()]);
      setState("ready");
    } catch (error) {
      setErrorKey(error?.messageKey || "casework.page.load_error");
      setState("error");
    }
  }, [loadCase, loadItems, loadMissingInfo]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* Viga seisab lava kohal, osa võib aga olla pikk loend ja keritud alla.
     Tõrge, mida ei ole näha, on töötaja jaoks „vajutasin ja midagi ei
     juhtunud": teade keritakse nähtavale. */
  const alertRef = useRef(null);
  useEffect(() => {
    if (errorKey) alertRef.current?.scrollIntoView({ block: "nearest" });
  }, [errorKey]);

  /** Üks koht, kus kirjutus õnnestub või annab tõlkevõtmega vea. Vastus ütleb, kumb juhtus. */
  const run = useCallback(
    async (operation) => {
      setBusy(true);
      setErrorKey(null);
      try {
        await operation();
        onChanged?.();
        return true;
      } catch (error) {
        setErrorKey(error?.messageKey || "casework.errors.unexpected");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onChanged]
  );

  /* Põhiandmete ja STAR-i viite vaade salvestavad KUMBKI AINULT OMA VÄLJAD.
     Vanal lehel oli üks nähtav vorm ja üks päring kõigi viie väljaga. Kahe
     vaatega kirjutaks ühe vaate „Salvesta" vaikselt serverisse ka teise,
     peidetud vaate salvestamata muudatused, ja pooleli STAR-i paar (süsteem
     valitud, number puudu) annaks põhiandmete salvestamisel vea, mida inimene
     seal ei näe. Server võtab vastu osalise sisu: väli, mida päringus ei ole,
     jääb muutmata (`app/api/casework/cases/[caseId]/route.js`). */
  const saveBasics = useCallback(
    (event) => {
      event.preventDefault();
      return run(async () => {
        await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}`, {
          method: "PATCH",
          locale,
          body: {
            /* Rada A juhtumil ei saadeta vabatekstivälju üldse: nende
               saatmine, ka tühjana, tähendaks kliendiraja vaikset vahetust. */
            ...(isTrackA || isErased
              ? {}
              : {
                  clientDisplayName: displayName.trim() || null,
                  clientExternalRef: externalRef.trim() || null
                }),
            nextContactAt: fromLocalInputValue(nextContact)
          }
        });
        await loadCase({ form: "basics" });
      });
    },
    [caseId, displayName, externalRef, isErased, isTrackA, loadCase, locale, nextContact, run]
  );

  const saveStar = useCallback(
    (event) => {
      event.preventDefault();
      return run(async () => {
        await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}`, {
          method: "PATCH",
          locale,
          /* Süsteem ja viide käivad koos (server keeldub poolikust paarist). */
          body: {
            externalSystem: externalSystem || null,
            externalReference: externalReference.trim() || null
          }
        });
        await loadCase({ form: "star" });
      });
    },
    [caseId, externalReference, externalSystem, loadCase, locale, run]
  );

  const linkItem = useCallback(
    (event) => {
      event.preventDefault();
      return run(async () => {
        await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/items`, {
          method: "POST",
          locale,
          body: { targetType: linkType, targetId: linkTargetId.trim() }
        });
        setLinkTargetId("");
        /* Seos on tehtud: vorm annab koha loendile tagasi. Tõrke korral jääb
           vorm ette ja sisestatud tunnus alles. */
        setLinking(false);
        await Promise.all([loadItems(), loadCase()]);
      });
    },
    [caseId, linkTargetId, linkType, loadCase, loadItems, locale, run]
  );

  const unlinkItem = useCallback(
    (itemId) =>
      run(async () => {
        await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/items/${encodeURIComponent(itemId)}`, {
          method: "DELETE",
          locale
        });
        await Promise.all([loadItems(), loadCase()]);
      }),
    [caseId, loadCase, loadItems, locale, run]
  );

  const addMissingInfo = useCallback(
    (event) => {
      event.preventDefault();
      return run(async () => {
        await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/missing-info`, {
          method: "POST",
          locale,
          body: { text: missingText, provenance: missingProvenance }
        });
        setMissingText("");
        setMissingProvenance("");
        setAddingPoint(false);
        await Promise.all([loadMissingInfo(), loadCase()]);
      });
    },
    [caseId, loadCase, loadMissingInfo, locale, missingProvenance, missingText, run]
  );

  const setMissingStatus = useCallback(
    (itemId, status) =>
      run(async () => {
        await caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/missing-info/${encodeURIComponent(itemId)}`,
          { method: "PATCH", locale, body: { status } }
        );
        /* Seis on salvestatud: punkt sulgub ja ees on jälle loend. */
        closePoint();
        await Promise.all([loadMissingInfo(), loadCase()]);
      }),
    [caseId, closePoint, loadCase, loadMissingInfo, locale, run]
  );

  const removeMissingInfo = useCallback(
    (itemId) =>
      run(async () => {
        await caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/missing-info/${encodeURIComponent(itemId)}`,
          { method: "DELETE", locale }
        );
        closePoint();
        await Promise.all([loadMissingInfo(), loadCase()]);
      }),
    [caseId, closePoint, loadCase, loadMissingInfo, locale, run]
  );

  const transitionRetention = useCallback(
    (toState) =>
      run(async () => {
        await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/retention`, {
          method: "POST",
          locale,
          body: { toState, reason: retentionReason }
        });
        setRetentionReason("");
        landPartRef.current = "retention";
        await loadCase();
      }),
    [caseId, loadCase, locale, retentionReason, run]
  );

  /**
   * O-JTA-5 rada C. `POST`, mitte `DELETE`: kustuv asi ei ole see, mida URL
   * nimetab — mustandi read ja ülekande tõend JÄÄVAD, kustub ainult sisu.
   *
   * KEHA EI SAADETA. Ulatuse otsustab server (kandmata mustandid selles
   * juhtumis); kliendi saadetud loend tähendaks, et pöördumatu kustutuse piiri
   * valib liides.
   */
  const archiveWorkingMaterial = useCallback(
    () =>
      run(async () => {
        await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/working-material`, {
          method: "POST",
          locale,
          body: {}
        });
        await loadCase();
      }),
    [caseId, loadCase, locale, run]
  );

  const eraseClientReference = useCallback(
    () =>
      run(async () => {
        await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/client-reference`, {
          method: "DELETE",
          locale,
          body: { reason: "worker_request" }
        });
        await loadCase();
      }),
    [caseId, loadCase, locale, run]
  );

  /* Sektsioonide teated oma loendi kohta. Funktsioonid on püsivad: sektsioon
     hoiab neid viitena ja kutsub pärast iga täislaadimist. */
  const reportList = useMemo(() => {
    const report = (key) => (list) => setSectionLists((previous) => ({ ...previous, [key]: list }));
    return { prep: report("prep"), notes: report("notes"), drafts: report("drafts"), transfer: report("transfer") };
  }, []);
  const noteTransfer = useCallback(() => setTransferToken((value) => value + 1), []);

  const parts = useMemo(
    () => (record ? caseParts({ record, counts, lists: sectionLists, recording, t, locale }) : []),
    [counts, locale, record, recording, sectionLists, t]
  );
  const linkRows = useMemo(() => itemRows(items, { t, locale }), [items, locale, t]);
  const points = useMemo(() => missingRows(missingInfo, { t }), [missingInfo, t]);

  if (state === "loading" && !record) return <p className={styles.quiet}>{t("casework.page.loading", "")}</p>;

  if (!record) {
    return (
      <>
        <Notice text={t(errorKey || "casework.page.load_error", "")} tone="risk" />
        <Button type="button" size="sm" variant="secondary" className={styles.more} onClick={onBack}>
          {t("casework.page.back_to_list", "")}
        </Button>
      </>
    );
  }

  const writeDisabled = busy || !isActive;
  const openPoint = openPointId ? points.find((point) => point.id === openPointId) || null : null;
  const lifecycle = retentionView({ record, retentionClock, t, locale });
  const landIndex = parts.findIndex((part) => part.key === landPartRef.current);

  const renderPart = (part, _index, flight) => {
    /* Sektsioonide põhinupp joonistab oma helgi ainult siis, kui osa on ees:
       lava hoiab kõik osad alles ja iga helk on oma joonistuspind. */
    const active = flight?.isActive !== false;
    switch (part.key) {
      case "basics":
        return (
          <BasicsView
            t={t}
            formId={`${formId}-basics`}
            client={{
              /* Rada A ja kustutatud viide: vabatekstivälju ei näidata (vt päis,
                 punkt 3), ja lause ütleb, miks neid ei ole. */
              editable: !(isTrackA || isErased),
              displayName,
              onDisplayName: (event) => setDisplayName(event.target.value),
              externalRef,
              onExternalRef: (event) => setExternalRef(event.target.value),
              note: isErased
                ? t("casework.page.erased", "")
                : isTrackA
                  ? t("casework.page.parts.client.account", "")
                  : ""
            }}
            nextContact={nextContact}
            onNextContact={(event) => setNextContact(event.target.value)}
            disabled={writeDisabled}
            onSubmit={saveBasics}
          />
        );

      case "star":
        return (
          <StarView
            t={t}
            formId={`${formId}-star`}
            system={{
              /* V1-s on lubatud ainult STAR2 (L6) — vaba tekstiväli tekitaks
                 süsteeminimede sõnastiku, mida keegi ei halda. */
              options: [
                { value: "", label: t("casework.page.parts.star.none", "") },
                ...EXTERNAL_SYSTEMS.map((system) => ({ value: system, label: system }))
              ],
              value: externalSystem,
              onChange: setExternalSystem
            }}
            reference={externalReference}
            onReference={(event) => setExternalReference(event.target.value)}
            disabled={writeDisabled}
            onSubmit={saveStar}
          />
        );

      case "items":
        return (
          <ItemsView
            t={t}
            adding={linking}
            rows={linkRows}
            /* `run()` SEES ja `busy` taga: väljaspool teda ei lukustunud nupp,
               sama cursor sai kaks korda lisanduda ja tõrge jäi hoopis
               käsitlemata — kasutaja vajutas ja ei juhtunud midagi. */
            more={itemsCursor ? { busy, onClick: () => run(() => loadItems({ cursor: itemsCursor, append: true })) } : null}
            disabled={writeDisabled}
            link={{
              formId: `${formId}-link`,
              types: TARGET_TYPES.map((type) => ({ value: type, label: t(targetTypeKey(type), "") })),
              type: linkType,
              onType: setLinkType,
              targetId: linkTargetId,
              onTargetId: (event) => setLinkTargetId(event.target.value),
              onSubmit: linkItem
            }}
            onAdd={() => setLinking(true)}
            onCancel={() => setLinking(false)}
            onUnlink={unlinkItem}
          />
        );

      case "missing":
        return (
          <MissingView
            t={t}
            mode={addingPoint ? "add" : openPoint ? "point" : "list"}
            rows={points}
            point={openPoint}
            more={
              missingCursor
                ? { busy, onClick: () => run(() => loadMissingInfo({ cursor: missingCursor, append: true })) }
                : null
            }
            disabled={writeDisabled}
            add={{
              formId: `${formId}-missing`,
              text: missingText,
              onText: setMissingText,
              provenance: missingProvenance,
              onProvenance: setMissingProvenance,
              provenances: PROVENANCES.map((value) => ({ value, label: t(provenanceLabelKey(value), "") })),
              onSubmit: addMissingInfo
            }}
            status={{
              options: missingStatusOptions(t),
              value: pointStatus ?? openPoint?.status,
              onChange: setPointStatus,
              /* Sama seisu uuesti valimine ei ole muudatus ega lähe serverisse. */
              changed: Boolean(openPoint && pointStatus && pointStatus !== openPoint.status),
              onSave: () => setMissingStatus(openPoint.id, pointStatus)
            }}
            onAdd={() => {
              closePoint();
              setAddingPoint(true);
            }}
            onCancel={() => {
              setAddingPoint(false);
              closePoint();
            }}
            onOpen={(itemId) => {
              setPointStatus(null);
              setOpenPointId(itemId);
            }}
            onRemove={removeMissingInfo}
          />
        );

      /* JTA-V1 E3 — kohtumise ettevalmistus. Ta seisab puuduva info JÄREL ja
         kliendiviite EES, sest ettevalmistus loeb puuduvat infot (ptk 4.7:
         koopiat ei tehta) ja kliendiviite kustutus on juhtumi lõpupunkt. */
      case "prep":
        return (
          <MeetingPrepSection
            caseId={caseId}
            locked={!isActive}
            caseBusy={busy}
            active={active}
            onChanged={loadCase}
            onListLoaded={reportList.prep}
          />
        );

      /* JTA-V1 E4 — kohtumise märge. Ta seisab ettevalmistuse JÄREL, sest
         ajaline järjekord on sama: enne kohtumist valmistutakse, pärast
         kirjutatakse üles. */
      case "notes":
        return (
          <MeetingNoteSection
            caseId={caseId}
            locked={!isActive}
            caseBusy={busy}
            active={active}
            onChanged={loadCase}
            onListLoaded={reportList.notes}
          />
        );

      /* Kohtumise heli seisab märkme KÕRVAL, omaette osana: salvestis on
         dokument, mitte märkme rida, ja salvesti peab töötama edasi ka siis,
         kui töötaja kirjutab samal ajal märget. Salvestatud osa seotakse
         juhtumiga ja ilmub seotud materjali alla. */
      case "audio":
        return (
          <MeetingAudioSection
            caseId={caseId}
            locked={!isActive}
            caseBusy={busy}
            active={active}
            onLinked={refreshLinkedItems}
            onRecording={setRecording}
          />
        );

      /* JTA-V1 E5 — STAR2 mustandi ahel. Seisab märkme JÄREL, sest ajaline
         järjekord on sama: kohtumine, märge, siis see, mis registrisse
         kantakse. */
      case "drafts":
        return (
          <DraftSection
            caseId={caseId}
            locked={!isActive}
            caseBusy={busy}
            active={active}
            onChanged={loadCase}
            onListLoaded={reportList.drafts}
            onTransferRecorded={noteTransfer}
          />
        );

      /* Ajalugu on JUHTUMI oma, mitte avatud mustandi oma: ülekanne on juhtumi
         sündmus ja töötaja peab teda nägema ka siis, kui ükski element ei ole
         lahti. Seepärast on ta omaette osa, mitte STAR2 järjekorra lõpp. */
      case "transfer":
        return <TransferHistory caseId={caseId} locale={locale} t={t} refreshToken={transferToken} onListLoaded={reportList.transfer} />;

      /* L7: LOENDUS ON NÄHTAV KOGU 12 KUU JOOKSUL, mitte alles siis, kui
         hoiatus saabub. Kuupäev tuleb serverist sama valemiga, millega
         kustutus päriselt juhtub.

         PÕHJUS ON KOHUSTUSLIK (L14) ja ta jääb auditisse — nupp on väljas
         seni, kuni ta on kirjutatud.

         L23 — KELL ÖELDAKSE VÄLJA ENNE TEGU, mitte 30 päeva enne kustutust.
         Olemasolev `retention_hint` ütleb „tagasiteed ei ole" ja oli oma ajal
         täielik: JUHTUM-V1-s ei olnud kella. Kell tuleb selle lepinguga, seega
         tekstivõlg on JTA oma. `READ_ONLY` siire EI KANNA seda teksti ja see ei
         ole väljajätt: tema ei käivita kella, ja vale hoiatus õpetab kasutajat
         hoiatusi ignoreerima.

         MÕLEMAD SIIRDED ON KAHEASTMELISED. `ARCHIVED` on terminaalne JA
         käivitab kustutuskella — ühe vajutusega pöördumatu tegu on täpselt see
         muster, mille seitsmes audit mujalt maha võttis. Kirjutuskaitse oli
         seni ühe vajutusega, kuigi ka temal ei ole tagasiteed. */
      case "retention":
        return (
          <RetentionView
            t={t}
            view={lifecycle}
            reason={retentionReason}
            onReason={(event) => setRetentionReason(event.target.value)}
            busy={busy}
            onTransition={transitionRetention}
          />
        );

      /* O-JTA-5 rada C — töötaja tegu „arhiveeri töömaterjal".
         SEE EI ARHIVEERI JUHTUMIT ja seepärast seisab ta arhiveerimisest
         eraldi, omaette osana: juhtum jääb `ACTIVE`-ks ja tööle, kustub ainult
         kandmata mustandite SISU. Osa on olemas ainult aktiivsel juhtumil. */
      case "material":
        return <MaterialView t={t} busy={busy} onArchive={archiveWorkingMaterial} />;

      /* NUPP ON ALLES KA `READ_ONLY` JA `ARCHIVED` JUHTUMIS (L17) — ainus
         koht selles vaates, kus `busy` on ainus takistus.

         KÕIGE PÖÖRDUMATUM TEGU SELLES VAATES: viide ei tule tagasi ka konto
         kustutamise rajalt ja juhtumi nimeks jääb jäädavalt „Kustutatud
         kliendiviide". Üks vajutus oli selle jaoks liiga vähe. `busy` jääb
         ainsaks lisatakistuseks — L17 järgi ei tohi see nupp sõltuda
         retention-olekust. */
      case "client":
        return <ClientView t={t} erased={isErased} busy={busy} onErase={eraseClientReference} />;

      default:
        return null;
    }
  };

  return (
    <>
      <CaseHead
        t={t}
        name={caseLabelText(record.label, t)}
        state={t(retentionLabelKey(record.retentionState), "")}
        tone={retentionTone(record.retentionState)}
        onBack={onBack}
      />

      {/* Kirjutuskaitse lause seisab lava KOHAL, mitte ühe osa sees: nupud on
          väljas igas osas ja põhjus peab olema näha sealsamas. */}
      {!isActive ? <p className={styles.quiet}>{t("casework.page.read_only_notice", "")}</p> : null}
      {errorKey ? (
        <p className={styles.notice} data-tone="risk" role="alert" ref={alertRef}>
          {t(errorKey, "")}
        </p>
      ) : null}

      <StepFlight
        /* Osade loend muutub, kui juhtum läheb kirjutuskaitse alla: siis
           ehitatakse lava uuesti. */
        key={parts.map((part) => part.key).join("|")}
        label={t("casework.page.title", "")}
        steps={parts}
        parts
        /* Juhtum avaneb ülevaates: kõik osad korraga, igaühel oma seis. */
        startWide={landIndex < 0}
        initialIndex={Math.max(0, landIndex)}
        texts={{
          all: t("casework.page.all_parts", ""),
          position: (current, total, label) =>
            t("casework.page.part_position", "")
              .replace("{current}", String(current))
              .replace("{total}", String(total))
              .replace("{label}", label)
        }}
      >
        {renderPart}
      </StepFlight>
    </>
  );
}
