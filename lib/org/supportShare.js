/**
 * T25 ORG-PROFILE-SUPPORT-V1 — tööheaolu toeavalduse päris tarne (E9).
 *
 * SEE ON PLATVORMI KÕIGE PRIVAATSEM RAJA JA TEMA REEGLID ON ABSOLUUTSED
 * (arenduskava §D8, §5.8):
 *
 *   1. LÄHTEKIRJE EI LIIGU. Saaja saab `sharedSnapshotJson` — kasutaja enda
 *      kinnitatud külmutatud koopia. `WellbeingRecord` ja `WellbeingOutputDraft`
 *      ei ole saaja päringus KUNAGI, ka mitte JOIN-i kaudu. `sourceRecordId` ja
 *      `sourceDraftId` on viited ILMA FK-ta ja need EI TOHI jõuda saaja
 *      projektsiooni.
 *
 *   2. ORGANISATSIOON EI NÄE VORMI KASUTAMISE FAKTI. Ta näeb ainult talle
 *      saadetud avaldusi. Kui keegi täidab vormi ja ei saada, ei tea
 *      organisatsioon sellest midagi.
 *
 *   3. AVALDUSE ALGATAB TÖÖTAJA. Juht ei saa seda küsida, tellida ega
 *      meelde tuletada. Siin failis ei ole ühtegi funktsiooni, mille kutsuja
 *      oleks keegi muu kui omanik ise — peale avamise ja sulgemise, mis on
 *      saaja omad.
 *
 *   4. KRIISISIGNAAL EI TEKITA SIIN MIDAGI. Eluohu rada on eraldi ja
 *      tööandjale automaatset teavitust ei lähe.
 */

import prisma from "@/lib/prisma";

import { NOTIFICATION_EVENT_TYPES, createNotificationEvent } from "@/lib/notifications";

import { OrganizationMembershipStatus, OrganizationStatus } from "./constants.js";
import { badRequest, conflict, forbidden, notFound } from "./errors.js";
import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "./audit.js";

export const SupportShareStatus = Object.freeze({
  SENT: "SENT",
  OPENED: "OPENED",
  RECALLED: "RECALLED",
  CORRECTED: "CORRECTED",
  CLOSED: "CLOSED"
});

/**
 * Lubatud snapshot-väljad. VALGE NIMEKIRI ja tahtlikult LÜHIKE.
 *
 * Siin ei ole `computedSignal`, `riskMarkers`, `loadFactors` ega ühtegi muud
 * tööheaolu skoorimise välja — need on kirje SISEMINE analüüs ja nende
 * jagamine muudaks toeavalduse riskihinnanguks, mida juht loeb. Jagatav on
 * see, mida inimene ISE ütleb: mida ta vajab ja mis on kokkulepe.
 */
export const ALLOWED_SNAPSHOT_FIELDS = Object.freeze([
  "summary",
  "needs",
  "proposedAgreements",
  "supportRequested",
  "periodLabel"
]);

const MAX_SNAPSHOT_FIELD_LENGTH = 4000;

/**
 * Valge nimekirja rakendamine ühes kohas, et kirjutamise ja lugemise pool ei
 * saaks kunagi lahku joosta. Ei viska — otsuse, mida tühja tulemusega teha,
 * langetab kutsuja.
 */
function applySnapshotWhitelist(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const clean = {};
  for (const field of ALLOWED_SNAPSHOT_FIELDS) {
    const value = input[field];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const items = value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim().slice(0, MAX_SNAPSHOT_FIELD_LENGTH))
        .filter(Boolean);
      if (items.length) clean[field] = items;
      continue;
    }
    if (typeof value !== "string") continue;
    const text = value.trim().slice(0, MAX_SNAPSHOT_FIELD_LENGTH);
    if (text) clean[field] = text;
  }
  return clean;
}

/**
 * Puhastab kasutaja kinnitatud snapshot'i. Tundmatu väli EI LÄHE läbi — mitte
 * „eemaldatakse hiljem", vaid ei jõua andmebaasi.
 */
export function sanitizeSnapshot(input) {
  const clean = applySnapshotWhitelist(input);
  if (!clean) throw badRequest("org.errors.snapshot_required");
  if (!Object.keys(clean).length) throw badRequest("org.errors.snapshot_empty");
  return clean;
}

