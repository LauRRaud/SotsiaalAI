/**
 * JTA-V1 (E6) — „Kopeeri STAR2 jaoks" + ülekandeajalugu.
 *
 * Leping: docs/platvormi arendus/jta-v1-arendusleping.md (v6), etapp E6.
 * Kirjeldus: `ideed.md` ptk 4.5 (kaheksa elementi) + ptk 2.2 (kuus seisu).
 *
 * KUUS REEGLIT, MIS ON SIIN ARHITEKTUUR:
 *
 *   L9 — KOPEERIMINE EI OLE ÜLEKANNE. Kaks tegu, kaks nime, kaks tagajärge.
 *        `COPIED_FOR_STAR2` ütleb, et tekst läks lõikelauale; `MARKED_AS_TRANSFERRED`
 *        ütleb, et INIMENE avaldas, et info on STAR-is. Kui kopeerimine märgiks
 *        automaatselt „üle kantud", käivituks L7 säilituskell hetkest, mil keegi
 *        ainult vaatas, ja mustand kustuks, ilma et ta oleks kuhugi jõudnud.
 *
 *   L8 — AUDIT ON FAKT + VÄLJADE LOEND, MITTE SNAPSHOT. Siin ei salvestata ühtegi
 *        välja VÄÄRTUST. Täissnapshot elaks üle E7 sisu-purge'i ja oleks
 *        varju-register, ehitatud selle mehhanismi sisse, mis pidi teda ära
 *        hoidma.
 *
 *   L16 — AUDIT SÜNNIB PÄRAST TEGU, MITTE ENNE. Järjekord on plokk → lõikelaud →
 *        `recordCopyEvent`. Seda jõustab KLIENT (`DraftSection.jsx`), sest ainult
 *        tema teab, kas `navigator.clipboard.writeText` õnnestus. Teenuskihi
 *        vastutus on, et see rada oleks korduvohutu — vt L22.
 *
 *   L18 — `markTransferred` ON ÜKS TEHING. Kolm asja sünnivad koos või ei sünni
 *        üldse: tingimuslik siire, `transferredAt` ja auditirida. Ilma selleta
 *        oleks võimalik mustand `ULE_KANTUD` ilma auditireata (säilituskell
 *        käiks tõendita) või auditirida ilma siirdeta (audit valetaks).
 *
 *   L19 — `markTransferred` ON AINUS TEE `ULE_KANTUD`-ini. Ta kasutab SAMA
 *        primitiivi mis `transitionDraft()` (`draftTransition.js`), teist ust ei
 *        ole.
 *
 *   L22 — KOPEERIMINE ON KORDUVOHUTU. Kui `POST` läheb välja ja vastus ei jõua
 *        tagasi, ei tea klient, kas rida tekkis — ja append-only tabel võtaks
 *        korduse vastu. Kaks auditirida ühe päris kopeerimise kohta on sama katki
 *        nagu puuduv rida, ainult vastupidises suunas. Jõustaja on UNIKAALNE
 *        INDEKS `[draftId, clientActionId]`, mitte „kas on juba olemas" kontroll:
 *        see oleks sama loe-kontrolli-kirjuta muster, mille L21 äsja maha võttis.
 *
 * MIDA SIIN EI OLE JA MIKS. `updateTransferEvent` ja `deleteTransferEvent`
 * PUUDUVAD TEADLIKULT (L8: tabel on append-only). Nende puudumist kontrollib
 * test, mitte see kommentaar — „ei ole marsruuti" ei ole sama, mis „ei ole teed".
 */

import prismaClient from "@/lib/prisma";

import { emitDomainEvent } from "@/lib/events/emitDomainEvent";
import { DomainEventType } from "@/lib/events/registry";
import { serverT } from "@/lib/i18n/serverMessages";
import { STAR2_TRANSFER_STATE } from "@/lib/workspaces/provenance";

import { withActiveCaseLock } from "./caseWorkAssist.js";
import { badRequest, notFound } from "./errors.js";
import { isCaseWorkEnabled } from "./flags.js";
import { transitionDraftStateTx } from "./draftTransition.js";
import { normalizeLimit } from "./paging.js";

