import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { ActionKind, buildActionHref } from "@/lib/actions/registry";
import { getEventSpec } from "@/lib/events/registry";

export const NOTIFICATION_EVENT_TYPES = Object.freeze({
  PRE_INQUIRY_ARRIVED: "PRE_INQUIRY_ARRIVED",
  PRE_INQUIRY_STATUS_CHANGED: "PRE_INQUIRY_STATUS_CHANGED",
  PRE_INQUIRY_RECALLED: "PRE_INQUIRY_RECALLED",
  ROOM_INVITE: "ROOM_INVITE",
  ROOM_ACTIVITY: "ROOM_ACTIVITY",
  // T12 E7: kõne/salvestuse elutsükkel kasutajateele. Payload kannab AINULT
  // ID-d, olekut ja ohutut sihtlinki — mitte sõnumi sisu, salvestist ega
  // kokkuvõtte teksti (T12 leping E7).
  CALL_STARTED: "CALL_STARTED",
  CALL_RECORDING_READY: "CALL_RECORDING_READY",
  // T20 COLLAB-P2: kokkuvõtte kinnitusring — fakt + viide, MITTE sisu.
  // Payload kannab jagamise-ID ja ruumi-ID; kokkuvõtte tekst ega paranduse
  // sisu ei liigu teavitusse (sama leping mis T12 E7 kõneteavitustel).
  ROOM_SUMMARY_APPROVAL_REQUESTED: "ROOM_SUMMARY_APPROVAL_REQUESTED",
  ROOM_SUMMARY_APPROVAL_RESPONSE: "ROOM_SUMMARY_APPROVAL_RESPONSE",
  // T20 COLLAB-P3 (O-CO-3 b): omanikuvahetus on osalejatele nähtav üleminek,
  // mitte vaikne taustamuutus.
  ROOM_OWNERSHIP_TRANSFERRED: "ROOM_OWNERSHIP_TRANSFERRED",
  /* T25 viil B: organisatsiooni vastuvõtt. Payload kannab AINULT ID-d ja
     ohutut sihtlinki — pöördumise sisu, saatja isikut ega kiireloomulisuse
     märget teavitusse EI PANDA (sama leping mis T12 E7 ja T20 COLLAB-P2). */
  ORG_WORK_ASSIGNED: "ORG_WORK_ASSIGNED",
  /* T25 viil C: tööheaolu toeavaldus. Payload kannab AINULT avalduse ID-d.
     Snapshot'i sisu, saatja isikut ega organisatsiooni nime teavitusse EI
     PANDA — see on platvormi kõige privaatsem rada (arenduskava §D8). */
  ORG_SUPPORT_SHARE_RECEIVED: "ORG_SUPPORT_SHARE_RECEIVED",
  HELP_MATCH_CREATED: "HELP_MATCH_CREATED",
  HELP_MATCH_CONSENT_REQUEST: "HELP_MATCH_CONSENT_REQUEST",
  NEXT_CONTACT_DUE: "NEXT_CONTACT_DUE",
  PRACTICE_REVIEW_ASSIGNED: "PRACTICE_REVIEW_ASSIGNED",
  PRACTICE_REVIEW_OVERDUE: "PRACTICE_REVIEW_OVERDUE",
  SERVICE_AVAILABILITY_STALE: "SERVICE_AVAILABILITY_STALE",
  DATA_EXPORT_READY: "DATA_EXPORT_READY",
  MENTORING_REQUEST_CREATED: "MENTORING_REQUEST_CREATED",
  MENTORING_REQUEST_ACCEPTED: "MENTORING_REQUEST_ACCEPTED",
  MENTORING_REQUEST_DECLINED: "MENTORING_REQUEST_DECLINED",
  MENTORING_REQUEST_EXPIRED: "MENTORING_REQUEST_EXPIRED",
  MENTORING_RELATION_ACTIVATED: "MENTORING_RELATION_ACTIVATED",
  MENTORING_AGREEMENT_UPDATED: "MENTORING_AGREEMENT_UPDATED",
  MENTORING_MEETING_UPCOMING: "MENTORING_MEETING_UPCOMING",
  MENTORING_MEETING_CHANGED: "MENTORING_MEETING_CHANGED",
  MENTORING_MEETING_CANCELLED: "MENTORING_MEETING_CANCELLED",
  MENTORING_SUMMARY_PENDING: "MENTORING_SUMMARY_PENDING",
  MENTORING_SUMMARY_CONFIRMED: "MENTORING_SUMMARY_CONFIRMED",
  MENTORING_RELATION_PAUSED: "MENTORING_RELATION_PAUSED",
  MENTORING_RELATION_RESUMED: "MENTORING_RELATION_RESUMED",
  MENTORING_RELATION_CLOSED: "MENTORING_RELATION_CLOSED",
  MENTORING_INACTIVITY_CHECK: "MENTORING_INACTIVITY_CHECK",
  MENTORING_PROFILE_APPROVED: "MENTORING_PROFILE_APPROVED",
  MENTORING_PROFILE_REJECTED: "MENTORING_PROFILE_REJECTED",
  MENTORING_PROFILE_REVOKED: "MENTORING_PROFILE_REVOKED",
  MENTORING_SHARE_RECALLED: "MENTORING_SHARE_RECALLED",
  FIELD_CHECKIN_DUE: "FIELD_CHECKIN_DUE",
  WELLBEING_CHECKPOINT_DUE: "WELLBEING_CHECKPOINT_DUE",
  // JTA-V1 (E7, L7): arhiveeritud juhtum kustub 30 päeva pärast. Adressaat on
  // AINULT juhtumi omanik — juhtum on rangelt isiklik (L2) ja kellelgi teisel ei
  // ole temast midagi teada. Teavitus kannab FAKTI ja viidet, mitte sisu.
  CASE_WORK_RETENTION_WARNING: "CASE_WORK_RETENTION_WARNING",
  // Supervisioon V0 (T22, Q2.8): fakt + viide, MITTE sisu. Kõik sihivad
  // protsessi (targetKind SUPERVISION_PROCESS); sourceId kannab konkreetse
  // osaluse/kohtumise/kokkuvõtte id-d dedupe'iks ja saaja-verifitseerimiseks.
  SUPERVISION_INVITE: "SUPERVISION_INVITE",
  SUPERVISION_CONTRACT_PENDING: "SUPERVISION_CONTRACT_PENDING",
  SUPERVISION_MEETING_UPCOMING: "SUPERVISION_MEETING_UPCOMING",
  SUPERVISION_SUMMARY_PENDING: "SUPERVISION_SUMMARY_PENDING",
  SUPERVISION_CLOSED: "SUPERVISION_CLOSED"
});

