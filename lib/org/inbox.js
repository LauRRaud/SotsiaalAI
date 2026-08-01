/**
 * T25 ORG-FUNDING-INBOX-V1 — organisatsiooni vastuvõtulaud ja töö määramine (E7).
 *
 * NÄHTAVUSE AHEL (arenduskava §5.7) on selle faili kandev reegel:
 *
 *   pöörduja saadab KINNITATUD paketi
 *     → koordinaator näeb TÄPSELT seda paketti, mitte Teekonda ega vestlust
 *       → määratud töötaja saab TÄPSELT sama ulatuse, mitte rohkem
 *         → üleandmine EI LAIENDA ulatust
 *
 * Postkastikirje ei dubleeri lähteobjekti sisu — ta kannab viidet ja seisu.
 * Sisu loetakse alati lähteobjektist läbi `projectSourcePackage`, mis on
 * VALGE NIMEKIRI. Musta nimekirja unustatakse täiendada ja siis lekib esimene
 * uus väli.
 *
 * MIDA SIIN EI OLE: AI triaaži, prioriteediarvutust, riskiskoori ega
 * automaatset määramist (arenduskava §13). Kiireloomulisuse märge on SAATJA
 * oma tekst, mida süsteem edastab muutmata kujul.
 */

import prisma from "@/lib/prisma";

import {
  LIVE_WORK_ASSIGNMENT_STATUSES,
  OrganizationCapability,
  OrganizationInboxSourceType,
  OrganizationInboxStatus,
  OrganizationMembershipStatus,
  OrganizationWorkAssignmentStatus,
  canTransitionInboxStatus
} from "./constants.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "./audit.js";
import { hasCapability } from "./accessContext.js";
import { unitScopeCovers } from "./units.js";

/**
 * VALGE NIMEKIRI sellest, mida vastuvõtja eelpöördumisest näeb.
 *
 * Need on täpselt samad väljad, mida näeb tänane ISIKLIK vastuvõtja
 * (`serializePreInquiry`, `isRecipient` haru) — organisatsiooni postkast ei
 * anna rohkem. `sourceJourneyId` on TEADLIKULT välja jäetud: pöörduja Teekond
 * ei kuulu organisatsioonile ja „jaga kogu Teekond" nuppu ei ole olemas.
 */
export function projectSourcePackage(inquiry) {
  if (!inquiry) return null;
  return {
    id: inquiry.id,
    topic: inquiry.topic || null,
    situation: inquiry.situation || null,
    generatedDraft: inquiry.generatedDraft || null,
    userEditedDraft: inquiry.userEditedDraft || null,
    assessmentState: inquiry.assessmentState || null,
    status: inquiry.status,
    sentAt: inquiry.sentAt,
    openedAt: inquiry.openedAt,
    recalledAt: inquiry.recalledAt,
    receiverNote: inquiry.receiverNote || "",
    nextContactOn: inquiry.nextContactOn || null
  };
}

const SOURCE_SELECT = Object.freeze({
  id: true,
  topic: true,
  situation: true,
  generatedDraft: true,
  userEditedDraft: true,
  assessmentState: true,
  status: true,
  sentAt: true,
  openedAt: true,
  recalledAt: true,
  receiverNote: true,
  nextContactOn: true,
  authorId: true
});

/**
 * Loob postkastikirje saadetud eelpöördumisest. Idempotentne:
 * `@@unique([organizationId, sourceType, sourceId])` tähendab, et sama
 * eelpöördumise korduv saatmine ei tekita teist kirjet.
 */
export async function deliverPreInquiryToOrganization(
  { preInquiryId, organizationId, unitId = null, urgencyDeclaredBySender = null },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const inquiry = await tx.preInquiry.findUnique({
      where: { id: preInquiryId },
      select: { id: true, status: true, recipientOrganizationId: true, authorId: true }
    });
    if (!inquiry) throw notFound("org.errors.inbox_source_not_found");
    if (inquiry.recipientOrganizationId !== organizationId) {
      throw conflict("org.errors.inbox_source_mismatch");
    }

    const existing = await tx.organizationInboxItem.findFirst({
      where: {
        organizationId,
        sourceType: OrganizationInboxSourceType.PRE_INQUIRY,
        sourceId: preInquiryId
      },
      select: { id: true }
    });
    if (existing) return existing;

    const item = await tx.organizationInboxItem.create({
      data: {
        organizationId,
        unitId,
        sourceType: OrganizationInboxSourceType.PRE_INQUIRY,
        sourceId: preInquiryId,
        status: OrganizationInboxStatus.RECEIVED,
        receivedAt: now,
        lastTransitionAt: now,
        urgencyDeclaredBySender: urgencyDeclaredBySender
          ? String(urgencyDeclaredBySender).slice(0, 200)
          : null
      }
    });

    await writeOrgAudit(tx, {
      actorUserId: null,
      action: OrgAuditAction.INBOX_ITEM_RECEIVED,
      resourceType: OrgAuditResource.INBOX_ITEM,
      resourceId: item.id,
      meta: { organizationId, inboxItemId: item.id, sourceType: OrganizationInboxSourceType.PRE_INQUIRY }
    });

    return item;
  });
}

