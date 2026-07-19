import prisma from "@/lib/prisma";
import { buildSupervisionContinuity } from "@/lib/supervision/notifications";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_AVAILABILITY_FRESH_DAYS = 28;
const WORKBENCH_ROLES = new Set(["CLIENT", "SOCIAL_WORKER", "SERVICE_PROVIDER"]);
const ROLE_KIND_PRIORITY = Object.freeze({
  CLIENT: Object.freeze({
    journey: 0,
    pre_inquiry_draft: 1,
    room_unread: 2,
    wellbeing_draft: 3
  }),
  SOCIAL_WORKER: Object.freeze({
    next_contact: 0,
    field_visit: 1,
    practice_review: 2,
    pre_inquiry_received: 3,
    supervision: 4,
    mentoring: 4,
    room_unread: 5,
    wellbeing_draft: 6
  }),
  SERVICE_PROVIDER: Object.freeze({
    next_contact: 0,
    field_visit: 1,
    pre_inquiry_received: 2,
    service_availability: 3,
    supervision: 4,
    mentoring: 4,
    room_unread: 5
  })
});

function normalizeWorkbenchRole(role) {
  const normalized = String(role || "").trim().toUpperCase();
  return WORKBENCH_ROLES.has(normalized) ? normalized : null;
}

function tallinnDate(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tallinn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function iso(value) {
  const date = value instanceof Date ? value : new Date(value || 0);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function addCandidate(list, candidate) {
  if (!candidate?.id || !candidate?.href || !candidate?.labelKey) return;
  list.push({
    kind: candidate.kind,
    id: String(candidate.id),
    href: candidate.href,
    labelKey: candidate.labelKey,
    date: candidate.date || null,
    priority: candidate.priority,
    badgeKey: candidate.badgeKey || null,
    overdue: Boolean(candidate.overdue)
  });
}

function compareCandidates(a, b) {
  if (a.priority !== b.priority) return a.priority - b.priority;
  if (a.kind === "next_contact" && b.kind === "next_contact" && a.date !== b.date) {
    return String(a.date || "").localeCompare(String(b.date || ""));
  }
  const dateOrder = String(b.date || "").localeCompare(String(a.date || ""));
  if (dateOrder) return dateOrder;
  const kindOrder = a.kind.localeCompare(b.kind);
  if (kindOrder) return kindOrder;
  return a.id.localeCompare(b.id);
}

function badgeCounts(candidates) {
  const counts = new Map();
  for (const item of candidates) {
    if (!item.badgeKey) continue;
    counts.set(item.badgeKey, (counts.get(item.badgeKey) || 0) + 1);
  }
  return Object.fromEntries([...counts].map(([key, count]) => [key, {
    type: "number",
    value: Math.min(count, 99),
    label: count > 99 ? "99+" : String(count)
  }]));
}

export async function getWorkspaceContinuity(
  userId,
  { db = prisma, now = new Date(), limit = 7, availabilityFreshDays, role } = {}
) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return { items: [], badges: {} };
  const take = Math.max(1, Math.min(Number(limit) || 7, 7));
  const today = tallinnDate(now);
  const freshDays = Math.max(
    1,
    Number(availabilityFreshDays || process.env.SERVICE_AVAILABILITY_FRESH_DAYS || DEFAULT_AVAILABILITY_FRESH_DAYS)
  );
  const availabilityCutoff = new Date(now.getTime() - freshDays * DAY_MS);

  const [
    drafts, received, memberships, wellbeingDrafts, journeys, assignments, services,
    mentoringRequests, mentoringRelations, mentoringSummaries, mentoringMeetings, fieldVisits
  ] = await Promise.all([
    db.preInquiry.findMany({
      where: { authorId: normalizedUserId, status: "DRAFT" },
      select: { id: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 20
    }),
    db.preInquiry.findMany({
      where: {
        recipientOwnerId: normalizedUserId,
        recalledAt: null,
        status: { in: ["SENT", "READY"] },
        OR: [{ sentAt: { not: null } }, { status: "SENT" }]
      },
      select: { id: true, status: true, nextContactOn: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 30
    }),
    db.roomMember.findMany({
      where: { userId: normalizedUserId, leftAt: null },
      select: { roomId: true, lastReadAt: true },
      orderBy: [{ joinedAt: "asc" }, { roomId: "asc" }],
      take: 30
    }),
    db.wellbeingOutputDraft.findMany({
      where: { userId: normalizedUserId, status: "draft", userConfirmed: false },
      select: { id: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 10
    }),
    db.journey.findMany({
      where: { ownerUserId: normalizedUserId, status: "ACTIVE" },
      select: { id: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 10
    }),
    db.effectivePracticeReviewAssignment.findMany({
      where: { reviewerId: normalizedUserId, status: "ASSIGNED", completedAt: null },
      select: { id: true, practiceId: true, assignedAt: true, updatedAt: true },
      orderBy: [{ assignedAt: "asc" }, { id: "asc" }],
      take: 20
    }),
    db.serviceProviderService.findMany({
      where: {
        status: "PUBLISHED",
        providerProfile: { ownerId: normalizedUserId },
        OR: [
          { availabilityCheckedAt: null },
          { availabilityCheckedAt: { lt: availabilityCutoff } }
        ]
      },
      select: { id: true, providerProfileId: true, availabilityCheckedAt: true, updatedAt: true },
      orderBy: [{ availabilityCheckedAt: "asc" }, { id: "asc" }],
      take: 20
    }),
    db.mentoringRequest.findMany({
      where: { mentorUserId: normalizedUserId, status: "PENDING" },
      select: { id: true, updatedAt: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 10
    }),
    db.mentoringRelation.findMany({
      where: {
        status: { in: ["DRAFT", "ACTIVE", "PAUSED"] },
        agreementText: { not: null },
        OR: [{ mentorUserId: normalizedUserId }, { menteeUserId: normalizedUserId }]
      },
      select: {
        id: true,
        agreementVersion: true,
        updatedAt: true,
        agreementAcceptances: {
          where: { userId: normalizedUserId },
          select: { agreementVersion: true }
        }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 20
    }),
    db.mentoringSummary.findMany({
      where: {
        status: "PENDING_CONFIRM",
        relation: {
          status: { in: ["ACTIVE", "PAUSED"] },
          OR: [{ mentorUserId: normalizedUserId }, { menteeUserId: normalizedUserId }]
        },
        confirmations: { none: { userId: normalizedUserId } }
      },
      select: { id: true, relationId: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 10
    }),
    db.mentoringMeeting.findMany({
      where: {
        status: "PLANNED",
        occurredAt: { gte: now },
        relation: {
          status: "ACTIVE",
          OR: [{ mentorUserId: normalizedUserId }, { menteeUserId: normalizedUserId }]
        }
      },
      select: { id: true, relationId: true, occurredAt: true },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      take: 10
    }),
    db.fieldVisit.findMany({
      where: {
        ownerUserId: normalizedUserId,
        status: { in: ["PLANNED", "IN_PROGRESS", "WRAP_UP"] }
      },
      select: {
        id: true,
        status: true,
        plannedStartAt: true,
        safetyArmedAt: true,
        safetyCancelledAt: true,
        updatedAt: true
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 10
    })
  ]);

  const roomUnread = await Promise.all(memberships.map(async (membership) => ({
    ...membership,
    unreadCount: await db.roomMessage.count({
      where: {
        roomId: membership.roomId,
        deletedAt: null,
        authorId: { not: normalizedUserId },
        createdAt: { gt: membership.lastReadAt || new Date(0) }
      }
    })
  })));

  const candidates = [];
  for (const visit of fieldVisits) {
    const armed = Boolean(visit.safetyArmedAt && !visit.safetyCancelledAt);
    const active = visit.status === "IN_PROGRESS" || armed;
    addCandidate(candidates, {
      kind: "field_visit",
      id: visit.id,
      href: `/valitoo/${encodeURIComponent(visit.id)}`,
      labelKey: active
        ? "workspace_continuity.field_visit_active"
        : "workspace_continuity.field_visit",
      date: iso(visit.plannedStartAt || visit.updatedAt),
      priority: active ? 1 : 5,
      badgeKey: "field_visits"
    });
  }
  for (const inquiry of received) {
    const nextContactOn = String(inquiry.nextContactOn || "");
    if (nextContactOn) {
      const overdue = nextContactOn <= today;
      addCandidate(candidates, {
        kind: "next_contact",
        id: inquiry.id,
        href: `/eelpoordumised?openInquiry=${encodeURIComponent(inquiry.id)}`,
        labelKey: overdue
          ? "workspace_continuity.next_contact_overdue"
          : "workspace_continuity.next_contact_upcoming",
        date: nextContactOn,
        priority: overdue ? 0 : 4,
        badgeKey: "pre_inquiries",
        overdue
      });
    }
    addCandidate(candidates, {
      kind: "pre_inquiry_received",
      id: inquiry.id,
      href: `/eelpoordumised?openInquiry=${encodeURIComponent(inquiry.id)}`,
      labelKey: "workspace_continuity.pre_inquiry_received",
      date: iso(inquiry.updatedAt),
      priority: 2,
      badgeKey: "pre_inquiries"
    });
  }
  for (const assignment of assignments) {
    addCandidate(candidates, {
      kind: "practice_review",
      id: assignment.id,
      href: `/parimad-praktikad?practice=${encodeURIComponent(assignment.practiceId)}`,
      labelKey: "workspace_continuity.practice_review",
      date: iso(assignment.assignedAt || assignment.updatedAt),
      priority: 1,
      badgeKey: "effective_practices"
    });
  }
  for (const membership of roomUnread) {
    if (!membership.unreadCount) continue;
    addCandidate(candidates, {
      kind: "room_unread",
      id: membership.roomId,
      href: `/vestlus?roomId=${encodeURIComponent(membership.roomId)}`,
      labelKey: "workspace_continuity.room_unread",
      date: iso(membership.lastReadAt || 0),
      priority: 3,
      badgeKey: "room_unread"
    });
  }
  for (const service of services) {
    addCandidate(candidates, {
      kind: "service_availability",
      id: service.id,
      href: `/teenuseprofiil?profileId=${encodeURIComponent(service.providerProfileId)}`,
      labelKey: "workspace_continuity.service_availability",
      date: iso(service.availabilityCheckedAt || service.updatedAt),
      priority: 4,
      badgeKey: "service_profile"
    });
  }
  for (const inquiry of drafts) {
    addCandidate(candidates, {
      kind: "pre_inquiry_draft",
      id: inquiry.id,
      href: `/eelpoordumised?openInquiry=${encodeURIComponent(inquiry.id)}`,
      labelKey: "workspace_continuity.pre_inquiry_draft",
      date: iso(inquiry.updatedAt),
      priority: 5,
      badgeKey: "pre_inquiries"
    });
  }
  for (const draft of wellbeingDrafts) {
    addCandidate(candidates, {
      kind: "wellbeing_draft",
      id: draft.id,
      /* V6 parandus: uks avaneb konkreetsele mustandile „Minu kirjed" vaates,
         mitte tühjale /tooheaolu avalehele (ptk 3.3 naasmispunkt). */
      href: `/tooheaolu/minu-kirjed?draft=${encodeURIComponent(draft.id)}`,
      labelKey: "workspace_continuity.wellbeing_draft",
      date: iso(draft.updatedAt),
      priority: 6,
      badgeKey: "wellbeing"
    });
  }
  for (const request of mentoringRequests) {
    addCandidate(candidates, {
      kind: "mentoring",
      id: request.id,
      href: "/mentorlus",
      labelKey: "workspace_continuity.mentoring_request",
      date: iso(request.updatedAt),
      priority: 2,
      badgeKey: "mentoring"
    });
  }
  for (const relation of mentoringRelations) {
    const accepted = (relation.agreementAcceptances || []).some(
      (a) => a.agreementVersion === relation.agreementVersion
    );
    if (accepted) continue;
    addCandidate(candidates, {
      kind: "mentoring",
      id: relation.id,
      href: `/mentorlus/suhe/${encodeURIComponent(relation.id)}`,
      labelKey: "workspace_continuity.mentoring_agreement",
      date: iso(relation.updatedAt),
      priority: 2,
      badgeKey: "mentoring"
    });
  }
  for (const summary of mentoringSummaries) {
    addCandidate(candidates, {
      kind: "mentoring",
      id: summary.id,
      href: `/mentorlus/suhe/${encodeURIComponent(summary.relationId)}`,
      labelKey: "workspace_continuity.mentoring_summary",
      date: iso(summary.updatedAt),
      priority: 3,
      badgeKey: "mentoring"
    });
  }
  for (const meeting of mentoringMeetings) {
    addCandidate(candidates, {
      kind: "mentoring",
      id: meeting.id,
      href: `/mentorlus/suhe/${encodeURIComponent(meeting.relationId)}`,
      labelKey: "workspace_continuity.mentoring_meeting",
      date: iso(meeting.occurredAt),
      priority: 4,
      badgeKey: "mentoring"
    });
  }
  for (const journey of journeys) {
    addCandidate(candidates, {
      kind: "journey",
      id: journey.id,
      href: `/teekond/${encodeURIComponent(journey.id)}`,
      labelKey: "workspace_continuity.journey",
      date: iso(journey.updatedAt),
      priority: 7,
      badgeKey: "journey"
    });
  }

  // Supervisiooni allikas (Q2.8): kuni 2 kirjet; CLIENT ei ole liige.
  if (String(role || "").trim().toUpperCase() !== "CLIENT") {
    const supervisionItems = await buildSupervisionContinuity(db, normalizedUserId, { now });
    for (const item of supervisionItems) {
      addCandidate(candidates, { ...item, badgeKey: "supervision" });
    }
  }

  candidates.sort(compareCandidates);
  const normalizedRole = normalizeWorkbenchRole(role);
  const rolePriority = normalizedRole ? ROLE_KIND_PRIORITY[normalizedRole] : null;
  const roleCandidates = rolePriority
    ? candidates
      .filter((candidate) => Object.hasOwn(rolePriority, candidate.kind))
      .map((candidate) => ({ ...candidate, priority: rolePriority[candidate.kind] }))
      .sort(compareCandidates)
    : candidates;
  const seenHrefs = new Set();
  const deduplicated = roleCandidates.filter((candidate) => {
    if (seenHrefs.has(candidate.href)) return false;
    seenHrefs.add(candidate.href);
    return true;
  });

  return {
    role: normalizedRole,
    items: deduplicated.slice(0, take).map(({ priority: _priority, badgeKey: _badgeKey, ...item }) => item),
    badges: badgeCounts(deduplicated)
  };
}

export const workspaceContinuityInternals = Object.freeze({
  tallinnDate,
  compareCandidates,
  normalizeWorkbenchRole,
  ROLE_KIND_PRIORITY
});
