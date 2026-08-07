/**
 * JUHTUM-V1 (CASEWORK-P7) — juhtumi teenuskiht.
 *
 * Leping: docs/platvormi arendus/juhtum-v1-arendusleping.md (v6), etapp E2.
 *
 * KOLM ASJA, MIS SIIN ON JA MIDA MARSRUUT EI TOHI DUBLEERIDA:
 *
 *   1. OMANIKUPIIR (L2). Iga päring kannab `ownerUserId`-d ja võõras juhtum
 *      annab 404, mitte 403 — vt `errors.js`. Marsruut ei kontrolli omandit ise;
 *      kaks kontrolli tähendaks kaht tõde ja üks neist vananeks.
 *   2. KIRJUTUSKEELUD (L14). `READ_ONLY` ja `ARCHIVED` juhtumit ei muudeta —
 *      ja seda EI kontrollita loe-siis-kirjuta mustriga, vaid TINGIMUSLIKU
 *      update'iga, mis õnnestub ainult siis, kui seis on ikka veel `ACTIVE`.
 *      Vahepeal tehtud retention-siire peab kirjutuse tapma, mitte kaotama.
 *   3. KUVANIMI (L10) on tuletatud, mitte salvestatud. Kolmandat identiteedivälja
 *      andmebaasi ei teki ja kliendi nime siia tabelisse ei kopeerita.
 */

import prismaClient from "@/lib/prisma";
import { logDataAudit } from "@/lib/privacy/audit.js";

import { badRequest, conflict, featureDisabled, notFound } from "./errors.js";
import { isCaseWorkEnabled } from "./flags.js";

export const RETENTION_STATE = Object.freeze({
  ACTIVE: "ACTIVE",
  READ_ONLY: "READ_ONLY",
  ARCHIVED: "ARCHIVED"
});

/**
 * Lubatud siirded (L14). ÜHESUUNALINE ja tagasiteed ei ole: `ARCHIVED` on
 * lõppseis. Tagasisiire tähendaks, et kirjutuskaitse on soovitus, mitte piir.
 */
export const RETENTION_TRANSITIONS = Object.freeze({
  [RETENTION_STATE.ACTIVE]: Object.freeze([RETENTION_STATE.READ_ONLY]),
  [RETENTION_STATE.READ_ONLY]: Object.freeze([RETENTION_STATE.ARCHIVED]),
  [RETENTION_STATE.ARCHIVED]: Object.freeze([])
});

/** Kuvanime allikas — UI ja adapter loevad SEDA, mitte ei arva ise. */
export const LABEL_SOURCE = Object.freeze({
  ERASED: "ERASED",
  CLIENT_ACCOUNT: "CLIENT_ACCOUNT",
  DISPLAY_NAME: "DISPLAY_NAME",
  EXTERNAL_REF: "EXTERNAL_REF",
  UNTITLED: "UNTITLED"
});

const DISPLAY_NAME_MAX = 120;
const EXTERNAL_REF_MAX = 120;
const EXTERNAL_REFERENCE_MAX = 120;
const REASON_MAX = 500;
const LIST_LIMIT_DEFAULT = 25;
const LIST_LIMIT_MAX = 100;

/** V1-s on lubatud ainult STAR2 (L6). */
const EXTERNAL_SYSTEMS = Object.freeze(["STAR2"]);

const ASSIST_SELECT = Object.freeze({
  id: true,
  ownerUserId: true,
  preInquiryId: true,
  urgentRequestId: true,
  clientUserId: true,
  clientDisplayName: true,
  clientExternalRef: true,
  clientErasedAt: true,
  externalSystem: true,
  externalReference: true,
  nextContactAt: true,
  retentionState: true,
  createdAt: true,
  updatedAt: true
});

function requireEnabled() {
  if (!isCaseWorkEnabled()) throw featureDisabled();
}

function trimmedOrNull(value, max, messageKey) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) throw badRequest(messageKey);
  return text;
}

