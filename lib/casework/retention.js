/**
 * JTA-V1 (E7) — säilituse JÕUSTAMINE.
 *
 * Leping: docs/platvormi arendus/jta-v1-arendusleping.md, etapp E7 (L7, L17, L23)
 * ja O-JTA-5 (omaniku otsus 08.08: rada C).
 *
 * OTSUS ILMA MEHHANISMITA EI OLE SÄILITUSREEGEL. v1-s ütles L7, mis peab
 * juhtuma, aga keegi ei käivitanud seda — ja E7 tõendas ainult kuupäeva
 * arvutamist. Siin on kolm tööd, mis päriselt kustutavad, ja üks tegu, mille
 * teeb inimene.
 *
 * VIIS REEGLIT, MIS ON SIIN ARHITEKTUUR:
 *
 *   L17 — KELL KÄIB PÄRIS ÜLEMINEKUST, mitte `updatedAt`-ist ega viimasest
 *        auditireast. `archivedAt` loetakse `CaseWorkRetentionAudit` reast, kus
 *        `fromState = READ_ONLY` ja `toState = ARCHIVED`. Elutsükkel on
 *        ühesuunaline ja terminaalne, seega selliseid ridu on TÄPSELT ÜKS,
 *        igavesti. v2 luges „viimast `ARCHIVED` rida" ja hoiatus ise kirjutas uue
 *        — kell nullis end iga hoiatusega ja 12 kuust sai 23.
 *
 *   L17 — SÄILITUSTÖÖ EI KIRJUTA AUDITISSE ÜHTEGI RIDA. Audit kannab ainult
 *        päris üleminekuid; rida, mis väidab siiret, mida ei toimunud, rikub
 *        auditi tähenduse ka siis, kui `reason` seda seletab. Hoiatuse
 *        kordumatus tuleb TEAVITUSKIHIST (`dedupeKey`), mitte auditist.
 *
 *   L7 — HOIATUS ON `deletionAt − 30 PÄEVA`, mitte „11 kuud". Kalendrikuu on
 *        28–31 päeva; lubadus anti PÄEVADES, seega lubadus ja teostus
 *        arvutatakse SAMAST valemist.
 *
 *   VAIKSET KUSTUTUST EI OLE. Juhtum on töötaja enda töökorraldus, mitte kliendi
 *        kirje — automaatne kustutus, millest ta ette teada ei saa, hävitab tema
 *        töö ja erinevalt STAR-ist ei ole tal seda kuskilt taastada.
 *
 *   ÜHE REA TÕRGE EI PEATA PARTIID. Logitakse ja liigutakse edasi; järgmine
 *        käivitus proovib uuesti, sest tingimus on ikka täidetud. Eraldi
 *        retry-taristut ei ehitata.
 *
 * SEE MOODUL EI OLE TURVAPIIR ja tal ei ole omanikku: teda kutsub cron, mitte
 * kasutaja. Ainus kasutaja-operatsioon siin on `archiveWorkingMaterial()` ja
 * tema piiri jõustab `withActiveCaseLock()`.
 */

import prismaClient from "@/lib/prisma";

import { createNotificationEvent, NOTIFICATION_EVENT_TYPES } from "@/lib/notifications";
import { STAR2_TRANSFER_STATE } from "@/lib/workspaces/provenance";

import { RETENTION_STATE, withActiveCaseLock } from "./caseWorkAssist.js";
import { conflict, notFound } from "./errors.js";
import { isCaseWorkEnabled } from "./flags.js";

/** Skeemi `CaseWorkPurgeReason`. Kaks rada, kaks tähendust — vt migratsioon. */
export const PURGE_REASON = Object.freeze({
  RETENTION_AFTER_TRANSFER: "RETENTION_AFTER_TRANSFER",
  WORKER_ARCHIVED_WORKING_MATERIAL: "WORKER_ARCHIVED_WORKING_MATERIAL"
});

/** L7. Konstandid, mitte maagilised numbrid — test kirjutab nad üle. */
export const RETENTION_MONTHS = 12;
export const WARNING_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BATCH = 50;
const MAX_BATCH = 500;

