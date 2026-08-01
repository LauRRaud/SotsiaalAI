/**
 * T25 ORG-FUNDING-INBOX-V1 — rollipõhised kasutajakohad (E5).
 *
 * KOLM ASJA, mida see fail hoiab lahus (arenduskava §D5):
 *   1. HINNASTATAV ROLL määrab paketi ja kasutuspiirid — `seatRole`;
 *   2. ORGANISATSIOONISISENE ÕIGUS määrab, mida inimene teha saab — capability;
 *   3. MAKSJA on eraldi telg — `payerSource`.
 * Koht ei anna õigust ja õigus ei anna kohta. Juht ei ole neljas hinnaklass.
 *
 * MIDA KOHT EI TEE: ei korruta kvooti (üks aktiivne koht liikmesuse kohta), ei
 * anna organisatsioonile ligipääsu inimese kasutusandmetele, ei muuda tema rolli.
 */

import prisma from "@/lib/prisma";

import {
  OrganizationMembershipStatus,
  OrganizationSeatAssignmentStatus,
  OrganizationSeatPlanStatus,
  OrganizationStatus,
  SEAT_ROLE_REFERENCE_PRICE_CENTS,
  isOrganizationSeatPlanSource,
  isOrganizationSeatRole,
  priceDiffersFromReference
} from "./constants.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "./audit.js";

function cleanReason(value, max = 500) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

/**
 * Loob kohaplaani.
 *
 * Hind on SNAPSHOT: kui see erineb rolli võrdlushinnast, on `priceReason`
 * KOHUSTUSLIK. Soodustus ilma põhjuseta ei ole soodustus, vaid jälgimatu erand.
 */
export async function createSeatPlan(
  organizationId,
  { actorUserId, seatRole, seatLimit, unitPriceCents, source = "MANUAL_CONTRACT", priceReason, validUntil },
  { db = prisma } = {}
) {
  if (!isOrganizationSeatRole(seatRole)) throw badRequest("org.errors.invalid_seat_role");
  if (!isOrganizationSeatPlanSource(source)) throw badRequest("org.errors.invalid_seat_plan_source");

  const limit = Number(seatLimit);
  if (!Number.isInteger(limit) || limit < 0) throw badRequest("org.errors.invalid_seat_limit");

  const price =
    unitPriceCents === undefined || unitPriceCents === null
      ? SEAT_ROLE_REFERENCE_PRICE_CENTS[seatRole]
      : Number(unitPriceCents);
  if (!Number.isInteger(price) || price < 0) throw badRequest("org.errors.invalid_price");

  const reason = cleanReason(priceReason);
  if (priceDiffersFromReference(seatRole, price) && !reason) {
    throw badRequest("org.errors.price_reason_required");
  }

  return db.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, status: true }
    });
    if (!organization) throw notFound("org.errors.organization_not_found");
    if (organization.status !== OrganizationStatus.ACTIVE) {
      throw conflict("org.errors.organization_not_writable");
    }

    const existing = await tx.organizationSeatPlan.findFirst({
      where: { organizationId, seatRole, status: OrganizationSeatPlanStatus.ACTIVE },
      select: { id: true }
    });
    if (existing) throw conflict("org.errors.seat_plan_already_active");

    const plan = await tx.organizationSeatPlan.create({
      data: {
        organizationId,
        seatRole,
        seatLimit: limit,
        unitPriceCents: price,
        source,
        priceReason: reason,
        validUntil: validUntil ? new Date(validUntil) : null,
        status: OrganizationSeatPlanStatus.ACTIVE,
        createdByUserId: actorUserId
      }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.SEAT_PLAN_CREATED,
      resourceType: OrgAuditResource.SEAT_PLAN,
      resourceId: plan.id,
      meta: { organizationId, seatRole, seatLimit: limit, unitPriceCents: price, reason }
    });

    return plan;
  });
}

/** Muudab kohalimiiti. Limiiti EI SAA langetada alla juba hõivatud kohtade arvu. */
export async function updateSeatLimit(
  organizationId,
  seatPlanId,
  { actorUserId, seatLimit },
  { db = prisma } = {}
) {
  const limit = Number(seatLimit);
  if (!Number.isInteger(limit) || limit < 0) throw badRequest("org.errors.invalid_seat_limit");

  return db.$transaction(async (tx) => {
    const plan = await tx.organizationSeatPlan.findFirst({
      where: { id: seatPlanId, organizationId },
      select: { id: true, status: true, seatRole: true }
    });
    if (!plan) throw notFound("org.errors.seat_plan_not_found");
    if (plan.status !== OrganizationSeatPlanStatus.ACTIVE) throw conflict("org.errors.seat_plan_not_active");

    const used = await tx.organizationSeatAssignment.count({
      where: { seatPlanId, status: OrganizationSeatAssignmentStatus.ACTIVE }
    });
    if (limit < used) throw conflict("org.errors.seat_limit_below_used", { used, requested: limit });

    const updated = await tx.organizationSeatPlan.update({
      where: { id: seatPlanId },
      data: { seatLimit: limit }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.SEAT_PLAN_UPDATED,
      resourceType: OrgAuditResource.SEAT_PLAN,
      resourceId: seatPlanId,
      meta: { organizationId, seatRole: plan.seatRole, seatLimit: limit }
    });

    return updated;
  });
}

