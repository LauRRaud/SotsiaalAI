/**
 * JTA-V1 (E5) — STAR2 mustandi ahel. CASEWORK-P2 tuum.
 *
 * Leping: docs/platvormi arendus/jta-v1-arendusleping.md (v6), etapp E5.
 * Kirjeldus: `ideed.md` ptk 4.5 (kaheksa elementi) + ptk 2.2 (kuus seisu).
 *
 * OLEKUMASINAT SIIN EI PROJEKTEERITA. Kuus seisu, lubatud üleminekud ja
 * `canTransitionStar2()` on `lib/workspaces/provenance.js`-is olemas olnud ja
 * seni kasutamata — E5 annab neile salvestuse. Teine koopia sõnastikust
 * tähendaks kahte tõde ja esimene lahkuminek oleks vaikne.
 *
 * KOLM REEGLIT, MIS ON SIIN ARHITEKTUUR:
 *
 *   L6 — ÜLEMINEKUT JÕUSTAB TINGIMUSLIK UPDATE, MITTE `CHECK`. Andmebaas ei
 *        oska kontrollida, kust kuhu mindi; ta oskab kontrollida ainult
 *        väärtust. Jõustaja on `WHERE … transferState = expectedFrom` — kaks
 *        samaaegset üleminekut ei saa mõlemad võita, teine saab 409.
 *
 *   L19 — `ULE_KANTUD`-ini VIIB TÄPSELT ÜKS TEE. `transitionDraft()` on avalik
 *        operatsioon KÕIGI MUUDE siirete jaoks ja `to = ULE_KANTUD` saab temalt
 *        **400**. Ainus tee sinna on E6 `markTransferred()`, mis loob samas
 *        tehingus ka auditirea. Ilma selleta jõuaks mustand `ULE_KANTUD`-i
 *        ilma ühegi tõendita, et keegi ta kuhugi kandis — ja L7 säilituskell
 *        hakkaks käima tõendita ülekande peal.
 *
 *   L4 — PÄRITOLU ON REA OMA ja `setField()` ei puutu teda olemasoleval real:
 *        saadetud `provenance` EIRATAKSE. Sama reegel mis E3-l ja E4-l.
 *
 * TERMINAALNE MUSTAND ON KIRJUTUSKAITSTUD. `ULE_KANTUD` ja `EI_KANTA` on ptk 2.2
 * järgi lõpp-punktid: `setField`/`removeField` keelduvad **409**-ga. See ei ole
 * sama asi mis juhtumi kirjutuskaitse (L14) — see on mustandi enda elutsükkel.
 */

import prismaClient from "@/lib/prisma";
import { isProvenance, isStar2Terminal, STAR2_TRANSFER_STATE } from "@/lib/workspaces/provenance";

import { withActiveCaseLock } from "./caseWorkAssist.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { isCaseWorkEnabled } from "./flags.js";
import { transitionDraftStateTx } from "./draftTransition.js";
import { normalizeLimit } from "./paging.js";

/** `ideed.md` ptk 4.5 kaheksa elementi. Sama hulk mis `CaseWorkDraftType` skeemis. */
export const DRAFT_TYPE = Object.freeze({
  POORDUMISE_KOKKUVOTE: "POORDUMISE_KOKKUVOTE",
  ABIVAJADUSE_HINDAMINE: "ABIVAJADUSE_HINDAMINE",
  ELUVALDKONNA_KIRJELDUS: "ELUVALDKONNA_KIRJELDUS",
  EESMARGI_SONASTUS: "EESMARGI_SONASTUS",
  TEGEVUS: "TEGEVUS",
  VASTUTAJA_JA_TAHTAEG: "VASTUTAJA_JA_TAHTAEG",
  KOHTUMISE_MARGE: "KOHTUMISE_MARGE",
  TEENUSE_SUUNAMISE_ALUS: "TEENUSE_SUUNAMISE_ALUS"
});

export const DRAFT_TYPES = Object.freeze(Object.values(DRAFT_TYPE));

export function isDraftType(value) {
  return typeof value === "string" && DRAFT_TYPES.includes(value);
}

/** i18n võti mustanditüübile. Andmebaasist ei tule renderdatavat stringi. */
export function draftTypeLabelKey(value) {
  return isDraftType(value) ? `casework.draft.type_${value}` : null;
}

const TEXT_MAX = 4000;
const FIELD_KEY_MAX = 64;
const FIELD_KEY_SHAPE = /^[A-Z][A-Z0-9_]*$/;
const LIST_LIMIT_DEFAULT = 50;
const LIST_LIMIT_MAX = 200;

const DRAFT_SELECT = Object.freeze({
  id: true,
  caseWorkAssistId: true,
  draftType: true,
  transferState: true,
  reviewKind: true,
  transferredAt: true,
  contentPurgedAt: true,
  createdAt: true,
  updatedAt: true
});

const FIELD_SELECT = Object.freeze({
  id: true,
  draftId: true,
  fieldKey: true,
  text: true,
  provenance: true,
  createdAt: true,
  updatedAt: true
});