/**
 * LUGEMISPOOLNE projektsioon — teine värav samale nimekirjale.
 *
 * Miks kaks väravat ühele asjale: kirjutamise puhastus kaitseb ainult neid
 * ridu, mis läksid läbi TÄNASE koodi. Saaja näeb aga seda, mis on ANDMEBAASIS.
 * Rea võib sinna panna vanem versioon, migratsioon, käsitsi parandus või
 * homme lisatav teine kirjutaja, kes selle värava unustab. Ainus koht, kus
 * lubadus „saaja ei näe sisemist analüüsi" päriselt kehtib, on projektsioon
 * ise — ülejäänu on lootus, et iga kirjutaja käitus hästi.
 *
 * Ei viska: katkine või tühi salvestatud snapshot ei tohi saaja lehte maha
 * võtta. Ta näeb tühja sisu, mitte viga — ja mitte kunagi `computedSignal`-i.
 */
export function projectSnapshotForRecipient(stored) {
  return applySnapshotWhitelist(stored) || {};
}

/**
 * Saatmine. Kutsub AINULT omanik ise.
 *
 * `userConfirmed` on kohustuslik ja selgesõnaline: „kasutaja kinnitatud
 * minimaalne jagatav koopia" (§5.8) tähendab, et kinnitus on tegu, mitte
 * vaikimisi eeldus.
 */
export async function sendSupportShare(
  { ownerUserId, organizationId, recipientMembershipId, snapshot, userConfirmed, sourceRecordId, sourceDraftId },
  { db = prisma, now = new Date() } = {}
) {
  if (userConfirmed !== true) throw badRequest("org.errors.share_requires_confirmation");
  const sharedSnapshotJson = sanitizeSnapshot(snapshot);

  return db.$transaction(async (tx) => {
    /* Saatja peab ISE olema selle organisatsiooni aktiivne liige — muidu saaks
       keegi saata avaldusi organisatsiooni, kuhu ta ei kuulu. */
    const senderMembership = await tx.organizationMembership.findFirst({
      where: { organizationId, userId: ownerUserId, status: OrganizationMembershipStatus.ACTIVE },
      select: { id: true }
    });
    if (!senderMembership) throw notFound("org.errors.organization_not_found");

    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { status: true }
    });
    if (organization?.status !== OrganizationStatus.ACTIVE) {
      throw conflict("org.errors.organization_not_writable");
    }

    if (recipientMembershipId === senderMembership.id) throw badRequest("org.errors.share_to_self");

    const recipient = await tx.organizationMembership.findFirst({
      where: {
        id: recipientMembershipId,
        organizationId,
        status: OrganizationMembershipStatus.ACTIVE
      },
      select: { id: true, userId: true }
    });
    if (!recipient) throw notFound("org.errors.membership_not_found");

    /* Saaja peab olema kas selle inimese otsene juht VÕI organisatsiooni
       määratud tugikontakt. Suvalisele kolleegile toeavaldust saata ei saa —
       see ei ole sõnumirada, vaid tugirada. */
    const [isManager, isContact] = await Promise.all([
      tx.organizationReportingLine.findFirst({
        where: {
          memberMembershipId: senderMembership.id,
          managerMembershipId: recipientMembershipId,
          validUntil: null
        },
        select: { id: true }
      }),
      tx.organizationSupportContact.findFirst({
        where: { organizationId, membershipId: recipientMembershipId, validUntil: null },
        select: { id: true }
      })
    ]);
    if (!isManager && !isContact) throw forbidden("org.errors.share_recipient_not_allowed");

    const share = await tx.wellbeingSupportShare.create({
      data: {
        ownerUserId,
        organizationId,
        recipientMembershipId,
        supportContactId: isContact?.id || null,
        /* Lähteviited salvestatakse OMANIKU ja auditi jaoks. Saaja
           projektsioon (`toRecipientView`) neid ei sisalda. */
        sourceRecordId: sourceRecordId ? String(sourceRecordId).slice(0, 64) : null,
        sourceDraftId: sourceDraftId ? String(sourceDraftId).slice(0, 64) : null,
        sharedSnapshotJson,
        status: SupportShareStatus.SENT,
        sentAt: now
      }
    });

    await writeOrgAudit(tx, {
      actorUserId: ownerUserId,
      targetUserId: recipient.userId,
      action: OrgAuditAction.SUPPORT_SHARE_SENT,
      resourceType: OrgAuditResource.SUPPORT_SHARE,
      resourceId: share.id,
      meta: { organizationId, shareId: share.id, membershipId: recipientMembershipId }
    });

    return { share, recipientUserId: recipient.userId };
  });
}