/**
 * Saatja tagasivõtmine. Kutsutakse eelpöördumise recall-rajalt.
 * Sulgeb ka elavad määramised — töö, mida enam ei ole, ei tohi jääda kellegi
 * ülesandeks.
 */
export async function recallInboxItemForSource(
  { sourceId, sourceType = OrganizationInboxSourceType.PRE_INQUIRY },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const item = await tx.organizationInboxItem.findFirst({
      where: { sourceType, sourceId },
      select: { id: true, organizationId: true, status: true }
    });
    if (!item) return null;
    if (item.status === OrganizationInboxStatus.RECALLED) return item;

    await tx.organizationWorkAssignment.updateMany({
      where: { inboxItemId: item.id, status: { in: [...LIVE_WORK_ASSIGNMENT_STATUSES] } },
      data: { status: OrganizationWorkAssignmentStatus.ENDED, endedAt: now }
    });

    const updated = await tx.organizationInboxItem.update({
      where: { id: item.id },
      data: { status: OrganizationInboxStatus.RECALLED, lastTransitionAt: now }
    });

    await writeOrgAudit(tx, {
      actorUserId: null,
      action: OrgAuditAction.INBOX_ITEM_TRANSITIONED,
      resourceType: OrgAuditResource.INBOX_ITEM,
      resourceId: item.id,
      meta: {
        organizationId: item.organizationId,
        inboxItemId: item.id,
        fromInboxStatus: item.status,
        toInboxStatus: OrganizationInboxStatus.RECALLED
      }
    });

    return updated;
  });
}

/**
 * Milliseid postkasti kirjeid see kontekst näeb?
 *
 * KOLM TASET:
 *   - `INBOX_COORDINATOR` org-skoobis → kogu postkast;
 *   - `INBOX_COORDINATOR` üksuse skoobis → ainult selle üksuse alampuu;
 *   - tavaline liige → MITTE MIDAGI, isegi mitte kirjete arvu.
 * Lisaks näeb iga liige talle MÄÄRATUD tööd, ka ilma koordinaatori õiguseta.
 */
function inboxScopeFilter(context) {
  const organizationId = context.organization.id;
  const grants = context.capabilities.filter(
    (grant) => grant.capability === OrganizationCapability.INBOX_COORDINATOR
  );

  const orgWide = grants.some((grant) => grant.scopeType === "ORGANIZATION");
  if (orgWide) return { organizationId };

  const unitIds = new Set();
  for (const grant of grants) {
    if (!grant.scopeUnitId) continue;
    for (const unit of context._unitTree || []) {
      if (unitScopeCovers(grant.scopeUnitId, unit.id, context._unitTree || [])) unitIds.add(unit.id);
    }
  }

  const membershipId = context.membership?.id;
  const assignedClause = membershipId
    ? [{ assignments: { some: { assigneeMembershipId: membershipId, status: { in: [...LIVE_WORK_ASSIGNMENT_STATUSES] } } } }]
    : [];

  if (!unitIds.size && !assignedClause.length) return null;

  return {
    organizationId,
    OR: [...(unitIds.size ? [{ unitId: { in: [...unitIds] } }] : []), ...assignedClause]
  };
}