function normalizeId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/* ────────────────────────────────────────────────────────────────────────────
   KUVANIMI (L10)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Juhtumi kuvanimi — TULETATUD, mitte salvestatud.
 *
 * Tagastab kirjelduse, mitte valmis teksti: `text` on inimese enda sisestatud
 * või lahendatud väärtus, `labelKey` on tõlkevõti nendeks juhtudeks, kus teksti
 * EI OLE. Nii ei satu tõlkimine teenuskihti ja andmebaasist ei tule kunagi
 * renderdatavat stringi (T21 P0 õppetund).
 *
 * JÄRJESTUS ON LEPINGUST JA TEDA EI TOHI ÜMBER TÕSTA:
 *   1. kustutatud kliendiviide VÕIDAB KÕIK — ka lahendatud nime;
 *   2. rada A: lugemise ajal lahendatud kliendi nimi;
 *   3. rada B kuvanimi;
 *   4. rada B välisviide;
 *   5. „Nimetu juhtum".
 *
 * Punkt 2 on v4 auditi parandus. Ilma temata saaks IGA platvormi kasutajaga
 * seotud juhtum kuvanimeks „Nimetu juhtum", sest L11 nõuab rada A puhul, et
 * vabatekstiväljad on tühjad — ja loendis muutuksid kõik sellised juhtumid
 * üksteisest eristamatuks.
 *
 * @param {object} row juhtumi rida
 * @param {string|null} resolvedClientName `resolveClientNames()` tulemus SELLE rea kohta
 */
export function caseDisplayLabel(row, resolvedClientName = null) {
  if (row?.clientErasedAt) return { source: LABEL_SOURCE.ERASED, text: null, labelKey: "casework.label.erased_client" };

  const resolved = typeof resolvedClientName === "string" ? resolvedClientName.trim() : "";
  if (row?.clientUserId && resolved) return { source: LABEL_SOURCE.CLIENT_ACCOUNT, text: resolved, labelKey: null };

  const displayName = typeof row?.clientDisplayName === "string" ? row.clientDisplayName.trim() : "";
  if (displayName) return { source: LABEL_SOURCE.DISPLAY_NAME, text: displayName, labelKey: null };

  const externalRef = typeof row?.clientExternalRef === "string" ? row.clientExternalRef.trim() : "";
  if (externalRef) return { source: LABEL_SOURCE.EXTERNAL_REF, text: externalRef, labelKey: null };

  /* Rada A ilma lahendatud nimeta jõuab SIIA — see on tahtlik. Kui kliendi
     profiil ei ole enam nähtav, ei tohi kuvada vana nime; „Nimetu juhtum" on
     aus vastus, vahemälust võetud nimi ei oleks. */
  return { source: LABEL_SOURCE.UNTITLED, text: null, labelKey: "casework.label.untitled" };
}

/**
 * Lahendab rada A kliendinimed HULGI.
 *
 * Üks päring loendi kohta, mitte üks rea kohta: N+1 tapaks juhtumiloendi kohe,
 * kui töötajal on rohkem kui käputäis juhtumeid. Kustutatud kliendiviitega ridu
 * ei küsita üldse — nende nimi ei tohi kuhugi jõuda.
 */
export async function resolveClientNames(rows, { db = prismaClient } = {}) {
  const ids = [
    ...new Set(
      (Array.isArray(rows) ? rows : [])
        .filter((row) => row?.clientUserId && !row?.clientErasedAt)
        .map((row) => String(row.clientUserId))
    )
  ];
  if (!ids.length) return new Map();

  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, profile: { select: { firstName: true, lastName: true } } }
  });

  const names = new Map();
  for (const user of users) {
    const name = [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(" ").trim();
    if (name) names.set(user.id, name);
  }
  return names;
}

/* ────────────────────────────────────────────────────────────────────────────
   VALIDEERIMINE
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Kliendi kaks rada (L11). Andmebaasis on sama reegel CHECK-ina — siin on ta
 * selleks, et kasutaja saaks arusaadava vea, mitte piirangu nime.
 */
function normalizeClientTrack({ clientUserId, clientDisplayName, clientExternalRef }) {
  const userId = normalizeId(clientUserId);
  const displayName = trimmedOrNull(clientDisplayName, DISPLAY_NAME_MAX, "casework.errors.display_name_too_long");
  const externalRef = trimmedOrNull(clientExternalRef, EXTERNAL_REF_MAX, "casework.errors.external_ref_too_long");

  if (userId && (displayName || externalRef)) throw badRequest("casework.errors.client_track_conflict");
  return { clientUserId: userId, clientDisplayName: displayName, clientExternalRef: externalRef };
}

