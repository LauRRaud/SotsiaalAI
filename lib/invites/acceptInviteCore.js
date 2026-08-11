import crypto from "node:crypto";
import {
  getPlanDefinitionId,
  getRolePlanKey,
  normalizeSubscriptionRole
} from "@/lib/subscriptionPlans";
import { ARCHIVED_ROOM_ERROR, isArchivedRoom } from "@/lib/rooms/accessGuard";
import { lockRoom } from "@/lib/rooms/ownership";

/*
  Jagatud kutse-vastuvõtu tuum. Kasutavad KAKS rada:
    1. app/api/invites/[id]/accept        — meililingi RAW tokeni järgi
    2. app/api/invites/pending            — sisseloginud + kinnitatud e-posti
                                            järgi tuvastatud kutse id järgi
  Maksekriitiline loogika (SPONSORED_BY_HOST tellimuse loomine/taasaktiveerimine,
  +1 kuu, roomMember, useCount) elab AINULT siin, et rajad ei lahkneks.
*/

export const SPONSORED_MEMBER_LIMIT = 50;

export function hashInviteToken(raw) {
  return crypto.createHash("sha256").update(String(raw || "")).digest("base64");
}

export function inviteAcceptError(messageKey, status = 400, code = "") {
  const error = new Error(messageKey);
  error.status = status;
  error.messageKey = messageKey;
  error.code = code;
  return error;
}

export function addOneMonth(date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

async function hasActiveSubscriptionTx(tx, userId) {
  if (!userId) return false;
  const now = new Date();
  const sub = await tx.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ validUntil: null }, { validUntil: { gt: now } }]
    },
    select: { id: true }
  });
  return Boolean(sub);
}

/*
  SOL-INV-01 — SPONSORKOHT ON RUUMI OMADUS, MITTE ÜHE KUTSE OMA.

  Loendus ise ei muutunud; muutus see, KUS ta jookseb. Kutse vastuvõtt lukustas
  `FOR UPDATE` ainult oma Invite rea, seega kaks ERI kutset samasse ruumi
  lukustasid eri read, lugesid mõlemad 49 aktiivset sponsoreeritud liiget ja
  lisasid mõlemad uue. Piir „50" ei olnud ühegi rea omadus, mille peale
  tingimuslikku kirjutust ehitada — seepärast on ta ruumipõhise nõuandeluku all
  (`lib/rooms/ownership.js` `lockRoom`, sama võti mis omanikuvahetusel ja
  lahkumisel: SOL-ROOM-04 järgi on omanik ja liikmesus üks invariant).

  Loenduriveergu ruumile EI lisatud: see oleks teine tõde, mida tuleks
  sünkroonis hoida (sama argument, mis SOL-DOC-07 loenduriveerul ja SOL-CALL-08
  osalejapiiril).
*/
async function hasSponsorCapacity(tx, roomId) {
  const count = await tx.roomMember.count({
    where: {
      roomId,
      billingSource: "SPONSORED_BY_HOST",
      leftAt: null
    }
  });
  return count < SPONSORED_MEMBER_LIMIT;
}

