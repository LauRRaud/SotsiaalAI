/**
 * KODUTEENUS K5-r — teade otsustajale (kava II.6.13, ehituse esimene samm).
 *
 * Koduteenuse mahu otsustab omavalitsuse sotsiaaltöötaja; osutab hoolekandekeskus. Kui
 * hooldajad näevad, et inimene enam toime ei tule või et teenus ei sobi, liigub see info
 * praegu telefoniga ja jälge ei jää. Siin koostab hooldusjuht kliendi kohta teate: põhjus,
 * kaks lauset ja kuni viis päeviku kirjet. Teenus paneb sellest kokku teksti, mille saab
 * kopeerida e-kirja või STAR-i (ametlik menetlus on seal), ja jätab meelde, mis saadeti.
 * Otsustaja vastuse märgib hooldusjuht käsitsi: hindab uuesti kuupäevaks, maht jääb
 * (põhjusega), suunab teisele teenusele või muu.
 *
 * Teadet ei saada platvorm ise ja väljapoole ei teki linki kliendi andmetele: selle sammu
 * jaoks on vaja otsustaja kontot või andmekaitse otsust. Saadetud tekst hoitakse täpselt
 * sellisena, nagu see koostati, et hiljem oleks näha, mida otsustajale öeldi.
 *
 * Koostab, vastab ja võtab tagasi kliendi hooldusjuht; meeskond teateid ei näe. Ridu ei
 * kustutata: ekslik teade võetakse tagasi põhjusega.
 */

import prisma from "@/lib/prisma";

import { serverT } from "../i18n/serverMessages.js";
import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, notFound } from "../org/errors.js";

import { assertHomeCareContext, membershipDisplayName, organizationTimeZone, requireClientCoordinator } from "./access.js";
import { figureLines, loadClientFiguresWithin } from "./clientFigures.js";
import {
  CARE_NOTICE_ANSWERS,
  CARE_NOTICE_CHANNELS,
  CARE_NOTICE_REASONS,
  CareClientStatus,
  CareNoticeAnswer,
  CareVolumePeriod,
  HOME_CARE_LIMITS
} from "./constants.js";
import { daysBetween, loadCurrentDecisionWithin, todayText } from "./decisions.js";
import { asObject, normalizeEnum, normalizeId, normalizeIsoDay, normalizeLine } from "./validation.js";

