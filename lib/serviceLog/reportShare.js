/**
 * TEENUSPÄEVIK — kuuaruande jagamine osakonna juhatajale.
 *
 * Omaniku nõue 02.08: „kui sina oled koduhoolduse või sotsiaaltöötaja
 * kodukülastusel, siis tuleks jagada oma tulemusi ka osakonna juhatajaga või
 * vastutava isikuga".
 *
 * NELI REEGLIT:
 *
 * 1. ALGATAJA ON TÖÖTAJA. Juht ei saa aruannet ise võtta ega tellida. Selles
 *    failis ei ole ühtegi funktsiooni, mille kutsuja oleks keegi muu kui
 *    omanik — peale avamise ja loendi, mis on saaja omad. Sama reegel mis
 *    tööheaolu rajal (`lib/org/supportShare.js`) ja sama põhjus: jagamine on
 *    SAATMINE, mitte ligipääs.
 *
 * 2. SAAJA EI OLE SUVALINE KOLLEEG. Ta on kas selle inimese otsene juht
 *    (`OrganizationReportingLine`) või tema üksuse juht (`UNIT_LEAD`) või
 *    organisatsiooni omanik. Kliendinimedega aruanne ei tohi liikuda
 *    „lihtsalt kellelegi organisatsioonis".
 *
 * 3. SAAJA SAAB OMA KÜLMUTATUD KOOPIA. Esimene versioon oli võõrvõti omaniku
 *    dokumendile ja see oli kahtpidi vale: org-kiht ei tohi omada võõrvõtit
 *    privaatobjekti (§D8) ning omaniku dokumendi kustutamine oleks vaikselt
 *    ära võtnud ka juhile saadetu. Koopia ei ole „teine tõde" — bait'id on
 *    samad ja `sha256` tõendab seda; erinev on ainult VALDUS.
 *
 * 4. TAGASIVÕTMINE JÄTAB JÄLJE. Rida ei kustu: „ma ei saatnud seda kunagi" ja
 *    „ma võtsin selle tagasi" on kaks eri asja.
 *
 * MIDA SIIN EI OLE: automaatset jagamist. Kuuaruanne läheb juhile siis, kui
 * töötaja ta saadab. Vaikne automaatne edastus tähendaks, et platvorm otsustab
 * töötaja eest, kellele tema töö nähtavaks läheb.
 */

import { prisma } from "@/lib/prisma";
import {
  getStoredDocumentPath,
  readStoredDocument,
  writeStoredBuffer
} from "@/lib/documents/server";

import { OrganizationCapability, OrganizationMembershipStatus } from "@/lib/org/constants";
import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "@/lib/org/audit";

import { badRequest, conflict, forbidden, notFound } from "./errors.js";
import { SERVICE_LOG_REPORT_KIND } from "./reportArchive.js";

export const ShareStatus = Object.freeze({
  SENT: "SENT",
  OPENED: "OPENED",
  RECALLED: "RECALLED"
});

const MAX_NOTE_LENGTH = 500;

/** Capability, mis teeb inimesest „osakonna juhataja või vastutava isiku". */
const LEAD_CAPABILITIES = [OrganizationCapability.UNIT_LEAD, OrganizationCapability.ORG_OWNER];

function cleanNote(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, MAX_NOTE_LENGTH) : null;
}

/**
 * Kehtiv capability-luba: määratud, veel mitte tühistatud ja veel mitte aegunud.
 * `validUntil: null` EI OLE piisav — aegunud lubade väljajätmine on siin
 * turvakontroll, mitte kosmeetika.
 */
function activeGrantWhere(now) {
  return {
    revokedAt: null,
    validFrom: { lte: now },
    OR: [{ validUntil: null }, { validUntil: { gt: now } }]
  };
}

/**
 * KELLELE MA SAAN SAATA. Vastus ei tule UI-st ega kasutaja sisendist: seesama
 * loend on ka saatmise valideerimise alus, seega „valikus ei olnud" ja „ei
 * lubata saata" ei saa üksteisest lahku minna.
 */