/** STAR-i viide: mõlemad või kumbki, ja ainult STAR2 (L6). */
function normalizeExternalReference({ externalSystem, externalReference }) {
  const system = normalizeId(externalSystem);
  const reference = trimmedOrNull(
    externalReference,
    EXTERNAL_REFERENCE_MAX,
    "casework.errors.external_reference_too_long"
  );

  if (Boolean(system) !== Boolean(reference)) throw badRequest("casework.errors.external_reference_incomplete");
  if (system && !EXTERNAL_SYSTEMS.includes(system)) throw badRequest("casework.errors.external_system_unsupported");
  return { externalSystem: system, externalReference: reference };
}

/**
 * Päritolu (L12): maksimaalselt üks, ja ta peab olema omaniku NÄHTAVAS skoobis.
 *
 * „Objekt on olemas" ei ole alus — töötaja tohib juhtumi siduda ainult
 * pöördumisega, mis talle päriselt saadeti või mille lauale ta kuulub. Muidu
 * saaks võõra ID-ga kontrollida, kas selline pöördumine eksisteerib.
 *
 * Tagastab ka päritoluobjekti AUTORI, sest rada A ainus lubatud väärtus on tema.
 */
async function resolveOrigin({ db, ownerUserId, preInquiryId, urgentRequestId }) {
  const preId = normalizeId(preInquiryId);
  const urgentId = normalizeId(urgentRequestId);
  if (preId && urgentId) throw badRequest("casework.errors.origin_conflict");
  if (!preId && !urgentId) return { preInquiryId: null, urgentRequestId: null, authorId: null };

  if (preId) {
    const preInquiry = await db.preInquiry.findFirst({
      where: { id: preId, recipientOwnerId: ownerUserId },
      select: { id: true, authorId: true }
    });
    if (!preInquiry) throw notFound("casework.errors.origin_not_found");
    return { preInquiryId: preInquiry.id, urgentRequestId: null, authorId: preInquiry.authorId || null };
  }

  const request = await db.urgentRequest.findFirst({
    where: {
      id: urgentId,
      desk: {
        OR: [{ ownerUserId }, { members: { some: { userId: ownerUserId, isActive: true } } }]
      }
    },
    select: { id: true, authorId: true }
  });
  if (!request) throw notFound("casework.errors.origin_not_found");
  return { preInquiryId: null, urgentRequestId: request.id, authorId: request.authorId || null };
}

/* ────────────────────────────────────────────────────────────────────────────
   LUGEMINE
   ──────────────────────────────────────────────────────────────────────────── */

