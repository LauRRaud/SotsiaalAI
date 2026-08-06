/**
 * JUHTUM-V1 (CASEWORK-P7) — seoseregister.
 *
 * Leping: docs/platvormi arendus/juhtum-v1-arendusleping.md (v6), etapp E3.
 *
 * KAKS INVARIANTI, MILLE PÄRAST SEE FAIL NII ON KIRJUTATUD:
 *
 *   L3 — SEOS EI LAIENDA KUNAGI LIGIPÄÄSU. Rida `CaseWorkItem`-is EI OLE luba.
 *        Õigust kontrollitakse ALATI sihtobjektil, ka lugemise ajal. Kui keegi
 *        kirjutab andmebaasi viida võõrale dokumendile, ei tohi ta ilmuda
 *        vastusesse EGA MÕJUTADA ARVE — vastasel juhul ei leki sisu, aga lekib
 *        fakt, et selline objekt on olemas.
 *
 *   L4 — SIDUDA SAAB AINULT SEDA, MIDA OMANIK JUBA NÄEB. „Objekt eksisteerib"
 *        ei ole alus; vastasel juhul saaks võõra ID-ga kontrollida, kas selline
 *        dokument on olemas.
 *
 * MÕLEMAD FILTREERITAKSE PÄRINGUS, MITTE JS-is. Kui ligipääsmatu rida jõuaks
 * andmebaasist välja ja kaoks alles mälus, oleks `count` juba vale — ja just
 * `count` on koht, kus leke oleks kõige märkamatum.
 */

import prismaClient from "@/lib/prisma";

import { RETENTION_STATE } from "./caseWorkAssist.js";
import { badRequest, conflict, featureDisabled, notFound } from "./errors.js";
import { isCaseWorkEnabled } from "./flags.js";

/**
 * Sihttüüpide register — ÜKS koht, kus sihttüüp on kirjeldatud.
 *
 * Typed-FK tähendab, et uus sihttüüp on migratsioon (L15); see register hoiab
 * ülejäänud teadmise — veeru nime, omanikuvälja ja Prisma relatsiooni — ühes
 * kohas, et lisamisel ei jääks mõni lugemisrada uuendamata.
 */
export const CASE_WORK_TARGET = Object.freeze({
  USER_DOCUMENT: "USER_DOCUMENT",
  AGENT_ARTIFACT: "AGENT_ARTIFACT",
  FIELD_VISIT: "FIELD_VISIT"
});

const TARGET_REGISTRY = Object.freeze({
  [CASE_WORK_TARGET.USER_DOCUMENT]: Object.freeze({
    column: "userDocumentId",
    relation: "userDocument",
    model: "userDocument",
    ownerField: "ownerId"
  }),
  [CASE_WORK_TARGET.AGENT_ARTIFACT]: Object.freeze({
    column: "agentArtifactId",
    relation: "agentArtifact",
    model: "agentArtifact",
    ownerField: "ownerId"
  }),
  [CASE_WORK_TARGET.FIELD_VISIT]: Object.freeze({
    column: "fieldVisitId",
    relation: "fieldVisit",
    model: "fieldVisit",
    ownerField: "ownerUserId"
  })
});

export const CASE_WORK_TARGETS = Object.freeze(Object.keys(TARGET_REGISTRY));

const LIST_LIMIT_DEFAULT = 25;
const LIST_LIMIT_MAX = 100;

function requireEnabled() {
  if (!isCaseWorkEnabled()) throw featureDisabled();
}

function normalizeId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Tundmatu sihttüüp kukub FAIL-CLOSED — mitte „ignoreeri ja jätka". */
function targetSpec(targetType) {
  const spec = TARGET_REGISTRY[normalizeId(targetType) || ""];
  if (!spec) throw badRequest("casework.errors.target_type_unknown");
  return spec;
}

/**
 * Ligipääsufilter (L3): rida loetakse ainult siis, kui SIHTOBJEKT kuulub
 * lugejale. Kasutatakse nii loendis kui loenduris, et need kaks ei saaks
 * kunagi lahku minna.
 */
function visibleItemWhere(ownerUserId) {
  return {
    OR: CASE_WORK_TARGETS.map((type) => {
      const spec = TARGET_REGISTRY[type];
      return { [spec.relation]: { [spec.ownerField]: ownerUserId } };
    })
  };
}

function toItem(row) {
  for (const type of CASE_WORK_TARGETS) {
    const spec = TARGET_REGISTRY[type];
    if (row[spec.column]) return { id: row.id, targetType: type, targetId: row[spec.column], createdAt: row.createdAt };
  }
  /* Siia ei jõuta: DB CHECK nõuab täpselt ühte sihti. Kui jõutakse, on skeem
     katki ja vaikimine oleks halvim vastus. */
  throw new Error(`CaseWorkItem ${row.id} has no target`);
}