export async function listShareRecipients(userId, { db = prisma, now = new Date() } = {}) {
  if (!userId) return [];

  const memberships = await db.organizationMembership.findMany({
    where: { userId, status: OrganizationMembershipStatus.ACTIVE },
    select: {
      id: true,
      organizationId: true,
      organization: { select: { id: true, name: true } },
      units: { where: { endedAt: null }, select: { unitId: true, isPrimary: true } }
    }
  });
  if (!memberships.length) return [];

  const recipients = new Map();

  for (const membership of memberships) {
    const unitIds = membership.units.map((row) => row.unitId);

    const [managerLines, leadGrants] = await Promise.all([
      /* OTSENE JUHT on esimene ja tugevaim vastus „kes on minu vastutav isik". */
      db.organizationReportingLine.findMany({
        where: { memberMembershipId: membership.id, validUntil: null },
        select: {
          managerMembershipId: true,
          manager: {
            select: {
              id: true,
              jobTitle: true,
              organizationId: true,
              user: { select: { id: true, name: true, email: true } }
            }
          }
        }
      }),
      /* ÜKSUSE JUHT ja organisatsiooni omanik. `UNIT_LEAD` arvestatakse ainult
         siis, kui tema skoop katab MINU üksuse — üksuse juht kõrvalosakonnas ei
         ole minu vastutav isik. */
      db.organizationCapabilityGrant.findMany({
        where: {
          capability: { in: LEAD_CAPABILITIES },
          ...activeGrantWhere(now),
          membership: {
            organizationId: membership.organizationId,
            status: OrganizationMembershipStatus.ACTIVE
          },
          OR: [
            { scopeType: "ORGANIZATION" },
            ...(unitIds.length ? [{ scopeType: "UNIT", scopeUnitId: { in: unitIds } }] : [])
          ]
        },
        select: {
          capability: true,
          membership: {
            select: {
              id: true,
              jobTitle: true,
              organizationId: true,
              user: { select: { id: true, name: true, email: true } }
            }
          }
        }
      })
    ]);

    const add = (target, relation) => {
      if (!target || target.id === membership.id) return; // iseendale ei saadeta
      const existing = recipients.get(target.id);
      if (existing) {
        /* Otsene juht kaalub üle üksusejuhi: kui sama inimene on mõlemat, on
           õigem sõna „juht", mitte „üksuse juht". */
        if (relation === "manager") existing.relation = relation;
        return;
      }
      recipients.set(target.id, {
        membershipId: target.id,
        organizationId: membership.organizationId,
        organizationName: membership.organization?.name || "",
        name: target.user?.name || target.user?.email || "",
        jobTitle: target.jobTitle || null,
        relation
      });
    };

    for (const line of managerLines) add(line.manager, "manager");
    for (const grant of leadGrants) {
      add(grant.membership, grant.capability === OrganizationCapability.ORG_OWNER ? "org_owner" : "unit_lead");
    }
  }

  return [...recipients.values()];
}

/**
 * Saadab arhiveeritud kuuaruande juhile.
 *
 * @returns `{ id, recipientUserId }`
 */