const EVENT_SPECS = Object.freeze({
  PRE_INQUIRY_ARRIVED: Object.freeze({
    sourceType: "PRE_INQUIRY",
    targetKind: "PRE_INQUIRY",
    labelKey: "notifications.events.pre_inquiry_arrived",
    badgeKey: "pre_inquiries",
    actionKind: ActionKind.OPEN_PRE_INQUIRY_RECEIVED,
    ackMode: "target_open"
  }),
  PRE_INQUIRY_STATUS_CHANGED: Object.freeze({
    sourceType: "PRE_INQUIRY",
    targetKind: "PRE_INQUIRY",
    labelKey: "notifications.events.pre_inquiry_status_changed",
    badgeKey: "pre_inquiries",
    actionKind: ActionKind.OPEN_PRE_INQUIRY_SENT,
    ackMode: "read"
  }),
  PRE_INQUIRY_RECALLED: Object.freeze({
    sourceType: "PRE_INQUIRY",
    targetKind: "PRE_INQUIRY",
    labelKey: "notifications.events.pre_inquiry_recalled",
    badgeKey: "pre_inquiries",
    actionKind: ActionKind.OPEN_PRE_INQUIRY_RECEIVED,
    ackMode: "read"
  }),
  ORG_WORK_ASSIGNED: Object.freeze({
    sourceType: "ORG_INBOX_ITEM",
    targetKind: "ORG_INBOX_ITEM",
    labelKey: "notifications.events.org_work_assigned",
    badgeKey: "pre_inquiries",
    ackMode: "target_open"
  }),
  ORG_SUPPORT_SHARE_RECEIVED: Object.freeze({
    sourceType: "WELLBEING_SUPPORT_SHARE",
    targetKind: "WELLBEING_SUPPORT_SHARE",
    labelKey: "notifications.events.org_support_share_received",
    badgeKey: "wellbeing",
    ackMode: "target_open"
  }),
  ROOM_INVITE: Object.freeze({
    sourceType: "INVITE",
    targetKind: "ROOM",
    labelKey: "notifications.events.room_invite",
    badgeKey: "add_person",
    actionKind: ActionKind.OPEN_ROOM,
    ackMode: "source_resolved"
  }),
  ROOM_ACTIVITY: Object.freeze({
    sourceType: "ROOM",
    targetKind: "ROOM",
    labelKey: "notifications.events.room_activity",
    badgeKey: "add_person",
    actionKind: ActionKind.OPEN_ROOM,
    ackMode: "target_open"
  }),
  // T12 E7: mõlemad sihivad ruumi (targetKind ROOM → /vestlus?roomId=…), sest
  // kõne ja salvestis elavad ruumis; sourceId kannab kõne/taotluse id-d dedupe'i
  // ja saaja-verifitseerimise jaoks. Badge käib sama nav-pinna alla kui muud
  // ruumiteavitused, muidu tekiks lugemata-loendur kohta, kuhu link ei vii.
  CALL_STARTED: Object.freeze({
    sourceType: "CALL",
    targetKind: "ROOM",
    labelKey: "notifications.events.call_started",
    badgeKey: "add_person",
    actionKind: ActionKind.OPEN_ROOM,
    ackMode: "target_open"
  }),
  CALL_RECORDING_READY: Object.freeze({
    sourceType: "CALL_RECORDING",
    targetKind: "ROOM",
    labelKey: "notifications.events.call_recording_ready",
    badgeKey: "add_person",
    actionKind: ActionKind.OPEN_ROOM,
    ackMode: "read"
  }),
  // T20 COLLAB-P2: kinnitusring elab ruumis; sourceId = RoomSharedSummary.id
  // (dedupe + saaja-verifitseerimine), sihtlink viib ruumi.
  ROOM_SUMMARY_APPROVAL_REQUESTED: Object.freeze({
    sourceType: "ROOM_SUMMARY",
    targetKind: "ROOM",
    labelKey: "notifications.events.room_summary_approval_requested",
    badgeKey: "add_person",
    actionKind: ActionKind.OPEN_ROOM,
    ackMode: "read"
  }),
  ROOM_SUMMARY_APPROVAL_RESPONSE: Object.freeze({
    sourceType: "ROOM_SUMMARY",
    targetKind: "ROOM",
    labelKey: "notifications.events.room_summary_approval_response",
    badgeKey: "add_person",
    actionKind: ActionKind.OPEN_ROOM,
    ackMode: "read"
  }),
  // T20 P3: sourceId = roomId (ruum ise on üleminekusündmuse allikas).
  ROOM_OWNERSHIP_TRANSFERRED: Object.freeze({
    sourceType: "ROOM",
    targetKind: "ROOM",
    labelKey: "notifications.events.room_ownership_transferred",
    badgeKey: "add_person",
    actionKind: ActionKind.OPEN_ROOM,
    ackMode: "read"
  }),
  HELP_MATCH_CREATED: Object.freeze({
    sourceType: "HELP_MATCH",
    targetKind: "ROOM",
    labelKey: "notifications.events.help_match_created",
    badgeKey: "add_person",
    actionKind: ActionKind.OPEN_ROOM,
    ackMode: "read"
  }),
  HELP_MATCH_CONSENT_REQUEST: Object.freeze({
    sourceType: "HELP_MATCH",
    targetKind: "SERVICE_MAP",
    labelKey: "notifications.events.help_match_consent_request",
    badgeKey: "add_person"
  }),
  NEXT_CONTACT_DUE: Object.freeze({
    sourceType: "PRE_INQUIRY",
    targetKind: "PRE_INQUIRY",
    labelKey: "notifications.events.next_contact_due",
    badgeKey: "pre_inquiries",
    actionKind: ActionKind.OPEN_PRE_INQUIRY_RECEIVED,
    ackMode: "source_resolved"
  }),
  PRACTICE_REVIEW_ASSIGNED: Object.freeze({
    sourceType: "PRACTICE_ASSIGNMENT",
    targetKind: "PRACTICE",
    labelKey: "notifications.events.practice_review_assigned",
    badgeKey: "effective_practices",
    actionKind: ActionKind.OPEN_PRACTICE,
    ackMode: "source_resolved"
  }),
  PRACTICE_REVIEW_OVERDUE: Object.freeze({
    sourceType: "PRACTICE_ASSIGNMENT",
    targetKind: "PRACTICE",
    labelKey: "notifications.events.practice_review_overdue",
    badgeKey: "effective_practices",
    actionKind: ActionKind.OPEN_PRACTICE,
    ackMode: "source_resolved"
  }),
  SERVICE_AVAILABILITY_STALE: Object.freeze({
    sourceType: "SERVICE",
    targetKind: "SERVICE_PROFILE",
    labelKey: "notifications.events.service_availability_stale",
    badgeKey: "service_profile",
    actionKind: ActionKind.OPEN_SERVICE_PROFILE,
    ackMode: "source_resolved"
  }),
  // T16: teadlikult ilma actionKind'ita — registris puudub OPEN_DATA_EXPORT ja
  // selle lisamine oleks T16 lepingust väljas. targetHref langeb siis
  // pärandharusse (case "DATA_EXPORT"), mis on allpool alles hoitud.
  DATA_EXPORT_READY: Object.freeze({
    sourceType: "DATA_EXPORT",
    targetKind: "DATA_EXPORT",
    labelKey: "notifications.events.data_export_ready",
    badgeKey: "data_export"
  }),
  // Mentorlus (ESTA-MENTOR-V1 ptk 9): payload kannab AINULT koode/ID-sid.
  MENTORING_REQUEST_CREATED: Object.freeze({
    sourceType: "MENTORING_REQUEST",
    targetKind: "MENTORING",
    labelKey: "notifications.events.mentoring_request_created",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING,
    ackMode: "source_resolved"
  }),
  MENTORING_REQUEST_ACCEPTED: Object.freeze({
    sourceType: "MENTORING_REQUEST",
    targetKind: "MENTORING",
    labelKey: "notifications.events.mentoring_request_accepted",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING,
    ackMode: "read"
  }),
  MENTORING_REQUEST_DECLINED: Object.freeze({
    sourceType: "MENTORING_REQUEST",
    targetKind: "MENTORING",
    labelKey: "notifications.events.mentoring_request_declined",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING,
    ackMode: "read"
  }),
  MENTORING_REQUEST_EXPIRED: Object.freeze({
    sourceType: "MENTORING_REQUEST",
    targetKind: "MENTORING",
    labelKey: "notifications.events.mentoring_request_expired",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING,
    ackMode: "read"
  }),
  MENTORING_RELATION_ACTIVATED: Object.freeze({
    sourceType: "MENTORING_RELATION",
    targetKind: "MENTORING_RELATION",
    labelKey: "notifications.events.mentoring_relation_activated",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING_RELATION,
    ackMode: "read"
  }),
  MENTORING_AGREEMENT_UPDATED: Object.freeze({
    sourceType: "MENTORING_RELATION",
    targetKind: "MENTORING_RELATION",
    labelKey: "notifications.events.mentoring_agreement_updated",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING_RELATION,
    ackMode: "source_resolved"
  }),
  MENTORING_MEETING_UPCOMING: Object.freeze({
    sourceType: "MENTORING_MEETING",
    targetKind: "MENTORING_RELATION",
    labelKey: "notifications.events.mentoring_meeting_upcoming",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING_RELATION,
    ackMode: "source_resolved"
  }),
  MENTORING_MEETING_CHANGED: Object.freeze({
    sourceType: "MENTORING_MEETING",
    targetKind: "MENTORING_RELATION",
    labelKey: "notifications.events.mentoring_meeting_changed",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING_RELATION,
    ackMode: "read"
  }),
  MENTORING_MEETING_CANCELLED: Object.freeze({
    sourceType: "MENTORING_MEETING",
    targetKind: "MENTORING_RELATION",
    labelKey: "notifications.events.mentoring_meeting_cancelled",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING_RELATION,
    ackMode: "read"
  }),
  MENTORING_SUMMARY_PENDING: Object.freeze({
    sourceType: "MENTORING_SUMMARY",
    targetKind: "MENTORING_RELATION",
    labelKey: "notifications.events.mentoring_summary_pending",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING_RELATION,
    ackMode: "source_resolved"
  }),
  MENTORING_SUMMARY_CONFIRMED: Object.freeze({
    sourceType: "MENTORING_SUMMARY",
    targetKind: "MENTORING_RELATION",
    labelKey: "notifications.events.mentoring_summary_confirmed",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING_RELATION,
    ackMode: "read"
  }),
  MENTORING_RELATION_PAUSED: Object.freeze({
    sourceType: "MENTORING_RELATION",
    targetKind: "MENTORING_RELATION",
    labelKey: "notifications.events.mentoring_relation_paused",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING_RELATION,
    ackMode: "read"
  }),
  MENTORING_RELATION_RESUMED: Object.freeze({
    sourceType: "MENTORING_RELATION",
    targetKind: "MENTORING_RELATION",
    labelKey: "notifications.events.mentoring_relation_resumed",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING_RELATION,
    ackMode: "read"
  }),
  MENTORING_RELATION_CLOSED: Object.freeze({
    sourceType: "MENTORING_RELATION",
    targetKind: "MENTORING_RELATION",
    labelKey: "notifications.events.mentoring_relation_closed",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING_RELATION,
    ackMode: "read"
  }),
  MENTORING_INACTIVITY_CHECK: Object.freeze({
    sourceType: "MENTORING_RELATION",
    targetKind: "MENTORING_RELATION",
    labelKey: "notifications.events.mentoring_inactivity_check",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING_RELATION,
    ackMode: "source_resolved"
  }),
  MENTORING_PROFILE_APPROVED: Object.freeze({
    sourceType: "MENTOR_PROFILE",
    targetKind: "MENTOR_PROFILE",
    labelKey: "notifications.events.mentoring_profile_approved",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTOR_PROFILE,
    ackMode: "read"
  }),
  MENTORING_PROFILE_REJECTED: Object.freeze({
    sourceType: "MENTOR_PROFILE",
    targetKind: "MENTOR_PROFILE",
    labelKey: "notifications.events.mentoring_profile_rejected",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTOR_PROFILE,
    ackMode: "read"
  }),
  MENTORING_PROFILE_REVOKED: Object.freeze({
    sourceType: "MENTOR_PROFILE",
    targetKind: "MENTOR_PROFILE",
    labelKey: "notifications.events.mentoring_profile_revoked",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTOR_PROFILE,
    ackMode: "read"
  }),
  MENTORING_SHARE_RECALLED: Object.freeze({
    sourceType: "MENTORING_NOTE",
    targetKind: "MENTORING_RELATION",
    labelKey: "notifications.events.mentoring_share_recalled",
    badgeKey: "mentoring",
    actionKind: ActionKind.OPEN_MENTORING_RELATION,
    ackMode: "read"
  }),
  // FIELD-V1 (O-FD-3): dead-man check-in; payload kannab AINULT koode/ID-sid.
  FIELD_CHECKIN_DUE: Object.freeze({
    sourceType: "FIELD_VISIT",
    targetKind: "FIELD_VISIT",
    labelKey: "notifications.events.field_checkin_due",
    badgeKey: "field_visits",
    actionKind: ActionKind.OPEN_FIELD_VISIT,
    ackMode: "source_resolved"
  }),
  /* Tööheaolu kontrollpunkt (T14, TO-2). Adressaat on AINULT kirje omanik ise —
     see ei ole kellegi teise saadetud teavitus, vaid kasutaja enda kokkulepe
     iseendaga. Sisu ei kanta: teavitus ütleb „kontrollpunkt saabus" + viide,
     mitte mida kasutaja vastas. `ackMode: "source_resolved"` — märk kaob siis,
     kui kirjele on „kas pidas?" vastatud, mitte pelgalt lugemisest.
     E-KIRJA EI OLE: emitter saadab `emailPolicy: "NONE"` (TO-2), mis ei ole
     tehniline piirang vaid tooteotsus — ära „paranda" seda OPTIONAL-iks. */
  WELLBEING_CHECKPOINT_DUE: Object.freeze({
    sourceType: "WELLBEING_RECORD",
    targetKind: "WELLBEING_RECORD",
    labelKey: "notifications.events.wellbeing_checkpoint_due",
    badgeKey: "wellbeing",
    actionKind: ActionKind.OPEN_WELLBEING_RECORD,
    ackMode: "source_resolved"
  }),
  /* JTA-V1 (E7, L7): 30 päeva enne arhiveeritud juhtumi kustutamist.
     `ackMode: "read"` — see teavitus EI OOTA tegu ja ei tohi teha nägu, nagu
     ootaks: kustutus tuleb niikuinii ja märgi kadumine „kui juhtum on lahendatud"
     lubaks midagi, mida siin ei ole. E-KIRJA EI OLE (`emailPolicy: "NONE"`
     kutsujas): juhtumi olemasolu fakt ei tohi lahkuda platvormilt postkasti. */
  CASE_WORK_RETENTION_WARNING: Object.freeze({
    sourceType: "CASE_WORK",
    targetKind: "CASE_WORK",
    labelKey: "notifications.events.casework_retention_warning",
    badgeKey: "pre_inquiries",
    ackMode: "read"
  }),
  // Supervisioon V0 (T22): teadlikult ILMA actionKind'ita (registris pole
  // OPEN_SUPERVISION ja selle lisamine oleks V0-st väljas) — targetHref langeb
  // pärandharusse (case "SUPERVISION_PROCESS"). Payload kannab AINULT koode/ID-sid.
  SUPERVISION_INVITE: Object.freeze({
    sourceType: "SUPERVISION_PARTICIPATION",
    targetKind: "SUPERVISION_PROCESS",
    labelKey: "notifications.events.supervision_invite",
    badgeKey: "supervision",
    ackMode: "source_resolved"
  }),
  SUPERVISION_CONTRACT_PENDING: Object.freeze({
    sourceType: "SUPERVISION_PARTICIPATION",
    targetKind: "SUPERVISION_PROCESS",
    labelKey: "notifications.events.supervision_contract_pending",
    badgeKey: "supervision",
    ackMode: "source_resolved"
  }),
  SUPERVISION_MEETING_UPCOMING: Object.freeze({
    sourceType: "SUPERVISION_MEETING",
    targetKind: "SUPERVISION_PROCESS",
    labelKey: "notifications.events.supervision_meeting_upcoming",
    badgeKey: "supervision",
    ackMode: "source_resolved"
  }),
  SUPERVISION_SUMMARY_PENDING: Object.freeze({
    sourceType: "SUPERVISION_SUMMARY",
    targetKind: "SUPERVISION_PROCESS",
    labelKey: "notifications.events.supervision_summary_pending",
    badgeKey: "supervision",
    ackMode: "source_resolved"
  }),
  SUPERVISION_CLOSED: Object.freeze({
    sourceType: "SUPERVISION_PROCESS",
    targetKind: "SUPERVISION_PROCESS",
    labelKey: "notifications.events.supervision_closed",
    badgeKey: "supervision",
    ackMode: "read"
  })
});