export async function listInboxItems(context, { db = prisma, includeClosed = false, take = 100 } = {}) {
  const where = inboxScopeFilter(context);
  // Tavaline liige ei näe ühist postkasti — tühi loend, mitte 403.
  // Vastasel korral paljastaks veakood postkasti olemasolu.
  if (!where) return [];

  const rows = await db.organizationInboxItem.findMany({
    where: {
      ...where,
      ...(includeClosed
        ? {}
        : { status: { notIn: [OrganizationInboxStatus.CLOSED, OrganizationInboxStatus.RECALLED] } })
    },
    select: {
      id: true,
      status: true,
      sourceType: true,
      sourceId: true,
      receivedAt: true,
      lastTransitionAt: true,
      dueAt: true,
      urgencyDeclaredBySender: true,
      unit: { select: { id: true, name: true } },
      assignments: {
        where: { status: { in: [...LIVE_WORK_ASSIGNMENT_STATUSES] } },
        select: {
          id: true,
          status: true,
          assignedAt: true,
          acceptedAt: true,
          assigneeMembershipId: true,
          assignee: {
            select: {
              id: true,
              jobTitle: true,
              user: { select: { profile: { select: { firstName: true, lastName: true } } } }
            }
          }
        }
      }
    },
    orderBy: [{ receivedAt: "desc" }],
    take: Math.min(Math.max(Number(take) || 100, 1), 200)
  });

  /* Loend EI kanna lähteobjekti sisu — ainult seisu ja vastutajat. Sisu
     avaneb ühe kirje avamisel, mis on eraldi teadlik samm ja eraldi audit. */
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    sourceType: row.sourceType,
    receivedAt: row.receivedAt,
    lastTransitionAt: row.lastTransitionAt,
    dueAt: row.dueAt,
    urgencyDeclaredBySender: row.urgencyDeclaredBySender,
    unit: row.unit ? { id: row.unit.id, name: row.unit.name } : null,
    assignment: row.assignments[0]
      ? {
          id: row.assignments[0].id,
          status: row.assignments[0].status,
          assignedAt: row.assignments[0].assignedAt,
          acceptedAt: row.assignments[0].acceptedAt,
          membershipId: row.assignments[0].assigneeMembershipId,
          jobTitle: row.assignments[0].assignee?.jobTitle || null,
          firstName: row.assignments[0].assignee?.user?.profile?.firstName || null,
          lastName: row.assignments[0].assignee?.user?.profile?.lastName || null
        }
      : null
  }));
}

/**
 * Kas see kontekst tohib SEDA kirjet avada? Koordinaator oma skoobis või
 * kirjele määratud töötaja. Kõik muu on 404 — mitte 403, sest võõra üksuse
 * kirje olemasolu ei tohi lekkida.
 */
async function requireVisibleInboxItem(tx, context, inboxItemId) {
  const item = await tx.organizationInboxItem.findFirst({
    where: { id: inboxItemId, organizationId: context.organization.id },
    select: {
      id: true,
      organizationId: true,
      unitId: true,
      status: true,
      sourceType: true,
      sourceId: true,
      receivedAt: true,
      urgencyDeclaredBySender: true,
      assignments: {
        where: { status: { in: [...LIVE_WORK_ASSIGNMENT_STATUSES] } },
        select: { id: true, assigneeMembershipId: true, status: true }
      }
    }
  });
  if (!item) throw notFound("org.errors.inbox_item_not_found");

  const isCoordinator = hasCapability(context, OrganizationCapability.INBOX_COORDINATOR, {
    unitId: item.unitId
  });
  const isAssignee = item.assignments.some(
    (assignment) => assignment.assigneeMembershipId === context.membership?.id
  );
  if (!isCoordinator && !isAssignee) throw notFound("org.errors.inbox_item_not_found");

  return { item, isCoordinator, isAssignee };
}

/** Avab kirje koos saatja kinnitatud paketiga. */
export async function getInboxItem(context, inboxItemId, { db = prisma } = {}) {
  return db.$transaction(async (tx) => {
    const { item, isCoordinator, isAssignee } = await requireVisibleInboxItem(tx, context, inboxItemId);

    const inquiry = await tx.preInquiry.findUnique({
      where: { id: item.sourceId },
      select: SOURCE_SELECT
    });

    return {
      id: item.id,
      status: item.status,
      unitId: item.unitId,
      receivedAt: item.receivedAt,
      urgencyDeclaredBySender: item.urgencyDeclaredBySender,
      isCoordinator,
      isAssignee,
      /* Määratud töötaja saab TÄPSELT sama projektsiooni mis koordinaator —
         ei rohkem (uus sisu) ega vähem (poolik pakett). */
      source: projectSourcePackage(inquiry)
    };
  });
}