/**
 * SAAJA projektsioon. See on ainus kuju, mille saaja kunagi näeb.
 *
 * VALGE NIMEKIRI: `sourceRecordId`, `sourceDraftId`, `ownerUserId` ja
 * `supportContactId` EI OLE siin. Kui keegi lisab neist mõne, saab saaja tee
 * lähtekirjeni — täpselt see, mida §D8 keelab.
 *
 * Sama kehtib snapshot'i SISU kohta: `snapshot` ei ole toores veerg, vaid
 * `projectSnapshotForRecipient` tulemus. Nii ei sõltu lubadus sellest, kes
 * rea kunagi kirjutas.
 */
export function toRecipientView(share) {
  if (!share) return null;
  /*
   * SAATJA NIMI TULEB KAASA, `ownerUserId` MITTE.
   *
   * See vahe on kogu selle funktsiooni mõte. Toeavaldus on suunatud palve
   * nimeliselt inimeselt nimeliselt inimesele — anonüümne palve ei ole tugi,
   * sest saaja ei saa sellele vastata. Aga identiteet on nimi, mitte VÕTI:
   * `ownerUserId` avaks tee kasutaja teiste objektideni, ja seda saaja ei saa.
   * E-post tuleb ainult siis, kui nime ei ole — muidu poleks saatja tuvastatav.
   */
  const firstName = share.owner?.profile?.firstName || null;
  const lastName = share.owner?.profile?.lastName || null;
  const named = Boolean(firstName || lastName);
  return {
    id: share.id,
    status: share.status,
    sentAt: share.sentAt,
    openedAt: share.openedAt,
    correctedAt: share.correctedAt,
    closedAt: share.closedAt,
    // Projektsioon, MITTE toores veerg — vt projectSnapshotForRecipient.
    snapshot: projectSnapshotForRecipient(share.sharedSnapshotJson),
    snapshotSchemaVersion: share.snapshotSchemaVersion,
    isCorrection: Boolean(share.supersedesShareId),
    sender: {
      firstName,
      lastName,
      email: named ? null : share.owner?.email || null
    }
  };
}

/** Saaja päringu `select` — saatja NIMI, mitte tema ID ega lähteviide. */
const RECIPIENT_SENDER_SELECT = Object.freeze({
  email: true,
  profile: { select: { firstName: true, lastName: true } }
});

/** Omaniku vaade oma saadetud avaldustele. Tema TOHIB näha lähteviidet. */
export async function listOwnSupportShares(ownerUserId, { db = prisma, take = 50 } = {}) {
  const rows = await db.wellbeingSupportShare.findMany({
    where: { ownerUserId },
    orderBy: { sentAt: "desc" },
    take: Math.min(Math.max(Number(take) || 50, 1), 200),
    select: {
      id: true,
      status: true,
      sentAt: true,
      openedAt: true,
      recalledAt: true,
      correctedAt: true,
      closedAt: true,
      sourceRecordId: true,
      organizationId: true,
      recipientMembershipId: true,
      sharedSnapshotJson: true,
      organization: { select: { displayName: true } },
      /*
       * Saatja PEAB nägema, kellele ta saatis. Ilma selleta ei saa ta hiljem
       * otsustada, kas tagasi võtta või parandada — ja tema enda kirje muutub
       * talle endale läbipaistmatuks. E-post tuleb kaasa ainult nime puududes,
       * sama reegel nagu `listSupportRecipients`-is.
       */
      recipient: {
        select: {
          jobTitle: true,
          user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } }
        }
      }
    }
  });
  return rows.map((row) => {
    const firstName = row.recipient?.user?.profile?.firstName || null;
    const lastName = row.recipient?.user?.profile?.lastName || null;
    const named = Boolean(firstName || lastName);
    return {
      ...row,
      organizationName: row.organization?.displayName || null,
      organization: undefined,
      recipient: {
        firstName,
        lastName,
        jobTitle: row.recipient?.jobTitle || null,
        email: named ? null : row.recipient?.user?.email || null
      }
    };
  });
}