const EMAIL_POLICIES = new Set(["NONE", "OPTIONAL", "TRANSACTIONAL"]);
const SOURCE_TYPES = new Set(Object.values(EVENT_SPECS).map((spec) => spec.sourceType));
const SAFE_ID = /^[A-Za-z0-9._:-]+$/u;

function notificationError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeId(value, field, { optional = false, maxLength = 240 } = {}) {
  const normalized = String(value || "").trim();
  if (!normalized && optional) return null;
  if (!normalized || normalized.length > maxLength || !SAFE_ID.test(normalized)) {
    throw notificationError(`api.notifications.invalid_${field}`, 400);
  }
  return normalized;
}

function targetHref(targetKind, targetId, actionKind = null) {
  if (actionKind) {
    const prefix = targetKind === "PRE_INQUIRY" ? "pre_inquiry"
      : targetKind === "ROOM" ? "room"
        : targetKind === "PRACTICE" ? "practice"
          : targetKind === "MENTORING_RELATION" ? "mentoring_relation"
            : targetKind === "FIELD_VISIT" ? "field_visit"
              : targetKind === "WELLBEING_RECORD" ? "record" : "";
    return buildActionHref(actionKind, prefix ? `${prefix}:${targetId}` : targetId);
  }
  const encoded = encodeURIComponent(targetId || "");
  switch (targetKind) {
    case "PRE_INQUIRY":
      return `/eelpoordumised?openInquiry=${encoded}`;
    case "ROOM":
      return `/vestlus?roomId=${encoded}`;
    case "PRACTICE":
      return `/parimad-praktikad?practice=${encoded}`;
    case "SERVICE_PROFILE":
      return `/teenuseprofiil?profileId=${encoded}`;
    case "SERVICE_MAP":
      return `/teenusekaart?match=${encoded}`;
    case "DATA_EXPORT":
      return `/profiil?dataExport=${encoded}`;
    case "MENTORING":
      return "/mentorlus";
    case "MENTORING_RELATION":
      return `/mentorlus/suhe/${encoded}`;
    case "MENTOR_PROFILE":
      return "/mentorlus/profiil";
    case "FIELD_VISIT":
      return `/valitoo/${encoded}`;
    case "WELLBEING_RECORD":
      return `/tooheaolu/minu-kirjed?record=${encoded}`;
    /* JTA-V1: juhtumil EI OLE oma teed. JUHTUM-V1 valis teadlikult ühe marsruudi
       ja detailvaade avaneb `/juhtumid` sees — `/juhtumid/<id>` oleks tuletatud
       aadress, mida ei ole olemas. */
    case "CASE_WORK":
      return `/juhtumid?juhtum=${encoded}`;
    case "SUPERVISION_PROCESS":
      return `/supervisioon/${encoded}`;
    /* T25 viil B: link EI kanna organisatsiooni ID-d. Teavitus ütleb ainult
       „sulle määrati töö" ja viitab kirjele; millisesse organisatsiooni see
       kuulub, selgub alles pärast õiguskontrolli `/org/vastuvott/[itemId]`
       suunajas. Nii ei lekita org-kuuluvust teavituse URL-i kaudu. */
    case "ORG_INBOX_ITEM":
      return `/org/vastuvott/${encoded}`;
    /* Toeavaldus avaneb TUGIVAATES, mitte tööheaolu vaates: saaja ei ole
       kirje omanik ja tal ei ole tööheaolu pinnale mingit asja. */
    case "WELLBEING_SUPPORT_SHARE":
      return `/org/tugi/${encoded}`;
    default:
      throw notificationError("api.notifications.invalid_target", 400);
  }
}

