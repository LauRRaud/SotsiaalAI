/**
 * JUHTUM-V1 (CASEWORK-P7) — puuduva ja kontrollimist vajava info loend.
 *
 * Leping: docs/platvormi arendus/juhtum-v1-arendusleping.md (v6), etapp E4.
 *
 * See on `ideed.md` ptk 4.3 „puuduv ja kontrollimist vajav info" ja ptk 4.4
 * „puuduva info loend". Juhtumitöö assistent hakkab teda LUGEMA — mitte uuesti
 * looma. Sellepärast elab ta juhtumi küljes, mitte assistendi sees.
 *
 * IGA KIRJE KANNAB PÄRITOLU. Sõnastik on `lib/workspaces/provenance.js` (8
 * väärtust, CASEWORK-P0) ja teda EI DUBLEERITA siin — T21 õppetund oli, et teine
 * koopia tekib märkamatult ja siis on kaks tõde. Väärtus on andmebaasis tekst,
 * mitte enum, et sõnastiku kasv ei nõuaks migratsiooni.
 */

import prismaClient from "@/lib/prisma";
import { isProvenance } from "@/lib/workspaces/provenance";

import { RETENTION_STATE } from "./caseWorkAssist.js";
import { badRequest, conflict, featureDisabled, notFound } from "./errors.js";
import { isCaseWorkEnabled } from "./flags.js";

export const MISSING_INFO_STATUS = Object.freeze({
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
  NOT_APPLICABLE: "NOT_APPLICABLE"
});

export const MISSING_INFO_STATUSES = Object.freeze(Object.values(MISSING_INFO_STATUS));

const TEXT_MAX = 2000;
const LIST_LIMIT_DEFAULT = 50;
const LIST_LIMIT_MAX = 200;

const ITEM_SELECT = Object.freeze({
  id: true,
  caseWorkAssistId: true,
  text: true,
  provenance: true,
  status: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true
});

function requireEnabled() {
  if (!isCaseWorkEnabled()) throw featureDisabled();
}

function normalizeId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Tekst on PLAIN TEXT. Me ei puhasta HTML-i ega tõlgi märgistust — vaade
 * renderdab teda tekstina ja seda tõendab eraldi test. Puhastamine siin
 * tekitaks illusiooni, et väljund on ohutu ka siis, kui keegi ta kunagi
 * `dangerouslySetInnerHTML`-i paneb.
 */
function normalizeText(value) {
  const text = String(value ?? "").trim();
  if (!text) throw badRequest("casework.errors.missing_info_text_required");
  if (text.length > TEXT_MAX) throw badRequest("casework.errors.missing_info_text_too_long");
  return text;
}

async function requireActiveCase({ db, ownerUserId, caseWorkAssistId }) {
  const row = await db.caseWorkAssist.findFirst({
    where: { id: caseWorkAssistId, ownerUserId },
    select: { id: true, retentionState: true }
  });
  if (!row) throw notFound();
  /* L14: kirjutuskeeld laieneb LASTELE. `READ_ONLY` juhtum, mille puuduva info
     loendit saaks muuta, ei oleks kirjutuskaitstud. */
  if (row.retentionState !== RETENTION_STATE.ACTIVE) throw conflict("casework.errors.not_active");
  return row;
}

async function requireVisibleCase({ db, ownerUserId, caseWorkAssistId }) {
  const row = await db.caseWorkAssist.findFirst({
    where: { id: caseWorkAssistId, ownerUserId },
    select: { id: true }
  });
  if (!row) throw notFound();
  return row;
}

