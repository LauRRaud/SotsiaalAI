/**
 * KODUTEENUS K1 — sisendi normaliseerimine.
 *
 * Käsitsi normaliseerijad nagu mujal repos (valideerimisteeki ei ole). Kõik
 * kontrollid tehakse ENNE tehingut. Tundmatu väli jäetakse kõrvale; vale
 * väärtus on 400 koos tõlkevõtmega. Tekst on lihttekst: HTML-i ei puhastata,
 * vaade renderdab selle tekstina.
 */

import { createHash } from "node:crypto";

import { badRequest } from "../org/errors.js";

import {
  CARE_ACCESS_REASONS,
  CARE_ACTIVITY_OUTCOMES,
  CARE_CALL_CALLERS,
  CARE_CALL_TOPICS,
  CARE_CARD_LINE_KINDS,
  CARE_CLIENT_STATUSES,
  CARE_STATUS_REASONS,
  CARE_CONTACT_MODES,
  CARE_ENTRY_KINDS,
  CARE_INCIDENT_ACTIONS,
  CARE_INCIDENT_STATUSES,
  CARE_INCIDENT_TYPES,
  CARE_PLAN_MODES,
  CareActivityOutcome,
  CareContactMode,
  CareEntryKind,
  HOME_CARE_LIMITS
} from "./constants.js";

const ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;
const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Postgresi INT4 ülempiir: suurem arv ei mahu veergu ja oleks 500, mitte 400. */
const INT4_MAX = 2147483647;
/** NUL-märk: Postgresi tekstiveerg seda ei võta. */
const NUL = String.fromCharCode(0);

/**
 * Päringu keha peab olema objekt. `null`, massiiv või lihtväärtus loetakse
 * tühjaks kehaks, et vigane keha annaks väljapõhise 400, mitte TypeError-i.
 */
export function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** Lihtväärtus tekstina. Objekt (ka omatehtud `toString`-iga) on tühi tekst. */
function scalarText(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function isAbsent(value) {
  return value === undefined || value === null || value === "";
}

export function normalizeText(rawValue, max, { required = false, errorKey } = {}) {
  const value = typeof rawValue === "string" ? rawValue.split(NUL).join("") : rawValue;
  const text = typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
  if (!text) {
    if (required) throw badRequest(errorKey || "home_care.errors.text_required");
    return null;
  }
  if (text.length > max) throw badRequest("home_care.errors.text_too_long", { limit: max });
  return text;
}

/** Üherealine väli: reavahetused ja korduvad tühikud üheks tühikuks. */
export function normalizeLine(value, max, options) {
  const text = normalizeText(typeof value === "string" ? value.replace(/\s+/g, " ") : value, max, options);
  return text;
}

export function normalizeId(value, errorKey = "home_care.errors.invalid_id") {
  const id = scalarText(value).trim();
  if (!ID_PATTERN.test(id)) throw badRequest(errorKey);
  return id;
}

export function normalizeOptionalId(value, errorKey) {
  if (value === undefined || value === null || value === "") return null;
  return normalizeId(value, errorKey);
}

export function normalizeEnum(value, allowed, errorKey, { fallback } = {}) {
  const text = scalarText(value).trim().toUpperCase();
  if (!text && fallback !== undefined) return fallback;
  if (!allowed.includes(text)) throw badRequest(errorKey);
  return text;
}

export function normalizeVersion(value) {
  const version = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(version) || version < 1 || version > INT4_MAX) {
    throw badRequest("home_care.errors.version_required");
  }
  return version;
}

export function normalizeRequestId(value) {
  if (value === undefined || value === null || value === "") return null;
  const id = scalarText(value).trim();
  if (!REQUEST_ID_PATTERN.test(id)) throw badRequest("home_care.errors.invalid_request_id");
  return id;
}

function parseDate(value, errorKey) {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) throw badRequest(errorKey);
  return date;
}

/**
 * Sündmuse aeg. Puudumisel `now`. Tulevikku lubame ainult kellade erinevuse
 * jagu: kirje sündmusest, mis ei ole veel juhtunud, on sisestusviga.
 */
export function normalizeOccurredAt(value, now) {
  if (value === undefined || value === null || value === "") return new Date(now);
  const date = parseDate(value, "home_care.errors.invalid_occurred_at");
  if (date.getTime() > now.getTime() + HOME_CARE_LIMITS.OCCURRED_AT_FUTURE_SKEW_MS) {
    throw badRequest("home_care.errors.occurred_at_in_future");
  }
  return date;
}

