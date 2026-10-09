/**
 * KODUTEENUS kiht 2, K2-b — hoolduskava kliendi juures.
 *
 * Kava ütleb, MIDA kliendi juures tehakse, KUI SAGELI ja KUIDAS: kas hooldaja
 * juhendab, tehakse koos, aidatakse osaliselt või tehakse inimese eest. Viimane on
 * määruse põhimõte („abistab või juhendab", arvestades inimese võimekust): kava, kus
 * kõik on „teen tema eest", ei toeta iseseisvust.
 *
 * VERSIOONID. Hooldusjuht muudab MUSTANDIT; kehtestamine teeb mustandist kehtiva kava
 * ja eelmine kehtiv jääb alles kui asendatud. Kehtivat kava kohapeal ei muudeta: nii
 * on alati näha, mis oli kokku lepitud ja millal see muutus. Kliendil on korraga kõige
 * rohkem üks mustand ja üks kehtiv kava (osalised unikaalindeksid).
 *
 * Kava read tulevad asutuse toimingute kataloogist ja kannavad toimingu nime koopiat:
 * kehtiv kava ei muutu, kui kataloogis toiming ümber nimetatakse.
 *
 * Loeb igaüks, kes tohib kliendi lehte avada (meeskond, hooldusjuht, põhjusega avaja):
 * kehtivat kava. Mustandit näeb ja muudab ainult hooldusjuht, kelle skoobis klient on.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, notFound } from "../org/errors.js";

import { assertHomeCareContext, membershipDisplayName, requireClientAccess, requireClientCoordinator } from "./access.js";
import {
  CARE_PLAN_FREQUENCIES,
  CARE_PLAN_MODES,
  CarePlanFrequency,
  CarePlanStatus,
  HOME_CARE_LIMITS
} from "./constants.js";
import { asObject, normalizeEnum, normalizeId, normalizeIsoDay, normalizeLine, normalizeText, normalizeVersion } from "./validation.js";

const LINE_SELECT = Object.freeze({
  id: true,
  activityId: true,
  activityName: true,
  activityGroup: true,
  frequencyKind: true,
  frequencyCount: true,
  frequencyNote: true,
  mode: true,
  critical: true,
  note: true,
  position: true
});

const PLAN_SELECT = Object.freeze({
  id: true,
  number: true,
  status: true,
  goals: true,
  reviewOn: true,
  note: true,
  version: true,
  createdByName: true,
  activatedAt: true,
  activatedByName: true,
  replacedAt: true,
  createdAt: true,
  updatedAt: true,
  lines: { select: LINE_SELECT, orderBy: [{ position: "asc" }, { id: "asc" }] }
});

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function serializePlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    goals: row.goals || null,
    reviewOn: row.reviewOn || null,
    note: row.note || null,
    version: row.version,
    createdByName: row.createdByName || null,
    activatedAt: iso(row.activatedAt),
    activatedByName: row.activatedByName || null,
    replacedAt: iso(row.replacedAt),
    updatedAt: iso(row.updatedAt),
    lines: (row.lines || []).map((line) => ({
      id: line.id,
      activityId: line.activityId || null,
      activityName: line.activityName,
      activityGroup: line.activityGroup,
      frequencyKind: line.frequencyKind,
      frequencyCount: line.frequencyCount ?? null,
      frequencyNote: line.frequencyNote || null,
      mode: line.mode,
      critical: Boolean(line.critical),
      note: line.note || null,
      position: line.position
    }))
  };
}

/** `normalizeIsoDay` annab päeva osadena; kavas hoitakse seda tekstina `AAAA-KK-PP`. */
function dayText(parts) {
  if (!parts) return null;
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Kava rida sisendist. Sagedus „vajadusel" on ilma arvuta, muu sagedus arvuga 1–60. */
function normalizeLineInput(rawLine) {
  const line = asObject(rawLine);
  const activityId = normalizeId(line.activityId, "home_care.errors.plan_activity_required");
  const frequencyKind = normalizeEnum(line.frequencyKind, CARE_PLAN_FREQUENCIES, "home_care.errors.plan_frequency_required");
  let frequencyCount = null;
  if (frequencyKind !== CarePlanFrequency.AS_NEEDED) {
    frequencyCount = Number(line.frequencyCount);
    if (!Number.isInteger(frequencyCount) || frequencyCount < 1 || frequencyCount > HOME_CARE_LIMITS.PLAN_FREQUENCY_MAX) {
      throw badRequest("home_care.errors.plan_frequency_count_invalid", { limit: HOME_CARE_LIMITS.PLAN_FREQUENCY_MAX });
    }
  }
  return {
    activityId,
    frequencyKind,
    frequencyCount,
    frequencyNote: normalizeLine(line.frequencyNote, HOME_CARE_LIMITS.PLAN_FREQUENCY_NOTE_MAX),
    mode: normalizeEnum(line.mode, CARE_PLAN_MODES, "home_care.errors.plan_mode_required"),
    critical: line.critical === true,
    note: normalizeLine(line.note, HOME_CARE_LIMITS.PLAN_LINE_NOTE_MAX)
  };
}

function normalizeDraftInput(rawInput) {
  const input = asObject(rawInput);
  const rawLines = Array.isArray(input.lines) ? input.lines : [];
  if (rawLines.length > HOME_CARE_LIMITS.PLAN_LINES_MAX) {
    throw badRequest("home_care.errors.plan_too_many_lines", { limit: HOME_CARE_LIMITS.PLAN_LINES_MAX });
  }
  const lines = rawLines.map(normalizeLineInput);
  if (new Set(lines.map((line) => line.activityId)).size !== lines.length) {
    throw badRequest("home_care.errors.plan_activity_repeated");
  }
  return {
    goals: normalizeText(input.goals, HOME_CARE_LIMITS.PLAN_GOALS_MAX),
    reviewOn: dayText(normalizeIsoDay(input.reviewOn)),
    note: normalizeText(input.note, HOME_CARE_LIMITS.PLAN_NOTE_MAX),
    lines
  };
}

async function findPlan(tx, clientId, status) {
  return tx.carePlan.findFirst({ where: { clientId, status }, select: PLAN_SELECT });
}

async function loadHistory(tx, clientId) {
  const rows = await tx.carePlan.findMany({
    where: { clientId, status: CarePlanStatus.REPLACED },
    orderBy: [{ number: "desc" }],
    take: HOME_CARE_LIMITS.PLAN_HISTORY_MAX,
    select: { id: true, number: true, activatedAt: true, activatedByName: true, replacedAt: true, _count: { select: { lines: true } } }
  });
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    activatedAt: iso(row.activatedAt),
    activatedByName: row.activatedByName || null,
    replacedAt: iso(row.replacedAt),
    lineCount: row._count.lines
  }));
}

