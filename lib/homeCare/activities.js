/**
 * KODUTEENUS kiht 2, K2-a — asutuse toimingute kataloog.
 *
 * Kaks taset. ÜLEMINE on määruse nr 40 § 2 kuusteist toimingurühma (kuus koduabi,
 * kümme isikuabi): need on koodis ja andmebaasi CHECK-is, asutus neid ei muuda.
 * ALUMINE on asutuse enda toimingud tema enda sõnastuses („puude tuppa toomine ja
 * tuha väljaviimine"); iga toiming kuulub ühte riiklikku rühma. Nii räägivad
 * hoolduskava, käigu kirje ja aruanne sama keelt, mida omavalitsus ja järelevalve.
 *
 * Loevad kõik asutuse hooldajad (hooldusjuht või vähemalt ühe kliendi meeskonna
 * liige). Muudab ainult kogu asutuse hooldusjuht: kataloog on asutuse ühine sõnavara,
 * mitte ühe üksuse oma.
 *
 * Toimingut ei kustutata: see arhiveeritakse, sest varasemad kavad ja kirjed
 * viitavad sellele. Arhiveeritud nimi on vaba ja toimingu saab taastada.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, forbidden, notFound } from "../org/errors.js";

import { assertHomeCareContext, coordinatorScope, isCareWorker } from "./access.js";
import {
  CARE_ACTIVITY_GROUPS,
  CARE_ACTIVITY_GROUP_DOMAIN,
  CARE_ACTIVITY_GROUP_NAMES_ET,
  HOME_CARE_COORDINATOR,
  HOME_CARE_LIMITS
} from "./constants.js";
import { asObject, normalizeEnum, normalizeId, normalizeLine, normalizeVersion } from "./validation.js";

const ACTIVITY_SELECT = Object.freeze({
  id: true,
  group: true,
  name: true,
  note: true,
  position: true,
  version: true,
  archivedAt: true
});

function serialize(row) {
  return {
    id: row.id,
    group: row.group,
    domain: CARE_ACTIVITY_GROUP_DOMAIN[row.group] || null,
    name: row.name,
    note: row.note || null,
    position: row.position,
    version: row.version,
    archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null
  };
}

function canEditCatalogue(context) {
  return Boolean(coordinatorScope(context)?.wholeOrg);
}

function requireCatalogueEditor(context) {
  if (!canEditCatalogue(context)) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
}

/** Määruse rühmade järjekord, rühma sees asutuse enda järjekord, siis nimi. */
function sortActivities(rows) {
  const order = new Map(CARE_ACTIVITY_GROUPS.map((group, index) => [group, index]));
  return [...rows].sort(
    (a, b) =>
      (order.get(a.group) ?? 99) - (order.get(b.group) ?? 99) ||
      a.position - b.position ||
      a.name.localeCompare(b.name, "et") ||
      a.id.localeCompare(b.id)
  );
}

function normalizeActivityInput(rawInput, { partial = false } = {}) {
  const input = asObject(rawInput);
  const data = {};
  if (!partial || Object.hasOwn(input, "group")) {
    data.group = normalizeEnum(input.group, CARE_ACTIVITY_GROUPS, "home_care.errors.activity_group_required");
  }
  if (!partial || Object.hasOwn(input, "name")) {
    data.name = normalizeLine(input.name, HOME_CARE_LIMITS.ACTIVITY_NAME_MAX, {
      required: true,
      errorKey: "home_care.errors.activity_name_required"
    });
  }
  if (Object.hasOwn(input, "note")) data.note = normalizeLine(input.note, HOME_CARE_LIMITS.ACTIVITY_NOTE_MAX);
  if (Object.hasOwn(input, "position")) {
    const position = Number(input.position);
    if (!Number.isInteger(position) || position < 0 || position > 9999) throw badRequest("home_care.errors.activity_position_invalid");
    data.position = position;
  }
  return data;
}

/** Sama nimega kehtiv toiming on asutuses juba olemas (osaline unikaalindeks). */
async function withNameConflict(run) {
  try {
    return await run();
  } catch (error) {
    if (error?.code === "P2002") throw conflict("home_care.errors.activity_name_taken");
    throw error;
  }
}

async function writeActivityAudit(tx, context, activityId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_ACTIVITY_CHANGED,
    resourceType: OrgAuditResource.CARE_ACTIVITY,
    resourceId: activityId,
    meta: { organizationId: context.organization.id, activityId, change }
  });
}

async function loadAll(tx, organizationId, { includeArchived }) {
  const rows = await tx.careActivity.findMany({
    where: { organizationId, ...(includeArchived ? {} : { archivedAt: null }) },
    select: ACTIVITY_SELECT
  });
  return sortActivities(rows).map(serialize);
}

