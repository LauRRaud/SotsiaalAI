/**
 * JTA-V1 (E4) — kohtumise märge kaheksa kihiga.
 *
 * Leping: docs/platvormi arendus/jta-v1-arendusleping.md (v6), etapp E4.
 * Kirjeldus: `ideed.md` ptk 4.4.
 *
 * VIIS REEGLIT, MIS ON SIIN ARHITEKTUUR, MITTE STIIL:
 *
 *   L5 — KAHEKSA KIHTI EI VALATA KOKKU. Kliendi enda vaade, faktiline asjaolu ja
 *        töötaja tõlgendus on kolm eri asja; kui nad seisavad ühes tekstiväljas,
 *        ei saa hiljem keegi öelda, kumb oli kelle oma. `layer` on TEKST +
 *        validaator, mitte DB-enum — kaheksa kihti on ptk 4.4 valdkonnasõnastik,
 *        sama liiki asi mis `provenance`.
 *
 *   L4 — PÄRITOLU ON REA OMA. Iga kirje kannab oma märgist ja `updateEntry()`
 *        EI PUUTU seda: saadetud `provenance` EIRATAKSE. Erinevalt E3-st ei ole
 *        märkmel `confirm-provenance` rada — leping ei anna talle marsruuti, ja
 *        seda ei leiutata siin juurde.
 *
 *   PRIVAATNE REFLEKSIOON EI LÄHE STAR2-sse KUNAGI, ja seda ei tohi saada
 *        tühistada ÜMBER NIMETAMISEGA. `updateEntry()` keelab kihi muutmise
 *        `PRIVAATNE_REFLEKSIOON`-i ja sellest välja. Ilma selleta oleks E6
 *        ekspordikontroll ainult teatrike: kirje liigutaks `STAR2_KANTAV`-isse
 *        ja läheks välja. Kui töötaja tahab midagi päriselt STAR-i, kirjutab ta
 *        selle `STAR2_KANTAV` kihti — see on autorlus, mitte silt ümber.
 *
 *   L14 — KIRJUTUSKAITSE PÄRITAKSE JUHTUMILT ja teda jõustab
 *        `withActiveCaseLock()` — kirjutuse SEES, mitte enne teda.
 *
 *   MÄRGET EI KUSTUTATA. `deleteNote()` puudub TEADLIKULT (E3 ettevalmistusel ta
 *        on): ettevalmistus kirjeldab kohtumist, mida veel ei olnud, märge seda,
 *        mis juba juhtus. Üksik kirje on eemaldatav, märge tervikuna mitte.
 */

import prismaClient from "@/lib/prisma";
import { isProvenance } from "@/lib/workspaces/provenance";

import { withActiveCaseLock } from "./caseWorkAssist.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { isCaseWorkEnabled } from "./flags.js";
import { normalizeLimit } from "./paging.js";

/**
 * Ptk 4.4 kaheksa kihti. JÄRJEKORD ON TÄHENDUSEGA ja teda kasutab ka pind:
 * kliendi oma sõnad seisavad ees, töötaja tõlgendus nende järel, ja privaatne
 * refleksioon kõige lõpus — mitte tähestikus.
 */
export const NOTE_LAYER = Object.freeze({
  KLIENDI_VAADE: "KLIENDI_VAADE",
  FAKTID: "FAKTID",
  TOOTAJA_TAHELEPANEK: "TOOTAJA_TAHELEPANEK",
  KONTROLLIMATA: "KONTROLLIMATA",
  KOKKULEPPED: "KOKKULEPPED",
  JARGMISED_SAMMUD: "JARGMISED_SAMMUD",
  STAR2_KANTAV: "STAR2_KANTAV",
  PRIVAATNE_REFLEKSIOON: "PRIVAATNE_REFLEKSIOON"
});

export const NOTE_LAYERS = Object.freeze(Object.values(NOTE_LAYER));