/** Kehtiv kava kliendi lehele. Kutsuja on juba kontrollinud ligipääsu kliendile. */
export async function loadActivePlanWithin(tx, clientId) {
  return serializePlan(await findPlan(tx, clientId, CarePlanStatus.ACTIVE));
}

/** Kava vaade: kehtiv kava kõigile lehe avajatele; mustand ja varasemad hooldusjuhile. */
export async function getCarePlans(context, clientId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    const active = await loadActivePlanWithin(tx, id);
    if (!access.isCoordinator) return { active, draft: null, history: [], canEdit: false };
    return {
      active,
      draft: serializePlan(await findPlan(tx, id, CarePlanStatus.DRAFT)),
      history: await loadHistory(tx, id),
      canEdit: Boolean(context.writable)
    };
  });
}

/**
 * Kava koostamise vaade hooldusjuhile: klient, kehtiv kava, mustand, varasemad kavad ja
 * asutuse kehtivad toimingud, millest ridu valida. Ainult hooldusjuht, kelle skoobis
 * klient on; muu on 403 (leht teeb sellest 404).
 */
export async function getCarePlanEditor(context, clientId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  return db.$transaction(async (tx) => {
    const access = await requireClientCoordinator(tx, context, id, { now });
    const activities = await tx.careActivity.findMany({
      where: { organizationId: context.organization.id, archivedAt: null },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, group: true, name: true, note: true, position: true }
    });
    return {
      client: { id: access.client.id, displayName: access.client.displayName },
      active: await loadActivePlanWithin(tx, id),
      draft: serializePlan(await findPlan(tx, id, CarePlanStatus.DRAFT)),
      history: await loadHistory(tx, id),
      activities,
      canEdit: Boolean(context.writable)
    };
  });
}

/**
 * Salvestab mustandi tervikuna (eesmärgid, ülevaatuse päev, read). Kui mustandit ei ole,
 * luuakse see; olemasoleva puhul saadab muutja versiooni, mida ta nägi.
 */