/** L9 kaks tegu. Sama hulk mis `CaseWorkTransferEventKind` skeemis. */
export const TRANSFER_EVENT_KIND = Object.freeze({
  COPIED_FOR_STAR2: "COPIED_FOR_STAR2",
  MARKED_AS_TRANSFERRED: "MARKED_AS_TRANSFERRED"
});

const FIELD_KEY_SHAPE = /^[A-Z][A-Z0-9_]*$/;
const FIELD_KEYS_MAX = 128;
/** RFC 4122 kuju, väiketähtedega — sama muster mis migratsiooni `CHECK`-il. */
const ACTION_KEY_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LIST_LIMIT_DEFAULT = 25;
const LIST_LIMIT_MAX = 100;

/**
 * L20 valge nimekiri. `ownerUserId` EI OLE siin: ta on päringu tingimus, mitte
 * vastuse sisu, ja kutsuja teab teda niikuinii — tema oma see on.
 */
const EVENT_SELECT = Object.freeze({
  id: true,
  caseWorkAssistId: true,
  draftId: true,
  actorUserId: true,
  kind: true,
  draftType: true,
  transferStateAtEvent: true,
  fieldKeys: true,
  createdAt: true
});

function requireEnabled() {
  if (!isCaseWorkEnabled()) throw notFound();
}

function normalizeId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isUniqueConflict(error) {
  return error?.code === "P2002" || error?.name === "UniqueConstraintError";
}

/**
 * `clientActionId` sünnib KLIENDIS enne lõikelauale kirjutust (L22). Serveris
 * genereeritud võti oleks iga kutse peale uus ja ei kaitseks millegi eest.
 *
 * Kuju kontrollitakse, sest kliendilt tulnud vaba string on väli, mille kasutaja
 * saab ise valida — sinna mahuks ajatempel või `fieldKey`, millest saaks sisu
 * tuletada. Läbipaistmatu võti on läbipaistmatu ainult siis, kui ta on kontrollitud.
 */
function normalizeActionKey(value) {
  const key = normalizeId(value);
  if (!key || !ACTION_KEY_SHAPE.test(key.toLowerCase())) {
    throw badRequest("casework.errors.transfer_action_key_invalid");
  }
  return key.toLowerCase();
}

function normalizeFieldKeys(value) {
  if (!Array.isArray(value)) throw badRequest("casework.errors.transfer_field_keys_required");

  const keys = [];
  for (const raw of value) {
    const key = normalizeId(raw);
    if (!key || !FIELD_KEY_SHAPE.test(key)) throw badRequest("casework.errors.draft_field_key_invalid");
    if (!keys.includes(key)) keys.push(key);
  }

  /* TÜHI LOEND ON 400, MITTE TÜHI RIDA. „Kopeerisin mitte midagi" ei ole tegu,
     mille kohta tõendit hoida — ja auditirida ilma väljadeta oleks hiljem
     eristamatu reast, mille väljad kadusid. */
  if (!keys.length) throw badRequest("casework.errors.transfer_field_keys_required");
  if (keys.length > FIELD_KEYS_MAX) throw badRequest("casework.errors.transfer_field_keys_too_many");
  return keys;
}

async function requireVisibleCase({ db, ownerUserId, caseWorkAssistId }) {
  const row = await db.caseWorkAssist.findFirst({
    where: { id: caseWorkAssistId, ownerUserId },
    select: { id: true }
  });
  if (!row) throw notFound();
  return row;
}

/** Mustand kuulub SELLESSE juhtumisse, mis URL-is on — vt sama selgitust E3/E4/E5-s. */
async function requireDraftInCase({ db, caseWorkAssistId, draftId }) {
  const draft = await db.caseWorkDraft.findFirst({
    where: { id: draftId, caseWorkAssistId },
    select: {
      id: true,
      draftType: true,
      transferState: true,
      transferredAt: true,
      contentPurgedAt: true
    }
  });
  if (!draft) throw notFound();
  return draft;
}