export async function endSeatPlan(organizationId, seatPlanId, { actorUserId, reason }, { db = prisma, now = new Date() } = {}) {
  return db.$transaction(async (tx) => {
    const plan = await tx.organizationSeatPlan.findFirst({
      where: { id: seatPlanId, organizationId },
      select: { id: true, status: true, seatRole: true }
    });
    if (!plan) throw notFound("org.errors.seat_plan_not_found");
    if (plan.status === OrganizationSeatPlanStatus.ENDED) throw conflict("org.errors.seat_plan_already_ended");

    /* Plaani lõpetamine lõpetab ka kohad. Alternatiiv — jätta kohad rippuma —
       tähendaks, et inimesel on koht plaanis, mida ei ole. */
    await tx.organizationSeatAssignment.updateMany({
      where: { seatPlanId, status: { not: OrganizationSeatAssignmentStatus.ENDED } },
      data: {
        status: OrganizationSeatAssignmentStatus.ENDED,
        endedAt: now,
        endedReason: "org.reason.seat_plan_ended"
      }
    });

    const updated = await tx.organizationSeatPlan.update({
      where: { id: seatPlanId },
      data: { status: OrganizationSeatPlanStatus.ENDED, validUntil: now }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.SEAT_PLAN_ENDED,
      resourceType: OrgAuditResource.SEAT_PLAN,
      resourceId: seatPlanId,
      meta: { organizationId, seatRole: plan.seatRole, reason: cleanReason(reason, 200) }
    });

    return updated;
  });
}

/**
 * Annab liikmele koha.
 *
 * SEAT-LIMIIDI VÕISTLUS on selle funktsiooni raskeim koht. Loendus ja
 * sisestus peavad olema ATOMAARSED: kaks samaaegset päringut viimasele vabale
 * kohale ei tohi mõlemad õnnestuda.
 *
 * Lahendus on kaheastmeline:
 *   1. `SELECT ... FOR UPDATE` plaanireal — see SERIALISEERIB kõik sama plaani
 *      kohtade andmised. Loendus toimub luku all, seega teine tehing ootab.
 *   2. osaline unikaalindeks `(membershipId) WHERE status='ACTIVE'` — teine lukk
 *      juhuks, kui keegi kirjutab mööda seda funktsiooni.
 * Ainult loendus ilma lukuta annaks klassikalise TOCTOU: mõlemad näevad
 * `used < limit` ja mõlemad kirjutavad.
 */
export async function assignSeat(
  organizationId,
  { actorUserId, seatPlanId, membershipId },
  { db = prisma } = {}
) {
  return db.$transaction(async (tx) => {
    const plan = await tx.organizationSeatPlan.findFirst({
      where: { id: seatPlanId, organizationId },
      select: { id: true, status: true, seatRole: true, seatLimit: true }
    });
    if (!plan) throw notFound("org.errors.seat_plan_not_found");
    if (plan.status !== OrganizationSeatPlanStatus.ACTIVE) throw conflict("org.errors.seat_plan_not_active");

    // 1. Serialiseeri kõik sama plaani kohaandmised.
    await tx.$queryRaw`SELECT "id" FROM "OrganizationSeatPlan" WHERE "id" = ${seatPlanId} FOR UPDATE`;

    const membership = await tx.organizationMembership.findFirst({
      where: { id: membershipId, organizationId },
      select: { id: true, status: true, seatRole: true, userId: true }
    });
    if (!membership) throw notFound("org.errors.membership_not_found");
    if (membership.status !== OrganizationMembershipStatus.ACTIVE) {
      throw conflict("org.errors.membership_not_active");
    }
    /* Koharoll peab klappima liikmesuse rolliga (arenduskava §5.6). Vastasel
       juhul maksaks organisatsioon spetsialisti hinda teenuseosutaja koha eest
       või vastupidi. */
    if (membership.seatRole !== plan.seatRole) {
      throw conflict("org.errors.seat_role_mismatch", {
        planRole: plan.seatRole,
        membershipRole: membership.seatRole
      });
    }

    const alreadySeated = await tx.organizationSeatAssignment.findFirst({
      where: { membershipId, status: OrganizationSeatAssignmentStatus.ACTIVE },
      select: { id: true }
    });
    if (alreadySeated) throw conflict("org.errors.seat_already_assigned");

    const used = await tx.organizationSeatAssignment.count({
      where: { seatPlanId, status: OrganizationSeatAssignmentStatus.ACTIVE }
    });
    if (used >= plan.seatLimit) {
      throw conflict("org.errors.seat_limit_reached", { used, seatLimit: plan.seatLimit });
    }

    const assignment = await tx.organizationSeatAssignment.create({
      data: {
        seatPlanId,
        membershipId,
        status: OrganizationSeatAssignmentStatus.ACTIVE,
        assignedByUserId: actorUserId
      }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      targetUserId: membership.userId,
      action: OrgAuditAction.SEAT_ASSIGNED,
      resourceType: OrgAuditResource.SEAT_ASSIGNMENT,
      resourceId: assignment.id,
      meta: { organizationId, membershipId, seatRole: plan.seatRole }
    });

    return assignment;
  });
}