export function normalizeOptionalDate(value, errorKey = "home_care.errors.invalid_date") {
  if (value === undefined || value === null || value === "") return null;
  return parseDate(value, errorKey);
}

/**
 * Seadme kirjutamisaeg. See on seadme VÄIDE, mitte tõend: hoiame seda ainult
 * siis, kui see mahub mõistlikku aknasse serveri kella suhtes (mitte tulevikus,
 * mitte vanem kui võrguta järjekorra pikim iga). Muu väärtus jäetakse vaikselt
 * kõrvale; kirje ise salvestub.
 */
export function normalizeDeviceCreatedAt(value, now) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) return null;
  if (time > now.getTime() + HOME_CARE_LIMITS.OCCURRED_AT_FUTURE_SKEW_MS) return null;
  if (time < now.getTime() - HOME_CARE_LIMITS.DEVICE_CREATED_MAX_AGE_MS) return null;
  return date;
}

/**
 * Kui kaua kirje seadme järjekorras võrku ootas (millisekundites).
 *
 * MIKS KESTUS, mitte kellaaeg. Kirje, mis sündis keldris ilma levita, jõuab
 * serverisse tunde hiljem; sündmuse aeg on salvestamise vajutus, mitte
 * kohalejõudmine. Seadme kellaaega server ei usalda (valesti käiv kell), aga
 * kestuse mõõdab seade ühe ja sama kellaga mõlemas otsas, nii et kella viga
 * taandub välja. Server arvutab: sündmuse aeg = oma kell miinus ooteaeg.
 *
 * Ooteaeg on seadme väide. Seepärast ei võta see kirjelt märki ära: hiljem
 * kohale jõudnud kirjel on alati kas „hiljem kirjutatud" või „saadetud hiljem".
 */
export function normalizeWaitedMs(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > HOME_CARE_LIMITS.QUEUE_WAIT_MAX_MS) {
    throw badRequest("home_care.errors.invalid_waited");
  }
  return Math.round(value);
}

/** Kalendripäev kujul AAAA-KK-PP → { year, month, day } või null. */
export function normalizeIsoDay(value) {
  if (value === undefined || value === null || value === "") return null;
  const match = ISO_DAY_PATTERN.exec(scalarText(value).trim());
  if (!match) throw badRequest("home_care.errors.invalid_date");
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    check.getUTCFullYear() !== parts.year ||
    check.getUTCMonth() !== parts.month - 1 ||
    check.getUTCDate() !== parts.day
  ) {
    throw badRequest("home_care.errors.invalid_date");
  }
  return parts;
}

export function normalizeClientInput(rawInput = {}, { partial = false } = {}) {
  const input = asObject(rawInput);
  const data = {};
  if (!partial || input.displayName !== undefined) {
    data.displayName = normalizeLine(input.displayName, HOME_CARE_LIMITS.DISPLAY_NAME_MAX, {
      required: true,
      errorKey: "home_care.errors.name_required"
    });
  }
  if (input.internalCode !== undefined) {
    data.internalCode = normalizeLine(input.internalCode, HOME_CARE_LIMITS.INTERNAL_CODE_MAX);
  }
  if (input.address !== undefined) data.address = normalizeLine(input.address, HOME_CARE_LIMITS.ADDRESS_MAX);
  if (input.contactPhone !== undefined) {
    data.contactPhone = normalizeLine(input.contactPhone, HOME_CARE_LIMITS.PHONE_MAX);
  }
  if (input.contactNote !== undefined) {
    data.contactNote = normalizeText(input.contactNote, HOME_CARE_LIMITS.CONTACT_NOTE_MAX);
  }
  if (input.unitId !== undefined) data.unitId = normalizeOptionalId(input.unitId, "home_care.errors.invalid_unit");
  return data;
}

export function normalizeStatusInput(rawInput = {}) {
  const input = asObject(rawInput);
  const status = normalizeEnum(input.status, CARE_CLIENT_STATUSES, "home_care.errors.invalid_status");
  /* Alus kuulub seisu juurde: ära oleval ja lõppenud kliendil on see kohustuslik,
     aktiivsel seda ei ole (saadetud väärtust ei arvestata). */
  const allowed = CARE_STATUS_REASONS[status];
  const statusReason = allowed.length
    ? normalizeEnum(input.statusReason, allowed, "home_care.errors.status_reason_required")
    : null;
  return {
    status,
    statusReason,
    statusNote: normalizeLine(input.statusNote, HOME_CARE_LIMITS.STATUS_NOTE_MAX)
  };
}

