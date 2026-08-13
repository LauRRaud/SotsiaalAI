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
import { badRequest, conflict, notFound } from "./errors.js";
import { MAX_EXTERNAL_REF_LENGTH, MAX_NOTE_LENGTH } from "./constants.js";
import { requireWritableProfile } from "./entries.js";
import { buildNarrativeSeed, isNarrativeProposal } from "./narrativeSeed.js";
import { findAllById } from "./pagination.js";

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

function parseExpectedUpdatedAt(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function narrativeVersionConflict(row) {
  return conflict("service_log.errors.narrative_version_conflict", {
    narrative: serializeNarrative(row)
  });
}

export function serializeNarrative(row) {
  if (!row) return null;
  return {
    id: row.id,
    referralId: row.referralId || null,
    clientUserId: row.clientUserId || null,
    clientDisplayName: row.clientDisplayName || null,
    clientExternalRef: row.clientExternalRef || null,
    clientIdentityNeedsReview: Boolean(row.clientIdentityNeedsReview),
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
  {
    referralId = null,
    clientUserId = null,
    clientDisplayName = null,
    clientExternalRef = null,
    periodYear,
    periodMonth
  } = {},
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
      select: {
        id: true,
        goalsText: true,
        clientUserId: true,
        clientDisplayName: true,
        clientExternalRef: true
      }
    });
    if (!referral) throw notFound("service_log.errors.referral_not_found");
  }

  const clientWhere = referralId
    ? { referralId }
    : clientUserId
      ? { clientUserId }
      : clientDisplayName && clientExternalRef
        ? {
            clientDisplayName: text(clientDisplayName, 200),
            clientExternalRef: text(clientExternalRef, MAX_EXTERNAL_REF_LENGTH)
          }
        : null;
  if (!clientWhere) throw badRequest("service_log.errors.client_required");

  const entries = await findAllById(db.serviceEntry, {
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
    pageSize: 1000
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
  let clientExternalRef = text(input.clientExternalRef, MAX_EXTERNAL_REF_LENGTH);

  if (referralId) {
    const referral = await db.serviceReferral.findFirst({
      where: { id: referralId, providerProfileId: profile.id },
      select: { id: true, clientUserId: true, clientDisplayName: true, clientExternalRef: true }
    });
    if (!referral) throw notFound("service_log.errors.referral_not_found");
    /* Klient tuleb SUUNAMISEST, mitte kutsuja sisendist: muidu saaks narratiivi
       siduda ühe suunamisega ja teise kliendi nimega, ja aruanne räägiks
       valest inimesest. */
    clientUserId = referral.clientUserId;
    clientDisplayName = referral.clientDisplayName;
    clientExternalRef = referral.clientExternalRef;
  } else if (!clientUserId && !clientDisplayName) {
    throw badRequest("service_log.errors.client_required");
  } else if (!clientUserId && (!clientDisplayName || !clientExternalRef)) {
    throw badRequest("service_log.errors.external_client_ref_required");
  }

  if (clientUserId) clientExternalRef = null;

  const where = {
    providerProfileId: profile.id,
    periodYear: year,
    periodMonth: month,
    ...(referralId
      ? { referralId }
      : clientUserId
        ? { referralId: null, clientUserId }
        : { referralId: null, clientExternalRef })
  };

  const data = {
    bodyText,
    proposal,
    proposalNote: text(input.proposalNote, MAX_NOTE_LENGTH),
    draftSource: text(input.draftSource, 64)
  };

  /* VÕISTLUSAKEN SULETUD. Varem oli siin `findFirst → create/update`: kaks
     samaaegset salvestust (kaks vahelehte, topeltklõps) nägid mõlemad tühjust
     ja mõlemad kirjutasid. Osalised unikaalindeksid päästsid ANDMED, aga
     kasutaja sai `P2002` → 500.
     `createMany({ skipDuplicates: true })` = `INSERT … ON CONFLICT DO
     NOTHING`: kokkupõrge ei ole erind, `count` ütleb ausalt, kumb kirjutaja
     võitis, ja kaotaja läheb lihtsalt uuendama. Sama lahendus, mis T25
     postkasti kohaletoimetamisel — ja SAMAL põhjusel: pärast unikaalsusviga
     ei tohi katkises tehingus edasi pärida. */
  const { count } = await db.serviceMonthlyNarrative.createMany({
    data: [
      {
        providerProfileId: profile.id,
        referralId,
        clientUserId,
        clientDisplayName,
        clientExternalRef,
        clientIdentityNeedsReview: false,
        periodYear: year,
        periodMonth: month,
        ...data
      }
    ],
    skipDuplicates: true
  });

  if (count === 0) {
    /* Loomise kaotaja ja olemasoleva rea muutja EI OLE sama leping. Uue rea
       võistluse kaotaja saab värske projektsiooniga 409; olemasolevat rida
       saab muuta ainult GET-ist saadud `updatedAt` versiooniga. */
    const existing = await db.serviceMonthlyNarrative.findFirst({ where });
    if (!existing) throw conflict("service_log.errors.narrative_conflict");
    const expectedUpdatedAt = parseExpectedUpdatedAt(input.expectedUpdatedAt);
    if (!expectedUpdatedAt) throw narrativeVersionConflict(existing);

    const updated = await db.serviceMonthlyNarrative.updateMany({
      where: {
        id: existing.id,
        providerProfileId: profile.id,
        updatedAt: expectedUpdatedAt
      },
      data
    });
    if (updated.count !== 1) {
      const fresh = await db.serviceMonthlyNarrative.findFirst({ where });
      if (!fresh) throw conflict("service_log.errors.narrative_conflict");
      throw narrativeVersionConflict(fresh);
    }

    const row = await db.serviceMonthlyNarrative.findFirst({ where });
    if (!row) throw conflict("service_log.errors.narrative_conflict");
    return serializeNarrative(row);
  }

  const row = await db.serviceMonthlyNarrative.findFirst({ where });
  if (!row) throw conflict("service_log.errors.narrative_conflict");
  return serializeNarrative(row);
}

export async function listNarratives(
  userId,
  { periodYear = null, periodMonth = null } = {},
  { db = prisma, env = process.env } = {}
) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const rows = await findAllById(db.serviceMonthlyNarrative, {
    where: {
      providerProfileId: profile.id,
      ...(periodYear ? { periodYear: Number(periodYear) } : {}),
      ...(periodMonth ? { periodMonth: Number(periodMonth) } : {})
    },
    pageSize: 500
  });
  rows.sort(
    (a, b) =>
      b.periodYear - a.periodYear ||
      b.periodMonth - a.periodMonth ||
      String(a.id).localeCompare(String(b.id))
  );
  return rows.map(serializeNarrative);
}