export async function saveCarePlanDraft(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const data = normalizeDraftInput(input);
  const organizationId = context.organization.id;

  try {
    return await db.$transaction(async (tx) => {
      await requireClientCoordinator(tx, context, id, { lock: true, now });

      /* Read tohivad viidata ainult selle asutuse KEHTIVATELE toimingutele. */
      const wanted = data.lines.map((line) => line.activityId);
      const activities = wanted.length
        ? await tx.careActivity.findMany({
            where: { organizationId, id: { in: wanted }, archivedAt: null },
            select: { id: true, name: true, group: true }
          })
        : [];
      const byId = new Map(activities.map((activity) => [activity.id, activity]));
      if (byId.size !== wanted.length) throw badRequest("home_care.errors.plan_activity_unknown");

      let draft = await tx.carePlan.findFirst({ where: { clientId: id, status: CarePlanStatus.DRAFT }, select: { id: true, version: true } });
      const actorName = await membershipDisplayName(tx, context);
      if (draft) {
        const version = normalizeVersion(asObject(input).version);
        const result = await tx.carePlan.updateMany({
          where: { id: draft.id, version, status: CarePlanStatus.DRAFT },
          data: { goals: data.goals, reviewOn: data.reviewOn, note: data.note, version: { increment: 1 } }
        });
        if (result.count !== 1) throw conflict("home_care.errors.version_conflict", { currentVersion: draft.version });
        await tx.carePlanLine.deleteMany({ where: { planId: draft.id } });
      } else {
        const last = await tx.carePlan.findFirst({ where: { clientId: id }, orderBy: { number: "desc" }, select: { number: true } });
        draft = await tx.carePlan.create({
          data: {
            organizationId,
            clientId: id,
            number: (last?.number || 0) + 1,
            status: CarePlanStatus.DRAFT,
            goals: data.goals,
            reviewOn: data.reviewOn,
            note: data.note,
            createdByMembershipId: context.membership?.id || null,
            createdByName: actorName
          },
          select: { id: true, version: true }
        });
      }
      if (data.lines.length) {
        await tx.carePlanLine.createMany({
          data: data.lines.map((line, index) => ({
            planId: draft.id,
            clientId: id,
            activityId: line.activityId,
            activityName: byId.get(line.activityId).name,
            activityGroup: byId.get(line.activityId).group,
            frequencyKind: line.frequencyKind,
            frequencyCount: line.frequencyCount,
            frequencyNote: line.frequencyNote,
            mode: line.mode,
            critical: line.critical,
            note: line.note,
            position: index
          }))
        });
      }
      return { draft: serializePlan(await findPlan(tx, id, CarePlanStatus.DRAFT)) };
    });
  } catch (error) {
    /* Kaks hooldusjuhti alustasid mustandit korraga: teine saab konflikti, mitte teist mustandit. */
    if (error?.code === "P2002") throw conflict("home_care.errors.version_conflict");
    throw error;
  }
}

/**
 * Kehtestab mustandi: sellest saab kehtiv kava ja eelmine kehtiv jääb alles kui
 * asendatud. Üks tehing. Tühja kava ei kehtestata.
 */
export async function activateCarePlan(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const version = normalizeVersion(asObject(input).version);
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const draft = await tx.carePlan.findFirst({
      where: { clientId: id, status: CarePlanStatus.DRAFT },
      select: { id: true, version: true, _count: { select: { lines: true } } }
    });
    if (!draft) throw notFound("home_care.errors.plan_draft_not_found");
    if (draft.version !== version) throw conflict("home_care.errors.version_conflict", { currentVersion: draft.version });
    if (draft._count.lines < 1) throw badRequest("home_care.errors.plan_empty");

    /* Kõigepealt eelmine kehtiv asendatuks: muidu oleks hetkeks kaks kehtivat kava. */
    await tx.carePlan.updateMany({
      where: { clientId: id, status: CarePlanStatus.ACTIVE },
      data: { status: CarePlanStatus.REPLACED, replacedAt: now, version: { increment: 1 } }
    });
    await tx.carePlan.update({
      where: { id: draft.id },
      data: {
        status: CarePlanStatus.ACTIVE,
        activatedAt: now,
        activatedByMembershipId: context.membership?.id || null,
        activatedByName: await membershipDisplayName(tx, context),
        version: { increment: 1 }
      }
    });
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_PLAN_ACTIVATED,
      resourceType: OrgAuditResource.CARE_PLAN,
      resourceId: draft.id,
      meta: { organizationId, clientId: id, planId: draft.id }
    });
    return {
      active: await loadActivePlanWithin(tx, id),
      draft: null,
      history: await loadHistory(tx, id),
      canEdit: Boolean(context.writable)
    };
  });
}

/** Viskab mustandi ära. Kehtivat ega varasemaid kavasid see ei puuduta. */
export async function discardCarePlanDraft(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const version = normalizeVersion(asObject(input).version);

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const draft = await tx.carePlan.findFirst({ where: { clientId: id, status: CarePlanStatus.DRAFT }, select: { id: true, version: true } });
    if (!draft) throw notFound("home_care.errors.plan_draft_not_found");
    const result = await tx.carePlan.deleteMany({ where: { id: draft.id, version, status: CarePlanStatus.DRAFT } });
    if (result.count !== 1) throw conflict("home_care.errors.version_conflict", { currentVersion: draft.version });
    return { draft: null };
  });
}
