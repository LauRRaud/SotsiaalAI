/**
 * JTA-V1 (E3) — kohtumise ettevalmistus.
 *
 * Leping: docs/platvormi arendus/jta-v1-arendusleping.md (v6), etapp E3.
 * Kirjeldus: `ideed.md` ptk 4.4–4.6.
 *
 * NELI REEGLIT, MIS ON SIIN ARHITEKTUUR, MITTE STIIL:
 *
 *   L4 — PÄRITOLU ON REA OMA, MITTE ETTEVALMISTUSE OMA. Iga väli ja iga küsimus
 *        kannab oma märgist. Üks jäme `provenance` terve prep-i peal ei suuda
 *        väljendada „eesmärgi kirjutas töötaja, lihtsas keeles selgituse koostas
 *        AI" — ja leping ütleb „AI koostatud OSA", mitte „AI koostatud
 *        ettevalmistus".
 *
 *   AI MÄRGIST EI SAA VAIKSELT MAHA VÕTTA. `updateField()` ja `updateQuestion()`
 *        EI PUUTU `provenance`-i ja saadetud väärtuse nad EIRAVAD — mitte ei
 *        võta vastu. Märgist muudab ainult `confirmProvenance()`, mis on oma
 *        operatsioon oma marsruudil, võtab `from` väärtuse ja teeb tingimusliku
 *        update'i. Ainus lubatud suund on `AI_MUSTAND` → inimese märgis:
 *        tagasitee masina märgise juurde kirjutaks inimese kinnituse ümber.
 *
 *   L14 — KIRJUTUSKAITSE PÄRITAKSE JUHTUMILT ja teda jõustab
 *        `withActiveCaseLock()` — KIRJUTUSE SEES, mitte enne teda. Eraldi
 *        eelkontroll oleks võistlus: `transitionRetention()` mahub kontrolli ja
 *        kirjutuse vahele.
 *
 *   PUUDUVAT INFOT SIIA EI KOPEERITA. Prep-i vaade loeb juhtumi enda
 *        `CaseWorkMissingInfo` lahtised punktid (`listMissingInfo`). Koopia
 *        oleks teine tõde ja läheks esimese lahendamise järel originaalist
 *        lahku (ptk 4.7 „paralleelset andmebaasi ei teki").
 */

import prismaClient from "@/lib/prisma";
import { isProvenance, PROVENANCE } from "@/lib/workspaces/provenance";

import { withActiveCaseLock } from "./caseWorkAssist.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { isCaseWorkEnabled } from "./flags.js";
import { normalizeLimit } from "./paging.js";

/** Ettevalmistuse väljad. Sama hulk mis `CaseWorkPrepFieldKey` skeemis. */
export const PREP_FIELD_KEY = Object.freeze({
  GOAL: "GOAL",
  REQUIRED_DOCUMENTS: "REQUIRED_DOCUMENTS",
  LIFE_DOMAINS: "LIFE_DOMAINS",
  AGENDA: "AGENDA",
  PLAIN_LANGUAGE_NOTES: "PLAIN_LANGUAGE_NOTES"
});

export const PREP_FIELD_KEYS = Object.freeze(Object.values(PREP_FIELD_KEY));

/** Küsimuse liik. Sama hulk mis `CaseWorkQuestionKind` skeemis. */
export const QUESTION_KIND = Object.freeze({
  CLARIFYING_QUESTION: "CLARIFYING_QUESTION",
  CLAIM_TO_VERIFY: "CLAIM_TO_VERIFY"
});

export const QUESTION_KINDS = Object.freeze(Object.values(QUESTION_KIND));

const TEXT_MAX = 4000;
const LIST_LIMIT_DEFAULT = 50;
const LIST_LIMIT_MAX = 200;
const ORDINAL_MAX = 100_000;

const PREP_SELECT = Object.freeze({
  id: true,
  caseWorkAssistId: true,
  meetingAt: true,
  createdAt: true,
  updatedAt: true
});

const FIELD_SELECT = Object.freeze({
  id: true,
  meetingPrepId: true,
  fieldKey: true,
  text: true,
  provenance: true,
  createdAt: true,
  updatedAt: true
});