const NOTICE_SELECT = {
  id: true,
  clientId: true,
  reason: true,
  text: true,
  recipient: true,
  channel: true,
  sentOn: true,
  entryIds: true,
  sentText: true,
  createdByName: true,
  createdAt: true,
  answer: true,
  answeredOn: true,
  reassessBy: true,
  answerNote: true,
  answeredByName: true,
  answeredAt: true,
  withdrawnAt: true,
  withdrawReason: true
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function dayOf(value) {
  const parts = normalizeIsoDay(value);
  return parts ? `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` : null;
}

/** Päev kujul PP.KK.AAAA teate teksti jaoks. */
function dayLabel(day) {
  const [year, month, date] = String(day || "").split("-");
  return year && month && date ? `${date}.${month}.${year}` : "";
}

/** Teate sisend: põhjus, tekst ja kanal on kohustuslikud; päev vaikimisi täna ega saa olla tulevikus. Puhas funktsioon. */
export function normalizeNotice(rawInput, today) {
  const input = asObject(rawInput);
  const reason = normalizeEnum(input.reason, CARE_NOTICE_REASONS, "home_care.errors.notice_reason_required");
  const text = normalizeLine(input.text, HOME_CARE_LIMITS.NOTICE_TEXT_MAX, { required: true, errorKey: "home_care.errors.notice_text_required" });
  const channel = normalizeEnum(input.channel, CARE_NOTICE_CHANNELS, "home_care.errors.notice_channel_required");
  const sentOn = dayOf(input.sentOn) || today;
  if (sentOn > today) throw badRequest("home_care.errors.notice_day_future");
  const rawIds = input.entryIds === undefined || input.entryIds === null ? [] : input.entryIds;
  if (!Array.isArray(rawIds)) throw badRequest("home_care.errors.notice_entries_invalid");
  const entryIds = [...new Set(rawIds.map((value) => normalizeId(value, "home_care.errors.notice_entries_invalid")))];
  if (entryIds.length > HOME_CARE_LIMITS.NOTICE_ENTRIES_MAX) {
    throw badRequest("home_care.errors.notice_entries_too_many", { limit: HOME_CARE_LIMITS.NOTICE_ENTRIES_MAX });
  }
  return {
    reason,
    text,
    recipient: normalizeLine(input.recipient, HOME_CARE_LIMITS.NOTICE_RECIPIENT_MAX) || null,
    channel,
    sentOn,
    entryIds,
    /* Viimaste kuude arvud teate teksti (K5-s); ainult selge „jah" korral. */
    withFigures: input.withFigures === true
  };
}

/**
 * Vastuse sisend. „Hindab uuesti" nõuab kuupäeva; „maht jääb" ja „muu" nõuavad selgitust
 * (kava: maht jääb, põhjus). Vastuse päev ei saa olla enne teate saatmist ega tulevikus.
 * Puhas funktsioon.
 */
export function normalizeNoticeAnswer(rawInput, { today, sentOn }) {
  const input = asObject(rawInput);
  const answer = normalizeEnum(input.answer, CARE_NOTICE_ANSWERS, "home_care.errors.notice_answer_required");
  const answeredOn = dayOf(input.answeredOn) || today;
  if (answeredOn > today || answeredOn < sentOn) throw badRequest("home_care.errors.notice_answer_day");
  const answerNote = normalizeLine(input.answerNote, HOME_CARE_LIMITS.NOTICE_ANSWER_NOTE_MAX) || null;
  let reassessBy = null;
  if (answer === CareNoticeAnswer.REASSESS) {
    reassessBy = dayOf(input.reassessBy);
    if (!reassessBy || reassessBy < sentOn) throw badRequest("home_care.errors.notice_reassess_day_required");
  } else if ((answer === CareNoticeAnswer.VOLUME_STAYS || answer === CareNoticeAnswer.OTHER) && !answerNote) {
    throw badRequest("home_care.errors.notice_answer_note_required");
  }
  return { answer, answeredOn, reassessBy, answerNote };
}

/**
 * Teate seis: ootab vastust (mitu päeva), vastatud või tagasi võetud. Lubatud uue hindamise
 * päev on „möödas" alles päev pärast seda. Puhas funktsioon.
 */
export function noticeState(row, today) {
  if (row.withdrawnAt) return { state: "WITHDRAWN", waitingDays: null, reassessOverdue: false };
  if (!row.answer) return { state: "WAITING", waitingDays: Math.max(0, daysBetween(row.sentOn, today)), reassessOverdue: false };
  return { state: "ANSWERED", waitingDays: null, reassessOverdue: row.answer === CareNoticeAnswer.REASSESS && Boolean(row.reassessBy) && row.reassessBy < today };
}

function clip(text, max) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Teate tekst asutuse keeles: kopeeritav e-kirja või STAR-i. Puhas funktsioon; kõik, mis
 * tekstis on, tuleb sisse (asutus, klient, otsus, arvud, kirjed).
 */
export function composeNoticeText(locale, { organizationName, clientName, authorName, notice, decision = null, figures = null, entries = [] }) {
  const say = (key, values) => serverT(locale, `home_care.notice.doc.${key}`, values);
  const lines = [say("title", { organization: organizationName || "" }), say("date", { date: dayLabel(notice.sentOn) })];
  if (notice.recipient) lines.push(say("recipient", { name: notice.recipient }));
  lines.push(say("client", { name: clientName || "" }));
  if (decision) {
    const hours = decision.volumeMinutes ? String(Math.round((decision.volumeMinutes / 60) * 100) / 100).replace(".", ",") : "";
    const volume = hours ? say(decision.volumePeriod === CareVolumePeriod.WEEK ? "volume_week" : "volume_month", { hours }) : "";
    const parts = [decision.documentNumber ? say("decision_number", { number: decision.documentNumber }) : "", decision.issuerName || "", volume].filter(Boolean);
    if (parts.length) lines.push(say("decision", { text: parts.join(", ") }));
  }
  lines.push(say("reason", { reason: serverT(locale, `home_care.notice.reasons.${notice.reason}`) }));
  lines.push("", notice.text);
  if (figures) lines.push("", ...figureLines(locale, figures));
  if (entries.length) {
    lines.push("", say("entries"));
    for (const entry of entries) {
      lines.push(`- ${dayLabel(entry.day)}${entry.authorName ? `, ${entry.authorName}` : ""}: ${clip(entry.text, HOME_CARE_LIMITS.NOTICE_ENTRY_TEXT_MAX)}`);
    }
  }
  lines.push("", say("author", { name: authorName || "" }), say("footer"));
  return lines.join("\n");
}

function serializeNotice(row, today) {
  return {
    id: row.id,
    reason: row.reason,
    text: row.text,
    recipient: row.recipient || null,
    channel: row.channel,
    sentOn: row.sentOn,
    entryCount: (row.entryIds || []).length,
    sentText: row.sentText,
    createdByName: row.createdByName || null,
    answer: row.answer || null,
    answeredOn: row.answeredOn || null,
    reassessBy: row.reassessBy || null,
    answerNote: row.answerNote || null,
    answeredByName: row.answeredByName || null,
    withdrawReason: row.withdrawReason || null,
    ...noticeState(row, today)
  };
}

/** Kliendi teated otsustajale, uuemad ees. Kutsuja on juba kontrollinud, et vaataja on hooldusjuht. */
export async function loadDecisionNoticesWithin(tx, clientId, today) {
  const rows = await tx.careDecisionNotice.findMany({
    where: { clientId },
    orderBy: [{ sentOn: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: HOME_CARE_LIMITS.NOTICES_SHOWN,
    select: NOTICE_SELECT
  });
  return rows.map((row) => serializeNotice(row, today));
}

async function writeNoticeAudit(tx, context, clientId, noticeId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_DECISION_NOTICE_CHANGED,
    resourceType: OrgAuditResource.CARE_DECISION_NOTICE,
    resourceId: noticeId,
    meta: { organizationId: context.organization.id, clientId, change }
  });
}

/**
 * Koostab teate ja jätab meelde, mis saadeti. Lisatud kirjed peavad olema selle kliendi
 * tühistamata kirjed; tekstis on need toimumise järjekorras.
 */
export async function createDecisionNotice(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const timeZone = organizationTimeZone(context);
  const today = todayText(now, timeZone);
  const data = normalizeNotice(input, today);
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    const access = await requireClientCoordinator(tx, context, id, { lock: true, now });
    const entryRows = data.entryIds.length
      ? await tx.careClientEntry.findMany({
          where: { id: { in: data.entryIds }, clientId: id, organizationId, retractedAt: null },
          select: { id: true, text: true, occurredAt: true, authorName: true },
          orderBy: [{ occurredAt: "asc" }, { id: "asc" }]
        })
      : [];
    if (entryRows.length !== data.entryIds.length) throw badRequest("home_care.errors.notice_entries_invalid");
    const authorName = await membershipDisplayName(tx, context);
    const sentText = composeNoticeText(context.organization.defaultLocale || "et", {
      organizationName: context.organization.displayName || "",
      clientName: access.client.displayName,
      authorName,
      notice: data,
      decision: await loadCurrentDecisionWithin(tx, id, today),
      figures: data.withFigures ? await loadClientFiguresWithin(tx, { organizationId, client: access.client, now, timeZone }) : null,
      entries: entryRows.map((row) => ({ day: todayText(row.occurredAt, timeZone), authorName: row.authorName || "", text: row.text }))
    });
    const row = await tx.careDecisionNotice.create({
      data: {
        organizationId,
        clientId: id,
        reason: data.reason,
        text: data.text,
        recipient: data.recipient,
        channel: data.channel,
        sentOn: data.sentOn,
        entryIds: entryRows.map((entry) => entry.id),
        sentText,
        createdByMembershipId: context.membership?.id || null,
        createdByName: authorName,
        createdAt: now
      },
      select: { id: true }
    });
    await writeNoticeAudit(tx, context, id, row.id, "sent");
    return { noticeId: row.id, decisionNotices: await loadDecisionNoticesWithin(tx, id, today) };
  });
}

