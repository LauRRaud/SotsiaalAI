/**
 * KODUTEENUS K1-b — teavitused hooldusjuhile.
 *
 * TEAVITUS KANNAB AINULT KIRJE ID-d. Kliendi nime, kirje teksti, liiki ega
 * autorit teavitusse ei panda; e-kiri ütleb ainult, et platvormil on uus
 * teavitus (`lib/notificationDelivery.js`). Link ei kanna organisatsiooni ID-d:
 * see lahendatakse suunajas pärast õiguskontrolli
 * (`app/org/koduteenus/kirje/[entryId]`).
 *
 * SAADETAKSE PÄRAST TEHINGU KINNITAMIST ja parima püüdlusena.
 * `createNotificationEvent` kasutab kordumatuse jaoks `create` + unikaalsusvea
 * püüdmist, mis Postgresi tehingu sees katkestaks kogu tehingu; ja teavituse
 * ebaõnnestumine ei tohi salvestatud kirjet tagasi võtta. Sama muster mis
 * `lib/org/inbox.js`-is.
 */

import prisma from "@/lib/prisma";
import { NOTIFICATION_EVENT_TYPES, createNotificationEvent } from "@/lib/notifications";

import { OrganizationCapabilityScopeType, OrganizationMembershipStatus } from "../org/constants.js";
import { unitScopeCovers } from "../org/units.js";

import { CareEntryKind, HOME_CARE_COORDINATOR } from "./constants.js";

function personName(membership) {
  const profile = membership?.user?.profile;
  const full = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  return (full || membership?.jobTitle || "").slice(0, 200);
}

/**
 * Hooldusjuhid, kelle skoopi see üksus kuulub: kogu asutuse luba või üksuse
 * luba, mille alampuus klient on. Üksuseta klienti näeb ainult kogu asutuse
 * hooldusjuht (sama reegel mis `isCoordinatorFor`).
 */
export async function listCoordinatorMemberships(db, { organizationId, unitId = null, now = new Date() }) {
  const grants = await db.organizationCapabilityGrant.findMany({
    where: {
      capability: HOME_CARE_COORDINATOR,
      revokedAt: null,
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      membership: { organizationId, status: OrganizationMembershipStatus.ACTIVE }
    },
    select: {
      scopeType: true,
      scopeUnitId: true,
      membership: {
        select: {
          id: true,
          userId: true,
          jobTitle: true,
          user: { select: { profile: { select: { firstName: true, lastName: true } } } }
        }
      }
    }
  });
  if (!grants.length) return [];

  const needsTree = grants.some((grant) => grant.scopeType === OrganizationCapabilityScopeType.UNIT);
  const tree = needsTree
    ? await db.organizationUnit.findMany({ where: { organizationId }, select: { id: true, parentUnitId: true } })
    : [];

  const byMembership = new Map();
  for (const grant of grants) {
    const covers =
      grant.scopeType === OrganizationCapabilityScopeType.ORGANIZATION ||
      (unitId && grant.scopeUnitId && unitScopeCovers(grant.scopeUnitId, unitId, tree));
    if (!covers || !grant.membership?.id) continue;
    byMembership.set(grant.membership.id, {
      membershipId: grant.membership.id,
      userId: grant.membership.userId || null,
      name: personName(grant.membership)
    });
  }
  return [...byMembership.values()];
}

/**
 * Uus erijuhtum, mure või autori täiendus: teade kõigile hooldusjuhtidele, kelle
 * skoobis klient on, välja arvatud kirjutaja ise. Tagastab loodud teavituste arvu.
 */
export async function notifyCoordinatorsOfEntry(
  { entryId, organizationId, unitId = null, kind, actorMembershipId = null, dedupeSuffix = "v1" },
  { db = prisma, now = new Date() } = {}
) {
  const type =
    kind === CareEntryKind.CONCERN
      ? NOTIFICATION_EVENT_TYPES.HOME_CARE_CONCERN_RAISED
      : NOTIFICATION_EVENT_TYPES.HOME_CARE_INCIDENT_REPORTED;
  let created = 0;
  try {
    const coordinators = await listCoordinatorMemberships(db, { organizationId, unitId, now });
    for (const coordinator of coordinators) {
      if (!coordinator.userId || coordinator.membershipId === actorMembershipId) continue;
      try {
        const result = await createNotificationEvent(
          {
            type,
            userId: coordinator.userId,
            sourceId: entryId,
            targetId: entryId,
            dedupeSuffix,
            workspaceKind: "org_space",
            workspaceId: organizationId,
            emailPolicy: "OPTIONAL"
          },
          { db, now }
        );
        if (result?.created) created += 1;
      } catch (error) {
        console.error("[home_care] coordinator notification failed", error?.message || error);
      }
    }
  } catch (error) {
    console.error("[home_care] coordinator lookup failed", error?.message || error);
  }
  return created;
}