export async function addMissingInfo({
  ownerUserId,
  caseWorkAssistId,
  text,
  provenance,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  if (!owner || !caseId) throw notFound();

  const value = normalizeText(text);
  const origin = normalizeId(provenance);
  /* L5: tundmatu päritolu lükatakse TAGASI, mitte ei salvestata „nagu on".
     Vaba tekst päritolu kohal tähendaks, et märgistus ei ole enam kontrollitav. */
  if (!isProvenance(origin)) throw badRequest("casework.errors.provenance_unknown");

  await requireActiveCase({ db, ownerUserId: owner, caseWorkAssistId: caseId });

  return db.caseWorkMissingInfo.create({
    data: { caseWorkAssistId: caseId, text: value, provenance: origin },
    select: ITEM_SELECT
  });
}

/**
 * Staatuse muutmine.
 *
 * INVARIANT MÕLEMAS SUUNAS: `OPEN` → `resolvedAt` on `null`;
 * `RESOLVED`/`NOT_APPLICABLE` → `resolvedAt` määratakse **serveris**, mitte
 * kliendilt. Tagasi `OPEN` viimine NULLIB `resolvedAt`-i — muidu jääks kirje,
 * mis on korraga lahtine ja lahendatud, ja loendur ei teaks, kumba uskuda.
 */
export async function setMissingInfoStatus({
  ownerUserId,
  caseWorkAssistId,
  itemId,
  status,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const id = normalizeId(itemId);
  if (!owner || !caseId || !id) throw notFound();

  const target = normalizeId(status);
  if (!target || !MISSING_INFO_STATUSES.includes(target)) throw badRequest("casework.errors.missing_info_status_unknown");

  await requireActiveCase({ db, ownerUserId: owner, caseWorkAssistId: caseId });

  const result = await db.caseWorkMissingInfo.updateMany({
    where: { id, caseWorkAssistId: caseId },
    data: {
      status: target,
      resolvedAt: target === MISSING_INFO_STATUS.OPEN ? null : new Date()
    }
  });
  if (!result?.count) throw notFound();

  return db.caseWorkMissingInfo.findFirst({ where: { id, caseWorkAssistId: caseId }, select: ITEM_SELECT });
}

export async function removeMissingInfo({ ownerUserId, caseWorkAssistId, itemId, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const id = normalizeId(itemId);
  if (!owner || !caseId || !id) throw notFound();

  await requireActiveCase({ db, ownerUserId: owner, caseWorkAssistId: caseId });

  const result = await db.caseWorkMissingInfo.deleteMany({ where: { id, caseWorkAssistId: caseId } });
  if (!result?.count) throw notFound();
  return { ok: true };
}

/**
 * Loend, cursor-pagineeritud.
 *
 * SORTIMINE: lahtised enne lahendatuid, siis vanimad ees.
 *
 * NB `status` järgi sortimine tugineb PostgreSQL enum'i deklaratsiooni-
 * järjekorrale (`OPEN, RESOLVED, NOT_APPLICABLE` — vt migratsioon), mitte
 * tähestikule. See on tahtlik ja odav, aga tähendab, et enum'i väärtuste
 * ÜMBERJÄRJESTAMINE migratsioonis muudaks vaikselt loendi järjekorda. Uued
 * väärtused tuleb lisada LÕPPU.
 */
export async function listMissingInfo({
  ownerUserId,
  caseWorkAssistId,
  cursor = null,
  limit = LIST_LIMIT_DEFAULT,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  if (!owner || !caseId) throw notFound();

  await requireVisibleCase({ db, ownerUserId: owner, caseWorkAssistId: caseId });

  const take = Math.min(Math.max(Number(limit) || LIST_LIMIT_DEFAULT, 1), LIST_LIMIT_MAX);
  const cursorId = normalizeId(cursor);

  const rows = await db.caseWorkMissingInfo.findMany({
    where: { caseWorkAssistId: caseId },
    select: ITEM_SELECT,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: take + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {})
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

/**
 * JTA-V1 (E1) — LAHTISED punktid ÜLE KÕIGI juhtumite, ühe päringuga.
 *
 * MIKS OMA LUGEJA: `listMissingInfo()` ja `countOpenMissingInfo()` võtavad
 * mõlemad `caseWorkAssistId`. Laual on vaja risti üle juhtumite, ja olemasolevate
 * lugejatega tähendaks see N+1 päringut — üks juhtumiloendi jaoks, siis üks
 * juhtumi kohta.
 *
 * SKOOP TULEB SEOSEST, MITTE ID-DE LOENDIST. `where` käib läbi
 * `caseWorkAssist.ownerUserId` — nii ei saa kutsuja anda võõraid ID-sid ega
 * jätta filtrit rakendamata. Kutsuja poolt antud ID-loend oleks täpselt see
 * muster, mis 04.08 IDOR-i tekitas.
 *
 * AINULT `ACTIVE` juhtumid: kirjutuskaitstud juhtumi lahtine punkt ei ole
 * ülesanne, sest teda ei saa enam lahendada.
 */
export async function listOpenMissingInfoForOwner({
  ownerUserId,
  limit = LIST_LIMIT_DEFAULT,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  if (!owner) return { items: [] };

  const take = Math.min(Math.max(Number(limit) || LIST_LIMIT_DEFAULT, 1), LIST_LIMIT_MAX);

  const rows = await db.caseWorkMissingInfo.findMany({
    where: {
      status: MISSING_INFO_STATUS.OPEN,
      caseWorkAssist: { ownerUserId: owner, retentionState: RETENTION_STATE.ACTIVE }
    },
    select: ITEM_SELECT,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take
  });

  return { items: rows };
}

/**
 * JTA-V1 (E1) — lahtiste punktide arv juhtumi kaupa, ÜKS `groupBy`.
 *
 * Tagastab `Map<caseWorkAssistId, arv>`. Juhtum ilma lahtise punktita PUUDUB
 * kaardilt — kutsuja loeb `map.get(id) || 0`. Nii ei pea päring tagastama rida
 * iga juhtumi kohta ja tühja tulemuse tähendus on üheselt „ei ole".
 *
 * Skoop on sama mis ülal: seose kaudu, mitte ID-de loendist.
 */
export async function countOpenMissingInfoByCase({ ownerUserId, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  if (!owner) return new Map();

  const rows = await db.caseWorkMissingInfo.groupBy({
    by: ["caseWorkAssistId"],
    where: {
      status: MISSING_INFO_STATUS.OPEN,
      caseWorkAssist: { ownerUserId: owner, retentionState: RETENTION_STATE.ACTIVE }
    },
    _count: { _all: true }
  });

  const counts = new Map();
  for (const row of rows || []) {
    counts.set(row.caseWorkAssistId, row?._count?._all ?? 0);
  }
  return counts;
}

/** Avatud punktide arv — juhtumiloendi ja detailvaate näidik. */
export async function countOpenMissingInfo({ ownerUserId, caseWorkAssistId, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  if (!owner || !caseId) return 0;

  await requireVisibleCase({ db, ownerUserId: owner, caseWorkAssistId: caseId });
  return db.caseWorkMissingInfo.count({
    where: { caseWorkAssistId: caseId, status: MISSING_INFO_STATUS.OPEN }
  });
}