export async function releaseSeat(
  organizationId,
  assignmentId,
  { actorUserId, reason },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const assignment = await tx.organizationSeatAssignment.findFirst({
      where: { id: assignmentId, seatPlan: { organizationId } },
      select: {
        id: true,
        status: true,
        membershipId: true,
        membership: { select: { userId: true } }
      }
    });
    if (!assignment) throw notFound("org.errors.seat_assignment_not_found");
    if (assignment.status === OrganizationSeatAssignmentStatus.ENDED) {
      throw conflict("org.errors.seat_already_released");
    }

    const updated = await tx.organizationSeatAssignment.update({
      where: { id: assignmentId },
      data: {
        status: OrganizationSeatAssignmentStatus.ENDED,
        endedAt: now,
        endedReason: cleanReason(reason)
      }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      targetUserId: assignment.membership?.userId || null,
      action: OrgAuditAction.SEAT_RELEASED,
      resourceType: OrgAuditResource.SEAT_ASSIGNMENT,
      resourceId: assignmentId,
      meta: { organizationId, membershipId: assignment.membershipId }
    });

    return updated;
  });
}

/**
 * Rahastuse ülevaade organisatsioonile.
 *
 * MIDA SIIN EI OLE (arenduskava §5.6, §7.4): ühegi inimese kasutussagedust,
 * vestluste arvu ega aktiivsust. Organisatsioon näeb, KELLE eest ta maksab —
 * mitte seda, mida see inimene teeb.
 */
export async function listSeatPlans(organizationId, { db = prisma } = {}) {
  const plans = await db.organizationSeatPlan.findMany({
    where: { organizationId },
    select: {
      id: true,
      seatRole: true,
      seatLimit: true,
      unitPriceCents: true,
      currency: true,
      billingInterval: true,
      source: true,
      priceReason: true,
      status: true,
      validFrom: true,
      validUntil: true,
      assignments: {
        where: { status: OrganizationSeatAssignmentStatus.ACTIVE },
        select: {
          id: true,
          startedAt: true,
          membershipId: true,
          membership: {
            select: {
              id: true,
              jobTitle: true,
              user: {
                select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } }
              }
            }
          }
        }
      }
    },
    orderBy: [{ status: "asc" }, { seatRole: "asc" }]
  });

  return plans.map((plan) => ({
    id: plan.id,
    seatRole: plan.seatRole,
    seatLimit: plan.seatLimit,
    unitPriceCents: plan.unitPriceCents,
    currency: plan.currency,
    billingInterval: plan.billingInterval,
    source: plan.source,
    priceReason: plan.priceReason,
    status: plan.status,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    usedSeats: plan.assignments.length,
    freeSeats: Math.max(0, plan.seatLimit - plan.assignments.length),
    assignments: plan.assignments.map((assignment) => ({
      id: assignment.id,
      membershipId: assignment.membershipId,
      startedAt: assignment.startedAt,
      jobTitle: assignment.membership?.jobTitle || null,
      person: {
        email: assignment.membership?.user?.email || null,
        firstName: assignment.membership?.user?.profile?.firstName || null,
        lastName: assignment.membership?.user?.profile?.lastName || null
      }
    }))
  }));
}

/** Kas sellel liikmesusel on aktiivne organisatsiooni koht? */
export async function findActiveSeatForMembership(membershipId, { db = prisma } = {}) {
  if (!membershipId) return null;
  return db.organizationSeatAssignment.findFirst({
    where: { membershipId, status: OrganizationSeatAssignmentStatus.ACTIVE },
    select: {
      id: true,
      seatPlanId: true,
      seatPlan: { select: { seatRole: true, status: true, organizationId: true } }
    }
  });
}