function requireEnabled() {
  if (!isCaseWorkEnabled()) throw notFound();
}

function normalizeId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeText(value) {
  const text = String(value ?? "").trim();
  if (!text) throw badRequest("casework.errors.draft_text_required");
  if (text.length > TEXT_MAX) throw badRequest("casework.errors.draft_text_too_long");
  return text;
}

function normalizeProvenance(value) {
  const origin = normalizeId(value);
  if (!isProvenance(origin)) throw badRequest("casework.errors.provenance_unknown");
  return origin;
}

function normalizeDraftType(value) {
  const type = normalizeId(value);
  if (!isDraftType(type)) throw badRequest("casework.errors.draft_type_unknown");
  return type;
}

/**
 * `fieldKey` on MASINVÕTI, mitte sisuväli. Vorm on sama, mida jõustab
 * migratsiooni `CHECK` — kaks kihti sama reegli peal on siin tahtlik, sest
 * andmebaas kaitseb ka otse-SQL-i eest ja teenuskiht annab ausa 400.
 */
function normalizeFieldKey(value) {
  const key = normalizeId(value);
  if (!key || key.length > FIELD_KEY_MAX || !FIELD_KEY_SHAPE.test(key)) {
    throw badRequest("casework.errors.draft_field_key_invalid");
  }
  return key;
}

async function requireVisibleCase({ db, ownerUserId, caseWorkAssistId }) {
  const row = await db.caseWorkAssist.findFirst({
    where: { id: caseWorkAssistId, ownerUserId },
    select: { id: true }
  });
  if (!row) throw notFound();
  return row;
}

/**
 * Mustand kuulub SELLESSE juhtumisse, mis URL-is on. Ristkontroll on
 * kohustuslik — vt sama selgitust E3-s ja E4-s.
 */
async function requireDraftInCase({ db, caseWorkAssistId, draftId, select = DRAFT_SELECT }) {
  const draft = await db.caseWorkDraft.findFirst({
    where: { id: draftId, caseWorkAssistId },
    select
  });
  if (!draft) throw notFound();
  return draft;
}

/* ────────────────────────────────────────────────────────────────────────────
   MUSTAND
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Mustandi loomine.
 *
 * MUSTANDI VÕIB LUUA ILMA ÜHEGI MÄRKMETA (O-JTA-4) — ptk 4.5 kaheksa elementi
 * ei eelda kohtumist. „Teenuse suunamise alus" võib sündida ilma ühegi
 * kohtumiseta, ja siis kannavad tema väljad oma päritolu ise.
 *
 * MITU SAMA TÜÜPI MUSTANDIT ON LUBATUD: `@@unique` on väljal, mitte tüübil.
 * Juhtumil võib olla kaks eluvaldkonna kirjeldust eri aegadest ja üks neist
 * ülekantud, teine mustand.
 */
export async function createDraft({ ownerUserId, caseWorkAssistId, draftType, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  if (!owner || !caseId) throw notFound();

  const type = normalizeDraftType(draftType);

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, (tx) =>
    tx.caseWorkDraft.create({
      /* `transferState` EI TULE kutsujalt. Iga element algab `MUSTAND`-ist
         (ptk 4.5) ja edasi liigub ainult `transitionDraft()` kaudu — loomisel
         antud seis oleks tee, mis läheks olekumasinast mööda. */
      data: { caseWorkAssistId: caseId, draftType: type },
      select: DRAFT_SELECT
    })
  );
}