export function normalizeCardLineInput(rawInput = {}) {
  const input = asObject(rawInput);
  return {
    kind: normalizeEnum(input.kind, CARE_CARD_LINE_KINDS, "home_care.errors.invalid_card_kind"),
    text: normalizeLine(input.text, HOME_CARE_LIMITS.CARD_LINE_TEXT_MAX, {
      required: true,
      errorKey: "home_care.errors.card_text_required"
    })
  };
}

/**
 * „Mida tegin" sammud. Kellaaja puudumisel paneb selle server. Tagastab kaks
 * kuju: `actions` läheb andmebaasi, `shape` kordussaatmise räsisse (seal on
 * serveri pandud kellaaja kohal `null`, vt `entryRequestHash`).
 */
function normalizeIncidentActions(value, now, eventNow = now) {
  if (value === undefined || value === null) return { actions: null, shape: null };
  if (!Array.isArray(value)) throw badRequest("home_care.errors.invalid_incident_actions");
  const seen = new Set();
  const actions = [];
  const shape = [];
  for (const rawItem of value.slice(0, CARE_INCIDENT_ACTIONS.length)) {
    const item = asObject(rawItem);
    const code = normalizeEnum(item.code, CARE_INCIDENT_ACTIONS, "home_care.errors.invalid_incident_actions");
    if (seen.has(code)) continue;
    seen.add(code);
    const given = !isAbsent(item.at);
    const at = given ? parseDate(item.at, "home_care.errors.invalid_incident_actions") : eventNow;
    if (at.getTime() > now.getTime() + HOME_CARE_LIMITS.OCCURRED_AT_FUTURE_SKEW_MS) {
      throw badRequest("home_care.errors.invalid_incident_actions");
    }
    actions.push({ code, at: at.toISOString() });
    shape.push({ code, at: given ? at.toISOString() : null });
  }
  return actions.length ? { actions, shape } : { actions: null, shape: null };
}

/** Käigu kestus täisminutites (1 kuni üks ööpäev); puuduv väärtus = kestust ei märgitud. */
function normalizeVisitMinutes(value) {
  if (isAbsent(value)) return null;
  const text = scalarText(value).trim();
  const minutes = /^\d{1,4}$/.test(text) ? Number(text) : NaN;
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > HOME_CARE_LIMITS.VISIT_MINUTES_MAX) {
    throw badRequest("home_care.errors.visit_minutes_invalid", { limit: HOME_CARE_LIMITS.VISIT_MINUTES_MAX });
  }
  return minutes;
}

/**
 * Käigul tehtud toimingud: `[{ activityId, mode }]`. Toimingu nime ja selle, kas see
 * on kavas, loeb server andmebaasist; siin kontrollitakse ainult kuju.
 */
function normalizeVisitActivities(value) {
  if (isAbsent(value)) return [];
  if (!Array.isArray(value)) throw badRequest("home_care.errors.visit_activity_unknown");
  if (value.length > HOME_CARE_LIMITS.VISIT_ACTIVITIES_MAX) {
    throw badRequest("home_care.errors.visit_too_many_activities", { limit: HOME_CARE_LIMITS.VISIT_ACTIVITIES_MAX });
  }
  const items = value.map((rawItem) => {
    const item = asObject(rawItem);
    /* Tulemus puudub = tehtud (nii saatis kirjeid ka varasem vorm ja seadme järjekord). */
    const outcome = normalizeEnum(item.outcome, CARE_ACTIVITY_OUTCOMES, "home_care.errors.visit_outcome_invalid", {
      fallback: CareActivityOutcome.DONE
    });
    return {
      activityId: normalizeId(item.activityId, "home_care.errors.visit_activity_unknown"),
      /* Tegemise viis on tehtud toimingul; tegemata toimingu reale paneb server kava rea viisi. */
      mode: outcome === CareActivityOutcome.DONE ? normalizeEnum(item.mode, CARE_PLAN_MODES, "home_care.errors.visit_mode_required") : null,
      outcome
    };
  });
  if (new Set(items.map((item) => item.activityId)).size !== items.length) {
    throw badRequest("home_care.errors.visit_activity_repeated");
  }
  return items;
}