/**
 * Saaja loend. AINULT talle saadetud avaldused.
 *
 * Organisatsioon ei näe siit, kes vormi täitis ja ei saatnud — päring käib
 * `recipientMembershipId` järgi, mitte organisatsiooni järgi.
 */
export async function listReceivedSupportShares(membershipId, { db = prisma } = {}) {
  const rows = await db.wellbeingSupportShare.findMany({
    where: {
      recipientMembershipId: membershipId,
      status: { in: [SupportShareStatus.SENT, SupportShareStatus.OPENED, SupportShareStatus.CORRECTED] }
    },
    orderBy: { sentAt: "desc" },
    take: 100,
    include: { owner: { select: RECIPIENT_SENDER_SELECT } }
  });
  return rows.map(toRecipientView);
}

/**
 * Avamine. Märgib `openedAt` ja lõpetab saatja tagasivõtmisõiguse — täpselt
 * nagu eelpöördumisel. Ilma selle ajatemplita oleks „tagasivõtmine enne
 * avamist" lubadus, mida süsteem ei suuda pidada.
 */
export async function openSupportShare(
  shareId,
  { recipientMembershipId },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const share = await tx.wellbeingSupportShare.findFirst({
      where: { id: shareId, recipientMembershipId },
      select: {
        id: true,
        status: true,
        openedAt: true,
        organizationId: true,
        recipientMembershipId: true
      }
    });
    if (!share) throw notFound("org.errors.support_share_not_found");
    if (share.status === SupportShareStatus.RECALLED) throw notFound("org.errors.support_share_not_found");

    if (!share.openedAt) {
      await tx.wellbeingSupportShare.updateMany({
        where: { id: shareId, openedAt: null },
        data: { openedAt: now, status: SupportShareStatus.OPENED }
      });
      await writeOrgAudit(tx, {
        actorUserId: null,
        action: OrgAuditAction.SUPPORT_SHARE_OPENED,
        resourceType: OrgAuditResource.SUPPORT_SHARE,
        resourceId: shareId,
        meta: { organizationId: share.organizationId, shareId }
      });
    }

    const fresh = await tx.wellbeingSupportShare.findUnique({
      where: { id: shareId },
      include: { owner: { select: RECIPIENT_SENDER_SELECT } }
    });
    return toRecipientView(fresh);
  });
}

/**
 * Tagasivõtmine — AINULT enne avamist ja ainult omanik ise.
 *
 * Pärast avamist ei saa öeldut olematuks teha; siis on ainus aus tee PARANDUS
 * (`correctSupportShare`), mis jätab jälje.
 */
export async function recallSupportShare(
  shareId,
  { ownerUserId },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const share = await tx.wellbeingSupportShare.findFirst({
      where: { id: shareId, ownerUserId },
      select: { id: true, status: true, openedAt: true, organizationId: true }
    });
    if (!share) throw notFound("org.errors.support_share_not_found");
    if (share.status === SupportShareStatus.RECALLED) return share;
    if (share.openedAt) throw conflict("org.errors.support_share_already_opened");

    const result = await tx.wellbeingSupportShare.updateMany({
      where: { id: shareId, openedAt: null },
      data: { status: SupportShareStatus.RECALLED, recalledAt: now }
    });
    if (result.count !== 1) throw conflict("org.errors.support_share_already_opened");

    await writeOrgAudit(tx, {
      actorUserId: ownerUserId,
      action: OrgAuditAction.SUPPORT_SHARE_RECALLED,
      resourceType: OrgAuditResource.SUPPORT_SHARE,
      resourceId: shareId,
      meta: { organizationId: share.organizationId, shareId }
    });

    return tx.wellbeingSupportShare.findUnique({ where: { id: shareId } });
  });
}