export async function getDraft({ ownerUserId, caseWorkAssistId, draftId, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const id = normalizeId(draftId);
  if (!owner || !caseId || !id) throw notFound();

  await requireVisibleCase({ db, ownerUserId: owner, caseWorkAssistId: caseId });
  const draft = await requireDraftInCase({ db, caseWorkAssistId: caseId, draftId: id });

  const fields = await db.caseWorkDraftField.findMany({
    where: { draftId: id },
    select: FIELD_SELECT,
    orderBy: [{ fieldKey: "asc" }]
  });

  return { ...draft, fields };
}

export async function listDrafts({
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

  const take = normalizeLimit(limit, { fallback: LIST_LIMIT_DEFAULT, max: LIST_LIMIT_MAX });
  const cursorId = normalizeId(cursor);

  const rows = await db.caseWorkDraft.findMany({
    where: { caseWorkAssistId: caseId },
    select: DRAFT_SELECT,
    /* `draftType` järgi, siis vanimad ees — ptk 4.5 järjekord on nimekirja
       kuju, mitte ajajoon. Enum sordib deklaratsioonijärjekorras. */
    orderBy: [{ draftType: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: take + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {})
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

/* Mustandi KUSTUTUST ei ole: ta on ülekandeahela lüli ja tema jälg on tõend.
   Lõpetamise tee on `EI_KANTA` — TEADLIK lõpp, mitte „jäi seisma" (ptk 2.2). */

/**
 * Laua sektsioon #4 (L12) — STAR2-sse kandmist ootavad mustandid.
 *
 * „OOTAB" TÄHENDAB MITTE-TERMINAALSET, mitte ainult `VALMIS_ULEKANDEKS`-i.
 * `ULE_KANTUD` on jõudnud kohale ja `EI_KANTA` on teadlik lõpp; kõik neli
 * ülejäänud seisu on tee peal ja neid on laual vaja näha. Kitsam filter näitaks
 * ainult viimast sammu ja töötaja ei näeks, mis tal pooleli on.
 *
 * LUGEJA ON SIIN, MITTE LAUAS (L10). Skoop tuleb päringust — juhtumi omanik on
 * `WHERE`-i sees, mitte filtrina vastuse peal.
 */
export async function listDraftsAwaitingTransfer({ ownerUserId, limit = LIST_LIMIT_DEFAULT, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  if (!owner) return { items: [] };

  const take = normalizeLimit(limit, { fallback: LIST_LIMIT_DEFAULT, max: LIST_LIMIT_MAX });
  const items = await db.caseWorkDraft.findMany({
    where: {
      caseWorkAssist: { ownerUserId: owner },
      transferState: {
        notIn: [STAR2_TRANSFER_STATE.ULE_KANTUD, STAR2_TRANSFER_STATE.EI_KANTA]
      }
    },
    select: DRAFT_SELECT,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take
  });
  return { items };
}

/* ────────────────────────────────────────────────────────────────────────────
   VÄLJAD
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * TERMINAALSE MUSTANDI SISU EI MUUTU.
 *
 * `ULE_KANTUD` ja `EI_KANTA` on ptk 2.2 lõpp-punktid. Esimene tähendab, et info
 * on STAR-is — hilisem muutmine tekitaks kaks eri versiooni ühest ja samast
 * kandest, ilma et keegi teaks, kumb registrisse läks. Teine on teadlik otsus
 * mitte kanda; tema muutmine tähendaks otsuse vaikset ümberpööramist.
 */
function assertDraftWritable(draft) {
  if (isStar2Terminal(draft.transferState)) throw conflict("casework.errors.draft_terminal");
}

export async function setField({
  ownerUserId,
  caseWorkAssistId,
  draftId,
  fieldKey,
  text,
  provenance,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const id = normalizeId(draftId);
  if (!owner || !caseId || !id) throw notFound();

  const key = normalizeFieldKey(fieldKey);
  const value = normalizeText(text);
  const origin = normalizeProvenance(provenance);

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    const draft = await requireDraftInCase({
      db: tx,
      caseWorkAssistId: caseId,
      draftId: id,
      select: { id: true, transferState: true }
    });
    assertDraftWritable(draft);

    return tx.caseWorkDraftField.upsert({
      where: { draftId_fieldKey: { draftId: id, fieldKey: key } },
      create: { draftId: id, fieldKey: key, text: value, provenance: origin },
      /* `provenance` EI OLE siin — uuendus muudab teksti, märgis jääb (L4). */
      update: { text: value },
      select: FIELD_SELECT
    });
  });
}

export async function removeField({ ownerUserId, caseWorkAssistId, draftId, fieldKey, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const id = normalizeId(draftId);
  if (!owner || !caseId || !id) throw notFound();

  const key = normalizeFieldKey(fieldKey);

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    const draft = await requireDraftInCase({
      db: tx,
      caseWorkAssistId: caseId,
      draftId: id,
      select: { id: true, transferState: true }
    });
    assertDraftWritable(draft);

    const result = await tx.caseWorkDraftField.deleteMany({ where: { draftId: id, fieldKey: key } });
    if (!result?.count) throw notFound();
    return { ok: true };
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   OLEKUSIIRE
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Avalik kasutajaoperatsioon KÕIGI MUUDE siirete jaoks.
 *
 * `to = ULE_KANTUD` → **400** (L19). Miks mitte vaikne ümbersuunamine
 * `markTransferred`-ile: kaks operatsiooni tähendavad kahte eri tegu ja kahte
 * eri tähendust. „Märgi üle kantuks" on avaldus selle kohta, et info on STAR-is;
 * „vii mustand järgmisse seisu" ei ole. Vaikne ümbersuunamine tekitaks
 * auditirea teo kohta, mida kasutaja ei teinud.
 */
export async function transitionDraft({
  ownerUserId,
  caseWorkAssistId,
  draftId,
  expectedFrom,
  to,
  reviewKind = undefined,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const id = normalizeId(draftId);
  if (!owner || !caseId || !id) throw notFound();

  if (normalizeId(to) === STAR2_TRANSFER_STATE.ULE_KANTUD) {
    throw badRequest("casework.errors.use_mark_transferred");
  }

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    /* 404 KÄIB VALIDEERIMISE EES — võõras mustand ei tohi anda teistsugust viga
       kui olematu mustand. Sama õppetund mis E3 `confirm-provenance`-il. */
    await requireDraftInCase({ db: tx, caseWorkAssistId: caseId, draftId: id, select: { id: true } });

    await transitionDraftStateTx(tx, { draftId: id, expectedFrom, to, reviewKind });
    return tx.caseWorkDraft.findFirst({ where: { id, caseWorkAssistId: caseId }, select: DRAFT_SELECT });
  });
}