/** Märgib otsustaja vastuse. Vastus pannakse üks kord; tagasi võetud teatele vastust ei märgita. */
export async function answerDecisionNotice(context, clientId, noticeId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const rowId = normalizeId(noticeId, "home_care.errors.notice_not_found");
  const today = todayText(now, organizationTimeZone(context));

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const notice = await tx.careDecisionNotice.findFirst({
      where: { id: rowId, clientId: id, organizationId: context.organization.id },
      select: { id: true, sentOn: true, answer: true, withdrawnAt: true }
    });
    if (!notice) throw notFound("home_care.errors.notice_not_found");
    if (notice.answer || notice.withdrawnAt) throw conflict("home_care.errors.notice_closed");
    const data = normalizeNoticeAnswer(input, { today, sentOn: notice.sentOn });
    const changed = await tx.careDecisionNotice.updateMany({
      where: { id: rowId, answer: null, withdrawnAt: null },
      data: { ...data, answeredAt: now, answeredByMembershipId: context.membership?.id || null, answeredByName: await membershipDisplayName(tx, context) }
    });
    if (changed.count !== 1) throw conflict("home_care.errors.notice_closed");
    await writeNoticeAudit(tx, context, id, rowId, "answered");
    return { decisionNotices: await loadDecisionNoticesWithin(tx, id, today) };
  });
}