export function notificationSpec(type) {
  return EVENT_SPECS[String(type || "").trim()] || null;
}

/**
 * Supervisiooni protsessi liikmesus teavituse re-verifitseerimiseks (Q2.3):
 * SV = superviisor; PARTICIPANT = osalus mistahes olekus (staatus tagastatakse,
 * et haru saaks nõuda ACCEPTED-it). Mitteliige → null (teavitus filtreeritakse).
 */
async function supervisionProcessMembership(db, processId, userId) {
  const process = await db.supervisionProcess.findUnique({
    where: { id: processId },
    select: { id: true, supervisorId: true }
  });
  if (!process) return null;
  if (process.supervisorId === userId) return { role: "SV", status: null };
  const participation = await db.supervisionParticipation.findFirst({
    where: { processId, userId },
    select: { id: true, status: true }
  });
  if (!participation) return null;
  return { role: "PARTICIPANT", status: participation.status };
}

export async function assertNotificationRecipient(db, { type, userId, sourceId, targetId }) {
  let allowed = false;
  if (type === NOTIFICATION_EVENT_TYPES.PRE_INQUIRY_ARRIVED) {
    allowed = Boolean(await db.preInquiry.findFirst({
      where: { id: sourceId, recipientOwnerId: userId, recalledAt: null }, select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.PRE_INQUIRY_STATUS_CHANGED) {
    allowed = Boolean(await db.preInquiry.findFirst({
      where: { id: sourceId, authorId: userId }, select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.PRE_INQUIRY_RECALLED) {
    allowed = Boolean(await db.preInquiry.findFirst({
      where: { id: sourceId, recipientOwnerId: userId, recalledAt: { not: null } }, select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.ORG_WORK_ASSIGNED) {
    /* T25 viil B. Ainus lubatud adressaat on inimene, kellele see töö on
       PÄRISELT määratud — ja ainult seni, kuni määramine on elav ja tema
       liikmesus aktiivne. Kolm tingimust korraga:
         1. määramine viitab sellele postkastikirjele;
         2. määramine on PENDING või ACCEPTED (üleantu ja tagasilükatu ei loe);
         3. liikmesus on selle kasutaja oma JA aktiivne.
       Koordinaatorile ega juhile teavitust EI teki: nemad näevad tööd
       postkastis, mis on nende pind. Teavitus on isiklik ülesanne, mitte
       ülevaade. */
    allowed = Boolean(await db.organizationWorkAssignment.findFirst({
      where: {
        inboxItemId: sourceId,
        status: { in: ["PENDING", "ACCEPTED"] },
        assignee: { userId, status: "ACTIVE" }
      },
      select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.ORG_SUPPORT_SHARE_RECEIVED) {
    /* T25 viil C. Kõige kitsam adressaadikontroll terves registris ja see on
       tahtlik: toeavaldus on tööheaolu rada, kus eksimuse hind on kõrgeim.
       Lubatud AINULT see inimene, kellele avaldus on saadetud — ja ainult siis,
       kui avaldus ei ole tagasi võetud ja tema liikmesus on aktiivne.
       Juht, koordinaator ega organisatsiooni omanik EI SAA siia teavitust
       kunagi, ka mitte oma organisatsiooni avalduste kohta. */
    allowed = Boolean(await db.wellbeingSupportShare.findFirst({
      where: {
        id: sourceId,
        status: { not: "RECALLED" },
        recipient: { userId, status: "ACTIVE" }
      },
      select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.NEXT_CONTACT_DUE) {
    allowed = Boolean(await db.preInquiry.findFirst({
      where: { id: sourceId, recipientOwnerId: userId, recalledAt: null, nextContactOn: { not: null } },
      select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.WELLBEING_CHECKPOINT_DUE) {
    /* Ainus lubatud adressaat on kirje omanik ise ja ainult siis, kui
       kontrollpunkt on tõesti olemas. Tööheaolu kirje on platvormi kõige
       privaatsem pind — siin ei tohi teavitus kunagi kellelegi teisele minna. */
    allowed = Boolean(await db.wellbeingRecord.findFirst({
      where: { id: sourceId, ownerUserId: userId, checkpointDueOn: { not: null } },
      select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.ROOM_INVITE) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    const invite = user?.email ? await db.invite.findFirst({
      where: { id: sourceId, roomId: targetId, inviteeEmail: user.email, status: "SENT" }, select: { id: true }
    }) : null;
    allowed = Boolean(invite);
  } else if (type === NOTIFICATION_EVENT_TYPES.ROOM_ACTIVITY) {
    allowed = Boolean(await db.roomMember.findFirst({
      where: { roomId: sourceId, userId, leftAt: null }, select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.CALL_STARTED) {
    /* Kõnest tohib teada saada ainult ruumi praegune liige ja ainult siis, kui
       kõne tõesti kuulub sellesse ruumi. Kõne ACTIVE-olekut siin EI nõuta:
       lühike kõne ei tohi teavitust vaikselt ära kaotada ja lõppenud kõne fakt
       on liikmele niikuinii nähtav. */
    allowed = Boolean(await db.callSession.findFirst({
      where: { id: sourceId, roomId: targetId }, select: { id: true }
    })) && Boolean(await db.roomMember.findFirst({
      where: { roomId: targetId, userId, leftAt: null }, select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.CALL_RECORDING_READY) {
    /* SOL-CALL-07 — sama värav nagu FAILI OMANDIL. Siin seisis varem
       nõusolekukontroll ja kommentaar, mis väitis, et „nõusoleku andnul on
       artefakti ligipääs ka pärast ruumist lahkumist". See väide oli vale:
       salvestise `UserDocument` kuulub taotlejale ja kogu dokumendipind on
       `ownerId`-skoobiga, seega nõustunul ei olnud ega ole ligipääsu.
       Teavituse ainus lubatud saaja on salvestise kandja — taotleja ise.
       Praegust ruumiliikmesust EI nõuta: fail on tema oma ka siis, kui ta
       ruumist lahkus. */
    allowed = Boolean(await db.callRecordingRequest.findFirst({
      where: {
        id: sourceId,
        requestedByUserId: userId,
        callSession: { roomId: targetId }
      },
      select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.ROOM_SUMMARY_APPROVAL_REQUESTED) {
    /* T20 P2: ringi kutse tohib jõuda ainult ruumi praegusele liikmele, kes ei
       ole jagaja ise ja kes on professionaalirollis (O-CO-5 c: klient on
       adressaat, mitte ringi osaleja). Ring peab olema avatud. */
    const summary = await db.roomSharedSummary.findFirst({
      where: { id: sourceId, roomId: targetId, approvalRequestedAt: { not: null } },
      select: { sharedByUserId: true }
    });
    if (summary && summary.sharedByUserId !== userId) {
      const membership = await db.roomMember.findFirst({
        where: { roomId: targetId, userId, leftAt: null }, select: { id: true }
      });
      const recipient = membership
        ? await db.user.findUnique({ where: { id: userId }, select: { role: true } })
        : null;
      allowed = ["SOCIAL_WORKER", "SERVICE_PROVIDER", "ADMIN"].includes(
        String(recipient?.role || "").trim().toUpperCase()
      );
    }
  } else if (type === NOTIFICATION_EVENT_TYPES.ROOM_OWNERSHIP_TRANSFERRED) {
    /* T20 P3: üleminekust tohib teada saada ainult ruumi praegune liige. */
    allowed = Boolean(await db.roomMember.findFirst({
      where: { roomId: targetId, userId, leftAt: null }, select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.ROOM_SUMMARY_APPROVAL_RESPONSE) {
    /* Vastuse-teavitus läheb AINULT jagajale ja ainult siis, kui vähemalt üks
       vastus on päriselt olemas. */
    allowed = Boolean(await db.roomSharedSummary.findFirst({
      where: { id: sourceId, roomId: targetId, sharedByUserId: userId },
      select: { id: true }
    })) && Boolean(await db.roomSummaryApproval.findFirst({
      where: { roomSharedSummaryId: sourceId }, select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.CASE_WORK_RETENTION_WARNING) {
    /* JTA-V1 (E7, L2): AINUS lubatud adressaat on juhtumi omanik ise, ja ainult
       siis, kui juhtum on päriselt `ARCHIVED` — hoiatus kella kohta, mis ei käi,
       õpetaks kasutajat hoiatusi ignoreerima. Kolleeg, juht ega admin ei saa
       siia teavitust kunagi: juhtum on rangelt isiklik ja isegi tema OLEMASOLU
       ei ole kellegi teise asi. */
    allowed = Boolean(await db.caseWorkAssist.findFirst({
      where: { id: sourceId, ownerUserId: userId, retentionState: "ARCHIVED" },
      select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.HELP_MATCH_CREATED) {
    allowed = Boolean(await db.helpMatch.findFirst({
      where: { id: sourceId, roomId: targetId, OR: [{ requesterId: userId }, { offererId: userId }] },
      select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.HELP_MATCH_CONSENT_REQUEST) {
    allowed = Boolean(await db.helpMatch.findFirst({
      where: {
        id: sourceId,
        status: "PENDING",
        initiatedByUserId: { not: userId },
        OR: [{ requesterId: userId }, { offererId: userId }]
      },
      select: { id: true }
    }));
  } else if (
    type === NOTIFICATION_EVENT_TYPES.PRACTICE_REVIEW_ASSIGNED ||
    type === NOTIFICATION_EVENT_TYPES.PRACTICE_REVIEW_OVERDUE
  ) {
    allowed = Boolean(await db.effectivePracticeReviewAssignment.findFirst({
      where: { id: sourceId, practiceId: targetId, reviewerId: userId }, select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.SERVICE_AVAILABILITY_STALE) {
    allowed = Boolean(await db.serviceProviderService.findFirst({
      where: { id: sourceId, providerProfileId: targetId, providerProfile: { ownerId: userId } },
      select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.DATA_EXPORT_READY) {
    allowed = Boolean(await db.dataExportJob.findFirst({
      where: { id: sourceId, userId, status: "ready", expiresAt: { gt: new Date() } }, select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.MENTORING_REQUEST_CREATED) {
    // Re-verify: CANCELLED/EXPIRED/vastatud taotlus kaotab mentori rea.
    allowed = Boolean(await db.mentoringRequest.findFirst({
      where: { id: sourceId, mentorUserId: userId, status: "PENDING" }, select: { id: true }
    }));
  } else if (
    type === NOTIFICATION_EVENT_TYPES.MENTORING_REQUEST_ACCEPTED ||
    type === NOTIFICATION_EVENT_TYPES.MENTORING_REQUEST_DECLINED ||
    type === NOTIFICATION_EVENT_TYPES.MENTORING_REQUEST_EXPIRED
  ) {
    const expected = type === NOTIFICATION_EVENT_TYPES.MENTORING_REQUEST_ACCEPTED ? "ACCEPTED"
      : type === NOTIFICATION_EVENT_TYPES.MENTORING_REQUEST_DECLINED ? "DECLINED" : "EXPIRED";
    allowed = Boolean(await db.mentoringRequest.findFirst({
      where: { id: sourceId, menteeId: userId, status: expected }, select: { id: true }
    }));
  } else if (
    type === NOTIFICATION_EVENT_TYPES.MENTORING_RELATION_ACTIVATED ||
    type === NOTIFICATION_EVENT_TYPES.MENTORING_AGREEMENT_UPDATED ||
    type === NOTIFICATION_EVENT_TYPES.MENTORING_RELATION_PAUSED ||
    type === NOTIFICATION_EVENT_TYPES.MENTORING_RELATION_RESUMED ||
    type === NOTIFICATION_EVENT_TYPES.MENTORING_RELATION_CLOSED
  ) {
    allowed = Boolean(await db.mentoringRelation.findFirst({
      where: {
        id: sourceId,
        OR: [{ mentorUserId: userId }, { menteeUserId: userId }]
      },
      select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.MENTORING_INACTIVITY_CHECK) {
    allowed = Boolean(await db.mentoringRelation.findFirst({
      where: {
        id: sourceId,
        inactivityCheckAt: { not: null },
        status: { in: ["ACTIVE", "PAUSED"] },
        OR: [{ mentorUserId: userId }, { menteeUserId: userId }]
      },
      select: { id: true }
    }));
  } else if (
    type === NOTIFICATION_EVENT_TYPES.MENTORING_MEETING_UPCOMING ||
    type === NOTIFICATION_EVENT_TYPES.MENTORING_MEETING_CHANGED ||
    type === NOTIFICATION_EVENT_TYPES.MENTORING_MEETING_CANCELLED
  ) {
    allowed = Boolean(await db.mentoringMeeting.findFirst({
      where: {
        id: sourceId,
        relationId: targetId,
        ...(type === NOTIFICATION_EVENT_TYPES.MENTORING_MEETING_UPCOMING ? { status: "PLANNED" } : {}),
        relation: { OR: [{ mentorUserId: userId }, { menteeUserId: userId }] }
      },
      select: { id: true }
    }));
  } else if (
    type === NOTIFICATION_EVENT_TYPES.MENTORING_SUMMARY_PENDING ||
    type === NOTIFICATION_EVENT_TYPES.MENTORING_SUMMARY_CONFIRMED
  ) {
    const expected = type === NOTIFICATION_EVENT_TYPES.MENTORING_SUMMARY_PENDING
      ? "PENDING_CONFIRM"
      : "CONFIRMED";
    allowed = Boolean(await db.mentoringSummary.findFirst({
      where: {
        id: sourceId,
        relationId: targetId,
        status: expected,
        relation: { OR: [{ mentorUserId: userId }, { menteeUserId: userId }] }
      },
      select: { id: true }
    }));
  } else if (
    type === NOTIFICATION_EVENT_TYPES.MENTORING_PROFILE_APPROVED ||
    type === NOTIFICATION_EVENT_TYPES.MENTORING_PROFILE_REJECTED ||
    type === NOTIFICATION_EVENT_TYPES.MENTORING_PROFILE_REVOKED
  ) {
    allowed = Boolean(await db.mentorProfile.findFirst({
      where: { id: sourceId, userId }, select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.MENTORING_SHARE_RECALLED) {
    allowed = Boolean(await db.mentoringPrivateNote.findFirst({
      where: {
        id: sourceId,
        relationId: targetId,
        kind: "PREPARATION",
        recalledAt: { not: null }
      },
      select: { id: true }
    })) && Boolean(await db.mentoringRelation.findFirst({
      where: { id: targetId, mentorUserId: userId }, select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.FIELD_CHECKIN_DUE) {
    allowed = Boolean(await db.fieldVisit.findFirst({
      where: { id: sourceId, ownerUserId: userId, safetyArmedAt: { not: null } },
      select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.SUPERVISION_INVITE) {
    // Kutse kaob, kui osaleja on juba vastanud (INVITED-i pole enam).
    allowed = Boolean(await db.supervisionParticipation.findFirst({
      where: { id: sourceId, processId: targetId, userId, status: "INVITED" },
      select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.SUPERVISION_CONTRACT_PENDING) {
    allowed = Boolean(await db.supervisionParticipation.findFirst({
      where: { id: sourceId, processId: targetId, userId, status: "ACCEPTED" },
      select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.SUPERVISION_MEETING_UPCOMING) {
    const meeting = await db.supervisionMeeting.findFirst({
      where: { id: sourceId, processId: targetId }, select: { id: true }
    });
    const membership = meeting ? await supervisionProcessMembership(db, targetId, userId) : null;
    allowed = Boolean(membership && (membership.role === "SV" || membership.status === "ACCEPTED"));
  } else if (type === NOTIFICATION_EVENT_TYPES.SUPERVISION_SUMMARY_PENDING) {
    const summary = await db.supervisionSummary.findFirst({
      where: { id: sourceId, processId: targetId }, select: { id: true }
    });
    const membership = summary ? await supervisionProcessMembership(db, targetId, userId) : null;
    allowed = Boolean(membership && membership.status === "ACCEPTED");
  } else if (type === NOTIFICATION_EVENT_TYPES.SUPERVISION_CLOSED) {
    const membership = await supervisionProcessMembership(db, targetId, userId);
    allowed = Boolean(membership && (membership.role === "SV"
      || ["ACCEPTED", "LEFT"].includes(membership.status)));
  }
  if (!allowed) throw notificationError("api.common.not_found", 404);
}

export function serializeNotificationEvent(event, { domainEventType = null } = {}) {
  if (!event) return null;
  const spec = notificationSpec(event.type);
  if (!spec || event.targetKind !== spec.targetKind) return null;
  const domainSpec = domainEventType ? getEventSpec(domainEventType) : null;
  return {
    id: event.id,
    type: event.type,
    href: targetHref(event.targetKind, event.targetId, spec.actionKind),
    eventType: domainEventType || null,
    actionKind: domainSpec?.actionKind || spec.actionKind,
    ackMode: domainSpec?.ackMode || spec.ackMode,
    labelKey: domainSpec?.labelKey || spec.labelKey,
    badgeKey: spec.badgeKey,
    createdAt: event.createdAt,
    readAt: event.readAt || null,
    dismissedAt: event.dismissedAt || null,
    workspaceKind: event.workspaceKind || null,
    workspaceId: event.workspaceId || null
  };
}

function isUniqueConflict(error) {
  return error?.code === "P2002" || error?.name === "UniqueConstraintError";
}

/**
 * Teavituse kordumatuse võti.
 *
 * ÜKS KOHT, KAKS KASUTAJAT (SOL-CW-07). Kutsuja, kes tahab ENNE saatmist teada,
 * kas teade on juba olemas, peab küsima täpselt sama võtme järgi. Kui ta
 * ehitaks stringi ise, läheks kaks kuju esimese muudatusega lahku — ja tagajärg
 * oleks vaikne: dedupe töötaks edasi, aga eelfilter ei leiaks midagi.
 */
export function notificationDedupeKey({ type, sourceId, userId, dedupeSuffix = "v1" }) {
  return `${type}:${sourceId}:${userId}:${dedupeSuffix}`;
}

export async function createNotificationEvent(
  input = {},
  { db = prisma, now = new Date(), verifyRecipient = true } = {}
) {
  const type = String(input.type || "").trim();
  const spec = notificationSpec(type);
  if (!spec) throw notificationError("api.notifications.invalid_type", 400);

  const userId = normalizeId(input.userId, "user");
  const sourceType = String(input.sourceType || spec.sourceType).trim();
  if (sourceType !== spec.sourceType) {
    throw notificationError("api.notifications.invalid_source", 400);
  }
  const sourceId = normalizeId(input.sourceId, "source");
  const targetKind = String(input.targetKind || spec.targetKind).trim();
  if (targetKind !== spec.targetKind) {
    throw notificationError("api.notifications.invalid_target", 400);
  }
  const targetId = normalizeId(input.targetId, "target");
  targetHref(targetKind, targetId);
  if (verifyRecipient) {
    await assertNotificationRecipient(db, { type, userId, sourceId, targetId });
  }
  const dedupeSuffix = normalizeId(input.dedupeSuffix || "v1", "dedupe", { maxLength: 160 });
  const dedupeKey = notificationDedupeKey({ type, sourceId, userId, dedupeSuffix });
  if (dedupeKey.length > 500) throw notificationError("api.notifications.invalid_dedupe", 400);

  const emailPolicy = String(input.emailPolicy || "NONE").trim().toUpperCase();
  if (!EMAIL_POLICIES.has(emailPolicy)) {
    throw notificationError("api.notifications.invalid_email_policy", 400);
  }
  let emailRequested = emailPolicy === "TRANSACTIONAL";
  if (emailPolicy === "OPTIONAL") {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { notificationEmailEnabled: true }
    });
    if (!user) throw notificationError("api.common.not_found", 404);
    emailRequested = user.notificationEmailEnabled === true;
  }

  const data = {
    userId,
    type,
    sourceType,
    sourceId,
    dedupeKey,
    targetKind,
    targetId,
    eventId: normalizeId(input.eventId, "event", { optional: true }),
    workspaceKind: normalizeId(input.workspaceKind, "workspace", { optional: true }),
    workspaceId: normalizeId(input.workspaceId, "workspace", { optional: true }),
    expiresAt: input.expiresAt || null,
    emailPolicy,
    emailStatus: emailRequested ? "PENDING" : "NOT_REQUESTED",
    emailNextAttemptAt: emailRequested ? now : null,
    emailMessageId: emailRequested
      ? `notification.${crypto.createHash("sha256").update(dedupeKey).digest("hex").slice(0, 40)}@sotsiaal.ai`
      : null
  };

  try {
    const event = await db.notificationEvent.create({ data });
    return { created: true, event };
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const event = await db.notificationEvent.findUnique({ where: { dedupeKey } });
    if (!event) throw error;
    if (data.eventId && !event.eventId && db.notificationEvent.updateMany) {
      await db.notificationEvent.updateMany({
        where: { id: event.id, eventId: null },
        data: {
          eventId: data.eventId,
          workspaceKind: data.workspaceKind,
          workspaceId: data.workspaceId
        }
      });
      return { created: false, event: { ...event, eventId: data.eventId, workspaceKind: data.workspaceKind, workspaceId: data.workspaceId } };
    }
    return { created: false, event };
  }
}

export async function listNotificationEvents(
  userId,
  { db = prisma, limit = 30, unreadOnly = false, dismissed = "exclude", now = new Date() } = {}
) {
  const normalizedUserId = normalizeId(userId, "user");
  const take = Math.max(1, Math.min(Number(limit) || 30, 100));
  const rows = await db.notificationEvent.findMany({
    where: {
      userId: normalizedUserId,
      ...(unreadOnly ? { readAt: null } : {}),
      ...(dismissed === "only" ? { dismissedAt: { not: null } }
        : dismissed === "include" ? {}
          : { dismissedAt: null }),
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(take * 2, 200)
  });
  const domainTypes = new Map();
  const eventIds = [...new Set(rows.map((row) => row.eventId).filter(Boolean))];
  if (eventIds.length && db.domainEvent?.findMany) {
    const domainRows = await db.domainEvent.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, type: true }
    });
    for (const row of domainRows) domainTypes.set(row.id, row.type);
  }
  const visible = [];
  for (const row of rows) {
    try {
      await assertNotificationRecipient(db, {
        type: row.type,
        userId: normalizedUserId,
        sourceId: row.sourceId,
        targetId: row.targetId
      });
      const serialized = serializeNotificationEvent(row, { domainEventType: domainTypes.get(row.eventId) || null });
      if (serialized) visible.push(serialized);
      if (visible.length >= take) break;
    } catch (error) {
      if (error?.status !== 404) throw error;
    }
  }
  return visible;
}

export async function markNotificationRead(userId, eventId, { db = prisma, now = new Date() } = {}) {
  const normalizedUserId = normalizeId(userId, "user");
  const normalizedEventId = normalizeId(eventId, "event");
  const visible = await db.notificationEvent.findFirst({
    where: { id: normalizedEventId, userId: normalizedUserId },
    select: { id: true, type: true, sourceId: true, targetId: true }
  });
  if (!visible) throw notificationError("api.common.not_found", 404);
  if (visible.type) {
    await assertNotificationRecipient(db, {
      type: visible.type,
      userId: normalizedUserId,
      sourceId: visible.sourceId,
      targetId: visible.targetId
    });
  }
  await db.notificationEvent.updateMany({
    where: { id: normalizedEventId, userId: normalizedUserId, readAt: null },
    data: { readAt: now }
  });
  return { ok: true };
}

export async function dismissNotification(userId, eventId, { db = prisma, now = new Date() } = {}) {
  const normalizedUserId = normalizeId(userId, "user");
  const normalizedEventId = normalizeId(eventId, "event");
  const visible = await db.notificationEvent.findFirst({
    where: { id: normalizedEventId, userId: normalizedUserId },
    select: { id: true, type: true, sourceId: true, targetId: true }
  });
  if (!visible) throw notificationError("api.common.not_found", 404);
  await assertNotificationRecipient(db, {
    type: visible.type,
    userId: normalizedUserId,
    sourceId: visible.sourceId,
    targetId: visible.targetId
  });
  await db.notificationEvent.updateMany({
    where: { id: normalizedEventId, userId: normalizedUserId, dismissedAt: null },
    data: { dismissedAt: now, readAt: now }
  });
  return { ok: true };
}

export async function markNotificationSourceRead(
  userId,
  { sourceType, sourceId },
  { db = prisma, now = new Date() } = {}
) {
  const normalizedUserId = normalizeId(userId, "user");
  const normalizedSourceType = normalizeId(sourceType, "source");
  if (!SOURCE_TYPES.has(normalizedSourceType)) {
    throw notificationError("api.notifications.invalid_source", 400);
  }
  const normalizedSourceId = normalizeId(sourceId, "source");
  const result = await db.notificationEvent.updateMany({
    where: {
      userId: normalizedUserId,
      sourceType: normalizedSourceType,
      sourceId: normalizedSourceId,
      readAt: null
    },
    data: { readAt: now }
  });
  return { updated: result.count };
}

export async function getNotificationPreference(userId, { db = prisma } = {}) {
  const normalizedUserId = normalizeId(userId, "user");
  const user = await db.user.findUnique({
    where: { id: normalizedUserId },
    select: {
      notificationEmailEnabled: true,
      notificationPreferenceVersion: true
    }
  });
  if (!user) throw notificationError("api.common.not_found", 404);
  return {
    emailEnabled: user.notificationEmailEnabled,
    version: user.notificationPreferenceVersion
  };
}

export async function updateNotificationPreference(
  userId,
  { emailEnabled, expectedVersion },
  { db = prisma } = {}
) {
  const normalizedUserId = normalizeId(userId, "user");
  if (typeof emailEnabled !== "boolean" || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw notificationError("api.notifications.invalid_preference", 400);
  }
  const result = await db.user.updateMany({
    where: {
      id: normalizedUserId,
      notificationPreferenceVersion: expectedVersion
    },
    data: {
      notificationEmailEnabled: emailEnabled,
      notificationPreferenceVersion: { increment: 1 }
    }
  });
  if (result.count !== 1) throw notificationError("api.notifications.preference_conflict", 409);
  return getNotificationPreference(normalizedUserId, { db });
}

export function notificationBadges(events = []) {
  const counts = new Map();
  for (const event of events) {
    if (!event || event.readAt || !event.badgeKey) continue;
    counts.set(event.badgeKey, (counts.get(event.badgeKey) || 0) + 1);
  }
  return Object.fromEntries([...counts].map(([key, count]) => [key, {
    type: "number",
    value: count,
    label: String(count)
  }]));
}