export async function shareMonthlyReport(
  { ownerUserId, documentId, recipientMembershipId, note },
  {
    db = prisma,
    now = new Date(),
    /* Salvestuskiht käib sisse, sama muster mis `db` — muidu kirjutaks ühiktest
       päris kettale ja kirjutamise tõrge näeks välja nagu loogikaviga. */
    readDocument = readStoredDocument,
    storeBuffer = writeStoredBuffer,
    makeStoragePath = getStoredDocumentPath
  } = {}
) {
  if (!ownerUserId) throw notFound();
  if (!documentId || !recipientMembershipId) throw badRequest("service_log.errors.invalid_input");

  /* DOKUMENT PEAB OLEMA MINU OMA JA OLEMA ARUANNE. Võõras id ja olematu id
     annavad MÕLEMAD 404 — muidu saaks id-de proovimisega teada, mis olemas on. */
  const document = await db.userDocument.findFirst({
    where: { id: documentId, ownerId: ownerUserId, kind: SERVICE_LOG_REPORT_KIND },
    select: { id: true, metadata: true, originalName: true, mime: true, storagePath: true }
  });
  if (!document) throw notFound("service_log.errors.report_not_found");

  const month = String(document.metadata?.month || "").slice(0, 7);
  if (!month) throw badRequest("service_log.errors.month_invalid");

  /* SAAJA TULEB SAMAST LOENDIST, mida UI näitab. Kaks eri reeglistikku
     tähendaks, et üks neist ükskord lubab seda, mida teine keelab. */
  const allowed = await listShareRecipients(ownerUserId, { db, now });
  const recipient = allowed.find((row) => row.membershipId === recipientMembershipId);
  if (!recipient) throw forbidden("service_log.errors.share_recipient_not_allowed");

  const membership = await db.organizationMembership.findFirst({
    where: { id: recipientMembershipId, status: OrganizationMembershipStatus.ACTIVE },
    select: { id: true, userId: true, organizationId: true }
  });
  if (!membership) throw notFound("service_log.errors.share_recipient_not_allowed");

  /* KOOPIA TEHAKSE ENNE RIDA. Kui kirjutamine ebaõnnestub, ei teki jagamist,
     mille taga faili ei ole — juht näeks loendis rida, mis avamisel katkeb. */
  const source = await readDocument(document.storagePath);
  const sharePath = makeStoragePath(document.originalName);
  const stored = await storeBuffer(source, sharePath);

  try {
    const share = await db.serviceReportShare.create({
      data: {
        /* VIIDE ILMA VÕÕRVÕTITA: omaniku enda loendi jaoks („millist aruannet
           ma jagasin"). Saaja päring seda ei joini. */
        documentId: document.id,
        ownerUserId,
        organizationId: membership.organizationId,
        recipientMembershipId,
        month,
        storagePath: sharePath,
        fileName: document.originalName,
        mime: document.mime,
        sizeBytes: stored.size,
        sha256: stored.sha256,
        kovName: document.metadata?.kovName || null,
        entryCount: Number.isFinite(Number(document.metadata?.entryCount))
          ? Number(document.metadata.entryCount)
          : null,
        note: cleanNote(note),
        status: ShareStatus.SENT,
        sentAt: now
      },
      select: { id: true }
    });

    await writeOrgAudit(db, {
      actorUserId: ownerUserId,
      targetUserId: membership.userId,
      action: OrgAuditAction.SERVICE_REPORT_SHARE_SENT,
      resourceType: OrgAuditResource.SERVICE_REPORT_SHARE,
      resourceId: share.id,
      meta: { organizationId: membership.organizationId, month, documentId: document.id }
    }).catch(() => {});

    return { id: share.id, recipientUserId: membership.userId, month };
  } catch (error) {
    /* Osaline unikaalindeks (`recalledAt IS NULL`) tähendab: sama aruanne on
       sellele juhile juba KEHTIVALT saadetud. See ei ole viga, vaid seis. */
    if (error?.code === "P2002") throw conflict("service_log.errors.share_already_sent");
    throw error;
  }
}

/** Mida MINA olen jaganud. */
export async function listOwnShares(ownerUserId, { month = null, db = prisma, take = 100 } = {}) {
  if (!ownerUserId) return [];
  const rows = await db.serviceReportShare.findMany({
    where: { ownerUserId, ...(month ? { month } : {}) },
    orderBy: { sentAt: "desc" },
    take,
    select: {
      id: true,
      documentId: true,
      month: true,
      status: true,
      sentAt: true,
      openedAt: true,
      recalledAt: true,
      recipient: {
        select: { id: true, jobTitle: true, user: { select: { name: true, email: true } } }
      }
    }
  });
  return rows.map((row) => ({
    id: row.id,
    documentId: row.documentId,
    month: row.month,
    status: row.status,
    sentAt: row.sentAt?.toISOString?.() || null,
    openedAt: row.openedAt?.toISOString?.() || null,
    recalledAt: row.recalledAt?.toISOString?.() || null,
    recipientName: row.recipient?.user?.name || row.recipient?.user?.email || "",
    recipientJobTitle: row.recipient?.jobTitle || null
  }));
}

/**
 * Mida MULLE on jagatud. Päring käib `recipientMembershipId` järgi, mitte
 * organisatsiooni järgi: juht näeb seda, mis talle saadeti, mitte kõike, mis
 * organisatsioonis liigub.
 *
 * TAGASIVÕETUD EI OLE LOENDIS. Ta jääb andmebaasi auditijäljena, aga saaja
 * jaoks on ta tagasi võetud — see ongi tagasivõtmise mõte.
 */