/* ────────────────────────────────────────────────────────────────────────────
   PLOKK — mida inimene lõikelauale viib
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * STAR2 plokk mustandi väljadest.
 *
 * ESIMENE RIDA ON HOIATUS ja ta ei ole viisakus: plokk läheb lõikelaualt
 * kuhugi, kus keegi teine võib teda lugeda ilma konteksti nägemata. Ametlik
 * kanne sünnib STAR-is, mitte siin — ja tekst, mis seda ei ütle, näeb välja
 * nagu ametlik kanne.
 *
 * SEE FUNKTSIOON EI TUNNE `PRIVAATNE_REFLEKSIOON` KIHTI ja see ei ole
 * kontrollirida, vaid STRUKTUUR: märkme kihid (E4) ja mustandi väljad (E5)
 * elavad eri tabelites ning ainus tee märkmest mustandisse käib läbi
 * `listTransferableEntries()`, mille `WHERE` kannab `STAR2_KANTAV`-i
 * KONSTANDINA. Siia ei jõua privaatne kiht ka siis, kui keegi teda küsib.
 */
export async function buildStar2Block({
  ownerUserId,
  caseWorkAssistId,
  draftId,
  locale = "et",
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const id = normalizeId(draftId);
  if (!owner || !caseId || !id) throw notFound();

  await requireVisibleCase({ db, ownerUserId: owner, caseWorkAssistId: caseId });
  const draft = await requireDraftInCase({ db, caseWorkAssistId: caseId, draftId: id });

  const fields = await db.caseWorkDraftField.findMany({
    where: { draftId: id },
    select: { fieldKey: true, text: true },
    orderBy: [{ fieldKey: "asc" }]
  });

  const warning = serverT(locale, "casework.transfer.block_warning");
  const body = fields.map((field) => `${field.fieldKey}: ${field.text}`);

  return {
    draftId: draft.id,
    draftType: draft.draftType,
    transferState: draft.transferState,
    /* Purge'itud mustand annab ausalt tühja loendi: sisu on kustunud, rida ja
       tõend on alles (L7). Kopeerimine sellest annab 400 — vt `recordCopyEvent`. */
    contentPurgedAt: draft.contentPurgedAt || null,
    fieldKeys: fields.map((field) => field.fieldKey),
    text: [warning, "", ...body].join("\n")
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   KOPEERIMISE AUDIT (L16, L22)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Auditirida kopeerimise kohta, mis JUBA TOIMUS.
 *
 * KIRJUTUSKAITSTUD JUHTUM EI BLOKEERI SEDA ja see on teadlik erand
 * `withActiveCaseLock`-ist. Kopeerimine on LUGEMISTEGU: `READ_ONLY` juhtumist
 * tohib töötaja oma materjali STAR-i viia — see on täpselt see, mida ta enne
 * arhiveerimist tegema peabki. Kui kirjutuskaitse blokeeriks auditi, jääks tegu
 * ise alles ja kaoks ainult tema JÄLG (L8: tõendi vaikne kadu on halvem kui
 * nähtav). Sama põhjendust kannab `CaseWorkRetentionAudit`, mis sünnib samuti
 * mitte-`ACTIVE` juhtumitel.
 *
 * KORDUS ANNAB 200, MITTE 409 (L22). Kasutaja tegi ühe teo ja peab nägema ühte
 * tulemust; 409 sunniks liidese seletama viga, mida ei ole.
 *
 * @returns {{ created: boolean, event: object }}
 */
export async function recordCopyEvent({
  ownerUserId,
  caseWorkAssistId,
  draftId,
  fieldKeys,
  clientActionId,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const id = normalizeId(draftId);
  if (!owner || !caseId || !id) throw notFound();

  const keys = normalizeFieldKeys(fieldKeys);
  const actionKey = normalizeActionKey(clientActionId);

  await requireVisibleCase({ db, ownerUserId: owner, caseWorkAssistId: caseId });
  const draft = await requireDraftInCase({ db, caseWorkAssistId: caseId, draftId: id });

  /* VÄLJAD PEAVAD KUULUMA SELLELE MUSTANDILE. Ilma selleta kirjutaks kutsuja
     auditisse võtmeid, mida ta ei kopeerinud — ja audit oleks tõend teo kohta,
     mida ei toimunud. */
  const existing = await db.caseWorkDraftField.findMany({
    where: { draftId: id },
    select: { fieldKey: true }
  });
  const known = new Set(existing.map((row) => row.fieldKey));
  if (keys.some((key) => !known.has(key))) {
    throw badRequest("casework.errors.transfer_field_keys_unknown");
  }

  const data = {
    caseWorkAssistId: caseId,
    draftId: id,
    ownerUserId: owner,
    actorUserId: owner,
    kind: TRANSFER_EVENT_KIND.COPIED_FOR_STAR2,
    draftType: draft.draftType,
    /* TEO HETKE seis (L8), mitte praegune: mustand liigub edasi ja auditirida
       peab ütlema, mis seisus ta TOL HETKEL oli. */
    transferStateAtEvent: draft.transferState,
    fieldKeys: keys,
    clientActionId: actionKey
  };

  try {
    const event = await db.caseWorkTransferEvent.create({ data, select: EVENT_SELECT });
    return { created: true, event };
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;

    /* JÕUSTAJA ON INDEKS, mitte see haru. Siia jõutakse alles PÄRAST seda, kui
       andmebaas on korduse tagasi lükanud — enne kirjutust ei küsita midagi. */
    const event = await db.caseWorkTransferEvent.findFirst({
      where: { draftId: id, clientActionId: actionKey },
      select: EVENT_SELECT
    });
    if (!event) throw error;
    return { created: false, event };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   ÜLEKANTUKS MÄRKIMINE (L18, L19)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Ainus tee `ULE_KANTUD`-ini.
 *
 * KOLM ASJA ÜHES TEHINGUS: tingimuslik siire (`expectedFrom` → 409, kui keegi
 * jõudis ette), `transferredAt` ja auditirida. `withActiveCaseLock()` on
 * väljaspool neid kolme, sest mustandi seisu muutmine ON juhtumi lapse kirjutus
 * (L21) — ja tema jõustaja peab olema kirjutusega samas atomaarses piiris.
 *
 * U1 SÜNDMUS EMITEERITAKSE PÄRAST COMMIT'i (L18). Tehingu sees emiteeritud
 * sündmus jõuaks välja ka siis, kui tehing hiljem tagasi veereb — ja
 * „üle kantud" sündmus ülekande kohta, mida ei toimunud, on halvem kui puuduv
 * sündmus. Emiteerimise TÕRGE ei veereta ülekannet tagasi: tõend (L8 auditirida)
 * on juba tehingus sees, sündmus on ajajoone fakt.
 */
export async function markTransferred({
  ownerUserId,
  caseWorkAssistId,
  draftId,
  expectedFrom,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const id = normalizeId(draftId);
  if (!owner || !caseId || !id) throw notFound();

  const from = normalizeId(expectedFrom);

  const result = await withActiveCaseLock({ ownerUserId: owner, caseWorkAssistId: caseId, db }, async (tx) => {
    /* 404 KÄIB VALIDEERIMISE EES — võõras mustand ei tohi anda teistsugust viga
       kui olematu mustand. Sama järjekord mis E3/E5-l. */
    const draft = await requireDraftInCase({ db: tx, caseWorkAssistId: caseId, draftId: id });

    await transitionDraftStateTx(tx, {
      draftId: id,
      expectedFrom: from,
      to: STAR2_TRANSFER_STATE.ULE_KANTUD
    });

    const event = await tx.caseWorkTransferEvent.create({
      data: {
        caseWorkAssistId: caseId,
        draftId: id,
        ownerUserId: owner,
        actorUserId: owner,
        kind: TRANSFER_EVENT_KIND.MARKED_AS_TRANSFERRED,
        draftType: draft.draftType,
        /* Seis, MILLEST märgiti — `ULE_KANTUD` oleks tautoloogia, sest just seda
           see rida tähendabki. */
        transferStateAtEvent: from,
        /* L22 ulatus on ainult kopeerimine: siin kaitseb tingimuslik siire ja
           teine kaitse ainult varjaks, kumb töötab. `null` ei põrka `null`-iga. */
        fieldKeys: [],
        clientActionId: null
      },
      select: EVENT_SELECT
    });

    const draftAfter = await tx.caseWorkDraft.findFirst({
      where: { id, caseWorkAssistId: caseId },
      select: {
        id: true,
        caseWorkAssistId: true,
        draftType: true,
        transferState: true,
        reviewKind: true,
        transferredAt: true,
        contentPurgedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return { draft: draftAfter, event };
  });

  await emitTransferMarked({ db, ownerUserId: owner, caseWorkAssistId: caseId, event: result.event });
  return result;
}

/**
 * U1 sündmus PÄRAST edukat commit'i.
 *
 * TÕRGE EI KUKUTA OPERATSIOONI. Ülekanne on tehtud ja tema tõend on andmebaasis;
 * erind siin ütleks kasutajale, et tegu ebaõnnestus, ja ta märgiks sama mustandi
 * uuesti — sealt tuleks 409, sest esimene kord õnnestus. Logi kannab ainult
 * konstante (sündmuse tüüp, erindi klass), mitte sisu — sama reegel mis laual.
 */
async function emitTransferMarked({ db, ownerUserId, caseWorkAssistId, event }) {
  try {
    await db.$transaction((tx) =>
      emitDomainEvent(tx, {
        type: DomainEventType.CASEWORK_DRAFT_EXTERNAL_TRANSFER_MARKED,
        actorKind: "user",
        actorUserId: ownerUserId,
        sourceId: event.draftId,
        workspaceId: caseWorkAssistId,
        actionTarget: `case_work:${caseWorkAssistId}`,
        /* Auditirea id teeb võtme kordumatuks PÄRIS teo kohta: kordus sama
           mustandi peal annaks niikuinii 409 ja siia ei jõuaks. */
        idempotencyKey: `casework.draft.external_transfer_marked:${event.id}`
      })
    );
  } catch (error) {
    console.error("[casework/transfer] domain event failed", {
      type: DomainEventType.CASEWORK_DRAFT_EXTERNAL_TRANSFER_MARKED,
      error: error?.name || "Error",
      code: error?.code || null
    });
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   AJALUGU
   ──────────────────────────────────────────────────────────────────────────── */

/** Ühe juhtumi ülekandeajalugu, uuemad ees. */
export async function listTransferEvents({
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

  const rows = await db.caseWorkTransferEvent.findMany({
    where: { caseWorkAssistId: caseId, ownerUserId: owner },
    select: EVENT_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {})
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

/**
 * Laua sektsioon #10 (L12) — omaniku ülekandeajalugu kõigi juhtumite peale.
 *
 * LUGEJA ON SIIN, MITTE LAUAS (L10): laud ei kirjuta ühtegi oma `findMany`-t,
 * sest just nii tekkis 04.08 IDOR — koondvaade tegi oma päringu ja unustas
 * skoobi. `ownerUserId` on siin päringu tingimus, mitte filter vastuse peal.
 */
export async function listTransferEventsForOwner({
  ownerUserId,
  limit = LIST_LIMIT_DEFAULT,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  if (!owner) return { items: [] };

  const take = normalizeLimit(limit, { fallback: LIST_LIMIT_DEFAULT, max: LIST_LIMIT_MAX });
  const items = await db.caseWorkTransferEvent.findMany({
    where: { ownerUserId: owner },
    select: EVENT_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take
  });
  return { items };
}

/* `updateTransferEvent` ja `deleteTransferEvent` PUUDUVAD (L8: append-only).
   Neid ei tohi „sümmeetria pärast" juurde kirjutada — tõend, mida saab muuta,
   ei ole tõend. */
