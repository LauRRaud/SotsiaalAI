"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { newClientActionKey } from "@/components/casework/caseWorkClient";
import { useI18n } from "@/components/i18n/I18nProvider";
import Dropdown from "@/components/ui/Dropdown";
import {
  CARE_CONTACT_MODES,
  CARE_ENTRY_KINDS,
  CARE_INCIDENT_ACTIONS,
  CARE_INCIDENT_TYPES,
  CARE_PLAN_MODES,
  COORDINATOR_ONLY_INCIDENT_TYPES,
  CareContactMode,
  CareEntryKind,
  CarePlanMode,
  HOME_CARE_LIMITS
} from "@/lib/homeCare/constants";
import { appendDictatedText } from "@/lib/homeCare/dictation";
import { OUTBOX_LIMIT, isDraftWorthKeeping, isUnreachable } from "@/lib/homeCare/outbox";

import HomeCareDictation from "./HomeCareDictation";
import {
  formatDateTime,
  fromZonedInputValue,
  homeCareBase,
  toZonedInputValue,
  useHomeCareApi
} from "./homeCareClient";
import { getOutboxManager } from "./homeCareOutbox";

const DRAFT_SAVE_DELAY_MS = 600;
/* Salvestamise päringu ajapiir: pärast seda käsitletakse päringut kui võrguviga
   ja uus kirje läheb seadme järjekorda. */
const SAVE_TIMEOUT_MS = 25_000;
/* Enne päringut ootame mustandi salvestust (katse võti) nii kaua; hoidla viga ei tohi salvestamist takistada. */
const DRAFT_BEFORE_SEND_MS = 400;
/* Alates sellest vanusest pakub taastatud mustand sündmuse ajaks oma kirjutamise aja. */
const DRAFT_TIME_HINT_MS = 10 * 60 * 1000;
/* Käigu kestuse kiirvalikud minutites. */
const VISIT_MINUTE_CHOICES = Object.freeze([15, 30, 45, 60, 90]);

/** Mustandist loetud „toiming → kuidas tehti": ainult tuntud väärtused. */
function restoredDone(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, mode]) => CARE_PLAN_MODES.includes(mode)));
}

/** Mustandist loetud kavavälised toimingud: ainult ID ja nimi. */
function restoredExtra(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item.activityId === "string" && typeof item.name === "string")
    .map((item) => ({ activityId: item.activityId, name: item.name }));
}