/**
 * Päevikukirje sisu. Erijuhtumi väljad loetakse ainult liigi INCIDENT korral;
 * muul liigil jäetakse need vaikselt kõrvale, et vormi vahetus ei tekitaks
 * „pooleldi erijuhtumit".
 *
 * `base` on PARANDATAV kirje. Parandus ei ole täisasendus: väli, mida päring ei
 * saatnud, jääb nii, nagu see kirjel on. Ilma selleta muudaks ainult teksti
 * saatev parandus mure tavaliseks kirjeks (ja meeskonnale nähtavaks) ning
 * sündmuse aja paranduse hetkeks.
 */
export function normalizeEntryInput(rawInput = {}, { now, base = null }) {
  const input = asObject(rawInput);
  const kind = normalizeEnum(input.kind, CARE_ENTRY_KINDS, "home_care.errors.invalid_entry_kind", {
    fallback: base?.kind || CareEntryKind.NOTE
  });
  /* Seadme järjekorras oodanud UUS kirje: kui inimene aega ei sisestanud, on
     sündmuse aeg salvestamise vajutus (serveri kell miinus ooteaeg), mitte
     kohalejõudmise hetk. Parandusel ooteaega ei ole. */
  const waitedMs = base ? null : normalizeWaitedMs(input.waitedMs);
  const eventNow = waitedMs ? new Date(now.getTime() - waitedMs) : now;
  const occurredGiven = !isAbsent(input.occurredAt);
  const occurredAt =
    !occurredGiven && base?.occurredAt
      ? new Date(base.occurredAt)
      : occurredGiven
        ? /* Sisestatud aeg ei tohi olla hilisem salvestamise vajutusest: sama
             reegel mis võrgus, kus tuleviku aeg lükatakse kohe tagasi. */
          normalizeOccurredAt(input.occurredAt, eventNow)
        : new Date(eventNow);
  const contactMode = normalizeEnum(input.contactMode, CARE_CONTACT_MODES, "home_care.errors.invalid_contact_mode", {
    fallback: base?.contactMode || CareContactMode.VISIT
  });
  /* Kõnemärge: kes helistas ja mille pärast. Ainult telefonikontaktil; kui
     kontakti viis muudetakse käiguks, kaovad need väljad koos sellega. Paranduses
     jäävad saatmata väljad nii, nagu need kirjel on. */
  let callTopic = null;
  let callCaller = null;
  if (contactMode === CareContactMode.PHONE) {
    if (!isAbsent(input.callTopic) || !isAbsent(input.callCaller)) {
      callTopic = normalizeEnum(input.callTopic, CARE_CALL_TOPICS, "home_care.errors.invalid_call");
      callCaller = normalizeEnum(input.callCaller, CARE_CALL_CALLERS, "home_care.errors.invalid_call");
    } else if (base) {
      callTopic = base.callTopic || null;
      callCaller = base.callCaller || null;
    }
  }
  /* Käigu kirje (K2-d): kestus ja tehtud toimingud. Ainult käigul; kui kontakti
     viis muudetakse muuks, kaovad need koos sellega. Paranduses jääb saatmata väli
     nii, nagu see kirjel on: `visitActivities: null` tähendab „jäta read puutumata". */
  let visitMinutes = null;
  let visitActivities = [];
  if (contactMode === CareContactMode.VISIT) {
    visitMinutes = input.visitMinutes === undefined && base ? (base.visitMinutes ?? null) : normalizeVisitMinutes(input.visitMinutes);
    visitActivities = input.activities === undefined && base ? null : normalizeVisitActivities(input.activities);
  }
  /* Tavaline käik, kus kõik läks nagu kavas: toimingud on märgitud ja teksti ei ole
     vaja. Muu liigi kirje (teade järgmisele, kokkulepe, mure, erijuhtum) on tekst. */
  const doneCount = visitActivities === null ? (base?.activities?.length ?? 0) : visitActivities.length;
  const textOptional = kind === CareEntryKind.NOTE && doneCount > 0;
  const data = {
    kind,
    contactMode,
    callTopic,
    callCaller,
    visitMinutes,
    visitActivities,
    text: textOptional
      ? normalizeText(input.text, HOME_CARE_LIMITS.ENTRY_TEXT_MAX) || ""
      : normalizeText(input.text, HOME_CARE_LIMITS.ENTRY_TEXT_MAX, {
          required: true,
          errorKey: "home_care.errors.entry_text_required"
        }),
    occurredAt,
    deviceCreatedAt: normalizeDeviceCreatedAt(input.deviceCreatedAt, now),
    deviceQueuedSec: waitedMs === null ? null : Math.round(waitedMs / 1000),
    companionMembershipId:
      input.companionMembershipId === undefined && base
        ? base.companionMembershipId || null
        : normalizeOptionalId(input.companionMembershipId, "home_care.errors.invalid_companion"),
    incidentType: null,
    incidentAssessment: null,
    incidentActions: null
  };
  let actionShape = null;

  if (kind === CareEntryKind.INCIDENT) {
    data.incidentType = normalizeEnum(input.incidentType, CARE_INCIDENT_TYPES, "home_care.errors.invalid_incident_type", {
      fallback: base?.incidentType || undefined
    });
    data.incidentAssessment =
      input.incidentAssessment === undefined && base
        ? base.incidentAssessment || null
        : normalizeText(input.incidentAssessment, HOME_CARE_LIMITS.ASSESSMENT_MAX);
    const actions =
      input.incidentActions === undefined && base
        ? normalizeIncidentActions(Array.isArray(base.incidentActions) ? base.incidentActions : null, now)
        : normalizeIncidentActions(input.incidentActions, now, eventNow);
    data.incidentActions = actions.actions;
    actionShape = actions.shape;
  }

  /* Mida päring ISE ütles (serveri vaikeväärtusteta). Ainult räsi jaoks. */
  data.requestShape = {
    occurredAt: occurredGiven ? occurredAt.toISOString() : null,
    incidentActions: actionShape
  };
  return data;
}

