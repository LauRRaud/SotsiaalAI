import prisma from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_AVAILABILITY_FRESH_DAYS = 28;

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
  { db = prisma, now = new Date(), limit = 7, availabilityFreshDays } = {}
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

  const [drafts, received, memberships, wellbeingDrafts, journeys, assignments, services] = await Promise.all([
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
      badgeKey: "add_person"
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
      href: "/tooheaolu",
      labelKey: "workspace_continuity.wellbeing_draft",
      date: iso(draft.updatedAt),
      priority: 6,
      badgeKey: "wellbeing"
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

  candidates.sort(compareCandidates);
  const seenHrefs = new Set();
  const deduplicated = candidates.filter((candidate) => {
    if (seenHrefs.has(candidate.href)) return false;
    seenHrefs.add(candidate.href);
    return true;
  });

  return {
    items: deduplicated.slice(0, take).map(({ priority: _priority, badgeKey: _badgeKey, ...item }) => item),
    badges: badgeCounts(deduplicated)
  };
}

export const workspaceContinuityInternals = Object.freeze({
  tallinnDate,
  compareCandidates
});