/**
 * Päevikukirje vorm: uus kirje või olemasoleva parandus.
 *
 * KORDUSSAATMINE. Esimesel katsel pannakse paika päringu võti. Kui salvestus
 * ebaõnnestub ja inimene vajutab uuesti, läheb teele TÄPSELT sama keha: server
 * tunneb korduse ära ja teist kirjet ei teki. Uus võti tekib alles siis, kui
 * sisu muudetakse.
 *
 * KELL. Kui inimene aega ei sisesta, EI saada vorm seadme kellaaega: sündmuse
 * aja ja tehtud sammude kellaajad paneb server. Valesti käiva kellaga telefon
 * saaks muidu vastuseks „aeg ei saa olla tulevikus", kuigi keegi aega ei
 * sisestanud. Sisestatud aeg on asutuse ajavööndis, nagu kõik ajad lehel.
 *
 * VEA KORRAL JÄÄB TEKST ALLES. Vorm tühjendatakse ainult õnnestumise järel.
 *
 * PARANDUS nõuab põhjust. Erijuhtumit ei saa parandusega tavaliseks kirjeks
 * muuta ega vastupidi, seepärast on liigivalik paranduses kitsam.
 *
 * VÕRGUTA (ainult uus kirje). Kui salvestamine serverini ei jõua, läheb SAMA
 * keha (sama võtmega) seadme krüpteeritud järjekorda ja saadetakse, kui ühendus
 * taastub; vorm tühjeneb ja ütleb, et kirje on ootel. Kui seade hoidlat ei
 * toeta, jääb kõik nagu enne: viga on näha ja tekst alles.
 *
 * POOLELI KIRJE hoitakse samas hoidlas kliendi kaupa: telefoni lukustumine või
 * lehe uuesti laadimine teksti ära ei vii. Koos tekstiga hoitakse viimase
 * salvestuskatse võtit, et pärast taastamist muutmata kujul salvestatud kirje
 * oleks serverile kordus, mitte teine kirje.
 *
 * DIKTEERIMINE lisab teksti välja lõppu (platvormi enda kõnetuvastus). Tekst
 * ei salvestu enne, kui inimene on selle üle lugenud ja salvestamist vajutanud.
 *
 * KÄIGU KIRJE (K2-d). Kui kontakti viis on käik, saab märkida, mida tehti (kliendi
 * kehtiva hoolduskava toimingud; muu toimingu saab lisada asutuse kataloogist), kuidas
 * tehti ja kui kaua käik kestis. Tavalisel käigul, kus toimingud on märgitud, võib
 * tekst tühjaks jääda. Need väljad lähevad uuel kirjel kaasa ainult siis, kui need
 * on täidetud; parandus saadab need alati, et ka eemaldamine jõuaks serverisse.
 *
 * SALVESTAMISE AJAL ON VORM LUKUS (`inert`). Pärast päringut tühjendatakse
 * vorm; kui inimene saaks vahepeal edasi kirjutada, kaoks lisatud lause koos
 * tühjendamisega. Nõrga leviga võib päring kesta kümneid sekundeid, seepärast
 * on sellel ajapiir.
 */