/** Kataloog lugemiseks. Arhiveeritud toiminguid näeb ainult see, kes kataloogi muudab. */
export async function listActivities(context, { includeArchived = false } = {}, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  if (!(await isCareWorker(db, context))) throw notFound("home_care.errors.client_not_found");
  const canEdit = canEditCatalogue(context);
  return {
    activities: await loadAll(db, context.organization.id, { includeArchived: includeArchived && canEdit }),
    canEdit
  };
}

export async function createActivity(context, input = {}, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  requireCatalogueEditor(context);
  const data = normalizeActivityInput(input);
  const organizationId = context.organization.id;

  return withNameConflict(() =>
    db.$transaction(async (tx) => {
      const count = await tx.careActivity.count({ where: { organizationId, archivedAt: null } });
      if (count >= HOME_CARE_LIMITS.ACTIVITIES_MAX) {
        throw conflict("home_care.errors.activity_limit_reached", { limit: HOME_CARE_LIMITS.ACTIVITIES_MAX });
      }
      const last = await tx.careActivity.findFirst({
        where: { organizationId, group: data.group, archivedAt: null },
        orderBy: { position: "desc" },
        select: { position: true }
      });
      const row = await tx.careActivity.create({
        data: {
          organizationId,
          group: data.group,
          name: data.name,
          note: data.note ?? null,
          position: data.position ?? (last ? last.position + 1 : 0),
          createdByMembershipId: context.membership?.id || null
        },
        select: ACTIVITY_SELECT
      });
      await writeActivityAudit(tx, context, row.id, "created");
      return { activity: serialize(row) };
    })
  );
}

/**
 * Muudab nime, rühma, selgitust või järjekorda; `archived: true/false` arhiveerib või
 * taastab. Muutja saadab versiooni, mida ta nägi.
 */
export async function updateActivity(context, activityId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  requireCatalogueEditor(context);
  const id = normalizeId(activityId, "home_care.errors.activity_not_found");
  const raw = asObject(input);
  const version = normalizeVersion(raw.version);
  const data = normalizeActivityInput(raw, { partial: true });
  const organizationId = context.organization.id;
  const archive = Object.hasOwn(raw, "archived") ? raw.archived === true : null;

  return withNameConflict(() =>
    db.$transaction(async (tx) => {
      const existing = await tx.careActivity.findFirst({ where: { id, organizationId }, select: ACTIVITY_SELECT });
      if (!existing) throw notFound("home_care.errors.activity_not_found");

      const change = { ...data };
      let kind = "updated";
      if (archive === true && !existing.archivedAt) {
        change.archivedAt = now;
        kind = "archived";
      } else if (archive === false && existing.archivedAt) {
        const count = await tx.careActivity.count({ where: { organizationId, archivedAt: null } });
        if (count >= HOME_CARE_LIMITS.ACTIVITIES_MAX) {
          throw conflict("home_care.errors.activity_limit_reached", { limit: HOME_CARE_LIMITS.ACTIVITIES_MAX });
        }
        change.archivedAt = null;
        kind = "restored";
      }
      if (!Object.keys(change).length) return { activity: serialize(existing) };

      const result = await tx.careActivity.updateMany({
        where: { id, organizationId, version },
        data: { ...change, version: { increment: 1 } }
      });
      if (result.count !== 1) throw conflict("home_care.errors.version_conflict", { currentVersion: existing.version });
      await writeActivityAudit(tx, context, id, kind);
      const fresh = await tx.careActivity.findFirst({ where: { id, organizationId }, select: ACTIVITY_SELECT });
      return { activity: serialize(fresh) };
    })
  );
}

/**
 * Algne loend: üks toiming iga riikliku rühma kohta määruse sõnastuses. Ainult tühja
 * kataloogi peale: olemasolevat loendit see ei puuduta. Sõnastus on eesti keeles, sest
 * see on määruse tekst; asutus nimetab toimingud seejärel oma sõnadega ümber.
 */
export async function seedDefaultActivities(context, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  requireCatalogueEditor(context);
  const organizationId = context.organization.id;

  return withNameConflict(() =>
    db.$transaction(async (tx) => {
      const existing = await tx.careActivity.count({ where: { organizationId } });
      if (existing > 0) throw conflict("home_care.errors.activity_catalogue_not_empty");
      await tx.careActivity.createMany({
        data: CARE_ACTIVITY_GROUPS.map((group) => ({
          organizationId,
          group,
          name: CARE_ACTIVITY_GROUP_NAMES_ET[group],
          position: 0,
          createdByMembershipId: context.membership?.id || null
        }))
      });
      await writeActivityAudit(tx, context, null, "seeded");
      return { activities: await loadAll(tx, organizationId, { includeArchived: true }), canEdit: true };
    })
  );
}