/** Võtab eksliku teate tagasi, põhjusega. Vastatud teadet tagasi ei võeta. */
export async function withdrawDecisionNotice(context, clientId, noticeId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const rowId = normalizeId(noticeId, "home_care.errors.notice_not_found");
  const today = todayText(now, organizationTimeZone(context));
  const reason = normalizeLine(asObject(input).reason, HOME_CARE_LIMITS.NOTICE_WITHDRAW_REASON_MAX, {
    required: true,
    errorKey: "home_care.errors.notice_withdraw_reason"
  });

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const notice = await tx.careDecisionNotice.findFirst({
      where: { id: rowId, clientId: id, organizationId: context.organization.id },
      select: { id: true, answer: true, withdrawnAt: true }
    });
    if (!notice) throw notFound("home_care.errors.notice_not_found");
    if (notice.answer || notice.withdrawnAt) throw conflict("home_care.errors.notice_closed");
    const changed = await tx.careDecisionNotice.updateMany({
      where: { id: rowId, answer: null, withdrawnAt: null },
      data: { withdrawnAt: now, withdrawnByMembershipId: context.membership?.id || null, withdrawReason: reason }
    });
    if (changed.count !== 1) throw conflict("home_care.errors.notice_closed");
    await writeNoticeAudit(tx, context, id, rowId, "withdrawn");
    return { decisionNotices: await loadDecisionNoticesWithin(tx, id, today) };
  });
}

/**
 * Tähtaegade vaatele, teenusel olevate klientide kohta vaataja skoobis:
 *   - teated, millele otsustaja ei ole vastanud (kõige kauem oodanu ees);
 *   - lubatud uus hindamine, mille päev on möödas ja mille järel ei ole uut otsust kirja pandud.
 */
export async function loadDecisionNoticesDue(db, organizationId, clientScope, { today }) {
  const client = { status: { in: [CareClientStatus.ACTIVE, CareClientStatus.AWAY] }, ...clientScope };
  const clientSelect = { select: { id: true, displayName: true, status: true } };
  const waitingRows = await db.careDecisionNotice.findMany({
    where: { organizationId, answer: null, withdrawnAt: null, client },
    select: { id: true, reason: true, sentOn: true, client: clientSelect },
    orderBy: [{ sentOn: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.DEADLINE_CLIENTS_MAX
  });
  const promisedRows = await db.careDecisionNotice.findMany({
    where: { organizationId, answer: CareNoticeAnswer.REASSESS, withdrawnAt: null, reassessBy: { lt: today }, client },
    select: { id: true, clientId: true, reassessBy: true, answeredOn: true, client: clientSelect },
    orderBy: [{ reassessBy: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.DEADLINE_CLIENTS_MAX
  });
  /* Otsus, mis on tehtud (või hakkab kehtima) vastuse päeval või hiljem, tähendab, et hindamine on
     tehtud: sellist lubadust enam ei näidata. Loetakse otsuse enda päeva, mitte sisestamise aega:
     tagantjärele sisse kantud vana otsus lubadust ei täida. */
  const decisions = promisedRows.length
    ? await db.careDecision.findMany({
        where: { organizationId, clientId: { in: [...new Set(promisedRows.map((row) => row.clientId))] }, retractedAt: null },
        select: { clientId: true, decidedOn: true, validFrom: true }
      })
    : [];
  const latestDecision = new Map();
  for (const row of decisions) {
    const day = row.decidedOn || row.validFrom;
    if (!latestDecision.has(row.clientId) || latestDecision.get(row.clientId) < day) latestDecision.set(row.clientId, day);
  }
  return {
    noticesWaiting: waitingRows.map((row) => ({ key: row.id, client: row.client, reason: row.reason, sentOn: row.sentOn, days: Math.max(0, daysBetween(row.sentOn, today)) })),
    reassessOverdue: promisedRows
      .filter((row) => !(latestDecision.get(row.clientId) >= row.answeredOn))
      .map((row) => ({ key: row.id, client: row.client, reassessBy: row.reassessBy, days: daysBetween(row.reassessBy, today) }))
  };
}