/*
  Eeldab, et kutse (koos roomiga) on juba laetud ja rida on transaktsioonis
  lukustatud (FOR UPDATE). auth = { userId, role, isAdmin, email }.
  userEmail on juba normaliseeritud (trim+lowercase) — kutsuja vastutus.
  Viskab inviteAcceptError'i valideerimisvigade korral; muidu tagastab
  { ok, roomId, billing_source }.
*/
export async function acceptInviteWithinTx({
  tx,
  invite,
  auth,
  userEmail,
  displayName,
  now = new Date()
}) {
  if (!invite) {
    throw inviteAcceptError("api.invites.invite_not_found", 404, "INVITE_NOT_FOUND");
  }

  if (invite.status === "PENDING_PAYMENT") {
    throw inviteAcceptError(
      "api.invites.invite_payment_pending",
      409,
      "INVITE_PAYMENT_PENDING"
    );
  }

  if (invite.status !== "SENT" || invite.expiresAt <= now) {
    throw inviteAcceptError("api.invites.invite_expired", 410, "INVITE_EXPIRED");
  }

  if (invite.useCount >= invite.maxUses) {
    throw inviteAcceptError("api.invites.invite_used", 410, "INVITE_EXHAUSTED");
  }

  // SOL-ROOM-01: lõpetatud ruumi koosseis on lõplik. Kehtiv kutse ei tohi teda avada —
  // varem käis see rada `room.archivedAt` väljast täiesti mööda ja kutse saaja lisandus
  // ruumi, mille ajalugu oli juba üle antud.
  if (isArchivedRoom(invite.room)) {
    throw inviteAcceptError(
      ARCHIVED_ROOM_ERROR.message,
      ARCHIVED_ROOM_ERROR.status,
      "ROOM_ARCHIVED"
    );
  }

  if (invite.inviteeEmail) {
    const inviteEmail = invite.inviteeEmail.trim().toLowerCase();
    if (!userEmail || inviteEmail !== userEmail) {
      throw inviteAcceptError(
        "api.invites.invite_email_mismatch",
        403,
        "INVITE_EMAIL_MISMATCH"
      );
    }
  }

  /* SOL-INV-01 — KOGU LIIKMESUSE OTSUS ON SIIT ALATES SERIALISEERITUD.
     Lukk võetakse ENNE esimest liikmesuse lugemist, mitte alles sponsorkoha
     kontrolli ees: „kas ma olen juba liige", „kas kohti on" ja „loo liikmesus"
     on üks otsus ja neid ei tohi lahutada. Invite rea `FOR UPDATE` on juba
     võetud (kutsuja marsruut), seega lukujärjekord on kutse → ruum; ruumiluku
     teised võtjad (omanikuvahetus, lahkumine) ei puutu Invite ridu, seega
     tsüklit ei teki. */
  await lockRoom(tx, invite.roomId);

  const existingMember = await tx.roomMember.findFirst({
    where: {
      roomId: invite.roomId,
      userId: auth.userId,
      leftAt: null
    },
    select: {
      billingSource: true
    }
  });
  if (existingMember) {
    return {
      ok: true,
      roomId: invite.roomId,
      billing_source: existingMember.billingSource || "SELF"
    };
  }

  const userActive =
    auth.role === "ADMIN" ? true : await hasActiveSubscriptionTx(tx, auth.userId);

  let billingSource = "SELF";
  let sponsorUserId = null;
  let sponsorOrgId = null;

  const inviteRole = invite.sponsoredRole
    ? normalizeSubscriptionRole(invite.sponsoredRole)
    : null;

  if (
    invite.paymentMode === "SPONSORED_BY_HOST" &&
    inviteRole &&
    !auth.isAdmin &&
    normalizeSubscriptionRole(auth.role) !== inviteRole
  ) {
    throw inviteAcceptError(
      "api.invites.invite_role_mismatch",
      409,
      "INVITE_ROLE_MISMATCH"
    );
  }

  if (!userActive) {
    if (invite.paymentMode === "SELF_PAID") {
      throw inviteAcceptError(
        "api.invites.subscription_required",
        402,
        "SUBSCRIPTION_REQUIRED"
      );
    }

    if (invite.paymentMode === "SPONSORED_BY_HOST") {
      if (!invite.sponsoredPaidAt) {
        throw inviteAcceptError(
          "api.invites.invite_payment_pending",
          409,
          "INVITE_PAYMENT_PENDING"
        );
      }

      const capacity = await hasSponsorCapacity(tx, invite.roomId);
      if (!capacity) {
        throw inviteAcceptError(
          "invite.error.sponsor_capacity_full",
          409,
          "SPONSOR_CAPACITY_FULL"
        );
      }

      billingSource = "SPONSORED_BY_HOST";
      sponsorUserId = invite.sponsoredByUserId || invite.room?.ownerId;
      sponsorOrgId = invite.sponsoredByOrgId || null;

      const existingSubscription = await tx.subscription.findFirst({
        where: { userId: auth.userId },
        orderBy: [{ updatedAt: "desc" }]
      });
      const validUntil = addOneMonth(now);
      const plan =
        invite.sponsoredPlan ||
        getRolePlanKey(inviteRole || normalizeSubscriptionRole(auth.role));
      const planDefinitionId = getPlanDefinitionId(
        plan,
        inviteRole || normalizeSubscriptionRole(auth.role)
      );

      if (existingSubscription) {
        await tx.subscription.update({
          where: { id: existingSubscription.id },
          data: {
            status: "ACTIVE",
            plan,
            planDefinitionId,
            billingSource: "SPONSORED_BY_HOST",
            sponsorUserId,
            inviteId: invite.id,
            validUntil,
            nextBilling: null,
            canceledAt: null
          }
        });
      } else {
        await tx.subscription.create({
          data: {
            userId: auth.userId,
            status: "ACTIVE",
            plan,
            planDefinitionId,
            billingSource: "SPONSORED_BY_HOST",
            sponsorUserId,
            inviteId: invite.id,
            validUntil,
            nextBilling: null
          }
        });
      }
    }
  }

  await tx.roomMember.upsert({
    where: {
      roomId_userId: {
        roomId: invite.roomId,
        userId: auth.userId
      }
    },
    create: {
      roomId: invite.roomId,
      userId: auth.userId,
      role: "MEMBER",
      displayName: displayName || undefined,
      billingSource,
      sponsorUserId,
      sponsorOrgId,
      joinedAt: now
    },
    update: {
      leftAt: null,
      billingSource,
      sponsorUserId,
      sponsorOrgId,
      ...(displayName ? { displayName } : {})
    }
  });

  const nextUseCount = invite.useCount + 1;
  await tx.invite.update({
    where: { id: invite.id },
    data: {
      useCount: nextUseCount,
      status: nextUseCount >= invite.maxUses ? "ACCEPTED" : "SENT",
      acceptedBillingSource: billingSource,
      acceptedByUserId: auth.userId
    }
  });

  return {
    ok: true,
    roomId: invite.roomId,
    billing_source: billingSource
  };
}
