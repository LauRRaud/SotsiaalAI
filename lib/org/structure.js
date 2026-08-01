/**
 * T25 ORG-FOUNDATION-V1 — üksuste ja tiimide struktuur (E3).
 *
 * Üksus EI OLE eraldi tenant (arenduskava §5.2). Ta on skoop: capability võib
 * olla üksusele piiratud, aga andmed kuuluvad organisatsioonile.
 *
 * Kõik puu-invariandid (tsükkel, sügavus, organisatsiooni piir) elavad
 * `lib/org/units.js`-is ja neid kontrollitakse TEHINGU SEES, sest kaks samaaegset
 * liigutamist võivad eraldi kontrollituna tekitada tsükli, mille kumbki üksi ei
 * teki.
 */

import prisma from "@/lib/prisma";

import { OrganizationUnitStatus, isOrganizationUnitType } from "./constants.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "./audit.js";
import { assertUnitPlacement, recomputeSubtreeDepths } from "./units.js";

function cleanName(value) {
  const name = String(value ?? "").trim();
  return name ? name.slice(0, 200) : null;
}

async function loadUnits(tx, organizationId) {
  return tx.organizationUnit.findMany({
    where: { organizationId },
    select: { id: true, organizationId: true, parentUnitId: true, depth: true, status: true }
  });
}

export async function listUnits(organizationId, { db = prisma, includeArchived = false } = {}) {
  return db.organizationUnit.findMany({
    where: {
      organizationId,
      ...(includeArchived ? {} : { status: OrganizationUnitStatus.ACTIVE })
    },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      parentUnitId: true,
      depth: true,
      sortOrder: true
    },
    orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
  });
}

export async function createUnit(
  organizationId,
  { actorUserId, name, type = "TEAM", parentUnitId = null, sortOrder = 0 },
  { db = prisma } = {}
) {
  const unitName = cleanName(name);
  if (!unitName) throw badRequest("org.errors.unit_name_required");
  if (!isOrganizationUnitType(type)) throw badRequest("org.errors.invalid_unit_type");

  return db.$transaction(async (tx) => {
    const units = await loadUnits(tx, organizationId);
    const { depth } = assertUnitPlacement({
      organizationId,
      unitId: null,
      parentUnitId: parentUnitId || null,
      units
    });

    const created = await tx.organizationUnit.create({
      data: {
        organizationId,
        parentUnitId: parentUnitId || null,
        name: unitName,
        type,
        depth,
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0
      }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.UNIT_CREATED,
      resourceType: OrgAuditResource.UNIT,
      resourceId: created.id,
      meta: { organizationId, unitId: created.id, parentUnitId: parentUnitId || null, depth }
    });

    return created;
  });
}

/**
 * Nime, tüübi ja järjestuse muutmine. Vanema muutmine käib `moveUnit`-iga —
 * teadlikult eraldi, sest see on struktuurne toiming oma invariantide ja oma
 * auditireaga, mitte välja redigeerimine.
 */
export async function updateUnit(
  organizationId,
  unitId,
  { actorUserId, name, type, sortOrder },
  { db = prisma } = {}
) {
  const data = {};
  if (name !== undefined) {
    const unitName = cleanName(name);
    if (!unitName) throw badRequest("org.errors.unit_name_required");
    data.name = unitName;
  }
  if (type !== undefined) {
    if (!isOrganizationUnitType(type)) throw badRequest("org.errors.invalid_unit_type");
    data.type = type;
  }
  if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) data.sortOrder = Number(sortOrder);
  if (!Object.keys(data).length) throw badRequest();

  return db.$transaction(async (tx) => {
    // Skoobitud päring: võõra organisatsiooni üksus ei ole leitav (§11.1).
    const existing = await tx.organizationUnit.findFirst({
      where: { id: unitId, organizationId },
      select: { id: true }
    });
    if (!existing) throw notFound("org.errors.unit_not_found");

    const updated = await tx.organizationUnit.update({ where: { id: unitId }, data });
    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.UNIT_UPDATED,
      resourceType: OrgAuditResource.UNIT,
      resourceId: unitId,
      meta: { organizationId, unitId }
    });
    return updated;
  });
}

/**
 * Liigutab üksuse koos kogu alampuuga. Sügavused arvutatakse ümber SAMAS
 * tehingus — muidu jääks `depth` valetama ja järgmine sügavuskontroll tugineks
 * valele arvule.
 */
export async function moveUnit(
  organizationId,
  unitId,
  { actorUserId, parentUnitId = null },
  { db = prisma } = {}
) {
  return db.$transaction(async (tx) => {
    const units = await loadUnits(tx, organizationId);
    const current = units.find((unit) => unit.id === unitId);
    if (!current) throw notFound("org.errors.unit_not_found");
    if ((current.parentUnitId || null) === (parentUnitId || null)) {
      throw conflict("org.errors.unit_parent_unchanged");
    }

    const { depth } = assertUnitPlacement({
      organizationId,
      unitId,
      parentUnitId: parentUnitId || null,
      units
    });

    const depths = recomputeSubtreeDepths(unitId, depth, units);
    await tx.organizationUnit.update({
      where: { id: unitId },
      data: { parentUnitId: parentUnitId || null, depth }
    });
    for (const [id, newDepth] of depths) {
      if (id === unitId) continue;
      await tx.organizationUnit.update({ where: { id }, data: { depth: newDepth } });
    }

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.UNIT_MOVED,
      resourceType: OrgAuditResource.UNIT,
      resourceId: unitId,
      meta: {
        organizationId,
        unitId,
        previousParentUnitId: current.parentUnitId || null,
        parentUnitId: parentUnitId || null,
        depth
      }
    });

    return { unitId, depth, movedCount: depths.size };
  });
}

/**
 * Arhiveerib üksuse. EI kustuta: üksus kannab ajalugu (kes kus töötas) ja
 * kustutamine muudaks selle ajaloo loetamatuks.
 *
 * Kaks väravat, mõlemad teadlikud:
 *   - aktiivne alamüksus blokeerib (muidu jääks alampuu orvuks);
 *   - aktiivne liige blokeerib (muidu kaoks inimese üksus vaikselt ära).
 */
export async function archiveUnit(
  organizationId,
  unitId,
  { actorUserId },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const unit = await tx.organizationUnit.findFirst({
      where: { id: unitId, organizationId },
      select: { id: true, status: true }
    });
    if (!unit) throw notFound("org.errors.unit_not_found");
    if (unit.status === OrganizationUnitStatus.ARCHIVED) throw conflict("org.errors.unit_already_archived");

    const activeChildren = await tx.organizationUnit.count({
      where: { organizationId, parentUnitId: unitId, status: OrganizationUnitStatus.ACTIVE }
    });
    if (activeChildren > 0) throw conflict("org.errors.unit_has_children");

    const activeMembers = await tx.organizationMembershipUnit.count({
      where: { unitId, endedAt: null }
    });
    if (activeMembers > 0) throw conflict("org.errors.unit_has_members");

    const updated = await tx.organizationUnit.update({
      where: { id: unitId },
      data: { status: OrganizationUnitStatus.ARCHIVED, archivedAt: now }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.UNIT_ARCHIVED,
      resourceType: OrgAuditResource.UNIT,
      resourceId: unitId,
      meta: { organizationId, unitId }
    });

    return updated;
  });
}