/**
 * Kuude liitmine UTC KALENDRIS.
 *
 * MIKS MITTE `+365 päeva` ega Eesti kalendripäev: säilitustähtaeg käib
 * AJAHETKEST (`transferredAt`, auditirea `createdAt`), mitte kalendripäevast,
 * ja „12 kuud" on kalendrimõiste. UTC teeb tulemuse ajavööndist sõltumatuks —
 * sama sisend annab sama tähtaja nii arendusmasinal (Europe/Tallinn) kui
 * serveris (UTC). See ei ole sama küsimus mis A4 „Eesti kalendripäev"; seal on
 * mõõdetav asi PÄEV, siin HETK.
 *
 * KUU LÕPP KLAMBERDATAKSE: 29.02 + 12 kuud oleks 29.02 aastal, mida ei ole, ja
 * JS veereks temast 01.03-ks. Kuu viimasele päevale klambeerimine hoiab tähtaja
 * lubatud kuu SEES.
 */
export function addMonths(date, months) {
  const source = new Date(date);
  const day = source.getUTCDate();
  const target = new Date(source.getTime());
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

/** Mustandi sisu kustub 12 kuud pärast ÜLEKANNET (L7). */
export function purgeDueAt(transferredAt) {
  return transferredAt ? addMonths(transferredAt, RETENTION_MONTHS) : null;
}

/** Juhtum kustub 12 kuud pärast PÄRIS `ARCHIVED` üleminekut (L7 + L17). */
export function deletionDueAt(archivedAt) {
  return archivedAt ? addMonths(archivedAt, RETENTION_MONTHS) : null;
}

/**
 * Hoiatus 30 päeva ENNE kustutust — ühest ja samast valemist, millest tuleb
 * lubadus. „11 kuud" annaks 28–31-päevase akna sõltuvalt arhiveerimise kuust.
 */
export function warningDueAt(archivedAt) {
  const deletion = deletionDueAt(archivedAt);
  return deletion ? new Date(deletion.getTime() - WARNING_DAYS * DAY_MS) : null;
}

function normalizeBatch(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || !Number.isInteger(size) || size < 1) return DEFAULT_BATCH;
  return Math.min(size, MAX_BATCH);
}

function normalizeId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/* ────────────────────────────────────────────────────────────────────────────
   TÖÖ 1 — MUSTANDI SISU PURGE (L7)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Ülekantud mustandid, mille 12 kuud on täis ja mille sisu on veel alles.
 *
 * `contentPurgedAt IS NULL` ON PÄRINGUTINGIMUS, mitte kontroll pärast lugemist —
 * just see teeb töö kordumatuks: teine käivitus ei leia rida.
 */
export async function findDraftsDueForPurge({ now = new Date(), limit = DEFAULT_BATCH, db = prismaClient } = {}) {
  const cutoff = addMonths(now, -RETENTION_MONTHS);
  return db.caseWorkDraft.findMany({
    where: {
      transferState: STAR2_TRANSFER_STATE.ULE_KANTUD,
      transferredAt: { not: null, lte: cutoff },
      contentPurgedAt: null
    },
    select: { id: true, caseWorkAssistId: true, transferredAt: true },
    orderBy: [{ transferredAt: "asc" }, { id: "asc" }],
    take: normalizeBatch(limit)
  });
}

/**
 * Sisu kustub, rida ja tõend jäävad (L7).
 *
 * ÜKS TEHING: väljade kustutus ja `contentPurgedAt` käivad koos. Poolik purge
 * jätaks mustandi, mille sisu on kadunud, aga mis järgmisel käivitusel uuesti
 * ette tuleb — ja iga käivitus väidaks, et ta tegi töö ära.
 *
 * `CaseWorkTransferEvent` JÄÄB ALLES ja tema `draftId` ei ripu: kustuvad ainult
 * `CaseWorkDraftField` read, mitte mustandi oma.
 */