/**
 * Parandus PÄRAST avamist: uus avaldus, mis viitab vanale.
 *
 * Vana avaldust EI MUUDETA — saaja nägi seda ja see jääb nähtavaks. Nii on
 * parandus jälg, mitte ajaloo vaikne ümberkirjutus (§5.8).
 */
export async function correctSupportShare(
  shareId,
  { ownerUserId, snapshot, userConfirmed },
  { db = prisma, now = new Date() } = {}
) {
  if (userConfirmed !== true) throw badRequest("org.errors.share_requires_confirmation");
  const sharedSnapshotJson = sanitizeSnapshot(snapshot);

  return db.$transaction(async (tx) => {
    const original = await tx.wellbeingSupportShare.findFirst({
      where: { id: shareId, ownerUserId },
      select: {
        id: true,
        status: true,
        openedAt: true,
        organizationId: true,
        recipientMembershipId: true,
        supportContactId: true,
        sourceRecordId: true,
        sourceDraftId: true,
        supersededBy: { select: { id: true } }
      }
    });
    if (!original) throw notFound("org.errors.support_share_not_found");
    if (original.status === SupportShareStatus.RECALLED) {
      throw conflict("org.errors.support_share_recalled");
    }
    if (original.supersededBy) throw conflict("org.errors.support_share_already_corrected");

    const created = await tx.wellbeingSupportShare.create({
      data: {
        ownerUserId,
        organizationId: original.organizationId,
        recipientMembershipId: original.recipientMembershipId,
        supportContactId: original.supportContactId,
        sourceRecordId: original.sourceRecordId,
        sourceDraftId: original.sourceDraftId,
        sharedSnapshotJson,
        status: SupportShareStatus.SENT,
        sentAt: now,
        supersedesShareId: original.id
      }
    });

    await tx.wellbeingSupportShare.update({
      where: { id: original.id },
      data: { status: SupportShareStatus.CORRECTED, correctedAt: now }
    });

    await writeOrgAudit(tx, {
      actorUserId: ownerUserId,
      action: OrgAuditAction.SUPPORT_SHARE_CORRECTED,
      resourceType: OrgAuditResource.SUPPORT_SHARE,
      resourceId: created.id,
      meta: { organizationId: original.organizationId, shareId: original.id }
    });

    return created;
  });
}

/** Saaja sulgeb avalduse, kui tugi on antud. Ei kustuta midagi. */
export async function closeSupportShare(
  shareId,
  { recipientMembershipId, actorUserId },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const share = await tx.wellbeingSupportShare.findFirst({
      where: { id: shareId, recipientMembershipId },
      select: { id: true, status: true, organizationId: true }
    });
    if (!share) throw notFound("org.errors.support_share_not_found");
    if (share.status === SupportShareStatus.CLOSED) throw conflict("org.errors.support_share_closed");

    const updated = await tx.wellbeingSupportShare.update({
      where: { id: shareId },
      data: { status: SupportShareStatus.CLOSED, closedAt: now }
    });

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.SUPPORT_SHARE_CLOSED,
      resourceType: OrgAuditResource.SUPPORT_SHARE,
      resourceId: shareId,
      meta: { organizationId: share.organizationId, shareId }
    });

    return toRecipientView(updated);
  });
}

/**
 * Saajale teavitus. Eraldi funktsioon ja parim-pingutus: teavituse tõrge ei
 * tohi keerata tagasi avalduse saatmist.
 *
 * Teavitus kannab AINULT fakti. Snapshot'i sisu, saatja nime ega organisatsiooni
 * siin ei ole — need on lingi taga, pärast õiguskontrolli.
 */
export async function notifySupportShareRecipient(
  { shareId, recipientUserId, organizationId },
  { db = prisma } = {}
) {
  try {
    await createNotificationEvent(
      {
        type: NOTIFICATION_EVENT_TYPES.ORG_SUPPORT_SHARE_RECEIVED,
        userId: recipientUserId,
        sourceId: shareId,
        targetId: shareId,
        dedupeSuffix: "v1",
        workspaceKind: "org_space",
        workspaceId: organizationId,
        emailPolicy: "OPTIONAL"
      },
      { db }
    );
  } catch (error) {
    console.error("[org-support-share] notification failed", error?.message || error);
  }
}