const QUESTION_SELECT = Object.freeze({
  id: true,
  meetingPrepId: true,
  kind: true,
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
 * renderdab teda tekstina ja seda tõendab eraldi test. Puhastamine siin
 * tekitaks illusiooni, et väljund on ohutu ka siis, kui keegi ta kunagi
 * `dangerouslySetInnerHTML`-i paneb.
 */
function normalizeText(value) {
  const text = String(value ?? "").trim();
  if (!text) throw badRequest("casework.errors.prep_text_required");
  if (text.length > TEXT_MAX) throw badRequest("casework.errors.prep_text_too_long");
  return text;
}

function normalizeProvenance(value) {
  const origin = normalizeId(value);
  /* Tundmatu päritolu lükatakse TAGASI, mitte ei salvestata „nagu on". Vaba
     tekst päritolu kohal tähendaks, et märgistus ei ole enam kontrollitav. */
  if (!isProvenance(origin)) throw badRequest("casework.errors.provenance_unknown");
  return origin;
}

function normalizeFieldKey(value) {
  const key = normalizeId(value);
  if (!key || !PREP_FIELD_KEYS.includes(key)) throw badRequest("casework.errors.prep_field_key_unknown");
  return key;
}

function normalizeQuestionKind(value) {
  const kind = normalizeId(value);
  if (!kind || !QUESTION_KINDS.includes(kind)) throw badRequest("casework.errors.question_kind_unknown");
  return kind;
}

/**
 * `meetingAt` on VABATAHTLIK ja tema puudumine on tähendusega: ettevalmistust
 * tohib alustada enne, kui aeg on kokku lepitud. `undefined` = ära puutu,
 * `null` = eemalda.
 */
function normalizeMeetingAt(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
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

/**
 * Juhtum on nähtav = kutsuja on tema omanik.
 *
 * LUGEMISRAJAL EI OLE LUKKU, sest lugemine ei ole kirjutuskaitse all: `L14`
 * keelab muutmise, mitte vaatamise. Kirjutusrajad käivad `withActiveCaseLock()`
 * kaudu ja kontrollivad omandit tehingu SEES.
 */
async function requireVisibleCase({ db, ownerUserId, caseWorkAssistId }) {
  const row = await db.caseWorkAssist.findFirst({
    where: { id: caseWorkAssistId, ownerUserId },
    select: { id: true }
  });
  if (!row) throw notFound();
  return row;
}

/**
 * Prep kuulub SELLESSE juhtumisse, mis URL-is on.
 *
 * RISTKONTROLL ON KOHUSTUSLIK. Ilma selleta saaks `/cases/<oma>/meeting-preps/<võõras>`
 * lugeda võõrast ettevalmistust — omandikontroll kehtiks juhtumile, mille ID
 * kutsuja ise valis. Sama muster, mis 04.08 IDOR-i tekitas, ainult ühe tasandi
 * võrra sügavamal.
 */
async function requirePrepInCase({ db, caseWorkAssistId, meetingPrepId, select = PREP_SELECT }) {
  const prep = await db.caseWorkMeetingPrep.findFirst({
    where: { id: meetingPrepId, caseWorkAssistId },
    select
  });
  if (!prep) throw notFound();
  return prep;
}

/* ────────────────────────────────────────────────────────────────────────────
   ETTEVALMISTUS
   ──────────────────────────────────────────────────────────────────────────── */

export async function createMeetingPrep({ ownerUserId, caseWorkAssistId, meetingAt, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  if (!owner || !caseId) throw notFound();

  const at = normalizeMeetingAt(meetingAt);

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, (tx) =>
    tx.caseWorkMeetingPrep.create({
      data: { caseWorkAssistId: caseId, meetingAt: at === undefined ? null : at },
      select: PREP_SELECT
    })
  );
}

/**
 * `meetingAt` on ainus muudetav väli — kogu ülejäänud sisu elab väljades ja
 * küsimustes, millel on oma operatsioonid ja oma päritolu.
 */
export async function updateMeetingPrep({ ownerUserId, caseWorkAssistId, meetingPrepId, meetingAt, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const prepId = normalizeId(meetingPrepId);
  if (!owner || !caseId || !prepId) throw notFound();

  const at = normalizeMeetingAt(meetingAt);
  if (at === undefined) throw badRequest("casework.errors.invalid_input");

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    const result = await tx.caseWorkMeetingPrep.updateMany({
      where: { id: prepId, caseWorkAssistId: caseId },
      data: { meetingAt: at }
    });
    if (!result?.count) throw notFound();
    return tx.caseWorkMeetingPrep.findFirst({ where: { id: prepId, caseWorkAssistId: caseId }, select: PREP_SELECT });
  });
}

/** Üks ettevalmistus koos väljade ja küsimustega. */
export async function getMeetingPrep({ ownerUserId, caseWorkAssistId, meetingPrepId, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const prepId = normalizeId(meetingPrepId);
  if (!owner || !caseId || !prepId) throw notFound();

  await requireVisibleCase({ db, ownerUserId: owner, caseWorkAssistId: caseId });
  const prep = await requirePrepInCase({ db, caseWorkAssistId: caseId, meetingPrepId: prepId });

  const [fields, questions] = await Promise.all([
    db.caseWorkMeetingPrepField.findMany({
      where: { meetingPrepId: prepId },
      select: FIELD_SELECT,
      orderBy: [{ fieldKey: "asc" }]
    }),
    db.caseWorkQuestion.findMany({
      where: { meetingPrepId: prepId },
      select: QUESTION_SELECT,
      orderBy: [{ kind: "asc" }, { ordinal: "asc" }, { createdAt: "asc" }, { id: "asc" }]
    })
  ]);

  return { ...prep, fields, questions };
}

/** Juhtumi ettevalmistused, cursor-pagineeritud. Uusim kohtumine ees. */
export async function listMeetingPreps({
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

  const rows = await db.caseWorkMeetingPrep.findMany({
    where: { caseWorkAssistId: caseId },
    select: PREP_SELECT,
    /* Aeg puudub → `nulls: "last"`. Ilma selleta upuksid ajata mustandid
       Postgresis `DESC` sortimisel ETTE ja plaanitud kohtumised kaoksid alla. */
    orderBy: [{ meetingAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {})
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

/**
 * `DELETE` on olemas — erinevalt märkmest ja mustandist.
 *
 * ETTEVALMISTUS ON TULEVIKUPLAAN, MITTE TÕEND: ta kirjeldab kohtumist, mida
 * veel ei ole olnud. Kustutus on kõva kustutus ja seda ei auditeerita eraldi;
 * kaskaad viib väljad ja küsimused kaasa.
 */
export async function deleteMeetingPrep({ ownerUserId, caseWorkAssistId, meetingPrepId, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const prepId = normalizeId(meetingPrepId);
  if (!owner || !caseId || !prepId) throw notFound();

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    const result = await tx.caseWorkMeetingPrep.deleteMany({ where: { id: prepId, caseWorkAssistId: caseId } });
    /* Teine kustutus annab 404, mitte edu. „Idempotentne" tähendab siin, et
       teine kutse ei tee kahju — mitte seda, et ta valetab olemasolu kohta. */
    if (!result?.count) throw notFound();
    return { ok: true };
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   VÄLJAD
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Välja määramine (upsert): üks rida välja kohta.
 *
 * PÄRITOLU ON KOHUSTUSLIK LOOMISEL ja `provenance` uuendatakse ainult siis, kui
 * rida veel ei olnud. Olemasoleva rea teksti muutmine EI PUUTU märgist — vt
 * faili päist. Märgise muutmiseks on `confirmProvenance()`.
 */
export async function setPrepField({
  ownerUserId,
  caseWorkAssistId,
  meetingPrepId,
  fieldKey,
  text,
  provenance,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const prepId = normalizeId(meetingPrepId);
  if (!owner || !caseId || !prepId) throw notFound();

  const key = normalizeFieldKey(fieldKey);
  const value = normalizeText(text);
  const origin = normalizeProvenance(provenance);

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    await requirePrepInCase({ db: tx, caseWorkAssistId: caseId, meetingPrepId: prepId, select: { id: true } });

    return tx.caseWorkMeetingPrepField.upsert({
      where: { meetingPrepId_fieldKey: { meetingPrepId: prepId, fieldKey: key } },
      create: { meetingPrepId: prepId, fieldKey: key, text: value, provenance: origin },
      /* `provenance` EI OLE siin. Uuendus muudab teksti; märgis jääb selleks,
         mis ta oli, ja saadetud väärtus eiratakse vaikselt. */
      update: { text: value },
      select: FIELD_SELECT
    });
  });
}

/* Välja KUSTUTUST V1-s ei ole ja see ei ole unustus: leping annab `fields`
   marsruudile ainult `PUT`. Tühi väli ja puuduv väli tähendavad ettevalmistuses
   sama asja, seega kustutus lisaks operatsiooni ilma uue tähenduseta — ja iga
   operatsioon on koht, kus omanikupiir võib maha jääda. */

/* ────────────────────────────────────────────────────────────────────────────
   KÜSIMUSED
   ──────────────────────────────────────────────────────────────────────────── */

export async function addQuestion({
  ownerUserId,
  caseWorkAssistId,
  meetingPrepId,
  kind,
  text,
  provenance,
  ordinal,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const prepId = normalizeId(meetingPrepId);
  if (!owner || !caseId || !prepId) throw notFound();

  const questionKind = normalizeQuestionKind(kind);
  const value = normalizeText(text);
  const origin = normalizeProvenance(provenance);
  const order = normalizeOrdinal(ordinal);

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    await requirePrepInCase({ db: tx, caseWorkAssistId: caseId, meetingPrepId: prepId, select: { id: true } });

    return tx.caseWorkQuestion.create({
      data: { meetingPrepId: prepId, kind: questionKind, text: value, provenance: origin, ordinal: order },
      select: QUESTION_SELECT
    });
  });
}

/**
 * Küsimuse muutmine.
 *
 * `provenance` EI OLE MUUDETAV — vt faili päist. `kind` on: sama küsimus võib
 * osutuda väiteks, mida kliendiga kontrollida, ja see on sisuline ümberotsus,
 * mitte märgise mahavõtmine.
 */
export async function updateQuestion({
  ownerUserId,
  caseWorkAssistId,
  meetingPrepId,
  questionId,
  kind,
  text,
  ordinal,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const prepId = normalizeId(meetingPrepId);
  const id = normalizeId(questionId);
  if (!owner || !caseId || !prepId || !id) throw notFound();

  const data = {};
  if (kind !== undefined) data.kind = normalizeQuestionKind(kind);
  if (text !== undefined) data.text = normalizeText(text);
  if (ordinal !== undefined) data.ordinal = normalizeOrdinal(ordinal);
  if (!Object.keys(data).length) throw badRequest("casework.errors.invalid_input");

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    await requirePrepInCase({ db: tx, caseWorkAssistId: caseId, meetingPrepId: prepId, select: { id: true } });

    const result = await tx.caseWorkQuestion.updateMany({ where: { id, meetingPrepId: prepId }, data });
    if (!result?.count) throw notFound();
    return tx.caseWorkQuestion.findFirst({ where: { id, meetingPrepId: prepId }, select: QUESTION_SELECT });
  });
}

export async function removeQuestion({
  ownerUserId,
  caseWorkAssistId,
  meetingPrepId,
  questionId,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const prepId = normalizeId(meetingPrepId);
  const id = normalizeId(questionId);
  if (!owner || !caseId || !prepId || !id) throw notFound();

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    await requirePrepInCase({ db: tx, caseWorkAssistId: caseId, meetingPrepId: prepId, select: { id: true } });
    const result = await tx.caseWorkQuestion.deleteMany({ where: { id, meetingPrepId: prepId } });
    if (!result?.count) throw notFound();
    return { ok: true };
  });
}

/** Küsimused, ilma prep-i tervikuta. */
export async function listQuestions({ ownerUserId, caseWorkAssistId, meetingPrepId, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const prepId = normalizeId(meetingPrepId);
  if (!owner || !caseId || !prepId) throw notFound();

  await requireVisibleCase({ db, ownerUserId: owner, caseWorkAssistId: caseId });
  await requirePrepInCase({ db, caseWorkAssistId: caseId, meetingPrepId: prepId, select: { id: true } });

  const items = await db.caseWorkQuestion.findMany({
    where: { meetingPrepId: prepId },
    select: QUESTION_SELECT,
    orderBy: [{ kind: "asc" }, { ordinal: "asc" }, { createdAt: "asc" }, { id: "asc" }]
  });
  return { items };
}

/* ────────────────────────────────────────────────────────────────────────────
   PÄRITOLU KINNITAMINE
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * `AI_MUSTAND` → inimese märgis. OMA OPERATSIOON, MITTE `PATCH`-i KÕRVALMÕJU.
 *
 * KOLM GARANTIID, IGAÜHEL OMA JÕUSTAJA:
 *
 *   1. **Suund on ühesuunaline.** `to` ei tohi olla `AI_MUSTAND` — masina
 *      märgise juurde tagasi minek kirjutaks inimese kinnituse ümber. Jõustab
 *      `badRequest` allpool, 400.
 *   2. **Lähtemärgis peab olema `AI_MUSTAND`.** Inimese märgise „kinnitamine"
 *      teiseks inimese märgiseks ei ole kinnitus, vaid vaikne ümberkirjutus.
 *   3. **Kaks samaaegset kinnitust ei kirjuta teineteist üle.** `from` läheb
 *      `WHERE`-i (sama muster mis L6): teine kutse ei leia rida ja saab 409,
 *      mitte „õnnestus" vale eeldusega.
 */
/**
 * JÄRJEKORD ON TÄHENDUSEGA — 404 KÄIB SUUNAKONTROLLI EES.
 *
 * Leitud päris sessioonidega 08.08: kui suunakontroll oli väljaspool ja enne
 * omandikontrolli, vastas `confirm-provenance` VÕÕRALE töötajale **400
 * `provenance_confirm_source`**, kuigi kõik teised operatsioonid vastasid samale
 * inimesele 404. Andmeid see ei lekitanud (400 sõltub ainult päringu kehast,
 * mitte sellest, kas rida on olemas), aga kaks asja olid valed:
 *
 *   1. **Omanikule oli vastus eksitav.** Olematu välja kinnitamine ütles „ainult
 *      AI mustandit saab kinnitada", kuigi tegelik põhjus oli, et välja ei ole.
 *      Ta oleks parandanud `from` väärtust ja saanud sama vastuse uuesti.
 *   2. **Võõrale oli vastus ebaühtlane.** Sama inimene sai ühelt marsruudilt
 *      404 ja teiselt 400 — ja just sellised erisused on need, mille pealt
 *      hakatakse mustrit otsima.
 *
 * Nüüd: rida olemas? (404) → suund? (400) → tingimuslik update (409).
 */
async function confirmProvenanceRow({ tx, model, where, from, to }) {
  const existing = await tx[model].findFirst({ where, select: { id: true } });
  if (!existing) throw notFound();

  assertConfirmDirection(from, to);

  /* Tingimuslik update ka pärast olemasolu kontrolli: `provenance: from` on
     `WHERE`-is, seega kaks samaaegset kinnitust ei kirjuta teineteist üle.
     Olemasolu kontroll EI asenda seda — ta vastab teisele küsimusele. */
  const result = await tx[model].updateMany({ where: { ...where, provenance: from }, data: { provenance: to } });
  if (!result?.count) throw conflict("casework.errors.provenance_conflict");
  return true;
}

export async function confirmFieldProvenance({
  ownerUserId,
  caseWorkAssistId,
  meetingPrepId,
  fieldKey,
  from,
  to,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const prepId = normalizeId(meetingPrepId);
  if (!owner || !caseId || !prepId) throw notFound();

  const key = normalizeFieldKey(fieldKey);
  const source = normalizeProvenance(from);
  const target = normalizeProvenance(to);
  /* Suunakontroll EI OLE siin — ta käib 404 JÄREL, `confirmProvenanceRow()` sees.
     Vt sealset selgitust: võõras töötaja peab saama 404, mitte 400. */

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    await requirePrepInCase({ db: tx, caseWorkAssistId: caseId, meetingPrepId: prepId, select: { id: true } });
    await confirmProvenanceRow({
      tx,
      model: "caseWorkMeetingPrepField",
      where: { meetingPrepId: prepId, fieldKey: key },
      from: source,
      to: target
    });
    return tx.caseWorkMeetingPrepField.findFirst({
      where: { meetingPrepId: prepId, fieldKey: key },
      select: FIELD_SELECT
    });
  });
}

export async function confirmQuestionProvenance({
  ownerUserId,
  caseWorkAssistId,
  meetingPrepId,
  questionId,
  from,
  to,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const prepId = normalizeId(meetingPrepId);
  const id = normalizeId(questionId);
  if (!owner || !caseId || !prepId || !id) throw notFound();

  const source = normalizeProvenance(from);
  const target = normalizeProvenance(to);
  /* Suunakontroll EI OLE siin — ta käib 404 JÄREL, `confirmProvenanceRow()` sees.
     Vt sealset selgitust: võõras töötaja peab saama 404, mitte 400. */

  return withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    await requirePrepInCase({ db: tx, caseWorkAssistId: caseId, meetingPrepId: prepId, select: { id: true } });
    await confirmProvenanceRow({
      tx,
      model: "caseWorkQuestion",
      where: { id, meetingPrepId: prepId },
      from: source,
      to: target
    });
    return tx.caseWorkQuestion.findFirst({ where: { id, meetingPrepId: prepId }, select: QUESTION_SELECT });
  });
}

/**
 * KONTROLLI JÄRJEKORD ON TÄHENDUSEGA, mitte suvaline.
 *
 * `from = inimene, to = AI_MUSTAND` rikub mõlemat reeglit korraga ja kutsuja
 * näeb ainult esimest viga. Sihi reegel käib EES, sest ta on absoluutne — masina
 * märgise juurde ei minda tagasi ühegi lähtekoha pealt. Lähte reegel on
 * kontekstuaalne („seda rida ei ole vaja kinnitada"). Vale järjekord ütleks
 * inimesele, kes üritab oma kinnitust tagasi võtta, et probleem on lähtekohas —
 * ja ta prooviks uuesti teise `from`-iga.
 */
function assertConfirmDirection(from, to) {
  if (to === PROVENANCE.AI_MUSTAND) throw badRequest("casework.errors.provenance_confirm_target");
  if (from !== PROVENANCE.AI_MUSTAND) throw badRequest("casework.errors.provenance_confirm_source");
}