export async function purgeDraftContent({ draftId, now = new Date(), db = prismaClient } = {}) {
  const id = normalizeId(draftId);
  if (!id) throw notFound();

  return db.$transaction(async (tx) => {
    /* TINGIMUSLIK UPDATE, mitte loe-kontrolli-kirjuta: kaks samaaegset
       käivitust (cron + käsitsi) ei tohi mõlemad väita, et nemad kustutasid. */
    const claimed = await tx.caseWorkDraft.updateMany({
      where: { id, contentPurgedAt: null, transferState: STAR2_TRANSFER_STATE.ULE_KANTUD },
      data: { contentPurgedAt: now, contentPurgeReason: PURGE_REASON.RETENTION_AFTER_TRANSFER }
    });
    if (!claimed?.count) return { purged: false, fields: 0 };

    const removed = await tx.caseWorkDraftField.deleteMany({ where: { draftId: id } });
    return { purged: true, fields: removed?.count || 0 };
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   TÖÖ 2 JA 3 — JUHTUMI HOIATUS JA KUSTUTUS (L7, L17)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * `archivedAt` PÄRIS ÜLEMINEKUST (L17).
 *
 * Päring käib AUDITI, mitte juhtumi pealt, ja see on kandev: juhtumi enda
 * `updatedAt` liigub iga lapse kirjutusega ja `retentionState` ei kanna aega.
 * Selliseid auditiridu on täpselt üks, sest `ARCHIVED` on terminaalne.
 */
async function findArchivedTransitions({ db, cutoffFrom, cutoffUntil, limit }) {
  const rows = await db.caseWorkRetentionAudit.findMany({
    where: {
      fromState: RETENTION_STATE.READ_ONLY,
      toState: RETENTION_STATE.ARCHIVED,
      ...(cutoffFrom || cutoffUntil
        ? { createdAt: { ...(cutoffFrom ? { gt: cutoffFrom } : {}), ...(cutoffUntil ? { lte: cutoffUntil } : {}) } }
        : {})
    },
    select: { caseWorkAssistId: true, ownerUserId: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }],
    take: normalizeBatch(limit)
  });

  /* Juhtum peab OLEMAS ja endiselt `ARCHIVED` olema: auditirida elab kustutuse
     hetkeni ja tema olemasolu üksi ei tähenda, et juhtum veel eksisteerib. */
  const alive = [];
  for (const row of rows) {
    const target = await db.caseWorkAssist.findFirst({
      where: { id: row.caseWorkAssistId, retentionState: RETENTION_STATE.ARCHIVED },
      select: { id: true, ownerUserId: true }
    });
    if (target) alive.push({ ...row, ownerUserId: target.ownerUserId || row.ownerUserId });
  }
  return alive;
}

/**
 * Juhtumid, mille kustutuseni on 30 päeva või vähem — AGA mis ei ole veel
 * kustutamise piiri ületanud. Üle piiri läinu saab sama käivituse jooksul
 * kustutuse ja hoiatus tema kohta oleks teade, mitte hoiatus.
 */
export async function findCasesDueForWarning({ now = new Date(), limit = DEFAULT_BATCH, db = prismaClient } = {}) {
  const deletionCutoff = addMonths(now, -RETENTION_MONTHS);
  const warningCutoff = new Date(deletionCutoff.getTime() + WARNING_DAYS * DAY_MS);
  return findArchivedTransitions({ db, cutoffFrom: deletionCutoff, cutoffUntil: warningCutoff, limit });
}

export async function findCasesDueForDeletion({ now = new Date(), limit = DEFAULT_BATCH, db = prismaClient } = {}) {
  return findArchivedTransitions({ db, cutoffUntil: addMonths(now, -RETENTION_MONTHS), limit });
}

/**
 * Hoiatus läheb ÜKS KORD ja seda jõustab teavituskihi `dedupeKey` (L17), mitte
 * säilitustöö oma jälg. Kokkupõrkel tagastab teavituskiht `{ created: false }`
 * ega kirjuta kuhugi midagi — ja mis kõige tähtsam, hoiatus EI PUUDUTA kella.
 */
export async function sendRetentionWarning({ caseWorkAssistId, ownerUserId, now = new Date(), db = prismaClient } = {}) {
  const caseId = normalizeId(caseWorkAssistId);
  const owner = normalizeId(ownerUserId);
  if (!caseId || !owner) throw notFound();

  const result = await createNotificationEvent(
    {
      userId: owner,
      type: NOTIFICATION_EVENT_TYPES.CASE_WORK_RETENTION_WARNING,
      sourceId: caseId,
      targetId: caseId,
      dedupeSuffix: "v1",
      emailPolicy: "NONE"
    },
    { db, now }
  );
  return { warned: Boolean(result?.created) };
}

/**
 * Juhtumi kustutus. KASKAAD viib kõik lapsed (L15) — ettevalmistused, märkmed,
 * mustandid, väljad, ülekandesündmused ja auditid.
 *
 * TINGIMUS ON `ARCHIVED`: juhtum, mille keegi vahepeal tagasi tõi, ei tohi
 * kustuda. `ARCHIVED` on küll terminaalne, aga tingimus maksab ühe `WHERE`
 * ja kaitseb tuleviku eest, kus keegi selle reegli lõdvendab.
 */
export async function deleteArchivedCase({ caseWorkAssistId, db = prismaClient } = {}) {
  const caseId = normalizeId(caseWorkAssistId);
  if (!caseId) throw notFound();

  const result = await db.caseWorkAssist.deleteMany({
    where: { id: caseId, retentionState: RETENTION_STATE.ARCHIVED }
  });
  return { deleted: Boolean(result?.count) };
}

/* ────────────────────────────────────────────────────────────────────────────
   O-JTA-5 RADA C — TÖÖTAJA TEGU
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * „Arhiveeri töömaterjal" — omaniku otsus 08.08 (rada C).
 *
 * MIS PROBLEEMI TA LAHENDAB. L7 annab kella ainult ÜLEKANTUD mustandile;
 * `MUSTAND` ja `EI_KANTA` ei saa oma kella ja kustuvad alles koos juhtumiga.
 * Juhtum, mis on aastaid `ACTIVE` — ja pikk aeglane juhtumitöö ongi valdkonna
 * norm —, hoiab seetõttu aastaid vana ettevalmistavat teksti, milles on kliendi
 * sisu. See ei ole varju-register, ta on lihtsalt unustatud.
 *
 * MIKS INIMESE TEGU, MITTE TEINE KELL (rada B). Puutumatuse kell vajaks „viimati
 * avatud" jälge, mida täna ei ole — ja LUGEMISE LOGIMINE ON ISE UUS TÖÖTLUS,
 * mida see leping mujal väldib. Rada C ei kustuta midagi kellegi selja taga;
 * sama põhimõte, mis kannab L7 lauset „vaikset kustutust ei ole".
 *
 * ULATUS ON MUSTANDID, MITTE KOGU JUHTUM, ja see on lepingu sõnastus tähttäheline
 * („purgeb kandmata mustandite sisu"). Kohtumise ettevalmistus jääb PUUTUMATA —
 * tal on oma kustutusrada (E3) ja tema kaasa võtmine oleks ulatuse laiendus,
 * mida omanik ei tellinud. Vt O-JTA-6 lepingus.
 *
 * `ULE_KANTUD` MUSTANDIT SEE TEGU EI PUUDUTA: tema sisu on automaatse kella all
 * ja tema enneaegne kustutamine viiks tõendi ära enne, kui STAR-i kanne on
 * kinnitatud.
 */
export async function archiveWorkingMaterial({
  ownerUserId,
  caseWorkAssistId,
  now = new Date(),
  db = prismaClient
} = {}) {
  if (!isCaseWorkEnabled()) throw notFound();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  if (!owner || !caseId) throw notFound();

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    const drafts = await tx.caseWorkDraft.findMany({
      where: {
        caseWorkAssistId: caseId,
        contentPurgedAt: null,
        transferState: { not: STAR2_TRANSFER_STATE.ULE_KANTUD }
      },
      select: { id: true }
    });

    if (!drafts.length) throw conflict("casework.errors.working_material_empty");

    let fields = 0;
    for (const draft of drafts) {
      const removed = await tx.caseWorkDraftField.deleteMany({ where: { draftId: draft.id } });
      fields += removed?.count || 0;
      await tx.caseWorkDraft.updateMany({
        where: { id: draft.id, contentPurgedAt: null },
        data: { contentPurgedAt: now, contentPurgeReason: PURGE_REASON.WORKER_ARCHIVED_WORKING_MATERIAL }
      });
    }

    return { drafts: drafts.length, fields };
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   PARTII — KOLM TÖÖD, ÜKS KÄIVITUS
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Säilituspartii.
 *
 * VÄRAV VÄLJAS → 0 TÖÖD. Skript austab sama lippu mis kõik muu (L11): väljas
 * funktsioon ei kustuta kellegi andmeid „taustal juba igaks juhuks".
 *
 * ÜHE REA TÕRGE EI PEATA PARTIID. Logi kannab ainult konstante — juhtumi id ja
 * erindi klassi —, mitte veateadet: Prisma paneb ebaõnnestunud päringu
 * argumendid teatesse ja sinna mahub kirje sisu.
 */
export async function runRetention({
  now = new Date(),
  batch = DEFAULT_BATCH,
  dryRun = false,
  db = prismaClient,
  logger = console
} = {}) {
  const counters = {
    disabled: false,
    dryRun: Boolean(dryRun),
    draftsPurged: 0,
    draftFieldsDeleted: 0,
    warningsSent: 0,
    casesDeleted: 0,
    failed: 0
  };

  if (!isCaseWorkEnabled()) return { ...counters, disabled: true };

  const size = normalizeBatch(batch);

  for (const draft of await findDraftsDueForPurge({ now, limit: size, db })) {
    try {
      if (dryRun) {
        counters.draftsPurged += 1;
        continue;
      }
      const result = await purgeDraftContent({ draftId: draft.id, now, db });
      if (result.purged) {
        counters.draftsPurged += 1;
        counters.draftFieldsDeleted += result.fields;
      }
    } catch (error) {
      counters.failed += 1;
      logger.error?.("[casework/retention] purge failed", { draftId: draft.id, error: error?.name || "Error" });
    }
  }

  for (const row of await findCasesDueForWarning({ now, limit: size, db })) {
    try {
      if (dryRun) {
        counters.warningsSent += 1;
        continue;
      }
      const result = await sendRetentionWarning({
        caseWorkAssistId: row.caseWorkAssistId,
        ownerUserId: row.ownerUserId,
        now,
        db
      });
      if (result.warned) counters.warningsSent += 1;
    } catch (error) {
      counters.failed += 1;
      logger.error?.("[casework/retention] warning failed", {
        caseId: row.caseWorkAssistId,
        error: error?.name || "Error"
      });
    }
  }

  for (const row of await findCasesDueForDeletion({ now, limit: size, db })) {
    try {
      if (dryRun) {
        counters.casesDeleted += 1;
        continue;
      }
      const result = await deleteArchivedCase({ caseWorkAssistId: row.caseWorkAssistId, db });
      if (result.deleted) counters.casesDeleted += 1;
    } catch (error) {
      counters.failed += 1;
      logger.error?.("[casework/retention] delete failed", {
        caseId: row.caseWorkAssistId,
        error: error?.name || "Error"
      });
    }
  }

  return counters;
}

/* ────────────────────────────────────────────────────────────────────────────
   LOENDUS PINNALE (L7)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Juhtumi säilituskell PINNA jaoks: kaks kuupäeva ja päevade arv.
 *
 * LOENDUS ON NÄHTAV KOGU 12 KUU JOOKSUL (L7) — mitte alles hoiatuse hetkel.
 * Sama valem kui jõustamisel; teine arvutus pinnal tähendaks, et ekraanil seisab
 * üks number ja kustutus juhtub teisel ajal.
 */
export async function getCaseRetentionClock({
  ownerUserId,
  caseWorkAssistId,
  now = new Date(),
  db = prismaClient
} = {}) {
  if (!isCaseWorkEnabled()) throw notFound();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  if (!owner || !caseId) throw notFound();

  const row = await db.caseWorkAssist.findFirst({
    where: { id: caseId, ownerUserId: owner },
    select: { id: true, retentionState: true }
  });
  if (!row) throw notFound();

  if (row.retentionState !== RETENTION_STATE.ARCHIVED) {
    return { archivedAt: null, warningAt: null, deletionAt: null, daysLeft: null };
  }

  const audit = await db.caseWorkRetentionAudit.findFirst({
    where: {
      caseWorkAssistId: caseId,
      fromState: RETENTION_STATE.READ_ONLY,
      toState: RETENTION_STATE.ARCHIVED
    },
    select: { createdAt: true },
    orderBy: [{ createdAt: "asc" }]
  });

  /* ARHIVEERITUD JUHTUM ILMA AUDITIREATA on andmeviga, mitte „kell puudub" —
     aga pind ei tohi selle peale plahvatada. Tühjad väljad ütlevad ausalt, et
     kella ei ole; kustutamata jäämist see ei varja, sest jõustaja loeb SAMA
     rida ja teda ei ole. */
  if (!audit) return { archivedAt: null, warningAt: null, deletionAt: null, daysLeft: null };

  const deletionAt = deletionDueAt(audit.createdAt);
  return {
    archivedAt: audit.createdAt,
    warningAt: warningDueAt(audit.createdAt),
    deletionAt,
    daysLeft: Math.max(0, Math.ceil((deletionAt.getTime() - new Date(now).getTime()) / DAY_MS))
  };
}