export async function listReceivedShares(membershipIds, { db = prisma, take = 200 } = {}) {
  const ids = (Array.isArray(membershipIds) ? membershipIds : [membershipIds]).filter(Boolean);
  if (!ids.length) return [];

  const rows = await db.serviceReportShare.findMany({
    where: { recipientMembershipId: { in: ids }, recalledAt: null },
    orderBy: [{ month: "desc" }, { sentAt: "desc" }],
    take,
    select: {
      id: true,
      month: true,
      note: true,
      status: true,
      sentAt: true,
      openedAt: true,
      fileName: true,
      sizeBytes: true,
      kovName: true,
      entryCount: true,
      owner: { select: { name: true, email: true } }
    }
  });

  /* SAAJA PROJEKTSIOON. `documentId`, `storagePath` ja `ownerUserId` EI OLE
     siin: nad on omaniku ja auditi omad. Sama valge nimekirja muster mis
     `toRecipientView` tööheaolu rajal. */
  return rows.map((row) => ({
    id: row.id,
    month: row.month,
    note: row.note,
    status: row.status,
    sentAt: row.sentAt?.toISOString?.() || null,
    openedAt: row.openedAt?.toISOString?.() || null,
    senderName: row.owner?.name || row.owner?.email || "",
    fileName: row.fileName,
    size: row.sizeBytes ?? null,
    kovName: row.kovName || null,
    entryCount: row.entryCount ?? null
  }));
}

/**
 * Saaja avab aruande. Märgib avatuks JA tagastab dokumendi — kaks eraldi kutset
 * tähendaks, et faili saab lugeda ilma avamist jätmata.
 */
export async function openShareForRecipient(
  shareId,
  { membershipIds, actorUserId },
  { db = prisma, now = new Date() } = {}
) {
  const ids = (Array.isArray(membershipIds) ? membershipIds : [membershipIds]).filter(Boolean);
  if (!shareId || !ids.length) throw notFound();

  const share = await db.serviceReportShare.findFirst({
    where: { id: shareId, recipientMembershipId: { in: ids }, recalledAt: null },
    select: {
      id: true,
      status: true,
      organizationId: true,
      ownerUserId: true,
      month: true,
      storagePath: true,
      fileName: true,
      mime: true
    }
  });
  if (!share?.storagePath) throw notFound();

  if (share.status === ShareStatus.SENT) {
    await db.serviceReportShare.update({
      where: { id: share.id },
      data: { status: ShareStatus.OPENED, openedAt: now }
    });
  }

  await writeOrgAudit(db, {
    actorUserId,
    targetUserId: share.ownerUserId,
    action: OrgAuditAction.SERVICE_REPORT_SHARE_OPENED,
    resourceType: OrgAuditResource.SERVICE_REPORT_SHARE,
    resourceId: share.id,
    meta: { organizationId: share.organizationId, month: share.month }
  }).catch(() => {});

  return { storagePath: share.storagePath, originalName: share.fileName, mime: share.mime };
}

/** Omanik võtab jagamise tagasi. Rida jääb alles (vt faili päise punkt 4). */
export async function recallShare(shareId, { ownerUserId }, { db = prisma, now = new Date() } = {}) {
  if (!shareId || !ownerUserId) throw notFound();
  const share = await db.serviceReportShare.findFirst({
    where: { id: shareId, ownerUserId },
    select: { id: true, recalledAt: true, organizationId: true, month: true }
  });
  if (!share) throw notFound();
  if (share.recalledAt) return { id: share.id, alreadyRecalled: true };

  await db.serviceReportShare.update({
    where: { id: share.id },
    data: { status: ShareStatus.RECALLED, recalledAt: now }
  });

  await writeOrgAudit(db, {
    actorUserId: ownerUserId,
    action: OrgAuditAction.SERVICE_REPORT_SHARE_RECALLED,
    resourceType: OrgAuditResource.SERVICE_REPORT_SHARE,
    resourceId: share.id,
    meta: { organizationId: share.organizationId, month: share.month }
  }).catch(() => {});

  return { id: share.id, alreadyRecalled: false };
}