export async function getCaseWorkAssist({ ownerUserId, id, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(id);
  if (!owner || !caseId) throw notFound();

  const row = await db.caseWorkAssist.findFirst({ where: { id: caseId, ownerUserId: owner }, select: ASSIST_SELECT });
  if (!row) throw notFound();

  const names = await resolveClientNames([row], { db });
  return { ...row, label: caseDisplayLabel(row, names.get(row.clientUserId) || null) };
}

/**
 * Juhtumiloend, cursor-pagineeritud.
 *
 * SORTIMISVÕTI ON STABIILNE: `updatedAt DESC, id DESC`. Ainult kuupäevast ei
 * piisa — kaks samal millisekundil muudetud juhtumit annaksid ebastabiilse
 * järjestuse ja cursor kas kordaks või hüppaks ridadest üle.
 */
export async function listCaseWorkAssists({
  ownerUserId,
  cursor = null,
  limit = LIST_LIMIT_DEFAULT,
  retentionState = null,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  if (!owner) return { items: [], nextCursor: null };

  const take = Math.min(Math.max(Number(limit) || LIST_LIMIT_DEFAULT, 1), LIST_LIMIT_MAX);
  const cursorId = normalizeId(cursor);

  const rows = await db.caseWorkAssist.findMany({
    where: { ownerUserId: owner, ...(retentionState ? { retentionState } : {}) },
    select: ASSIST_SELECT,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {})
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const names = await resolveClientNames(page, { db });

  return {
    items: page.map((row) => ({ ...row, label: caseDisplayLabel(row, names.get(row.clientUserId) || null) })),
    nextCursor: hasMore ? page[page.length - 1].id : null
  };
}

/**
 * JTA-V1 (E1) — juhtumid, millel on JÄRGMINE KONTAKT, ajajärjestuses.
 *
 * MIKS OMA LUGEJA, MITTE `listCaseWorkAssists()` PARAMEETER: see päring sordib
 * `nextContactAt ASC`, mitte `updatedAt DESC`. Indeks
 * `[ownerUserId, nextContactAt]` on skeemis olemas juba JUHTUM-V1-st ja seni
 * lugejata — laud on tema esimene kasutaja.
 *
 * MIKS SIIN, MITTE LAUAS (leping L10): omanikupiir elab selles moodulis. Laud,
 * mis kirjutaks oma `findMany`-t, päriks 04.08 IDOR-i mustri — koondvaade tegi
 * oma päringu ja unustas skoobi.
 *
 * AINULT `ACTIVE`. Kirjutuskaitstud ja arhiveeritud juhtumil ei ole „järgmist
 * kontakti" — tema töö on lõppenud, ja tema kuupäeva näitamine tekitaks
 * ülesande, mida keegi teha ei saa.
 *
 * @param {Date} [from] alumine piir (kaasa arvatud). Vaikimisi „nüüd".
 * @param {Date} [until] ülemine piir (välja arvatud). `null` = piirita.
 */
export async function listUpcomingContacts({
  ownerUserId,
  from = null,
  until = null,
  limit = LIST_LIMIT_DEFAULT,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  if (!owner) return { items: [] };

  const take = Math.min(Math.max(Number(limit) || LIST_LIMIT_DEFAULT, 1), LIST_LIMIT_MAX);
  const lower = from instanceof Date ? from : new Date();

  const rows = await db.caseWorkAssist.findMany({
    where: {
      ownerUserId: owner,
      retentionState: RETENTION_STATE.ACTIVE,
      nextContactAt: { gte: lower, ...(until instanceof Date ? { lt: until } : {}) }
    },
    select: ASSIST_SELECT,
    orderBy: [{ nextContactAt: "asc" }, { id: "asc" }],
    take
  });

  const names = await resolveClientNames(rows, { db });
  return {
    items: rows.map((row) => ({ ...row, label: caseDisplayLabel(row, names.get(row.clientUserId) || null) }))
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   KIRJUTAMINE
   ──────────────────────────────────────────────────────────────────────────── */

export async function createCaseWorkAssist({
  ownerUserId,
  preInquiryId = null,
  urgentRequestId = null,
  clientUserId = null,
  clientDisplayName = null,
  clientExternalRef = null,
  externalSystem = null,
  externalReference = null,
  nextContactAt = null,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  if (!owner) throw badRequest();

  const client = normalizeClientTrack({ clientUserId, clientDisplayName, clientExternalRef });
  const external = normalizeExternalReference({ externalSystem, externalReference });
  const origin = await resolveOrigin({ db, ownerUserId: owner, preInquiryId, urgentRequestId });

  /* RADA A ALUS (L11): `clientUserId` tohib olla ainult päritoluobjekti autor.
     „Kasutaja eksisteerib" ei ole alus — vastasel juhul saaks töötaja siduda
     oma juhtumiga suvalise konto. Kliendiotsingut V1-s ei ole (O-JU-4). */
  if (client.clientUserId && client.clientUserId !== origin.authorId) {
    throw badRequest("casework.errors.client_account_not_origin_author");
  }

  const row = await db.caseWorkAssist.create({
    data: {
      ownerUserId: owner,
      preInquiryId: origin.preInquiryId,
      urgentRequestId: origin.urgentRequestId,
      ...client,
      ...external,
      nextContactAt: nextContactAt ? new Date(nextContactAt) : null
    },
    select: ASSIST_SELECT
  });

  const names = await resolveClientNames([row], { db });
  return { ...row, label: caseDisplayLabel(row, names.get(row.clientUserId) || null) };
}

/**
 * Aktiivse juhtumi muutmine.
 *
 * PÄRITOLU EI MUUDETA V1-s (L12): ta määratakse loomisel. Muutmine tähendaks,
 * et juhtumi lugu saab tagantjärele ümber kirjutada, ja rada A alus (autor)
 * muutuks koos temaga.
 */
export async function updateCaseWorkAssist({ ownerUserId, id, patch = {}, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(id);
  if (!owner || !caseId) throw notFound();

  if ("preInquiryId" in patch || "urgentRequestId" in patch) throw badRequest("casework.errors.origin_immutable");

  const current = await db.caseWorkAssist.findFirst({
    where: { id: caseId, ownerUserId: owner },
    select: ASSIST_SELECT
  });
  if (!current) throw notFound();

  const data = {};

  if ("clientUserId" in patch || "clientDisplayName" in patch || "clientExternalRef" in patch) {
    /* Kustutatud kliendiviidet ei taasta: CHECK keelaks selle nagunii, aga
       kasutaja peab saama põhjuse, mitte piirangu nime. */
    if (current.clientErasedAt) throw conflict("casework.errors.client_reference_erased");
    const client = normalizeClientTrack({
      clientUserId: "clientUserId" in patch ? patch.clientUserId : current.clientUserId,
      clientDisplayName: "clientDisplayName" in patch ? patch.clientDisplayName : current.clientDisplayName,
      clientExternalRef: "clientExternalRef" in patch ? patch.clientExternalRef : current.clientExternalRef
    });
    if (client.clientUserId && client.clientUserId !== current.clientUserId) {
      const authorId = current.preInquiryId
        ? (await db.preInquiry.findUnique({ where: { id: current.preInquiryId }, select: { authorId: true } }))?.authorId
        : current.urgentRequestId
          ? (await db.urgentRequest.findUnique({ where: { id: current.urgentRequestId }, select: { authorId: true } }))
              ?.authorId
          : null;
      if (client.clientUserId !== authorId) throw badRequest("casework.errors.client_account_not_origin_author");
    }
    Object.assign(data, client);
  }

  if ("externalSystem" in patch || "externalReference" in patch) {
    Object.assign(
      data,
      normalizeExternalReference({
        externalSystem: "externalSystem" in patch ? patch.externalSystem : current.externalSystem,
        externalReference: "externalReference" in patch ? patch.externalReference : current.externalReference
      })
    );
  }

  if ("nextContactAt" in patch) {
    data.nextContactAt = patch.nextContactAt ? new Date(patch.nextContactAt) : null;
  }

  if (!Object.keys(data).length) throw badRequest();

  /* TINGIMUSLIK UPDATE, mitte loe-kontrolli-kirjuta. Kui keegi viis juhtumi
     vahepeal `READ_ONLY`-sse, peab see kirjutus KUKKUMA — mitte võitma. */
  const result = await db.caseWorkAssist.updateMany({
    where: { id: caseId, ownerUserId: owner, retentionState: RETENTION_STATE.ACTIVE },
    data
  });
  if (!result?.count) throw conflict("casework.errors.not_active");

  return getCaseWorkAssist({ ownerUserId: owner, id: caseId, db });
}

/**
 * Retention-siire (L14) — PRIVILEGEERITUD OPERATSIOON, mitte tavaline update.
 *
 * Siire ja auditikirje sünnivad ÜHES TEHINGUS: audit, mis võib siirdest maha
 * jääda, ei ole audit. Tingimuslik update kannab ka võistlustingimust — kaks
 * samaaegset siiret ei saa mõlemad õnnestuda.
 */
export async function transitionRetention({ ownerUserId, id, toState, reason, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(id);
  if (!owner || !caseId) throw notFound();

  const target = normalizeId(toState);
  if (!target || !Object.hasOwn(RETENTION_TRANSITIONS, target)) throw badRequest("casework.errors.retention_unknown");

  const trimmedReason = trimmedOrNull(reason, REASON_MAX, "casework.errors.reason_too_long");
  if (!trimmedReason) throw badRequest("casework.errors.reason_required");

  const current = await db.caseWorkAssist.findFirst({
    where: { id: caseId, ownerUserId: owner },
    select: { id: true, retentionState: true }
  });
  if (!current) throw notFound();

  const allowed = RETENTION_TRANSITIONS[current.retentionState] || [];
  if (!allowed.includes(target)) throw conflict("casework.errors.retention_transition_forbidden");

  await db.$transaction(async (tx) => {
    const moved = await tx.caseWorkAssist.updateMany({
      where: { id: caseId, ownerUserId: owner, retentionState: current.retentionState },
      data: { retentionState: target }
    });
    if (!moved?.count) throw conflict("casework.errors.retention_transition_forbidden");

    await tx.caseWorkRetentionAudit.create({
      data: {
        caseWorkAssistId: caseId,
        ownerUserId: owner,
        actorUserId: owner,
        fromState: current.retentionState,
        toState: target,
        reason: trimmedReason
      }
    });
  });

  return getCaseWorkAssist({ ownerUserId: owner, id: caseId, db });
}

/* ────────────────────────────────────────────────────────────────────────────
   KLIENDIVIITE KUSTUTAMINE (L17)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Kustutab kliendiviite ühest juhtumist.
 *
 * **EI OLE aktiveerimisvärava taga** ja see on tahtlik: andmesubjekti õigus ei
 * tohi sõltuda sellest, kas tootefunktsioon on parasjagu sisse lülitatud. Kui
 * ridu on, peab neid saada tühjendada.
 *
 * **LUBATUD KÕIGIS RETENTION-OLEKUTES**, ka `READ_ONLY` ja `ARCHIVED` all —
 * see on ainus erand L14 kirjutuskeelust. Kirjutuskaitse kaitseb töötaja tööd,
 * mitte kolmanda isiku andmeid tema eest.
 *
 * **IDEMPOTENTNE KÕRVALMÕJUDENI**: kui `clientErasedAt` on juba määratud,
 * tagastab edu ilma andmeid muutmata JA ilma uue auditireata. Muidu tekitaks
 * konto kustutamise korduskatse iga korra kohta rea ja kustutusjälg näeks välja
 * korduva sündmusena.
 */
export async function eraseCaseClientReference({
  caseWorkAssistId,
  actorUserId = null,
  actorKind = "USER",
  reason,
  db = prismaClient
} = {}) {
  const caseId = normalizeId(caseWorkAssistId);
  if (!caseId) throw notFound();

  const trimmedReason = trimmedOrNull(reason, REASON_MAX, "casework.errors.reason_too_long");
  if (!trimmedReason) throw badRequest("casework.errors.reason_required");

  const current = await db.caseWorkAssist.findUnique({
    where: { id: caseId },
    select: { id: true, ownerUserId: true, clientErasedAt: true }
  });
  if (!current) throw notFound();
  if (current.clientErasedAt) return { ok: true, changed: false };

  const erasedAt = new Date();
  const changed = await db.$transaction(async (tx) => {
    const result = await tx.caseWorkAssist.updateMany({
      /* `clientErasedAt: null` tingimuses teeb operatsiooni ka VÕISTLUSE korral
         idempotentseks: kaks samaaegset kutset ei kirjuta kaks auditirida. */
      where: { id: caseId, clientErasedAt: null },
      data: { clientUserId: null, clientDisplayName: null, clientExternalRef: null, clientErasedAt: erasedAt }
    });
    if (!result?.count) return false;

    await tx.caseWorkClientErasureAudit.create({
      data: {
        caseWorkAssistId: caseId,
        ownerUserId: current.ownerUserId,
        actorUserId: normalizeId(actorUserId),
        actorKind: actorKind === "SYSTEM" ? "SYSTEM" : "USER",
        /* Auditisse EI kirjutata kustutatud väärtusi — ei nime, ei välisviidet. */
        reason: trimmedReason
      }
    });
    return true;
  });

  if (!changed) return { ok: true, changed: false };

  /* Platvormiülene vastutusjälg jääb alles, aga SISUTA: admin näeb, et kustutus
     toimus, mitte mida kustutati. Põhjus ja väärtused jäävad owner-skoobitud
     auditisse (L21). */
  await logDataAudit({
    actorUserId: normalizeId(actorUserId),
    action: "CASEWORK_CLIENT_REFERENCE_ERASED",
    resourceType: "CaseWorkAssist",
    resourceId: caseId
  });

  return { ok: true, changed: true };
}

/**
 * Konto kustutamise rada: tühjendab kliendiviited KÕIGIST juhtumitest, kus see
 * inimene on kliendiks märgitud.
 *
 * MIKS SEE OLEMAS ON. `CaseWorkAssist.clientUserId` on FK `onDelete: SetNull`,
 * seega konto kustutamine nulliks viite ka ilma selle funktsioonita — AGA
 * `clientErasedAt` jääks määramata ja kirjes ei oleks mingit jälge, et seal
 * kunagi kliendiviide oli. Sond tõendab seda käitumist eraldi.
 *
 * Kutsutakse ENNE kasutaja kustutamist, muidu ei ole enam mille järgi otsida.
 */
export async function eraseCaseWorkClientReferences({ userId, db = prismaClient } = {}) {
  const targetId = normalizeId(userId);
  if (!targetId) return { erased: 0 };

  const rows = await db.caseWorkAssist.findMany({
    where: { clientUserId: targetId, clientErasedAt: null },
    select: { id: true }
  });

  let erased = 0;
  for (const row of rows) {
    const result = await eraseCaseClientReference({
      caseWorkAssistId: row.id,
      actorUserId: null,
      actorKind: "SYSTEM",
      reason: "account_deleted",
      db
    });
    if (result.changed) erased += 1;
  }
  return { erased };
}