/** Postkasti seisusiire. Ainult koordinaator, ainult lubatud siirded. */
export async function transitionInboxItem(
  context,
  inboxItemId,
  { toStatus, reason },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const { item, isCoordinator } = await requireVisibleInboxItem(tx, context, inboxItemId);
    if (!isCoordinator) throw notFound("org.errors.inbox_item_not_found");

    if (toStatus === OrganizationInboxStatus.RECALLED) {
      // Tagasivõtmine on SAATJA õigus. Organisatsioon ei saa seda ise valida.
      throw badRequest("org.errors.inbox_recall_is_sender_right");
    }
    if (!canTransitionInboxStatus(item.status, toStatus)) {
      throw conflict("org.errors.invalid_inbox_transition", { fromStatus: item.status, toStatus });
    }

    const closing =
      toStatus === OrganizationInboxStatus.CLOSED || toStatus === OrganizationInboxStatus.REJECTED;

    const updated = await tx.organizationInboxItem.update({
      where: { id: inboxItemId },
      data: {
        status: toStatus,
        lastTransitionAt: now,
        closedAt: closing ? now : null,
        closedReason: closing && reason ? String(reason).slice(0, 500) : null
      }
    });

    if (closing) {
      await tx.organizationWorkAssignment.updateMany({
        where: { inboxItemId, status: { in: [...LIVE_WORK_ASSIGNMENT_STATUSES] } },
        data: { status: OrganizationWorkAssignmentStatus.ENDED, endedAt: now }
      });
    }

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.INBOX_ITEM_TRANSITIONED,
      resourceType: OrgAuditResource.INBOX_ITEM,
      resourceId: inboxItemId,
      meta: {
        organizationId: item.organizationId,
        inboxItemId,
        fromInboxStatus: item.status,
        toInboxStatus: toStatus
      }
    });

    return updated;
  });
}

/**
 * Määrab töö. Nõuab `WORK_ASSIGNER` õigust kirje üksuse skoobis.
 *
 * Topeltmääramise võistlus on kaetud osalise unikaalindeksiga
 * `(inboxItemId) WHERE status IN ('PENDING','ACCEPTED')` — kaks samaaegset
 * määramist ei saa mõlemad õnnestuda ka siis, kui mõlemad nägid tühja kohta.
 */
export async function assignWork(
  context,
  inboxItemId,
  { assigneeMembershipId },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const { item } = await requireVisibleInboxItem(tx, context, inboxItemId);
    if (!hasCapability(context, OrganizationCapability.WORK_ASSIGNER, { unitId: item.unitId })) {
      throw notFound("org.errors.inbox_item_not_found");
    }
    if (item.assignments.length) throw conflict("org.errors.work_already_assigned");

    const assignee = await tx.organizationMembership.findFirst({
      where: {
        id: assigneeMembershipId,
        organizationId: context.organization.id,
        status: OrganizationMembershipStatus.ACTIVE
      },
      select: { id: true, userId: true }
    });
    if (!assignee) throw notFound("org.errors.membership_not_found");

    const assignment = await tx.organizationWorkAssignment.create({
      data: {
        inboxItemId,
        assigneeMembershipId,
        status: OrganizationWorkAssignmentStatus.PENDING,
        assignedByUserId: context.userId,
        assignedAt: now
      }
    });

    if (canTransitionInboxStatus(item.status, OrganizationInboxStatus.ASSIGNED)) {
      await tx.organizationInboxItem.update({
        where: { id: inboxItemId },
        data: { status: OrganizationInboxStatus.ASSIGNED, lastTransitionAt: now }
      });
    }

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      targetUserId: assignee.userId,
      action: OrgAuditAction.WORK_ASSIGNED,
      resourceType: OrgAuditResource.WORK_ASSIGNMENT,
      resourceId: assignment.id,
      meta: { organizationId: item.organizationId, inboxItemId, membershipId: assigneeMembershipId }
    });

    return assignment;
  });
}

/** Määratud töötaja võtab töö vastu või lükkab tagasi. Ainult tema ise. */
export async function respondToAssignment(
  context,
  assignmentId,
  { accept, reason },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const assignment = await tx.organizationWorkAssignment.findFirst({
      where: {
        id: assignmentId,
        inboxItem: { organizationId: context.organization.id },
        assigneeMembershipId: context.membership?.id
      },
      select: { id: true, status: true, inboxItemId: true, inboxItem: { select: { organizationId: true, status: true } } }
    });
    if (!assignment) throw notFound("org.errors.work_assignment_not_found");
    if (assignment.status !== OrganizationWorkAssignmentStatus.PENDING) {
      throw conflict("org.errors.work_assignment_not_pending");
    }

    const updated = await tx.organizationWorkAssignment.update({
      where: { id: assignmentId },
      data: accept
        ? { status: OrganizationWorkAssignmentStatus.ACCEPTED, acceptedAt: now }
        : {
            status: OrganizationWorkAssignmentStatus.REJECTED,
            rejectedAt: now,
            rejectedReason: reason ? String(reason).slice(0, 500) : null
          }
    });

    const nextStatus = accept
      ? OrganizationInboxStatus.ACCEPTED
      : OrganizationInboxStatus.ASSIGNMENT_PENDING;
    if (canTransitionInboxStatus(assignment.inboxItem.status, nextStatus)) {
      await tx.organizationInboxItem.update({
        where: { id: assignment.inboxItemId },
        data: { status: nextStatus, lastTransitionAt: now }
      });
    }

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: accept ? OrgAuditAction.WORK_ACCEPTED : OrgAuditAction.WORK_REJECTED,
      resourceType: OrgAuditResource.WORK_ASSIGNMENT,
      resourceId: assignmentId,
      meta: {
        organizationId: assignment.inboxItem.organizationId,
        inboxItemId: assignment.inboxItemId
      }
    });

    return updated;
  });
}