export function normalizeReason(value) {
  return normalizeText(value, HOME_CARE_LIMITS.REASON_MAX, {
    required: true,
    errorKey: "home_care.errors.reason_required"
  });
}

export function normalizeAccessReasonInput(rawInput = {}) {
  const input = asObject(rawInput);
  return {
    reasonCode: normalizeEnum(input.reasonCode, CARE_ACCESS_REASONS, "home_care.errors.access_reason_required"),
    reason: normalizeLine(input.reason, HOME_CARE_LIMITS.ACCESS_REASON_MAX)
  };
}

export function normalizeIncidentStatusInput(rawInput = {}) {
  const input = asObject(rawInput);
  return {
    status: normalizeEnum(input.status, CARE_INCIDENT_STATUSES, "home_care.errors.invalid_incident_status"),
    note: normalizeText(input.note, HOME_CARE_LIMITS.ASSESSMENT_MAX)
  };
}

export function normalizeSearchQuery(value) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (text.length < HOME_CARE_LIMITS.SEARCH_MIN) throw badRequest("home_care.errors.search_too_short");
  return text.slice(0, HOME_CARE_LIMITS.SEARCH_MAX);
}

/**
 * Kordussaatmise võrdlus: sama võti + sama sisu on kordus, sama võti + muu sisu
 * on konflikt. Räsi arvutatakse normaliseeritud sisust kindlas võtmejärjekorras.
 *
 * Räsis on see, mida PÄRING ütles, mitte see, mille server juurde pani. Kui
 * sündmuse aeg või sammu kellaaeg jäi saatmata, paneb server selleks `now`;
 * korduskatsel oleks `now` teine ja juba salvestatud kirje näeks välja nagu
 * muu sisuga päring.
 */
export function entryRequestHash(clientId, data) {
  const shape = data.requestShape || {
    occurredAt: data.occurredAt.toISOString(),
    incidentActions: data.incidentActions || null
  };
  const canonical = JSON.stringify([
    clientId,
    data.kind,
    data.contactMode,
    data.text,
    shape.occurredAt,
    data.companionMembershipId || null,
    data.incidentType || null,
    data.incidentAssessment || null,
    shape.incidentActions || null,
    /* Kõnemärke väljad lisanduvad AINULT siis, kui need on olemas: ilma
       kõnemärketa kirje räsi peab jääma samaks, mis enne nende väljade tulekut,
       muidu oleks seadme järjekorras ootav vanem kirje pärast uuendust konflikt. */
    ...(data.callTopic ? [data.callTopic, data.callCaller] : []),
    /* Käigu kirje väljad samal põhjusel AINULT siis, kui need on olemas. */
    ...(data.visitMinutes || data.visitActivities?.length
      ? [
          [
            "visit",
            data.visitMinutes || null,
            /* Tehtud toimingu kuju on sama mis enne tulemuse välja: ootel kirje räsi ei muutu. */
            (data.visitActivities || []).map((item) =>
              item.outcome && item.outcome !== CareActivityOutcome.DONE ? [item.activityId, item.mode, item.outcome] : [item.activityId, item.mode]
            )
          ]
        ]
      : [])
  ]);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