/** Erijuhtum määrati vastutajale. Iseendale määramisest teadet ei tule. */
export async function notifyIncidentAssignee(
  { entryId, organizationId, assigneeMembershipId, actorMembershipId = null, dedupeSuffix },
  { db = prisma, now = new Date() } = {}
) {
  if (!assigneeMembershipId || assigneeMembershipId === actorMembershipId) return 0;
  try {
    const membership = await db.organizationMembership.findFirst({
      where: { id: assigneeMembershipId, organizationId, status: OrganizationMembershipStatus.ACTIVE },
      select: { userId: true }
    });
    if (!membership?.userId) return 0;
    const result = await createNotificationEvent(
      {
        type: NOTIFICATION_EVENT_TYPES.HOME_CARE_INCIDENT_ASSIGNED,
        userId: membership.userId,
        sourceId: entryId,
        targetId: entryId,
        dedupeSuffix,
        workspaceKind: "org_space",
        workspaceId: organizationId,
        emailPolicy: "OPTIONAL"
      },
      { db, now }
    );
    return result?.created ? 1 : 0;
  } catch (error) {
    console.error("[home_care] assignee notification failed", error?.message || error);
    return 0;
  }
}

/**
 * Töötaja käigud muutusid (K3-d): käigumuster muutus või ühe päeva käik tõsteti ümber,
 * jäeti ära või taastati. Teade läheb töötajatele, keda muutus puudutab (kellele käik
 * tuli ja kellelt see ära läks), välja arvatud muutja ise. Teade kannab ainult
 * töötaja enda liikmesuse ID-d; mis muutus, näeb töötaja oma päevadest.
 *
 * ÜKS LUGEMATA TEADE KORRAGA. Teade ütleb ainult „vaata oma päevi", seega ei lisa teine
 * lugemata teade midagi: kui hooldusjuht sätib päeva mitme sammuga ümber, saab töötaja
 * ühe teate (ja kõige rohkem ühe e-kirja), mitte iga sammu kohta oma. Kui ta on teate
 * läbi lugenud, toob järgmine muutus uue.
 */
export async function notifyWorkersOfVisitChange(
  { organizationId, membershipIds = [], actorMembershipId = null },
  { db = prisma, now = new Date() } = {}
) {
  const ids = [...new Set(membershipIds.filter((id) => id && id !== actorMembershipId))];
  if (!ids.length) return 0;
  let created = 0;
  try {
    const members = await db.organizationMembership.findMany({
      where: { id: { in: ids }, organizationId, status: OrganizationMembershipStatus.ACTIVE },
      select: { id: true, userId: true }
    });
    for (const member of members) {
      if (!member.userId) continue;
      try {
        const unread = await db.notificationEvent.findFirst({
          where: {
            userId: member.userId,
            type: NOTIFICATION_EVENT_TYPES.HOME_CARE_VISITS_CHANGED,
            workspaceId: organizationId,
            readAt: null,
            dismissedAt: null
          },
          select: { id: true }
        });
        if (unread) continue;
        const result = await createNotificationEvent(
          {
            type: NOTIFICATION_EVENT_TYPES.HOME_CARE_VISITS_CHANGED,
            userId: member.userId,
            sourceId: member.id,
            targetId: member.id,
            dedupeSuffix: String(now.getTime()),
            workspaceKind: "org_space",
            workspaceId: organizationId,
            emailPolicy: "OPTIONAL"
          },
          { db, now }
        );
        if (result?.created) created += 1;
      } catch (error) {
        console.error("[home_care] visit change notification failed", error?.message || error);
      }
    }
  } catch (error) {
    console.error("[home_care] visit change lookup failed", error?.message || error);
  }
  return created;
}

/**
 * Hooldaja teatas takistusest (K3-e): teade hooldusjuhtidele, kelle skoobis on mõni
 * klient, kelle meeskonnas teataja on (kogu asutuse hooldusjuht alati). Teataja ise
 * teadet ei saa. Teavitus kannab ainult teate rea ID-d.
 */
export async function notifyCoordinatorsOfObstacle({ obstacleId, organizationId, membershipId }, { db = prisma, now = new Date() } = {}) {
  let created = 0;
  try {
    const teams = await db.careClientTeamMember.findMany({
      where: { membershipId, endedAt: null, client: { organizationId } },
      select: { client: { select: { unitId: true } } }
    });
    const unitIds = [...new Set(teams.map((row) => row.client?.unitId || null))];
    if (!unitIds.length) unitIds.push(null);
    const recipients = new Map();
    for (const unitId of unitIds) {
      for (const coordinator of await listCoordinatorMemberships(db, { organizationId, unitId, now })) {
        recipients.set(coordinator.membershipId, coordinator);
      }
    }
    for (const recipient of recipients.values()) {
      if (!recipient.userId || recipient.membershipId === membershipId) continue;
      try {
        const result = await createNotificationEvent(
          {
            type: NOTIFICATION_EVENT_TYPES.HOME_CARE_OBSTACLE_REPORTED,
            userId: recipient.userId,
            sourceId: obstacleId,
            targetId: obstacleId,
            workspaceKind: "org_space",
            workspaceId: organizationId,
            emailPolicy: "OPTIONAL"
          },
          { db, now }
        );
        if (result?.created) created += 1;
      } catch (error) {
        console.error("[home_care] obstacle notification failed", error?.message || error);
      }
    }
  } catch (error) {
    console.error("[home_care] obstacle notification lookup failed", error?.message || error);
  }
  return created;
}