/**
 * Üleandmine: vana määramine SULETAKSE ja luuakse UUS, mis viitab vanale.
 * `ownerId` vaikset ülekirjutust ei toimu ja ajalugu säilib (arenduskava §5.7).
 *
 * Jagamisulatus EI LAIENE: uus vastutaja saab täpselt sama `projectSourcePackage`
 * projektsiooni, mille sai eelmine.
 */
export async function handOverWork(
  context,
  assignmentId,
  { toMembershipId, reason },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const current = await tx.organizationWorkAssignment.findFirst({
      where: { id: assignmentId, inboxItem: { organizationId: context.organization.id } },
      select: {
        id: true,
        status: true,
        inboxItemId: true,
        assigneeMembershipId: true,
        inboxItem: { select: { organizationId: true, unitId: true, status: true } }
      }
    });
    if (!current) throw notFound("org.errors.work_assignment_not_found");
    if (!LIVE_WORK_ASSIGNMENT_STATUSES.includes(current.status)) {
      throw conflict("org.errors.work_assignment_not_live");
    }

    /* Üle anda tohib kas töö määraja või senine vastutaja ise. Teine variant
       on tahtlik: puhkusele minev töötaja peab saama töö edasi anda ilma, et
       ta peaks juhi kätte saama. */
    const isAssigner = hasCapability(context, OrganizationCapability.WORK_ASSIGNER, {
      unitId: current.inboxItem.unitId
    });
    const isCurrentAssignee = current.assigneeMembershipId === context.membership?.id;
    if (!isAssigner && !isCurrentAssignee) throw notFound("org.errors.work_assignment_not_found");

    if (toMembershipId === current.assigneeMembershipId) throw conflict("org.errors.work_handover_same_person");

    const next = await tx.organizationMembership.findFirst({
      where: {
        id: toMembershipId,
        organizationId: context.organization.id,
        status: OrganizationMembershipStatus.ACTIVE
      },
      select: { id: true, userId: true }
    });
    if (!next) throw notFound("org.errors.membership_not_found");

    await tx.organizationWorkAssignment.update({
      where: { id: assignmentId },
      data: { status: OrganizationWorkAssignmentStatus.HANDED_OVER, endedAt: now }
    });

    const created = await tx.organizationWorkAssignment.create({
      data: {
        inboxItemId: current.inboxItemId,
        assigneeMembershipId: toMembershipId,
        status: OrganizationWorkAssignmentStatus.PENDING,
        assignedByUserId: context.userId,
        assignedAt: now,
        supersedesAssignmentId: assignmentId
      }
    });

    if (canTransitionInboxStatus(current.inboxItem.status, OrganizationInboxStatus.ASSIGNED)) {
      await tx.organizationInboxItem.update({
        where: { id: current.inboxItemId },
        data: { status: OrganizationInboxStatus.ASSIGNED, lastTransitionAt: now }
      });
    }

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      targetUserId: next.userId,
      action: OrgAuditAction.WORK_HANDED_OVER,
      resourceType: OrgAuditResource.WORK_ASSIGNMENT,
      resourceId: created.id,
      meta: {
        organizationId: current.inboxItem.organizationId,
        inboxItemId: current.inboxItemId,
        assignmentId,
        membershipId: toMembershipId,
        reason: reason ? String(reason).slice(0, 200) : null
      }
    });

    return created;
  });
}

/**
 * Offboardingu värav: kas sellel liikmesusel on veel elavat organisatsiooni tööd?
 *
 * Arenduskava §E7: „offboarding leiab poolelioleva töö ja nõuab üleandmist".
 * `OrganizationWorkAssignment.assignee` on `onDelete: Restrict`, seega ka DB
 * ei lase liikmesust ära kustutada nii, et töö jääks omanikuta.
 */
export async function findLiveWorkForMembership(membershipId, { db = prisma } = {}) {
  if (!membershipId) return [];
  return db.organizationWorkAssignment.findMany({
    where: { assigneeMembershipId: membershipId, status: { in: [...LIVE_WORK_ASSIGNMENT_STATUSES] } },
    select: { id: true, inboxItemId: true, status: true, assignedAt: true }
  });
}