export default function HomeCareEntryForm({
  organizationId,
  clientId,
  team = [],
  viewerMembershipId = null,
  clientName = "",
  timeZone,
  entry = null,
  plan = null,
  onSaved,
  onCancel
}) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const catalogueApi = useHomeCareApi();
  const fieldId = useId();
  const attemptRef = useRef(null);
  const correcting = Boolean(entry);
  const wasIncident = entry?.kind === CareEntryKind.INCIDENT;

  const [kind, setKind] = useState(entry?.kind || CareEntryKind.NOTE);
  const [contactMode, setContactMode] = useState(entry?.contactMode || CareContactMode.VISIT);
  const [text, setText] = useState(entry?.text || "");
  const [occurredLocal, setOccurredLocal] = useState("");
  const [companion, setCompanion] = useState(entry?.companionMembershipId || "");
  const [incidentType, setIncidentType] = useState(entry?.incident?.type || "");
  const [assessment, setAssessment] = useState(entry?.incident?.assessment || "");
  const [actions, setActions] = useState(() => {
    const map = {};
    for (const action of entry?.incident?.actions || []) map[action.code] = action.at || null;
    return map;
  });
  /* Käigu kirje: kestus minutites ja tehtud toimingud kujul „toiming → kuidas tehti". */
  const [visitMinutes, setVisitMinutes] = useState(entry?.visit?.minutes ? String(entry.visit.minutes) : "");
  const [done, setDone] = useState(() =>
    Object.fromEntries((entry?.visit?.activities || []).filter((item) => item.activityId).map((item) => [item.activityId, item.mode]))
  );
  /* Toimingud, mida kehtivas kavas ei ole: kataloogist lisatud või parandataval kirjel juba olemas. */
  const [extra, setExtra] = useState(() =>
    (entry?.visit?.activities || [])
      .filter((item) => item.activityId && !(plan?.lines || []).some((line) => line.activityId === item.activityId))
      .map((item) => ({ activityId: item.activityId, name: item.name }))
  );
  /* Asutuse kataloog laaditakse alles siis, kui inimene tahab lisada muu toimingu. */
  const [catalogue, setCatalogue] = useState(null);
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState(false);
  const [queued, setQueued] = useState(false);
  /* Dikteeritud tekst ei mahtunud kirje pikkuse piiri ja lõpp jäi välja. */
  const [dictationCut, setDictationCut] = useState(false);
  /* `""` = ei ole taastatud; muidu mustandi kirjutamise aeg või `"-"`, kui see ei ole teada. */
  const [restored, setRestored] = useState("");
  /* Lukk kogu salvestamise ajaks, ka järjekorda panemise ajal (`busy` katab ainult päringu). */
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  /* Kuni seadmest ei ole loetud, kas mustand on olemas, ei tohi viitega
     salvestus seda üle kirjutada ega kustutada. */
  const loadedRef = useRef(false);
  /* Seadme hoidla on liikmesuse oma; paranduse vorm seda ei kasuta. */
  const device = useMemo(
    () => (correcting ? null : getOutboxManager(viewerMembershipId)),
    [correcting, viewerMembershipId]
  );
  const touchedRef = useRef(false);
  const latestRef = useRef(null);

  const isIncident = kind === CareEntryKind.INCIDENT;
  const isVisit = contactMode === CareContactMode.VISIT;
  /* Valikus on kehtiva kava read ja selle kirje kavavälised toimingud, selles järjekorras. */
  const planChoices = (plan?.lines || [])
    .filter((line) => line.activityId)
    .map((line) => ({ activityId: line.activityId, name: line.activityName, mode: line.mode, critical: Boolean(line.critical) }));
  const visitChoices = [
    ...planChoices,
    ...extra
      .filter((item) => !planChoices.some((choice) => choice.activityId === item.activityId))
      .map((item) => ({ activityId: item.activityId, name: item.name, mode: CarePlanMode.TOGETHER, critical: false }))
  ];
  const doneList = isVisit
    ? visitChoices.filter((choice) => done[choice.activityId]).map((choice) => ({ activityId: choice.activityId, mode: done[choice.activityId] }))
    : [];
  /* Tavaline käik märgitud toimingutega ei vaja teksti; muu liigi kirje on tekst. */
  const textRequired = !(kind === CareEntryKind.NOTE && doneList.length > 0);
  const otherOptions = (catalogue || [])
    .filter((activity) => !visitChoices.some((choice) => choice.activityId === activity.id))
    .map((activity) => ({ value: activity.id, label: activity.name }));
  const coordinatorOnly =
    kind === CareEntryKind.CONCERN || (isIncident && COORDINATOR_ONLY_INCIDENT_TYPES.includes(incidentType));

  const kindChoices = CARE_ENTRY_KINDS.filter((value) => {
    if (!correcting) return true;
    return wasIncident ? value === CareEntryKind.INCIDENT : value !== CareEntryKind.INCIDENT;
  });

  const companionOptions = [
    { value: "", label: t("home_care.entry.companion_none") },
    ...team
      .filter((member) => member.active && member.membershipId !== viewerMembershipId)
      .map((member) => ({ value: member.membershipId, label: member.name }))
  ];
  /* Parandatava kirje kaaslane võib olla meeskonnast lahkunud; valik peab
     teda siiski näitama, muidu võtaks parandus ta kirjelt vaikselt maha. */
  if (entry?.companionMembershipId && !companionOptions.some((option) => option.value === entry.companionMembershipId)) {
    companionOptions.push({ value: entry.companionMembershipId, label: entry.companionName || "" });
  }

  const touch = () => {
    touchedRef.current = true;
    setSaved(false);
    setQueued(false);
    setDictationCut(false);
    if (error) setError("");
  };

  /* Püsiv viide: kõnetuvastuse hook hoiab seda oma sõltuvustes. Välja praegune
     tekst loetakse viitest (uuendatakse pärast iga joonistust): tuvastus jõuab
     kohale sekundeid hiljem ja inimene võib vahepeal edasi kirjutada. */
  const addDictated = useCallback((spoken) => {
    const next = appendDictatedText(latestRef.current?.text ?? "", spoken, HOME_CARE_LIMITS.ENTRY_TEXT_MAX);
    touchedRef.current = true;
    setSaved(false);
    setQueued(false);
    setDictationCut(next.cut);
    setText(next.text);
  }, []);

  useEffect(() => {
    latestRef.current = { kind, contactMode, text, occurredLocal, companion, incidentType, assessment, actions, visitMinutes, done, extra };
  });

  /* Mustandi salvestus: kohe (leht läheb peitu, vorm suletakse) või viitega (kirjutamise ajal). */
  const saveDraftNow = useCallback(() => {
    if (!device || !touchedRef.current || !loadedRef.current) return null;
    const state = latestRef.current;
    if (isDraftWorthKeeping(state)) return device.saveDraft(clientId, { ...state, attempt: attemptRef.current });
    return device.clearDraft(clientId);
  }, [device, clientId]);

  useEffect(() => {
    if (!device) return undefined;
    let alive = true;
    device.loadDraft(clientId).then((draft) => {
      if (!alive) return;
      loadedRef.current = true;
      const state = draft?.state;
      if (!isDraftWorthKeeping(state)) return;
      const savedText = typeof state.text === "string" ? state.text : "";
      const savedAssessment = typeof state.assessment === "string" ? state.assessment : "";
      const joined = (now, saved, max) =>
        [now, saved]
          .filter((part) => String(part || "").trim())
          .join("\n\n")
          .slice(0, max);
      if (isDraftWorthKeeping(latestRef.current)) {
        /* Inimene jõudis juba kirjutada, enne kui mustand seadmest kätte saadi:
           tema tekst jääb ette ja mustandi tekst lisatakse järele. Kumbki ei kao. */
        setText((now) => joined(now, savedText, HOME_CARE_LIMITS.ENTRY_TEXT_MAX));
        setAssessment((now) => joined(now, savedAssessment, HOME_CARE_LIMITS.ASSESSMENT_MAX));
        touchedRef.current = true;
      } else {
        setKind(CARE_ENTRY_KINDS.includes(state.kind) ? state.kind : CareEntryKind.NOTE);
        setContactMode(CARE_CONTACT_MODES.includes(state.contactMode) ? state.contactMode : CareContactMode.VISIT);
        setText(savedText);
        setCompanion(typeof state.companion === "string" ? state.companion : "");
        setIncidentType(CARE_INCIDENT_TYPES.includes(state.incidentType) ? state.incidentType : "");
        setAssessment(savedAssessment);
        setActions(state.actions && typeof state.actions === "object" ? state.actions : {});
        setVisitMinutes(typeof state.visitMinutes === "string" ? state.visitMinutes : "");
        setDone(restoredDone(state.done));
        setExtra(restoredExtra(state.extra));
        const typedTime = typeof state.occurredLocal === "string" ? state.occurredLocal : "";
        const age = Date.now() - Number(draft.savedAtMs);
        setOccurredLocal(typedTime);
        if (state.attempt?.signature && state.attempt?.body) {
          /* Salvestamist on juba proovitud: keha peab jääma täpselt samaks, et
             kohale jõudnud kirje uus salvestus oleks kordus. Aega siin ei pakuta. */
          attemptRef.current = state.attempt;
        } else if (!typedTime && Number.isFinite(age) && age >= DRAFT_TIME_HINT_MS) {
          /* Vana mustand ilma ajata: sündmus oli siis, kui seda kirjutati, mitte
             nüüd. Pakume selle aja välja; inimene näeb seda ja saab muuta. Ilma
             selleta saaks tunde hiljem salvestatud kirje ajaks „praegu".
             Pakkumine ei loe vormi puudutamiseks: mustand jääb seadmesse oma
             algse kirjutamisajaga, kuni inimene midagi muudab või salvestab. */
          setOccurredLocal(toZonedInputValue(new Date(draft.savedAtMs).toISOString(), timeZone));
        }
      }
      const savedAt = Number.isFinite(Number(draft.savedAtMs)) ? new Date(draft.savedAtMs).toISOString() : "";
      setRestored(savedAt || "-");
    });
    const onHidden = () => {
      if (document.visibilityState === "hidden") saveDraftNow();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", saveDraftNow);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", saveDraftNow);
      saveDraftNow();
    };
  }, [device, clientId, saveDraftNow, timeZone]);

  useEffect(() => {
    if (!device || !touchedRef.current) return undefined;
    const timer = setTimeout(saveDraftNow, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [device, saveDraftNow, kind, contactMode, text, occurredLocal, companion, incidentType, assessment, actions, visitMinutes, done, extra]);

  const toggleAction = (code) => {
    touch();
    setActions((current) => {
      const next = { ...current };
      if (code in next) delete next[code];
      else next[code] = null;
      return next;
    });
  };

  const toggleDone = (choice) => {
    touch();
    setDone((current) => {
      const next = { ...current };
      if (next[choice.activityId]) delete next[choice.activityId];
      else next[choice.activityId] = choice.mode;
      return next;
    });
  };

  const setDoneMode = (activityId, mode) => {
    touch();
    setDone((current) => ({ ...current, [activityId]: mode }));
  };

  const loadCatalogue = async () => {
    const result = await catalogueApi.call(`${homeCareBase(organizationId)}/toimingud`, { fallbackKey: "home_care.errors.list_failed" });
    if (result.ok) setCatalogue((result.data.activities || []).filter((activity) => !activity.archivedAt));
  };

  const addOther = (activityId) => {
    const activity = (catalogue || []).find((item) => item.id === activityId);
    if (!activity) return;
    touch();
    setExtra((current) => [...current, { activityId: activity.id, name: activity.name }]);
    setDone((current) => ({ ...current, [activity.id]: CarePlanMode.TOGETHER }));
  };

  const reset = () => {
    attemptRef.current = null;
    touchedRef.current = false;
    setRestored("");
    setDictationCut(false);
    device?.clearDraft(clientId);
    setKind(CareEntryKind.NOTE);
    setContactMode(CareContactMode.VISIT);
    setText("");
    setOccurredLocal("");
    setCompanion("");
    setIncidentType("");
    setAssessment("");
    setActions({});
    setVisitMinutes("");
    setDone({});
    setExtra([]);
    setReason("");
  };

  const buildBody = () => {
    const actionCodes = CARE_INCIDENT_ACTIONS.filter((code) => code in actions);
    const signature = JSON.stringify([
      kind,
      contactMode,
      text,
      occurredLocal,
      companion,
      isIncident ? incidentType : "",
      isIncident ? assessment : "",
      isIncident ? actionCodes : [],
      reason,
      isVisit ? visitMinutes.trim() : "",
      doneList
    ]);
    if (attemptRef.current?.signature === signature) return attemptRef.current.body;

    const body = {
      kind,
      contactMode,
      text,
      companionMembershipId: companion || null
    };
    /* Aeg läheb kaasa ainult siis, kui inimene selle sisestas. Paranduses
       tähendab puuduv aeg „jäta nagu on", uuel kirjel „praegu" (serveri kell). */
    if (occurredLocal) body.occurredAt = fromZonedInputValue(occurredLocal, timeZone) || occurredLocal;
    if (isIncident) {
      body.incidentType = incidentType;
      body.incidentAssessment = assessment;
      /* Varem salvestatud sammu kellaaeg jääb; uue sammu kellaaja paneb server. */
      body.incidentActions = actionCodes.map((code) => (actions[code] ? { code, at: actions[code] } : { code }));
    }
    /* Kestus läheb numbrina; muu sisestuse lükkab server selge teatega tagasi. */
    const minutes = isVisit ? visitMinutes.trim() : "";
    const minutesValue = /^\d+$/.test(minutes) ? Number(minutes) : minutes;
    if (correcting) {
      if (isVisit) {
        body.visitMinutes = minutes ? minutesValue : null;
        body.activities = doneList;
      }
    } else {
      if (minutes) body.visitMinutes = minutesValue;
      if (doneList.length) body.activities = doneList;
    }
    if (correcting) {
      body.reason = reason;
      body.revision = entry.revision;
    } else {
      body.deviceCreatedAt = new Date().toISOString();
      body.clientRequestId = newClientActionKey();
    }
    attemptRef.current = { signature, body };
    return body;
  };

  const send = async () => {
    const body = buildBody();
    /* Katse võti läheb mustandisse ENNE päringut: kui leht selle ajal uuesti
       laaditakse ja kirje oli juba kohale jõudnud, on uus salvestus kordus.
       Ka muutmata kujul salvestatud taastatud mustandi puhul, seepärast loeb
       salvestamise vajutus vormi puudutamiseks. Ootame salvestuse ära (lühikese
       piiriga), et võti oleks seadmes enne, kui päring teele läheb. */
    touchedRef.current = true;
    const stored = saveDraftNow();
    if (stored) {
      await Promise.race([stored.catch(() => {}), new Promise((resolve) => setTimeout(resolve, DRAFT_BEFORE_SEND_MS))]);
    }
    const base = `${homeCareBase(organizationId)}/kliendid/${clientId}/kirjed`;
    const options = { body, fallbackKey: "home_care.errors.save_failed", timeoutMs: SAVE_TIMEOUT_MS };
    const result = correcting
      ? await call(`${base}/${entry.id}`, { ...options, method: "PATCH" })
      : await call(base, { ...options, method: "POST" });
    if (!result.ok) {
      if (!device || !isUnreachable(result.status)) return;
      const outcome = await device.enqueue({ organizationId, clientId, clientName, body });
      if (outcome.ok) {
        setError("");
        reset();
        setQueued(true);
      } else if (outcome.reason === "full") {
        setError(t("home_care.outbox.full", { limit: OUTBOX_LIMIT }));
      }
      return;
    }
    onSaved?.(result.data.entry);
    if (!correcting) {
      reset();
      setSaved(true);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    /* Üks salvestamine korraga: teine vajutus järjekorda panemise ajal ei tohi
       alustada uut katset, mille lõpp tühjendaks vahepeal alustatud kirje. */
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSaved(false);
    setQueued(false);
    try {
      await send();
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const textLabel = isIncident ? t("home_care.incident.text_label") : t("home_care.entry.text_label");

  return (
    <form className="hc-form" onSubmit={submit} inert={sending} aria-busy={sending}>
      {restored ? (
        <div className="hc-notice" role="status">
          <p>
            {restored === "-"
              ? t("home_care.entry.draft_restored")
              : t("home_care.entry.draft_restored_at", { time: formatDateTime(restored, timeZone) })}
          </p>
          <div className="hc-row">
            <button className="hc-btn hc-btn--quiet" type="button" onClick={reset} disabled={busy}>
              {t("home_care.entry.draft_clear")}
            </button>
          </div>
        </div>
      ) : null}
      <div className="hc-field">
        <span className="hc-label" id={`${fieldId}-kind`}>
          {t("home_care.entry.kind_label")}
        </span>
        <div className="hc-chips" role="group" aria-labelledby={`${fieldId}-kind`}>
          {kindChoices.map((value) => (
            <button
              key={value}
              type="button"
              className="hc-chip"
              aria-pressed={kind === value}
              onClick={() => {
                touch();
                setKind(value);
              }}
            >
              {t(`home_care.entry.kinds.${value}`)}
            </button>
          ))}
        </div>
      </div>

      {isIncident ? (
        <>
          <p className="hc-notice hc-notice--warn">{t("home_care.incident.notice")}</p>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.incident.type_label")}</span>
            <Dropdown
              value={incidentType}
              onChange={(value) => {
                touch();
                setIncidentType(value);
              }}
              ariaLabel={t("home_care.incident.type_label")}
              placeholder={t("home_care.incident.type_label")}
              options={CARE_INCIDENT_TYPES.map((value) => ({ value, label: t(`home_care.incident.types.${value}`) }))}
              required
            />
          </div>
        </>
      ) : null}

      {isVisit ? (
        <fieldset className="hc-fieldset">
          <legend className="hc-label">{t("home_care.visit.title")}</legend>
          {visitChoices.length === 0 ? <p className="hc-hint">{t("home_care.visit.no_plan")}</p> : null}
          {visitChoices.map((choice) => (
            <div key={choice.activityId}>
              <button
                type="button"
                className="hc-chip"
                aria-pressed={Boolean(done[choice.activityId])}
                onClick={() => toggleDone(choice)}
              >
                {choice.name}
              </button>
              {choice.critical && !done[choice.activityId] ? (
                <>
                  {" "}
                  <span className="hc-badge hc-badge--warn">{t("home_care.plan.critical_badge")}</span>
                </>
              ) : null}
              {done[choice.activityId] ? (
                <div className="hc-chips" role="group" aria-label={t("home_care.visit.mode_label", { name: choice.name })}>
                  {CARE_PLAN_MODES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className="hc-chip"
                      aria-pressed={done[choice.activityId] === value}
                      onClick={() => setDoneMode(choice.activityId, value)}
                    >
                      {t(`home_care.visit.modes.${value}`)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {catalogue ? (
            otherOptions.length > 0 ? (
              <Dropdown
                value=""
                onChange={addOther}
                ariaLabel={t("home_care.visit.add_other")}
                placeholder={t("home_care.visit.other_placeholder")}
                options={otherOptions}
              />
            ) : (
              <p className="hc-hint">{t("home_care.visit.catalogue_done")}</p>
            )
          ) : (
            <button className="hc-btn hc-btn--quiet" type="button" onClick={loadCatalogue} disabled={catalogueApi.busy}>
              {t("home_care.visit.add_other")}
            </button>
          )}
          {catalogueApi.error ? (
            <p className="hc-error" role="alert">
              {catalogueApi.error}
            </p>
          ) : null}
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-minutes`}>
              {t("home_care.visit.minutes_label")}
            </label>
            <input
              id={`${fieldId}-minutes`}
              className="hc-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={HOME_CARE_LIMITS.VISIT_MINUTES_MAX}
              value={visitMinutes}
              onChange={(event) => {
                touch();
                setVisitMinutes(event.target.value);
              }}
            />
            <div className="hc-chips" role="group" aria-label={t("home_care.visit.minutes_quick")}>
              {VISIT_MINUTE_CHOICES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="hc-chip"
                  aria-pressed={visitMinutes === String(value)}
                  onClick={() => {
                    touch();
                    setVisitMinutes(visitMinutes === String(value) ? "" : String(value));
                  }}
                >
                  {t("home_care.visit.minutes", { minutes: value })}
                </button>
              ))}
            </div>
          </div>
        </fieldset>
      ) : null}

      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-text`}>
          {textLabel}
        </label>
        <textarea
          id={`${fieldId}-text`}
          className="hc-textarea"
          value={text}
          onChange={(event) => {
            touch();
            setText(event.target.value);
          }}
          maxLength={HOME_CARE_LIMITS.ENTRY_TEXT_MAX}
          rows={4}
          required={textRequired}
          aria-describedby={`${fieldId}-text-hint`}
        />
        <p className="hc-hint" id={`${fieldId}-text-hint`}>
          {textRequired ? t("home_care.entry.write_what_you_saw") : t("home_care.visit.text_optional")}
        </p>
        <HomeCareDictation onText={addDictated} disabled={busy || sending} describedBy={`${fieldId}-dictation-hint`} />
        <p className="hc-hint" id={`${fieldId}-dictation-hint`}>
          {t("home_care.dictation.hint")}
        </p>
        {dictationCut ? (
          <p className="hc-notice hc-notice--warn" role="status">
            {t("home_care.dictation.cut", { limit: HOME_CARE_LIMITS.ENTRY_TEXT_MAX })}
          </p>
        ) : null}
      </div>

      {isIncident ? (
        <>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-assessment`}>
              {t("home_care.incident.assessment_label")}
            </label>
            <textarea
              id={`${fieldId}-assessment`}
              className="hc-textarea hc-textarea--short"
              value={assessment}
              onChange={(event) => {
                touch();
                setAssessment(event.target.value);
              }}
              maxLength={HOME_CARE_LIMITS.ASSESSMENT_MAX}
              rows={2}
            />
          </div>
          <fieldset className="hc-fieldset">
            <legend className="hc-label">{t("home_care.incident.actions_label")}</legend>
            {CARE_INCIDENT_ACTIONS.map((code) => (
              <label key={code} className="hc-check">
                <input type="checkbox" checked={code in actions} onChange={() => toggleAction(code)} />
                <span>{t(`home_care.incident.actions.${code}`)}</span>
              </label>
            ))}
          </fieldset>
        </>
      ) : null}

      <div className="hc-field">
        <span className="hc-label" id={`${fieldId}-contact`}>
          {t("home_care.entry.contact_label")}
        </span>
        <div className="hc-chips" role="group" aria-labelledby={`${fieldId}-contact`}>
          {CARE_CONTACT_MODES.map((value) => (
            <button
              key={value}
              type="button"
              className="hc-chip"
              aria-pressed={contactMode === value}
              onClick={() => {
                touch();
                setContactMode(value);
              }}
            >
              {t(`home_care.entry.contact.${value}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="hc-grid hc-grid--two">
        <div className="hc-field">
          <label className="hc-label" htmlFor={`${fieldId}-occurred`}>
            {t("home_care.entry.occurred_label")}
          </label>
          <input
            id={`${fieldId}-occurred`}
            className="hc-input"
            type="datetime-local"
            value={occurredLocal || (correcting ? toZonedInputValue(entry.occurredAt, timeZone) : "")}
            onChange={(event) => {
              touch();
              setOccurredLocal(event.target.value);
            }}
            aria-describedby={correcting ? undefined : `${fieldId}-occurred-hint`}
          />
          {correcting ? null : (
            <p className="hc-hint" id={`${fieldId}-occurred-hint`}>
              {t("home_care.entry.occurred_hint")}
            </p>
          )}
        </div>
        {companionOptions.length > 1 ? (
          <div className="hc-field">
            <span className="hc-label">{t("home_care.entry.companion_label")}</span>
            <Dropdown
              value={companion}
              onChange={(value) => {
                touch();
                setCompanion(value);
              }}
              ariaLabel={t("home_care.entry.companion_label")}
              options={companionOptions}
            />
          </div>
        ) : null}
      </div>

      {correcting ? (
        <div className="hc-field">
          <label className="hc-label" htmlFor={`${fieldId}-reason`}>
            {t("home_care.entry.reason_label")}
          </label>
          <input
            id={`${fieldId}-reason`}
            className="hc-input"
            value={reason}
            onChange={(event) => {
              touch();
              setReason(event.target.value);
            }}
            maxLength={HOME_CARE_LIMITS.REASON_MAX}
            required
            autoComplete="off"
          />
        </div>
      ) : null}

      <p className="hc-hint">
        {coordinatorOnly
          ? t("home_care.entry.visibility_coordinator")
          : t("home_care.entry.visibility_team", { count: team.filter((member) => member.active).length })}
      </p>

      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="hc-ok" role="status">
          {t("home_care.entry.saved")}
        </p>
      ) : null}
      {queued ? (
        <p className="hc-ok" role="status">
          {t("home_care.entry.queued")}
        </p>
      ) : null}

      <div className="hc-row">
        <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || sending}>
          {correcting ? t("home_care.entry.correct_save") : t("home_care.entry.save")}
        </button>
        {onCancel ? (
          <button className="hc-btn" type="button" onClick={onCancel} disabled={busy}>
            {t("home_care.entry.cancel")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