export function isNoteLayer(value) {
  return typeof value === "string" && NOTE_LAYERS.includes(value);
}

/** i18n võti kihile. Andmebaasist ei tule kunagi renderdatavat stringi. */
export function noteLayerLabelKey(value) {
  return isNoteLayer(value) ? `casework.note.layer_${value}` : null;
}

const TEXT_MAX = 4000;
const LIST_LIMIT_DEFAULT = 50;
const LIST_LIMIT_MAX = 200;
const ORDINAL_MAX = 100_000;

const NOTE_SELECT = Object.freeze({
  id: true,
  caseWorkAssistId: true,
  meetingPrepId: true,
  meetingAt: true,
  createdAt: true,
  updatedAt: true
});

const ENTRY_SELECT = Object.freeze({
  id: true,
  meetingNoteId: true,
  layer: true,
  text: true,
  provenance: true,
  ordinal: true,
  createdAt: true,
  updatedAt: true
});

function requireEnabled() {
  if (!isCaseWorkEnabled()) throw notFound();
}

function normalizeId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Tekst on PLAIN TEXT. Me ei puhasta HTML-i ega tõlgi märgistust — vaade
 * renderdab teda tekstina ja seda tõendab eraldi test.
 */
function normalizeText(value) {
  const text = String(value ?? "").trim();
  if (!text) throw badRequest("casework.errors.note_text_required");
  if (text.length > TEXT_MAX) throw badRequest("casework.errors.note_text_too_long");
  return text;
}

function normalizeLayer(value) {
  const layer = normalizeId(value);
  if (!isNoteLayer(layer)) throw badRequest("casework.errors.note_layer_unknown");
  return layer;
}

function normalizeProvenance(value) {
  const origin = normalizeId(value);
  if (!isProvenance(origin)) throw badRequest("casework.errors.provenance_unknown");
  return origin;
}

function normalizeMeetingAt(value) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest("casework.errors.meeting_at_invalid");
  return date;
}

function normalizeOrdinal(value) {
  if (value === undefined || value === null || value === "") return 0;
  const ordinal = Number(value);
  if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal > ORDINAL_MAX) {
    throw badRequest("casework.errors.ordinal_invalid");
  }
  return ordinal;
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
 * Märge kuulub SELLESSE juhtumisse, mis URL-is on.
 *
 * RISTKONTROLL ON KOHUSTUSLIK — ilma selleta loeks `/cases/<oma>/meeting-notes/<võõras>`
 * võõrast märget ja omanikupiir kehtiks juhtumile, mille ID kutsuja ise valis.
 */
async function requireNoteInCase({ db, caseWorkAssistId, meetingNoteId, select = NOTE_SELECT }) {
  const note = await db.caseWorkMeetingNote.findFirst({
    where: { id: meetingNoteId, caseWorkAssistId },
    select
  });
  if (!note) throw notFound();
  return note;
}

/* ────────────────────────────────────────────────────────────────────────────
   MÄRGE
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Märkme loomine. `meetingPrepId` on VALIKULINE seos ettevalmistusele.
 *
 * SEOS KONTROLLITAKSE SAMAS JUHTUMIS: võõra juhtumi ettevalmistuse külge ei saa
 * märget riputada, ka mitte oma juhtumi alt. Kontrollimata FK laseks kutsujal
 * siduda kaks juhtumit, mille vahel ei ole mingit suhet.
 */
export async function createNote({
  ownerUserId,
  caseWorkAssistId,
  meetingPrepId = null,
  meetingAt = null,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  if (!owner || !caseId) throw notFound();

  const prepId = normalizeId(meetingPrepId);
  const at = normalizeMeetingAt(meetingAt);

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    if (prepId) {
      const prep = await tx.caseWorkMeetingPrep.findFirst({
        where: { id: prepId, caseWorkAssistId: caseId },
        select: { id: true }
      });
      if (!prep) throw notFound();
    }

    return tx.caseWorkMeetingNote.create({
      data: { caseWorkAssistId: caseId, meetingPrepId: prepId, meetingAt: at },
      select: NOTE_SELECT
    });
  });
}

