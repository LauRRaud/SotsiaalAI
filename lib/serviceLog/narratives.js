/**
 * TEENUSPÄEVIK-V1 E5 — kuunarratiiv.
 *
 * KAKS KIHTI ON LAHUS (leping ptk 3, „Andmeklassi tagajärjed"):
 *   - kirjemärge = LÜHIKE faktimärge, aruande tooraine;
 *   - kuunarratiiv = kliendi LUGU, eraldi objekt, eri tundlikkus.
 * Seepärast ei kopeerita märkmeid narratiivi automaatselt: koond annab
 * kirjutajale faktid ette (`buildNarrativeSeed`), teksti kirjutab inimene.
 *
 * KLIENDI NÄHTAVUS (`SERVICE_LOG_CLIENT_VIEW`) on ehitatud LÜLITINA ja
 * vaikimisi väljas. Leping nimetab siin ausa pinge: riskihinnanguid peab saama
 * kirjutada avameelselt. Otsus on omaniku oma ja tehakse enne avamist — kood
 * ei tee seda valikut vaikselt ette ära.
 */

import { prisma } from "@/lib/prisma";
import { assertServiceLogEnabled } from "./flags.js";
import { badRequest, notFound } from "./errors.js";
import { MAX_NOTE_LENGTH } from "./constants.js";
import { requireWritableProfile } from "./entries.js";
import { buildNarrativeSeed, isNarrativeProposal } from "./narrativeSeed.js";

/** Narratiiv on pikk tekst — piir on suurem kui kirjemärkmel, aga on olemas. */
const MAX_BODY_LENGTH = 20000;

function text(value, maxLength) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function parsePeriod(input) {
  const year = Number(input?.periodYear);
  const month = Number(input?.periodMonth);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw badRequest("service_log.errors.period_invalid");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw badRequest("service_log.errors.period_invalid");
  }
  return { year, month };
}

export function serializeNarrative(row) {
  if (!row) return null;
  return {
    id: row.id,
    referralId: row.referralId || null,
    clientUserId: row.clientUserId || null,
    clientDisplayName: row.clientDisplayName || null,
    periodYear: row.periodYear,
    periodMonth: row.periodMonth,
    bodyText: row.bodyText,
    proposal: row.proposal || null,
    proposalNote: row.proposalNote || null,
    /* `draftSource` ütleb AUSALT, kas tekst sündis mustandist. Tühi väli
       tähendab, et inimene kirjutas ta ise — ja seda ei tohi hiljem segi ajada. */
    draftSource: row.draftSource || null,
    createdAt: row.createdAt?.toISOString?.() || null,
    updatedAt: row.updatedAt?.toISOString?.() || null
  };
}

/**
 * Lähtekoond kirjutajale: perioodi faktid, tegevused, päritolumärgistatud
 * märkmed ja suunamise eesmärgid. EI kirjuta teksti.
 */
export async function getNarrativeSeed(
  userId,
  { referralId = null, clientUserId = null, clientDisplayName = null, periodYear, periodMonth } = {},
  { db = prisma, env = process.env } = {}
) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });
  const { year, month } = parsePeriod({ periodYear, periodMonth });

  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));

  let referral = null;
  if (referralId) {
    referral = await db.serviceReferral.findFirst({
      where: { id: referralId, providerProfileId: profile.id },
      select: { id: true, goalsText: true, clientUserId: true, clientDisplayName: true }
    });
    if (!referral) throw notFound("service_log.errors.referral_not_found");
  }

  const clientWhere = referralId
    ? { referralId }
    : clientUserId
      ? { clientUserId }
      : clientDisplayName
        ? { clientDisplayName }
        : null;
  if (!clientWhere) throw badRequest("service_log.errors.client_required");

  const entries = await db.serviceEntry.findMany({
    where: {
      providerProfileId: profile.id,
      date: { gte: from, lt: to },
      ...clientWhere
    },
    select: {
      date: true,
      unit: true,
      quantity: true,
      activities: true,
      note: true,
      noteProvenance: true,
      status: true
    },
    take: 2000
  });

  return buildNarrativeSeed(entries, { referral });
}

/**
 * Loob või uuendab kuunarratiivi.
 *
 * Upsert, mitte create+update: narratiiv on kuu kohta ÜKS ja kirjutaja naaseb
 * tema juurde mitu korda. Kaks rida sama kuu kohta tähendaks kahte lugu ja
 * lugejale küsimust, kumb kehtib — seda hoiavad ära ka DB unikaalindeksid.
 */
export async function upsertNarrative(userId, input = {}, { db = prisma, env = process.env } = {}) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });
  const { year, month } = parsePeriod(input);

  const bodyText = text(input.bodyText, MAX_BODY_LENGTH);
  if (!bodyText) throw badRequest("service_log.errors.narrative_required");

  const proposal = text(input.proposal, 32);
  if (proposal && !isNarrativeProposal(proposal)) {
    throw badRequest("service_log.errors.proposal_invalid");
  }

  const referralId = text(input.referralId, 64);
  let clientUserId = text(input.clientUserId, 64);
  let clientDisplayName = text(input.clientDisplayName, 200);

  if (referralId) {
    const referral = await db.serviceReferral.findFirst({
      where: { id: referralId, providerProfileId: profile.id },
      select: { id: true, clientUserId: true, clientDisplayName: true }
    });
    if (!referral) throw notFound("service_log.errors.referral_not_found");
    /* Klient tuleb SUUNAMISEST, mitte kutsuja sisendist: muidu saaks narratiivi
       siduda ühe suunamisega ja teise kliendi nimega, ja aruanne räägiks
       valest inimesest. */
    clientUserId = referral.clientUserId;
    clientDisplayName = referral.clientDisplayName;
  } else if (!clientUserId && !clientDisplayName) {
    throw badRequest("service_log.errors.client_required");
  }

  const existing = await db.serviceMonthlyNarrative.findFirst({
    where: {
      providerProfileId: profile.id,
      periodYear: year,
      periodMonth: month,
      ...(referralId
        ? { referralId }
        : clientUserId
          ? { referralId: null, clientUserId }
          : { referralId: null, clientDisplayName })
    },
    select: { id: true }
  });

  const data = {
    bodyText,
    proposal,
    proposalNote: text(input.proposalNote, MAX_NOTE_LENGTH),
    draftSource: text(input.draftSource, 64)
  };

  const row = existing
    ? await db.serviceMonthlyNarrative.update({ where: { id: existing.id }, data })
    : await db.serviceMonthlyNarrative.create({
        data: {
          providerProfileId: profile.id,
          referralId,
          clientUserId,
          clientDisplayName,
          periodYear: year,
          periodMonth: month,
          ...data
        }
      });

  return serializeNarrative(row);
}

export async function listNarratives(
  userId,
  { periodYear = null, periodMonth = null } = {},
  { db = prisma, env = process.env } = {}
) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const rows = await db.serviceMonthlyNarrative.findMany({
    where: {
      providerProfileId: profile.id,
      ...(periodYear ? { periodYear: Number(periodYear) } : {}),
      ...(periodMonth ? { periodMonth: Number(periodMonth) } : {})
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    take: 500
  });
  return rows.map(serializeNarrative);
}
