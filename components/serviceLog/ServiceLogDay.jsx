"use client";

/**
 * TEENUSPÄEVIK-V1 E2 — „Päev": kiirsisestus ja neli märget.
 *
 * KOLM ASJA, MIS SIIN ON TEADLIKUD:
 *
 * 1. KLIENT ENNE, teenus tuletatakse. Osutaja mõtleb „käisin Mardi juures kaks
 *    tundi", mitte „osutasin teenust X". Teenuse valik ilmub AINULT siis, kui
 *    server ütleb `askService` — reeglid elavad serveris
 *    (`lib/serviceLog/entryDerivation.js`), mitte siin. Kaks eri „mida küsida"
 *    loogikat lahkneksid vaikselt.
 *
 * 2. NELI MÄRGET on suured nupud. Iga puude on ajatempel; kestus ja kogus
 *    tuletatakse. LÄKSIN ja TAGASI on VALIKULISED — järjestikuste klientide
 *    puhul ei ole tagasisõitu ja nende nõudmine teeks voost bürokraatia.
 *
 * 3. MÄRKUSE PIIRANG ON NÄHTAV. Väli ütleb otse, et siia ei kirjutata tundlikku
 *    sisu. ⓘ ütleb sedasama pikemalt. Ilma selleta muutub „lühike faktimärge"
 *    juhtumilooks ja säilitusaeg (7 aastat) hakkab kandma valet sisu.
 *
 * KEELEPÄIS ON KLIENDI KOHUSTUS. `localeFromRequest` loeb päringut ja päiseid,
   AGA MITTE keeleküpsist — ilma `x-ui-locale`-ta tuleb serveri veateade
   inglise keeles keset eestikeelset pinda. Brauserikontroll näitas seda
   („The entry is already final."); `i18n:check` ei saa seda püüda, sest
   võtmed on kõigis keeltes olemas — vale on KUTSE, mitte sõnastik.
   Sama muster, mida kasutab admin-kiht (`x-ui-locale: locale`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import DateField from "@/components/ui/DateField";
import Dropdown from "@/components/ui/Dropdown";
import { PROVENANCE, SERVICE_UNITS, VISIT_STAMP } from "@/lib/serviceLog/constants";
import { dequeue, enqueue, outboxCount, readOutbox, shouldRetry } from "@/lib/serviceLog/outbox";
import { SAMPLE_KIND } from "@/lib/serviceLog/measurement";
import {
  isServiceLogLocationStampUiEnabled,
  isServiceLogMeasurementUiEnabled
} from "@/lib/serviceLog/flags";
import { captureLocationPoint } from "@/lib/serviceLog/geolocation";
import { clearVisitDraft, readVisitDraft, writeVisitDraft } from "@/lib/serviceLog/visitDraft";
import LocationPermission from "./LocationPermission";

/**
 * JADA, MITTE PANEEL. Neli koervuti nuppu naeitasid nelja AJATEMPLIT ja pidid
 * seetoettu igauehe juurde kirjutama „valikuline" — sona, mis ei uetle
 * kasutajale, MIDA teha, vaid ainult seda, et ta voib tegemata jaetta.
 * Toeoevoos on igal hetkel tegelikult ainult UKS joergmine samm, seega on nuppe
 * ueks ja tema funktsioon tuletatakse olemasolevatest templitest.
 *
 * KAKS JADA, mitte ueks valikuliste sammudega: soiduaeg kas arvestatakse voi ei.
 * Nii kaob „valikuline" taeielikult — kumbki jada ei sisalda ueheski punktis
 * sammu, mille voiks vahele jaetta.
 */
/* `VISIT_STAMP` vaeaertused on andmebaasi vaeljanimed (`departedForVisitAt`),
   toelkevoetmed aga inimloetavad. `toLowerCase()` annaks „departedforvisitat" —
   seega vahendaja, mitte automaatne teisendus. */
const STAMP_KEY = Object.freeze({
  [VISIT_STAMP.DEPARTED]: "departed",
  [VISIT_STAMP.ARRIVED]: "arrived",
  [VISIT_STAMP.LEFT]: "left",
  [VISIT_STAMP.RETURNED]: "returned"
});

const FLOW_WITHOUT_TRAVEL = [VISIT_STAMP.ARRIVED, VISIT_STAMP.LEFT];
const FLOW_WITH_TRAVEL = [
  VISIT_STAMP.DEPARTED,
  VISIT_STAMP.ARRIVED,
  VISIT_STAMP.LEFT,
  VISIT_STAMP.RETURNED
];

/**
 * MÄRKUSE PÄRITOLU — valik, mitte vaikimisi oletus.
 *
 * Vormil EI OLNUD seda üldse: märkus salvestus ilma päritoluta ja koond
 * nimetas ta vaikimisi „töötaja tähelepanekuks" — ka siis, kui see oli kliendi
 * ütlus. Produktsiooni AI-mustand märkas vastuolu ise ja kirjutas aruandesse
 * „Tegemist on kliendi ütlusega; kinnitatud töötaja tähelepanekut koondis ei
 * ole". Ehk vaikne vaikeväärtus jõudis KOV-ile minevasse teksti.
 *
 * Fakti ja tõlgenduse lahusus on lepingu enda eristaja — ta ei tohi olla asi,
 * mida vormist kätte ei saa.
 *
 * VIIS VALIKUT KAHEKSAST: `KLIENDI_KINNITATUD`, `AI_MUSTAND` ja
 * `AMETLIKULT_KONTROLLITUD` ei kirjelda käsitsi kirjutatud välitöömärget.
 * Sõnastik ise on platvormi oma (`lib/workspaces/provenance.js`) ja sildid
 * tulevad juba olemasolevatest `casework.provenance.*` võtmetest — teine
 * koopia vananeks eraldi.
 */
const NOTE_PROVENANCES = [
  PROVENANCE.KLIENDI_OELDUD,
  PROVENANCE.TOOTAJA_TAHELEPANEK,
  PROVENANCE.TOOTAJA_TOLGENDUS,
  PROVENANCE.TEISE_SPETSIALISTI_INFO,
  PROVENANCE.DOKUMENDIST
];

function todayIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    .toISOString()
    .slice(0, 10);
}

/**
 * `undefined` lokaadina tähendab BRAUSERI lokaati, mitte lehe oma — ja
 * ingliskeelses Chrome'is tuli eestikeelsele lehele „02:04 PM". Kellaaeg on
 * siin tõend (millal töötaja kohal oli), seega ta peab olema loetav lehe
 * keeles ja ühemõtteline: 24 tundi, ilma AM/PM-ita.
 */
function formatTime(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(locale || "et", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

export default function ServiceLogDay() {
  const { t, locale } = useI18n();
  /* Roll tuleb platvormi ROLLIVAATEST, mitte toorest sessioonist — vt
     `ServiceLogShell` ja `lib/serviceLog/access.js`. */
  const { effectiveRole, isRoleResolved } = useEffectiveRole();
  const allowed = effectiveRole === "SERVICE_PROVIDER";

  const [entries, setEntries] = useState(null);
  const [loadError, setLoadError] = useState(false);
  /* PUUDUV TEENUSEPROFIIL EI OLE TAVALINE TÕRGE, vaid järgmine samm.
     Ilma selleta nägi uus osutaja täisvormi, mis ei saanud midagi salvestada,
     ja ainus vihje oli veateade kirjete loendi all. Omanik ise: „mulle oli ka
     üllatus." */
  const [needsProfile, setNeedsProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [overrunNotice, setOverrunNotice] = useState(null);
  const [referralId, setReferralId] = useState("");
  const [finalizing, setFinalizing] = useState("");
  const [finalizeError, setFinalizeError] = useState("");

  const [clientName, setClientName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("HOUR");
  const [serviceId, setServiceId] = useState("");
  const [note, setNote] = useState("");
  /* NÄHTAV vaikeväärtus, mitte vaikne: kasutaja näeb kohe, mis kirja läheb,
     ja muudab ühe puutega. Nii ei kannata „alla 30 sekundi" ja vale silt ei
     jõua enam aruandesse märkamatult. */
  const [noteProvenance, setNoteProvenance] = useState(PROVENANCE.TOOTAJA_TAHELEPANEK);
  const [stamps, setStamps] = useState({});
  const [withTravel, setWithTravel] = useState(false);
  const [pending, setPending] = useState(0);
  /* Välitöö sild: `null` = eeltäidet ei ole; objekt = kirje sünnib külastusest. */
  const [fromVisit, setFromVisit] = useState(null);
  const [fromVisitError, setFromVisitError] = useState(false);
  /* Asukohapunktid ainult KÄESOLEVA külastuse kohta; nad lähevad kirjega
     kaasa ja kaovad vormi tühjendamisel. */
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [locationStamps, setLocationStamps] = useState({});
  const [locationState, setLocationState] = useState("");
  /**
   * E8 MOOTMINE (DoD 1). Kell hakkab kaeima ESIMESEST PUUTEST, mitte lehe
   * avanemisest: leht voib olla taustavahekaardis lahti tunde ja see ei ole
   * sisestusele kulunud aeg. Viide, mitte olek — moodik ei tohi pohjustada
   * uehtegi uembervormistust.
   */
  /* Kaesoleva kuelastuse poletusnumber — vt asukohapaeringu selgitust
     `stampNow`-is. Kasvab iga vormi tuehjenduse juures. */
  const visitTokenRef = useRef(0);
  const inputStartedRef = useRef(0);
  /* Viide funktsioonile, sest eeltäite-effect jookseb ENNE `markInputStart`-i
     definitsiooni ja otsene kutse oleks siin TDZ-viga. */
  const markInputStartRef = useRef(null);

  /* Viide, mitte soltuvus: nii jaeaevad `stampNow` ja `undoLastStamp` stabiilseks
     ega sunni iga soiduaja luelitust kogu vormi uembervormistama. */
  const withTravelRef = useRef(false);
  useEffect(() => {
    withTravelRef.current = withTravel;
  }, [withTravel]);
  const [defaults, setDefaults] = useState(null);

  const loadEntries = useCallback(async () => {
    try {
      setLoadError(false);
      const response = await fetch("/api/service-entries?take=50", { headers: { "x-ui-locale": locale || "et" } });
      const body = await response.json().catch(() => ({}));
      /* PÕHJUS, MITTE ÜLDINE TÕRGE. „Kirjete laadimine ebaõnnestus" ei ütle
         kasutajale midagi: kõige tavalisem juhtum on hoopis see, et tal ei ole
         veel teenuseprofiili, ja seda oskab ta ise parandada. */
      if (!response.ok) {
        setNeedsProfile(body?.messageKey === "service_log.errors.profile_not_found");
        setLoadError(body?.message || true);
        setEntries((current) => current || []);
        return;
      }
      setNeedsProfile(false);
      setEntries(Array.isArray(body.entries) ? body.entries : []);
    } catch {
      setLoadError(true);
      setEntries((current) => current || []);
    }
  }, [locale]);

  useEffect(() => {
    if (allowed) loadEntries();
  }, [allowed, loadEntries]);

  /* Tuletamisotsus küsitakse serverilt kohe, kui klient on teada — see on see
     koht, kus küsimused kaovad (või jäävad). */
  useEffect(() => {
    if (!allowed || !clientName.trim()) {
      setDefaults(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ defaults: "1", clientDisplayName: clientName.trim() });
        const response = await fetch(`/api/service-entries?${params}`, { headers: { "x-ui-locale": locale || "et" } });
        if (!response.ok) return;
        const body = await response.json();
        if (cancelled) return;
        setDefaults(body.defaults || null);
        /* TULETAMISVASTUS ON TÕDE, ka siis kui ta on TÜHI. Varem jäid siia
           eelmise kliendi väärtused alles: server ütles `askUnit`, aga vormis
           seisis endiselt eelmise kliendi ühik ja kasutaja salvestas selle
           märkamata. Tühi vastus peab välja puhastama, mitte vaikima. */
        setServiceId(body.defaults?.serviceId || "");
        setUnit(body.defaults?.unit || "");
        /* Ühese suunamise korral seome kirje ise; mitme korral jääb valik
           kasutajale ja vorm KÜSIB — varem läks siit `referralId: null` ja
           kirje jäi KOV-i ekspordist ning saldost välja. */
        setReferralId(body.defaults?.referralId || "");
      } catch {
        /* Tuletamise ebaõnnestumine ei tohi sisestust blokeerida: kasutaja
           täidab väljad käsitsi ja server valideerib niikuinii. */
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [allowed, clientName, locale]);

  /* Kestus minutites — ühikust SÕLTUMATU. `derivedQuantity` annab koguse ainult
     tundides; see siin vastab küsimusele „kui kaua ma kohal olin", mis kehtib
     iga ühiku juures. */
  const measuredMinutes = useMemo(() => {
    const arrived = stamps[VISIT_STAMP.ARRIVED];
    const left = stamps[VISIT_STAMP.LEFT];
    if (!arrived || !left) return null;
    const minutes = Math.round((new Date(left).getTime() - new Date(arrived).getTime()) / 60000);
    return minutes > 0 ? minutes : null;
  }, [stamps]);

  const derivedQuantity = useMemo(() => {
    const arrived = stamps[VISIT_STAMP.ARRIVED];
    const left = stamps[VISIT_STAMP.LEFT];
    if (!arrived || !left || unit !== "HOUR") return null;
    const minutes = (new Date(left).getTime() - new Date(arrived).getTime()) / 60000;
    if (minutes <= 0) return null;
    return Math.round((minutes / 60) * 100) / 100;
  }, [stamps, unit]);

  /* Taastame poooleli kaeaesoleva kuelastuse alles pärast esimest renderdust:
     `localStorage` ei ole serveris olemas ja `useState`-i algväärtusena tekitaks
     see hüdratsiooni lahknevuse. */
  const draftReadyRef = useRef(false);
  useEffect(() => {
    const draft = readVisitDraft(typeof window === "undefined" ? null : window.localStorage);
    /* Ka „mustandit ei olnud" lõpetab taastamise: muidu ei salvestuks enam
       kunagi midagi. */
    if (!draft) {
      draftReadyRef.current = true;
      return;
    }
    setStamps(draft.stamps);
    setLocationStamps(draft.locationStamps || {});
    setWithTravel(draft.withTravel);
    /* Iga väli taastatakse ainult siis, kui mustandis midagi oli: tühi string
       üle vaikeväärtuse (nt `unit = "HOUR"`) oleks samasugune vaikne kadu. */
    if (draft.clientName) setClientName(draft.clientName);
    if (draft.note) setNote(draft.note);
    if (draft.noteProvenance) setNoteProvenance(draft.noteProvenance);
    if (draft.quantity) setQuantity(draft.quantity);
    if (draft.unit) setUnit(draft.unit);
    if (draft.referralId) setReferralId(draft.referralId);
    if (draft.date) setDate(draft.date);
    if (Object.keys(draft.stamps || {}).length || draft.clientName) setRestoredDraft(true);
    draftReadyRef.current = true;
  }, []);

  /**
   * SALVESTAMINE ON ÜKS EFEKT, MITTE KÜMME KUTSET.
   *
   * Varem kirjutati mustandit ainult kahes kohas — templi panekul ja tagasi
   * võtmisel — ja iga uus väli oleks vajanud oma kutset, mille unustamine
   * oleks andnud vaikse kao täpselt seal, kus mustandit üldse vaja on.
   *
   * Kutsed olid pealegi `setStamps`-i uuendaja SEES: React kutsub uuendajat
   * StrictMode'is kaks korda ja kõrvalmõju uuendajas on iseenesest viga.
   */
  useEffect(() => {
    if (!draftReadyRef.current) return;
    writeVisitDraft(typeof window === "undefined" ? null : window.localStorage, {
      stamps,
      locationStamps,
      withTravel,
      clientName,
      note,
      noteProvenance,
      quantity,
      unit,
      referralId,
      date
    });
  }, [stamps, locationStamps, withTravel, clientName, note, noteProvenance, quantity, unit, referralId, date]);

  /**
   * TÄPSUS ON OSA TÕENDIST, MITTE TEHNILINE DETAIL.
   *
   * Omanik mõõtis päris seadmes: leht ütles Kopli, tegelik koht oli Tabasalu.
   * Peapõhjus oli vahemälu (`LOCATION_MAX_AGE_MS`), aga teine pool probleemist
   * on siin: „Asukoht märgitud" nägi mõlemal juhul välja ÜHTE MOODI. Punkt
   * ±20 m ja punkt ±3 km andsid sama rahustava lause.
   *
   * Nüüd ütleb ekraan numbri välja. Kui täpsus ei kanna kohalolu tõendina välja,
   * on lause hoiatav ja soovitab märkida uuesti — otsuse teeb inimene, kes
   * teab, kas ta seisab ukse taga või sõidab bussis.
   */
  const arrivalPoint = locationStamps[VISIT_STAMP.ARRIVED] || null;
  const locationMessage = (() => {
    if (locationState !== "captured" || !arrivalPoint) {
      return t(`service_log.location.${locationState}`, "");
    }
    const meters = Number.isFinite(Number(arrivalPoint.acc)) ? Math.round(Number(arrivalPoint.acc)) : null;
    if (meters === null) return t("service_log.location.captured", "");
    return t(
      arrivalPoint.trusted === false
        ? "service_log.location.coarse"
        : "service_log.location.captured_accuracy",
      "",
      { meters: String(meters) }
    );
  })();

  const flow = withTravel ? FLOW_WITH_TRAVEL : FLOW_WITHOUT_TRAVEL;
  /* Järgmine samm = esimene jada punkt, mida veel ei ole. `null` tähendab, et
     külastus on läbi ja edasi minnakse salvestamisega. */
  const nextStamp = flow.find((key) => !stamps[key]) || null;
  const lastStamp = [...flow].reverse().find((key) => stamps[key]) || null;
  const started = Boolean(lastStamp);

  /**
   * VÄLITÖÖ SILD (leping 8.4). Marsruut `/teenuspaevik?visit=<id>` tähendab
   * „see kirje sünnib sellest külastusest". Eeltäide tuleb SERVERIST, mitte
   * URL-ist: tuletamisreeglid on serveri tõde ja URL-i võib kirjutada igaüks.
   *
   * KIRJET EI LOODA AUTOMAATSELT. Külastus ei ole alati arveldatav teenus ja
   * arve alusdokument ei tohi tekkida ilma inimese kinnituseta — vorm täitub,
   * inimene vajutab „Salvesta".
   */
  useEffect(() => {
    if (!allowed || typeof window === "undefined") return;
    const visitId = new URLSearchParams(window.location.search).get("visit");
    if (!visitId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/service-entries?fromVisit=${encodeURIComponent(visitId)}`, {
          headers: { "x-ui-locale": locale || "et" }
        });
        if (!response.ok) {
          if (!cancelled) setFromVisitError(true);
          return;
        }
        const body = await response.json();
        const draft = body?.draft;
        if (cancelled || !draft) return;
        setFromVisit(draft);
        if (draft.date) setDate(String(draft.date).slice(0, 10));
        if (draft.arrivedAt || draft.leftAt) {
          setStamps({
            ...(draft.arrivedAt ? { [VISIT_STAMP.ARRIVED]: draft.arrivedAt } : {}),
            ...(draft.leftAt ? { [VISIT_STAMP.LEFT]: draft.leftAt } : {})
          });
        }
        if (draft.quantity !== null && draft.quantity !== undefined) {
          setQuantity(String(draft.quantity));
        }
        if (draft.unit) setUnit(draft.unit);
        /* Kell käib juba: eeltäidetud vorm on sisestuse algus, mitte lõpp. */
        markInputStartRef.current?.();
      } catch {
        if (!cancelled) setFromVisitError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, locale]);

  /* Kell kaeib AINULT piloodi ajal. Vaeljas lipuga ei alusta me isegi
     moootmist — mitte ei mooeda ja viska aera. */
  const markInputStart = useCallback(() => {
    if (!isServiceLogMeasurementUiEnabled()) return;
    if (!inputStartedRef.current) inputStartedRef.current = Date.now();
  }, []);
  markInputStartRef.current = markInputStart;

  /**
   * SAADAB JA UNUSTAB. Moodik on korvalsaadus: kui proov ei jou kohale (levi
   * kadus), on kaotus ueks number statistikas, mitte kirje. Seepaerast ei ole
   * siin `await`-i kutsuja rajal ega uehtegi veateadet.
   */
  const sendSample = useCallback(
    (kind, seconds) => {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      fetch("/api/service-log/measure", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
        body: JSON.stringify({ kind, seconds })
      }).catch(() => {});
    },
    [locale]
  );

  const finishInputTimer = useCallback(() => {
    const started = inputStartedRef.current;
    inputStartedRef.current = 0;
    if (!started) return;
    sendSample(SAMPLE_KIND.ENTRY_INPUT, Math.round((Date.now() - started) / 1000));
  }, [sendSample]);

  /**
   * ASUKOHAPUNKT (E2b, DoD 10). AJATEMPEL PANNAKSE KIRJA ESIMESENA ja punkti
   * küsitakse alles pärast seda — nii ei saa GPS-i ootamine, loa küsimine ega
   * tõrge külastuse märkimist edasi lükata ega ära jätta.
   *
   * KÜSITAKSE AINULT [KOHAL] VAJUTUSE HETKEL. Mitte igal märkel, mitte taustal,
   * mitte kordagi ilma kasutaja vajutuseta.
   */
  const stampNow = useCallback(
    (key) => {
      markInputStart();
      setStamps((current) => {
        return { ...current, [key]: new Date().toISOString() };
      });

      if (!isServiceLogLocationStampUiEnabled()) return;
      if (key !== VISIT_STAMP.ARRIVED) return;

      /* VOISTLUSOLUKORD, mis oleks maksnud vale asukoha VALEL kirjel.
         Asukohapaering kaib taustal ja voib kesta kuni 8 sekundit. Kui tootaja
         jouab selle ajaga kirje salvestada ja jargmise kliendi juurde asuda,
         joudis hilinenud vastus JUBA UUE vormi peale — ja kirjele oleks
         laeinud punkt kohast, kus seda teenust ei osutatud.

         Iga kuelastus saab oma poletusnumbri. Vastust votame vastu ainult
         siis, kui number on ikka seesama; vormi tuehjendamine kasvatab teda. */
      const visitToken = visitTokenRef.current;
      setLocationState("asking");
      /* PÕHJUS TULEB KAASA. Vana kood ütles iga tõrke peale ühte lauset ja
         kasutaja ei saanud teada, kas ta peaks midagi ette võtma — keelatud
         luba on parandatav ühe klikiga, aegumine mitte. */
      captureLocationPoint(undefined, {
        onReason: (reason) => {
          if (visitTokenRef.current !== visitToken) return;
          setLocationState(reason);
        }
      }).then((point) => {
        if (visitTokenRef.current !== visitToken) return;
        if (!point) return;
        setLocationStamps((current) => ({ ...current, [key]: point }));
        setLocationState("captured");
      });
    },
    [markInputStart]
  );

  /* „Vajutasin valesti" on paratamatu, kui nuppu on ainult üks: eksliku
     vajutuse hind on siin suurem kui nelja nupu paneelis, kus vale tempel jäi
     lihtsalt teise lahtrisse. Võtab tagasi VIIMASE märke, mitte kõik. */
  const undoLastStamp = useCallback(() => {
    setStamps((current) => {
      const order = withTravelRef.current ? FLOW_WITH_TRAVEL : FLOW_WITHOUT_TRAVEL;
      const last = [...order].reverse().find((key) => current[key]);
      if (!last) return current;
      const next = { ...current };
      delete next[last];
      return next;
    });
  }, []);

  /* KINNITAMINE PEAB OLEMA UI-s. Kirje sünnib mustandina ja eksport jätab
     mustandid vaikimisi välja — ilma selle nuputa võis osutaja sisestada terve
     kuu ja eksportida NULL rida, ilma et miski oleks katki paistnud. */
  const runLifecycle = useCallback(
    async (entryId, action) => {
      setFinalizing(entryId);
      setFinalizeError("");
      try {
        const response = await fetch(`/api/service-entries/${entryId}/lifecycle`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
          body: JSON.stringify({ action })
        });
        if (response.ok) {
          await loadEntries();
          return;
        }
        /* TÕRGE EI TOHI OLLA VAIKNE. Varem neelati vastus alla: kasutaja
           vajutas „Kinnita", mitte midagi ei juhtunud ja kirje jäi mustandiks —
           ta saanuks sellest teada alles kuu lõpus tühjast ekspordist. */
        const body = await response.json().catch(() => ({}));
        setFinalizeError(body?.message || t("service_log.errors.invalid_input", ""));
      } catch {
        setFinalizeError(t("service_log.errors.invalid_input", ""));
      } finally {
        setFinalizing("");
      }
    },
    [loadEntries, locale, t]
  );

  const finalize = useCallback((entryId) => runLifecycle(entryId, "finalize"), [runLifecycle]);

  /* KÄSITSI KINNITUS on VÄLISE kliendi paberallkirja MÄRGE, mitte kinnitus ise:
     osutaja ei kinnita kliendi eest. Platvormi kliendi digikinnitus käib oma
     teed (`/api/service-log/client`) ja seda siit teha ei saa. */
  const toggleManualConfirm = useCallback(
    (entry) =>
      runLifecycle(entry.id, entry.confirmedManually ? "unconfirm_manual" : "confirm_manual"),
    [runLifecycle]
  );

  const resetForm = useCallback(() => {
    /* Uus kuelastus = uus number. Vana kuelastuse hilinenud asukohavastus ei
       jou enam siia. */
    visitTokenRef.current += 1;
    setClientName("");
    setQuantity("");
    setNote("");
    setNoteProvenance(PROVENANCE.TOOTAJA_TAHELEPANEK);
    setStamps({});
    setFromVisit(null);
    setLocationStamps({});
    setLocationState("");
    setWithTravel(false);
    /* Salvestatud kirje ei ole enam pooleli töö: nimi ei tohi seadmesse jääda
       hetkegi kauemaks, kui teda vaja oli. */
    clearVisitDraft(typeof window === "undefined" ? null : window.localStorage);
    setRestoredDraft(false);
    setDefaults(null);
    setServiceId("");
    setReferralId("");
    setDate(todayIso());
  }, []);

  /**
   * ÜKS SAATMISFUNKTSIOON NII UUELE KUI JÄRJEKORRAS OLEVALE KIRJELE.
   *
   * Kaks eri rada tähendaks kahte eri arusaama sellest, mis on „õnnestus" — ja
   * järjekorra puhul on just see otsus kõige kallim: vale otsus jätab kirje
   * igaveseks järjekorda või kustutab tehtud töö ära.
   *
   * @returns {"sent"|"retry"|"rejected"}
   */
  const postEntry = useCallback(
    async (payload) => {
      let response;
      try {
        response = await fetch("/api/service-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
          body: JSON.stringify(payload)
        });
      } catch {
        /* `fetch` viskab AINULT võrguvea korral. Just see on „ei tea, kas
           jõudis" — ja just siin päästab `clientRequestId` topeltkirjest. */
        return { outcome: "retry" };
      }
      const body = await response.json().catch(() => ({}));
      if (response.ok) return { outcome: "sent", body };
      if (shouldRetry({ status: response.status })) return { outcome: "retry" };
      return { outcome: "rejected", body };
    },
    [locale]
  );

  /* Tühjendab järjekorra ükshaaval ja PEATUB esimese võrguvea peal: kui võrku
     ei ole, ei ole mõtet ülejäänuid läbi käia — ja järjekorra järjekord on
     ühtlasi kirjete sünniaeg. */
  const flushOutbox = useCallback(async () => {
    const storage = typeof window === "undefined" ? null : window.localStorage;
    const queued = readOutbox(storage);
    if (!queued.length) return;
    let sentAny = false;
    for (const item of queued) {
      const { outcome } = await postEntry(item);
      if (outcome === "retry") break;
      /* „rejected" kustutab samuti: server vaatas kirje üle ja ütles ei, seega
         kordamine annaks igavesti sama vastuse ja järjekord ei tühjeneks enam.
         Kadu on nähtav — pending-loendur langeb ja teade jääb ekraanile. */
      dequeue(storage, item.clientRequestId);
      if (outcome === "sent") sentAny = true;
      else setFormError(t("service_log.outbox.rejected", ""));
    }
    setPending(outboxCount(storage));
    if (sentAny) await loadEntries();
  }, [loadEntries, postEntry, t]);

  /* Kaks käivitajat: leht avaneb (seade võis vahepeal võrku saada) ja brauseri
     `online`. Kolmandat ei ole — perioodiline pollimine kulutaks akut just
     seal, kus töötaja on terve päeva väljas. */
  useEffect(() => {
    if (!allowed || typeof window === "undefined") return undefined;
    setPending(outboxCount(window.localStorage));
    flushOutbox();
    const onOnline = () => flushOutbox();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [allowed, flushOutbox]);

  const submit = useCallback(
    async (event) => {
      event.preventDefault();
      setFormError("");
      if (!clientName.trim()) {
        /* Ilma kliendita ei ole kirjel aruandes kohta — mall A grupeerib read
           kliendi kaupa. Teade on meie oma, sest brauseri oma on inglise keeles. */
        setFormError(t("service_log.errors.client_required", ""));
        return;
      }
      setSaving(true);
      const storage = typeof window === "undefined" ? null : window.localStorage;
      /* VÕTI SÜNNIB SIIN, mitte serveris — server ei saa teda ise välja mõelda,
         ja just tema teeb kordussaatmise ohutuks. */
      const clientRequestId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `req-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const payload = {
        clientRequestId,
        clientDisplayName: clientName.trim(),
        date,
        unit,
        serviceId: serviceId || null,
        referralId: referralId || null,
        quantity: quantity === "" ? null : quantity,
        note: note.trim() || null,
        noteProvenance: note.trim() ? noteProvenance : null,
        /* LAEHTEKUELASTUS. Ilma temata sai samast kuelastusest teha piiramatu
           arvu kirjeid ja miski ei naeidanud, kust kirje tuli. */
        ...(fromVisit?.sourceFieldVisitId
          ? { sourceFieldVisitId: fromVisit.sourceFieldVisitId }
          : {}),
        ...stamps,
        /* Server otsustab, kas punkt salvestub: lüliti on seal, mitte siin.
           Väljas lülitiga jõuab punkt serverini ja visatakse ära — UI ei tohi
           seetõttu väita „salvestatud" enne serveri vastust. */
        ...(Object.keys(locationStamps).length ? { locationStamps } : {})
      };
      try {
        const { outcome, body } = await postEntry(payload);

        if (outcome === "retry") {
          /* KIRJE EI KAO. Ta on seadmes ja läheb teele, kui võrk tuleb —
             vorm tühjendatakse, sest töötaja jaoks on see külastus tehtud. */
          enqueue(storage, payload);
          setPending(outboxCount(storage));
          /* Ka jaerjekorda laeinud kirje sisestamisele kulus paeris aeg — vork
             ei ole osa sellest, mida me moodame. */
          finishInputTimer();
          setFormError("");
          setOverrunNotice(null);
          resetForm();
          return;
        }

        if (outcome === "rejected") {
          setFormError(body?.message || t("service_log.errors.invalid_input", ""));
          return;
        }

        /* ÜLETAMISE HOIATUS (DoD 4). Server tagastab ta kirjega KOOS ja ta ei
           ole viga: kirje SALVESTUS. Osutaja näeb numbrit ja otsustab ise, kas
           ta räägib KOV-iga — dokumenteerimata töö oleks halvem. */
        if (body?.entry?.overrun?.warn) {
          setOverrunNotice(body.entry.overrun);
        } else {
          setOverrunNotice(null);
        }
        finishInputTimer();
        resetForm();
        await loadEntries();
      } finally {
        setSaving(false);
      }
    },
    [clientName, date, finishInputTimer, fromVisit, loadEntries, locationStamps, note, noteProvenance, postEntry, quantity, referralId, resetForm, serviceId, stamps, t, unit]
  );

  if (!isRoleResolved) return null;

  /* Teade on VORMI EES, mitte loendi all: kasutaja peab teadma ENNE täitmist,
     et salvestada ei õnnestu. */
  if (needsProfile) {
    return (
      <div className="sl-day">
        <div className="sl-needs-profile" role="status">
          <h2 className="sl-list-title">{t("service_log.needs_profile.title", "")}</h2>
          <p>{t("service_log.needs_profile.body", "")}</p>
          <Button as="a" href="/teenuseprofiil">
            {t("service_log.needs_profile.action", "")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="sl-day">
      {/* `noValidate`: brauseri oma valideerimismull („Please fill out this
          field.") joonistab OPERATSIOONISÜSTEEM — teda ei saa kujundada ega
          tõlkida ja eestikeelsel lehel ilmus ingliskeelne kollane mull klaasi
          keskele. Sama põhjus, miks siin ei ole natiivset `select`-i ega
          kuupäevavälja. Nõue ise jääb alles: väli kannab endiselt `required`-i
          (ekraanilugeja jaoks) ja puuduva välja ütleb meie oma teade. */}
      <form className="sl-form" noValidate onSubmit={submit} onInput={markInputStart}>
        {/* PÄRITOLU ON NÄHTAV. Ilma selleta ei saa kasutaja aru, miks väljad on
            juba täidetud — ja täidetud väli, mille päritolu ei tea, on halvem
            kui tühi väli. */}
        {fromVisit ? (
          <div className="sl-from-visit" role="status">
            <p className="sl-label">{t("service_log.from_visit.title", "")}</p>
            {fromVisit.locationText ? (
              <p className="sl-source">
                {t("service_log.from_visit.location", "", { place: fromVisit.locationText })}
              </p>
            ) : null}
            {!fromVisit.hasDuration ? (
              <p className="sl-source">{t("service_log.from_visit.no_duration", "")}</p>
            ) : null}
          </div>
        ) : null}
        {fromVisitError ? (
          <p className="sl-error" role="alert">
            {t("service_log.from_visit.load_error", "")}
          </p>
        ) : null}
        {/* KLIENT ENNE — see väli on esimene ja fookuses. */}
        <label className="sl-field">
          <span className="sl-label">{t("service_log.form.client", "")}</span>
          <input
            name="clientDisplayName"
            className="sl-input"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            autoComplete="off"
            required
          />
        </label>

        {/* TAASTAMINE PEAB OLEMA NÄHTAV, MITTE VAIKNE.
            Nimi, mis ilmub vormile iseenesest, on täpselt sama ohtlik nagu nimi,
            mis kaob: töötaja võib kirjutada uue kliendi ajad EELMISE kliendi nime
            alla, ilma et miski oleks katki paistnud. Seepärast tuleb taastatud
            külastus koos küsimusega ja ühe vajutusega saab ta ära visata. */}
        {restoredDraft ? (
          <div className="sl-restored" role="status">
            <p className="sl-restored-text">
              <strong>{t("service_log.draft.restored", "")}</strong>{" "}
              {t("service_log.draft.restored_check", "")}
            </p>
            <button type="button" className="sl-restored-discard" onClick={resetForm}>
              {t("service_log.draft.discard", "")}
            </button>
          </div>
        ) : null}

        {/* LUBA KÜSITAKSE ENNE, MITTE UKSE TAGA. Plokk kaob ise ära, kui luba
            on olemas ja töötab. */}
        {isServiceLogLocationStampUiEnabled() ? <LocationPermission /> : null}

        <h3 className="sl-group-title">{t("service_log.form.group_visit", "")}</h3>
        <div className="sl-flow" role="group" aria-label={t("service_log.stamps.group", "")}>
          {/* Soiduaja valik on ENNE alustamist ja lukustub esimese maerke jaerel:
              keskel uembervahetatuna tekiks jada, mille esimene samm on juba
              moeoedas ja mille juurde ei saa enam tagasi. */}
          <label className="sl-travel-toggle">
            <input
              type="checkbox"
              name="withTravel"
              checked={withTravel}
              disabled={started}
              onChange={(event) => {
                setWithTravel(event.target.checked);
                withTravelRef.current = event.target.checked;
              }}
            />
            <span>{t("service_log.stamps.with_travel", "")}</span>
          </label>

          {/* Seis on nupu KOHAL, mitte nupu sees: kasutaja peab nagema, kus ta
              jadas on, ka siis kui ta naeeb ekraani alles nuepu vajutamise
              hetkel. `aria-live` teatab sammu ka ekraanilugejale. */}
          {/* SEIS JA JAERGMINE SAMM ON KAKS ERI LAUSET. Kui „jaergmine" oli
              seisutekstis sees, uetles ta soiduajata jadas „maergi
              tagasijoudmine" — sammu, mida selles jadas ei olegi. Jaergmine
              samm tuletatakse `nextStamp`-ist, seega ta EI SAA lahkneda
              nupust, mis koervale ilmub. */}
          <p className="sl-flow-status" aria-live="polite">
            {lastStamp
              ? t(`service_log.stamps.state.${STAMP_KEY[lastStamp]}`, "", {
                  time: formatTime(stamps[lastStamp], locale)
                })
              : t("service_log.stamps.state.idle", "")}
            {nextStamp ? (
              <span className="sl-flow-next">
                {" "}
                {t("service_log.stamps.next", "", {
                  step: t(`service_log.stamps.step.${STAMP_KEY[nextStamp]}`, "")
                })}
              </span>
            ) : null}
          </p>

          {nextStamp ? (
            <button
              type="button"
              className="sl-flow-button"
              onClick={() => stampNow(nextStamp)}
            >
              {t(`service_log.stamps.action.${STAMP_KEY[nextStamp]}`, "")}
            </button>
          ) : (
            <p className="sl-flow-done">{t("service_log.stamps.state.done", "")}</p>
          )}

          {/* TÖÖTAJA NÄEB, MIS TEMA KOHTA SALVESTATI. Vaikne asukohakogumine oleks
              sama asi, mille eest me konkurenti kritiseerime. */}
          {locationState ? (
            <p
              className={arrivalPoint && arrivalPoint.trusted === false ? "sl-source sl-source-warn" : "sl-source"}
              aria-live="polite"
            >
              {locationMessage}
            </p>
          ) : null}

          {started ? (
            <button type="button" className="sl-flow-undo" onClick={undoLastStamp}>
              {t("service_log.stamps.undo", "")}
            </button>
          ) : null}
        </div>

        {/* SUUNAMISE VALIK. Server ütleb `askReferral`, kui kliendil on mitu
            aktiivset suunamist — siis EI TOHI masin valida, sest vale
            suunamine tähendab valele KOV-ile esitatud mahtu. */}
        {defaults?.askReferral && Array.isArray(defaults.referrals) && defaults.referrals.length > 1 ? (
          <label className="sl-field">
            <span className="sl-label">{t("service_log.form.referral", "")}</span>
            <Dropdown
              name="referralId"
              value={referralId}
              onChange={setReferralId}
              placeholder={t("service_log.form.referral_choose", "")}
              options={defaults.referrals.map((referral) => ({
                value: referral.id,
                label: `${referral.kovName}${referral.referralNumber ? ` · ${referral.referralNumber}` : ""}`
              }))}
            />
          </label>
        ) : null}

        {/* Teenuse valik ilmub AINULT siis, kui server ütleb, et küsida tuleb. */}
        {defaults?.askService && Array.isArray(defaults.services) && defaults.services.length > 1 ? (
          <label className="sl-field">
            <span className="sl-label">{t("service_log.form.service", "")}</span>
            <Dropdown
              name="serviceId"
              value={serviceId}
              onChange={setServiceId}
              placeholder={t("service_log.form.service_choose", "")}
              options={defaults.services.map((service) => ({
                value: service.id,
                label: service.name
              }))}
            />
          </label>
        ) : null}

        <h3 className="sl-group-title">{t("service_log.form.group_entry", "")}</h3>
        <div className="sl-row">
          <label className="sl-field">
            <span className="sl-label">{t("service_log.form.date", "")}</span>
            <DateField
              name="date"
              value={date}
              onChange={(next) => {
                markInputStart();
                setDate(next);
              }}
              required
            />
          </label>

          <label className="sl-field">
            <span className="sl-label">{t("service_log.form.quantity", "")}</span>
            <input
              name="quantity"
              className="sl-input"
              type="number"
              step="0.25"
              min="0"
              inputMode="decimal"
              value={quantity}
              placeholder={derivedQuantity !== null ? String(derivedQuantity) : ""}
              onChange={(event) => setQuantity(event.target.value)}
            />
            {derivedQuantity !== null && quantity === "" ? (
              <span className="sl-hint">{t("service_log.form.quantity_derived", "")}</span>
            ) : null}
            {/* MÕÕDETUD AEG EI TOHI ÄRA KAODA. Tuletatud KOGUS eeldab tundi,
                aga KESTUS on olemas iga ühiku juures — ja just teda vaatab
                inimene, kes kontrollib, kas märked said õigeks. */}
            {measuredMinutes !== null ? (
              <span className="sl-hint">
                {t("service_log.form.measured_minutes", "", { minutes: measuredMinutes })}
              </span>
            ) : null}
          </label>

          <label className="sl-field">
            <span className="sl-label">{t("service_log.form.unit", "")}</span>
            <Dropdown
              name="unit"
              value={unit}
              onChange={setUnit}
              ariaLabel={t("service_log.form.unit", "")}
              /* KUI SERVER ÜTLEB „küsi", peab valik seda ka ÜTLEMA. Päris
                 juhtum näitas tühja rippmenüüd ilma ühegi vihjeta: kasutaja ei
                 saanud aru, et temalt oodatakse valikut, ja kuna tuletatud
                 kogus nõuab tundi, kadus koos sellega ka kestus ekraanilt. */
              placeholder={t("service_log.form.unit_choose", "")}
              options={SERVICE_UNITS.map((value) => ({
                value,
                label: t(`service_log.units.${value.toLowerCase()}`, value)
              }))}
            />
          </label>
        </div>

        <label className="sl-field">
          <span className="sl-label">{t("service_log.form.note", "")}</span>
          <textarea
            name="note"
            className="sl-input sl-textarea"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {/* Piirang on NÄHTAV, mitte ainult ⓘ-s peidus. */}
          <span className="sl-hint">{t("service_log.form.note_hint", "")}</span>

          {/* Päritolu ilmub ALLES siis, kui märkus on kirjutatud: tühja märkuse
              juures oleks ta müra, mis maksab sekundeid igal sisestusel. */}
          {note.trim() ? (
            <span className="sl-note-provenance">
              <span className="sl-label">{t("service_log.form.note_provenance", "")}</span>
              <Dropdown
                name="noteProvenance"
                value={noteProvenance}
                onChange={setNoteProvenance}
                ariaLabel={t("service_log.form.note_provenance", "")}
                options={NOTE_PROVENANCES.map((value) => ({
                  value,
                  label: t(`casework.provenance.${value}`, value)
                }))}
              />
            </span>
          ) : null}
        </label>

        {overrunNotice ? (
          <p className="sl-warn" role="status">
            {t("service_log.form.overrun_saved", "")} {overrunNotice.overBy}
          </p>
        ) : null}

        {formError ? (
          <p className="sl-error" role="alert">
            {formError}
          </p>
        ) : null}

        <Button type="submit" disabled={saving || !clientName.trim()}>
          {saving ? t("service_log.form.saving", "") : t("service_log.form.save", "")}
        </Button>

        {/* OOTEL OLEV TÖÖ PEAB OLEMA NÄHTAV. Vaikne järjekord tähendaks, et
            töötaja arvab kirjet olevat serveris, aga ta on tema telefonis —
            ja kui telefon kaob, kaob koos temaga tasustamata töö.

            SÕNASTUS VÄLDIB MITMUST TEADLIKULT („Ootel: 3", mitte „3 kirjet").
            Esimene katse ütles „Ootel 1 kirjet" — vale eesti keel, mille
            brauserikontroll kohe välja tõi. Platvormi `t()` ei tunne
            mitmusevorme ja vene keeles on neid kolm, seega ainus aus valik ilma
            `Intl.PluralRules`-i sisse toomata on lause, mis mitmust ei nõua. */}
        {pending > 0 ? (
          <p className="sl-pending" role="status">
            {t("service_log.outbox.pending", "", { count: pending })}
          </p>
        ) : null}
      </form>

      <div className="sl-list">
        <h2 className="sl-list-title">{t("service_log.list.title", "")}</h2>
        {finalizeError ? (
          <p className="sl-error" role="alert" aria-live="assertive">
            {finalizeError}
          </p>
        ) : null}
        {/* VEASEIS VAELISTAB TUEHJA SEISU. Varem kuvati korraga „laadimine
            ebaoennestus" ja „kirjeid veel ei ole" — kasutaja ei saanud teada,
            kumb on tosi, ja tal ei olnud uehtegi nuppu, millega uuesti proovida. */}
        {loadError ? (
          <div className="sl-load-error">
            <p className="sl-error" role="alert">
              {typeof loadError === "string" ? loadError : t("service_log.list.load_error", "")}
            </p>
            <button type="button" className="sl-tab" onClick={loadEntries}>
              {t("service_log.list.retry", "")}
            </button>
          </div>
        ) : entries === null ? null : entries.length === 0 ? (
          <p className="sl-empty">{t("service_log.list.empty", "")}</p>
        ) : (
          <ul className="sl-entries">
            {entries.map((entry) => (
              <li key={entry.id} className="sl-entry">
                <span className="sl-entry-client">{entry.clientDisplayName || "—"}</span>
                <span className="sl-entry-meta">
                  {entry.date} · {entry.quantity}{" "}
                  {t(`service_log.units.${String(entry.unit).toLowerCase()}`, entry.unit)}
                  {entry.travelMinutes !== null
                    ? ` · ${t("service_log.list.travel", "")} ${entry.travelMinutes} min`
                    : ""}
                  {" · "}
                  {t(`service_log.status.${String(entry.status || "DRAFT").toLowerCase()}`, entry.status)}
                  {/* Serveri tõde, mitte brauseri oma: kui lüliti on väljas, ei
                      ole siin midagi, ka siis kui brauser punkti kätte sai. */}
                  {entry.locationStampedAt?.length ? ` · ${t("service_log.location.saved", "")}` : ""}
                </span>
                <button
                  type="button"
                  className={`sl-tab${entry.confirmedManually ? " is-active" : ""}`}
                  disabled={finalizing === entry.id}
                  aria-pressed={Boolean(entry.confirmedManually)}
                  onClick={() => toggleManualConfirm(entry)}
                >
                  {t("service_log.list.manual_confirm", "")}
                </button>
                {entry.status === "DRAFT" ? (
                  <button
                    type="button"
                    className="sl-tab"
                    disabled={finalizing === entry.id}
                    onClick={() => finalize(entry.id)}
                  >
                    {finalizing === entry.id
                      ? t("service_log.form.saving", "")
                      : t("service_log.list.finalize", "")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