const ITEM_SELECT = Object.freeze({
  id: true,
  userDocumentId: true,
  agentArtifactId: true,
  fieldVisitId: true,
  createdAt: true
});

/** Juhtum peab olema lugejale nähtav; võõras ja olematu annavad mõlemad 404. */
async function requireOwnedCase({ db, ownerUserId, caseWorkAssistId, mustBeActive = false }) {
  const row = await db.caseWorkAssist.findFirst({
    where: { id: caseWorkAssistId, ownerUserId },
    select: { id: true, retentionState: true }
  });
  if (!row) throw notFound();
  if (mustBeActive && row.retentionState !== RETENTION_STATE.ACTIVE) throw conflict("casework.errors.not_active");
  return row;
}

/**
 * Seob olemasoleva objekti juhtumiga. 0 kopeeritud rida — sünnib ainult viit.
 */
export async function linkCaseWorkItem({
  ownerUserId,
  caseWorkAssistId,
  targetType,
  targetId,
  db = prismaClient
} = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const target = normalizeId(targetId);
  if (!owner || !caseId || !target) throw notFound();

  const spec = targetSpec(targetType);
  await requireOwnedCase({ db, ownerUserId: owner, caseWorkAssistId: caseId, mustBeActive: true });

  /* L4: kontrollime sihtobjekti OMANDIT, mitte olemasolu. Võõras objekt annab
     404 — sama vastus mis olematu, muidu lekiks ID olemasolu. */
  const targetRow = await db[spec.model].findFirst({
    where: { id: target, [spec.ownerField]: owner },
    select: { id: true }
  });
  if (!targetRow) throw notFound("casework.errors.target_not_found");

  try {
    const row = await db.caseWorkItem.create({
      data: { caseWorkAssistId: caseId, [spec.column]: target },
      select: ITEM_SELECT
    });
    return toItem(row);
  } catch (error) {
    /* Unikaalindeks: sama objekt on juba seotud. See ei ole viga, mille peale
       kasutaja midagi teha saaks — ütleme selle välja, mitte ei paku toorest
       piirangunime. */
    if (error?.code === "P2002") throw conflict("casework.errors.target_already_linked");
    throw error;
  }
}

export async function unlinkCaseWorkItem({ ownerUserId, caseWorkAssistId, itemId, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  const id = normalizeId(itemId);
  if (!owner || !caseId || !id) throw notFound();

  await requireOwnedCase({ db, ownerUserId: owner, caseWorkAssistId: caseId, mustBeActive: true });

  /* Kustutame AINULT nähtava seose: ligipääsmatut rida ei tohi saada ka
     eemaldada, sest õnnestumine kinnitaks tema olemasolu. */
  const result = await db.caseWorkItem.deleteMany({
    where: { id, caseWorkAssistId: caseId, ...visibleItemWhere(owner) }
  });
  if (!result?.count) throw notFound();
  return { ok: true };
}

/**
 * Juhtumi seosed, cursor-pagineeritud.
 *
 * SORTIMISVÕTI ON STABIILNE: `createdAt DESC, id DESC`. Ainult ajatemplist ei
 * piisa — samal hetkel loodud seosed annaksid ebastabiilse järjestuse.
 */
export async function listCaseWorkItems({
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

  await requireOwnedCase({ db, ownerUserId: owner, caseWorkAssistId: caseId });

  const take = Math.min(Math.max(Number(limit) || LIST_LIMIT_DEFAULT, 1), LIST_LIMIT_MAX);
  const cursorId = normalizeId(cursor);

  const rows = await db.caseWorkItem.findMany({
    where: { caseWorkAssistId: caseId, ...visibleItemWhere(owner) },
    select: ITEM_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {})
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return { items: page.map(toItem), nextCursor: hasMore ? page[page.length - 1].id : null };
}

/**
 * Seoste arv.
 *
 * KASUTAB SAMA FILTRIT mis loend. Kui loendur loeks kõiki ridu ja loend
 * filtreeriks, ütleks vaade „3 seost" ja näitaks kahte — ja see vahe ise oleks
 * leke: ta ütleks, et kolmas objekt on olemas.
 */
export async function countCaseWorkItems({ ownerUserId, caseWorkAssistId, db = prismaClient } = {}) {
  requireEnabled();
  const owner = normalizeId(ownerUserId);
  const caseId = normalizeId(caseWorkAssistId);
  if (!owner || !caseId) return 0;

  return db.caseWorkItem.count({ where: { caseWorkAssistId: caseId, ...visibleItemWhere(owner) } });
}