/** Üks märge koos kirjetega, kihtide kaupa järjestatuna. */
export async function getNote({ ownerUserId, caseWorkAssistId, meetingNoteId, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const noteId = normalizeId(meetingNoteId);
  if (!owner || !caseId || !noteId) throw notFound();

  await requireVisibleCase({ db, ownerUserId: owner, caseWorkAssistId: caseId });
  const note = await requireNoteInCase({ db, caseWorkAssistId: caseId, meetingNoteId: noteId });

  const entries = await db.caseWorkMeetingNoteEntry.findMany({
    where: { meetingNoteId: noteId },
    select: ENTRY_SELECT,
    orderBy: [{ ordinal: "asc" }, { createdAt: "asc" }, { id: "asc" }]
  });

  return { ...note, entries };
}

export async function listNotes({
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

  const rows = await db.caseWorkMeetingNote.findMany({
    where: { caseWorkAssistId: caseId },
    select: NOTE_SELECT,
    /* Ajata märge ei tohi ajaga märkmete ette upuda — vt E3 sama põhjendus. */
    orderBy: [{ meetingAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {})
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

/* Märkme KUSTUTUST ei ole ja seda ei tohi „sümmeetria pärast" juurde kirjutada
   — vt faili päist. */

/* ────────────────────────────────────────────────────────────────────────────
   KIRJED
   ──────────────────────────────────────────────────────────────────────────── */

export async function addEntry({
  ownerUserId,
  caseWorkAssistId,
  meetingNoteId,
  layer,
  text,
  provenance,
  ordinal,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const noteId = normalizeId(meetingNoteId);
  if (!owner || !caseId || !noteId) throw notFound();

  const entryLayer = normalizeLayer(layer);
  const value = normalizeText(text);
  const origin = normalizeProvenance(provenance);
  const order = normalizeOrdinal(ordinal);

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    await requireNoteInCase({ db: tx, caseWorkAssistId: caseId, meetingNoteId: noteId, select: { id: true } });

    return tx.caseWorkMeetingNoteEntry.create({
      data: { meetingNoteId: noteId, layer: entryLayer, text: value, provenance: origin, ordinal: order },
      select: ENTRY_SELECT
    });
  });
}

/**
 * Kirje muutmine.
 *
 * `provenance` EI OLE muudetav (L4) — saadetud väärtus eiratakse vaikselt.
 *
 * `layer` ON muudetav, AGA MITTE `PRIVAATNE_REFLEKSIOON`-i ega sellest välja.
 * Ümbernimetamine oleks ainus tee, mis tühistaks lubaduse „privaatne refleksioon
 * ei lähe STAR2-sse kunagi" — ja ta teeks seda VAIKSELT, ilma et kuskil tekiks
 * jälge. Kui töötaja tahab midagi päriselt STAR-i, kirjutab ta selle
 * `STAR2_KANTAV` kihti; see on autorlus, mitte silt ümber.
 */
export async function updateEntry({
  ownerUserId,
  caseWorkAssistId,
  meetingNoteId,
  entryId,
  layer,
  text,
  ordinal,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const noteId = normalizeId(meetingNoteId);
  const id = normalizeId(entryId);
  if (!owner || !caseId || !noteId || !id) throw notFound();

  const data = {};
  if (layer !== undefined) data.layer = normalizeLayer(layer);
  if (text !== undefined) data.text = normalizeText(text);
  if (ordinal !== undefined) data.ordinal = normalizeOrdinal(ordinal);
  if (!Object.keys(data).length) throw badRequest("casework.errors.invalid_input");

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    await requireNoteInCase({ db: tx, caseWorkAssistId: caseId, meetingNoteId: noteId, select: { id: true } });

    const current = await tx.caseWorkMeetingNoteEntry.findFirst({
      where: { id, meetingNoteId: noteId },
      select: { id: true, layer: true }
    });
    /* 404 KÄIB KIHIKONTROLLI EES — sama õppetund mis E3 `confirm-provenance`-il:
       võõras kirje ei tohi anda teistsugust viga kui olematu kirje. */
    if (!current) throw notFound();

    if (data.layer && data.layer !== current.layer) {
      const touchesPrivate =
        current.layer === NOTE_LAYER.PRIVAATNE_REFLEKSIOON || data.layer === NOTE_LAYER.PRIVAATNE_REFLEKSIOON;
      if (touchesPrivate) throw conflict("casework.errors.note_private_layer_locked");
    }

    const result = await tx.caseWorkMeetingNoteEntry.updateMany({ where: { id, meetingNoteId: noteId }, data });
    if (!result?.count) throw notFound();
    return tx.caseWorkMeetingNoteEntry.findFirst({ where: { id, meetingNoteId: noteId }, select: ENTRY_SELECT });
  });
}

export async function removeEntry({
  ownerUserId,
  caseWorkAssistId,
  meetingNoteId,
  entryId,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const noteId = normalizeId(meetingNoteId);
  const id = normalizeId(entryId);
  if (!owner || !caseId || !noteId || !id) throw notFound();

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    await requireNoteInCase({ db: tx, caseWorkAssistId: caseId, meetingNoteId: noteId, select: { id: true } });
    const result = await tx.caseWorkMeetingNoteEntry.deleteMany({ where: { id, meetingNoteId: noteId } });
    if (!result?.count) throw notFound();
    return { ok: true };
  });
}

export async function listEntries({ ownerUserId, caseWorkAssistId, meetingNoteId, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const noteId = normalizeId(meetingNoteId);
  if (!owner || !caseId || !noteId) throw notFound();

  await requireVisibleCase({ db, ownerUserId: owner, caseWorkAssistId: caseId });
  await requireNoteInCase({ db, caseWorkAssistId: caseId, meetingNoteId: noteId, select: { id: true } });

  const items = await db.caseWorkMeetingNoteEntry.findMany({
    where: { meetingNoteId: noteId },
    select: ENTRY_SELECT,
    orderBy: [{ ordinal: "asc" }, { createdAt: "asc" }, { id: "asc" }]
  });
  return { items };
}

/**
 * E5/E6 LUGEJA: ainult `STAR2_KANTAV` kirjed.
 *
 * SIIN ON EKSPORDIRAJA AINUS UKS ja ta on kitsas MEELEGA — L5 järgi jõuab
 * märkmest mustandisse ainult see üks kiht. Üldine „anna kirjed" lugeja koos
 * kutsuja poolel filtreerimisega tähendaks, et filter võib ühes kutsujas maha
 * jääda; siin on ta päringus.
 *
 * `PRIVAATNE_REFLEKSIOON` ei jõua siia ka siis, kui keegi seda küsib: kihi
 * väärtus on `WHERE`-is konstandina, mitte parameetrina.
 */
export async function listTransferableEntries({
  ownerUserId,
  caseWorkAssistId,
  meetingNoteId,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const noteId = normalizeId(meetingNoteId);
  if (!owner || !caseId || !noteId) throw notFound();

  await requireVisibleCase({ db, ownerUserId: owner, caseWorkAssistId: caseId });
  await requireNoteInCase({ db, caseWorkAssistId: caseId, meetingNoteId: noteId, select: { id: true } });

  const items = await db.caseWorkMeetingNoteEntry.findMany({
    where: { meetingNoteId: noteId, layer: NOTE_LAYER.STAR2_KANTAV },
    select: ENTRY_SELECT,
    orderBy: [{ ordinal: "asc" }, { createdAt: "asc" }, { id: "asc" }]
  });
  return { items };
}
