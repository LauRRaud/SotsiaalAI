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

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
  decodePageCursor,
  descendingCursorWhere,
  normalizePageSize,
  toCursorPage
} from "@/lib/org/pagination";
import {
  deleteStoredDocument,
  getStoredDocumentPath,
  promoteStoredDocument,
  readStoredDocument,
  writeStoredBuffer
} from "@/lib/documents/server";

import { OrganizationCapability, OrganizationMembershipStatus } from "@/lib/org/constants";
import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "@/lib/org/audit";

import { badRequest, conflict, forbidden, notFound } from "./errors.js";
import { SERVICE_LOG_REPORT_KIND } from "./reportArchive.js";
import { reportRetentionEnd } from "./reportRetention.js";

export const ShareStatus = Object.freeze({
  SENT: "SENT",
  OPENED: "OPENED",
  RECALLED: "RECALLED"
});

const DELIVERY_TOKEN_TTL_MS = 5 * 60 * 1000;

function deliverySecret(env = process.env) {
  const secret = String(env.REPORT_DELIVERY_SECRET || env.NEXTAUTH_SECRET || env.AUTH_SECRET || "").trim();
  if (secret) return secret;
  if (String(env.NODE_ENV || "").toLowerCase() !== "production") return "sotsiaalai-local-report-delivery";
  const error = new Error("REPORT_DELIVERY_UNAVAILABLE");
  error.status = 503;
  throw error;
}

function signDeliveryPayload(encoded, env) {
  return createHmac("sha256", deliverySecret(env)).update(encoded).digest("base64url");
}

function signaturesMatch(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assertReportFileIntegrity(document, buffer) {
  const content = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const expectedSize = Number(document?.sizeBytes);
  const expectedHash = String(document?.sha256 || "").trim().toLowerCase();
  const actualHash = createHash("sha256").update(content).digest("hex");
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 0 || content.byteLength !== expectedSize) {
    const error = new Error("REPORT_FILE_SIZE_MISMATCH");
    error.code = "REPORT_FILE_SIZE_MISMATCH";
    throw error;
  }
  if (!/^[a-f0-9]{64}$/.test(expectedHash) || !signaturesMatch(actualHash, expectedHash)) {
    const error = new Error("REPORT_FILE_HASH_MISMATCH");
    error.code = "REPORT_FILE_HASH_MISMATCH";
    throw error;
  }
  return content;
}

export async function readVerifiedReportFile(
  document,
  { readFile = readStoredDocument } = {}
) {
  return assertReportFileIntegrity(document, await readFile(document.storagePath));
}

export function createReportDeliveryToken(
  document,
  { actorUserId, now = new Date(), env = process.env } = {}
) {
  const payload = {
    v: 1,
    shareId: document.id,
    recipientMembershipId: document.recipientMembershipId,
    actorUserId,
    sha256: document.sha256,
    exp: now.getTime() + DELIVERY_TOKEN_TTL_MS
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signDeliveryPayload(encoded, env)}`;
}

function verifyReportDeliveryToken(
  token,
  { actorUserId, membershipIds, shareId, now = new Date(), env = process.env }
) {
  try {
    const [encoded, signature, extra] = String(token || "").split(".");
    if (!encoded || !signature || extra || !signaturesMatch(signature, signDeliveryPayload(encoded, env))) {
      throw new Error("signature");
    }
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    const ids = new Set((Array.isArray(membershipIds) ? membershipIds : [membershipIds]).filter(Boolean));
    if (
      payload?.v !== 1 ||
      !payload.shareId ||
      payload.shareId !== shareId ||
      !payload.recipientMembershipId ||
      payload.actorUserId !== actorUserId ||
      !ids.has(payload.recipientMembershipId) ||
      !Number.isFinite(payload.exp) ||
      payload.exp < now.getTime()
    ) {
      throw new Error("payload");
    }
    return payload;
  } catch {
    throw notFound();
  }
}

const MAX_NOTE_LENGTH = 500;

/**
 * INIMESE NIMI EI OLE `User.name` — SEDA VÄLJA EI OLE OLEMAS.
 *
 * Esimene versioon valis `user.name` ja see oleks produktsioonis visanud
 * `Unknown field \`name\` for select statement on model \`User\``. Testid seda ei
 * näinud (fake-prisma ei valideeri skeemi) ja lint samuti mitte. Leidsin
 * päris andmebaasi vastu päringut tehes.
 *
 * Nimi elab `UserProfile`-is; e-post tuleb ainult siis, kui nime ei ole — muidu
 * poleks saaja tuvastatav. Sama muster mis `lib/org/supportShare.js`-is.
 */
const PERSON_SELECT = Object.freeze({
  id: true,
  email: true,
  profile: { select: { firstName: true, lastName: true } }
});

function personName(user) {
  const full = [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(" ").trim();
  return full || user?.email || "";
}

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
 *
 * SOL-SLOG-14 — MIKS SEE TAGASTAB MASSIIVI, MITTE OBJEKTI.
 *
 * Vana teostus tagastas objekti, mille sees oli `OR`, ja kutsuja spread'is ta
 * `where`-i sisse. Sama `where` sisaldas TEIST `OR`-i (skoobitüübi jaoks) ja
 * JavaScript kirjutas objektiliteraalis samanimelise võtme lihtsalt üle: kehtivuse
 * kontroll KADUS päris Prisma WHERE-st. Ei süntaksiviga, ei hoiatust, ei testi —
 * aegunud UNIT_LEAD või ORG_OWNER luba andis endiselt õiguse saada töötaja
 * kliendiaruande külmutatud koopia.
 *
 * `AND`-massiivi harudena ei saa see korduda: kaks haru elavad kõrvuti, mitte
 * ühe võtme all. Struktuur ise välistab vea, mitte tähelepanelikkus.
 */
function activeGrantConditions(now) {
  return [
    { revokedAt: null },
    { validFrom: { lte: now } },
    { OR: [{ validUntil: null }, { validUntil: { gt: now } }] }
  ];
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
      /* `Organization.name` EI OLE OLEMAS — väli on `displayName`. Sama pere
         viga mis `User.name`: fake-prisma ei valideeri skeemi, seega roheline
         sviit ei tõenda ühtegi `select`-i. */
      organization: { select: { id: true, displayName: true } },
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
              user: { select: PERSON_SELECT }
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
          membership: {
            organizationId: membership.organizationId,
            status: OrganizationMembershipStatus.ACTIVE
          },
          // SOL-SLOG-14: kehtivus ja skoop on ÜHE `AND` eri harudes, vt selgitust
          // `activeGrantConditions` juures. Kaks `OR`-i ühes objektis kaotas ühe.
          AND: [
            ...activeGrantConditions(now),
            {
              OR: [
                { scopeType: "ORGANIZATION" },
                ...(unitIds.length ? [{ scopeType: "UNIT", scopeUnitId: { in: unitIds } }] : [])
              ]
            }
          ]
        },
        select: {
          capability: true,
          membership: {
            select: {
              id: true,
              jobTitle: true,
              organizationId: true,
              user: { select: PERSON_SELECT }
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
        organizationName: membership.organization?.displayName || "",
        name: personName(target.user),
        jobTitle: target.jobTitle || null,
        relation
      });
    };

    /* SOL-SLOG-13 — JÄRJEKORD ON SIIN AUTORISEERIMISOTSUS, MITTE STIIL.
     *
     * Varem lisas `managerLines` saaja ISE: iga aktiivne lõputa otsese juhi seos
     * sai kliendinimede, teenuste, mahtude ja märkmetega faili lugemisõiguse.
     * Prisma mudeli enda invariant ütleb sõnaselgelt vastupidist — „EI ANNA
     * SISUÕIGUSI … seost ei tohi kasutada üheski capability-kontrollis"
     * (`prisma/schema.prisma`, `OrganizationReportingLine`). Valesti või liiga
     * laialt määratud juht sai tundliku aruande seadusliku aluseta.
     *
     * Nüüd AUTORISEERIB ainult capability. Juhiseos võib öelda ainult seda, KUIDAS
     * teda nimetada — „juht" on täpsem sõna kui „üksuse juht", kui sama inimene on
     * mõlemat. Kui capability't ei ole, ei ilmu ta loendisse üldse ja seega ei
     * läbi ka otsest POST-i: `shareMonthlyReport` valideerib sama loendi vastu.
     */
    for (const grant of leadGrants) {
      add(grant.membership, grant.capability === OrganizationCapability.ORG_OWNER ? "org_owner" : "unit_lead");
    }
    for (const line of managerLines) {
      const authorized = line.manager && recipients.get(line.manager.id);
      if (authorized) authorized.relation = "manager";
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
    makeStoragePath = getStoredDocumentPath,
    promoteFile = promoteStoredDocument,
    deleteFile = deleteStoredDocument
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

  const source = await readDocument(document.storagePath);
  const sharePath = makeStoragePath(document.originalName);
  const stagingPath = makeStoragePath(`${document.originalName}.preparing`);
  const retentionEndsAt = reportRetentionEnd({ kind: SERVICE_LOG_REPORT_KIND, metadata: document.metadata });
  if (!retentionEndsAt) throw conflict("service_log.errors.report_retention_invalid");

  let shareId = null;

  try {
    const preparing = await db.serviceReportShare.create({
      data: {
        /* VIIDE ILMA VÕÕRVÕTITA: omaniku enda loendi jaoks („millist aruannet
           ma jagasin"). Saaja päring seda ei joini. */
        documentId: document.id,
        ownerUserId,
        organizationId: membership.organizationId,
        recipientMembershipId,
        month,
        storagePath: sharePath,
        stagingStoragePath: stagingPath,
        fileName: document.originalName,
        mime: document.mime,
        sizeBytes: source.byteLength,
        sha256: createHash("sha256").update(source).digest("hex"),
        kovName: document.metadata?.kovName || null,
        entryCount: Number.isFinite(Number(document.metadata?.entryCount))
          ? Number(document.metadata.entryCount)
          : null,
        note: cleanNote(note),
        status: "PREPARING",
        retentionEndsAt,
        sentAt: now
      },
      select: { id: true }
    });
    shareId = preparing.id;

    const stored = await storeBuffer(source, stagingPath);
    await promoteFile(stagingPath, sharePath);

    const share = await db.$transaction(async (tx) => {
      await lockServiceReportShareRow(tx, preparing.id);
      const finalized = await tx.serviceReportShare.updateMany({
        where: { id: preparing.id, status: "PREPARING" },
        data: { status: ShareStatus.SENT, stagingStoragePath: null, sizeBytes: stored.size, sha256: stored.sha256 }
      });
      if (finalized.count !== 1) throw conflict();

      await writeOrgAudit(tx, {
        actorUserId: ownerUserId,
        targetUserId: membership.userId,
        action: OrgAuditAction.SERVICE_REPORT_SHARE_SENT,
        resourceType: OrgAuditResource.SERVICE_REPORT_SHARE,
        resourceId: preparing.id,
        meta: { organizationId: membership.organizationId, month, documentId: document.id }
      });
      return { id: preparing.id };
    });

    return { id: share.id, recipientUserId: membership.userId, month };
  } catch (error) {
    /* Osaline unikaalindeks (`recalledAt IS NULL`) tähendab: sama aruanne on
       sellele juhile juba KEHTIVALT saadetud. See ei ole viga, vaid seis. */
    if (error?.code === "P2002" && !shareId) {
      throw conflict("service_log.errors.share_already_sent");
    }
    if (shareId) {
      let filesClean = true;
      for (const path of [stagingPath, sharePath]) {
        try {
          await deleteFile(path);
        } catch {
          filesClean = false;
        }
      }
      /* Rida on cleanup-job. Teda tohib eemaldada ainult siis, kui MÕLEMAD
         võimalikud failiasukohad on puhtad; muidu korjab retention-sweep. */
      if (filesClean) {
        await db.serviceReportShare.deleteMany({ where: { id: shareId, status: "PREPARING" } }).catch(() => {});
      }
    }
    throw error;
  }
}

/** Mida MINA olen jaganud. */
export async function listOwnShares(ownerUserId, { month = null, db = prisma, take = 100 } = {}) {
  if (!ownerUserId) return [];
  const rows = await db.serviceReportShare.findMany({
    where: { ownerUserId, status: { not: "PREPARING" }, ...(month ? { month } : {}) },
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
      recipient: { select: { id: true, jobTitle: true, user: { select: PERSON_SELECT } } }
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
    recipientName: personName(row.recipient?.user),
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
export async function listReceivedSharePage(
  membershipIds,
  { db = prisma, take = 200, cursor, status, unopened = false } = {}
) {
  const ids = (Array.isArray(membershipIds) ? membershipIds : [membershipIds]).filter(Boolean);
  if (!ids.length) return { items: [], hasMore: false, nextCursor: null };

  const normalizedStatus = String(status || "").trim();
  if (normalizedStatus && !Object.values(ShareStatus).includes(normalizedStatus)) {
    throw badRequest("org.errors.invalid_payload");
  }
  const decoded = decodePageCursor(cursor, { stringKeys: ["month", "id"], dateKeys: ["sentAt"] });
  const pageSize = normalizePageSize(take, 200, 200);
  const baseWhere = {
    recipientMembershipId: { in: ids },
    recalledAt: null,
    status: normalizedStatus || { in: [ShareStatus.SENT, ShareStatus.OPENED] },
    ...(unopened ? { openedAt: null } : {})
  };

  const rows = await db.serviceReportShare.findMany({
    where: decoded
      ? { AND: [baseWhere, descendingCursorWhere(decoded, ["month", "sentAt", "id"])] }
      : baseWhere,
    orderBy: [{ month: "desc" }, { sentAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
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
      owner: { select: PERSON_SELECT }
    }
  });

  /* SAAJA PROJEKTSIOON. `documentId`, `storagePath` ja `ownerUserId` EI OLE
     siin: nad on omaniku ja auditi omad. Sama valge nimekirja muster mis
     `toRecipientView` tööheaolu rajal. */
  const page = toCursorPage(rows, pageSize, (row) => ({ month: row.month, sentAt: row.sentAt, id: row.id }));
  return {
    ...page,
    items: page.items.map((row) => ({
    id: row.id,
    month: row.month,
    note: row.note,
    status: row.status,
    sentAt: row.sentAt?.toISOString?.() || null,
    openedAt: row.openedAt?.toISOString?.() || null,
    senderName: personName(row.owner),
    fileName: row.fileName,
    size: row.sizeBytes ?? null,
    kovName: row.kovName || null,
    entryCount: row.entryCount ?? null
    }))
  };
}

export async function listReceivedShares(membershipIds, options = {}) {
  return (await listReceivedSharePage(membershipIds, options)).items;
}

/** Autoriseerib külmutatud faili lugemise, aga EI väida veel, et baitide tarne õnnestus. */
export async function prepareShareDelivery(shareId, { membershipIds }, { db = prisma } = {}) {
  const ids = (Array.isArray(membershipIds) ? membershipIds : [membershipIds]).filter(Boolean);
  if (!shareId || !ids.length) throw notFound();

  const share = await db.serviceReportShare.findFirst({
    where: {
      id: shareId,
      recipientMembershipId: { in: ids },
      status: { in: [ShareStatus.SENT, ShareStatus.OPENED] },
      recalledAt: null
    },
    select: {
      id: true,
      status: true,
      recipientMembershipId: true,
      organizationId: true,
      ownerUserId: true,
      month: true,
      storagePath: true,
      fileName: true,
      mime: true,
      sizeBytes: true,
      sha256: true
    }
  });
  if (!share?.storagePath) throw notFound();
  return share;
}

/**
 * Kirjutab ausa ligipääsukatse enne, kui server ühegi aruandebaidi vastusesse
 * annab. See EI tähenda `OPENED`: edukas tarne kinnitatakse eraldi alles pärast
 * kogu vastuse lugemist. Audit ei ole best-effort — kui jälge ei saa kirjutada,
 * ei tohi tundlik fail serverist väljuda.
 */
export async function recordShareAccessAttempt(
  shareId,
  { membershipIds, actorUserId },
  { db = prisma } = {}
) {
  const ids = (Array.isArray(membershipIds) ? membershipIds : [membershipIds]).filter(Boolean);
  if (!shareId || !actorUserId || !ids.length) throw notFound();

  /* Kontrollime õigust uuesti vahetult enne auditit ja väljastust. Faili
     kontrollimise ajal võis omanik jagamise tagasi võtta. */
  const share = await db.serviceReportShare.findFirst({
    where: { id: shareId, recipientMembershipId: { in: ids }, recalledAt: null },
    select: { id: true, organizationId: true, ownerUserId: true }
  });
  if (!share) throw notFound();

  await writeOrgAudit(db, {
    actorUserId,
    targetUserId: share.ownerUserId,
    action: OrgAuditAction.SERVICE_REPORT_SHARE_ACCESS_ATTEMPTED,
    resourceType: OrgAuditResource.SERVICE_REPORT_SHARE,
    resourceId: share.id,
    meta: { organizationId: share.organizationId }
  });
  return { id: share.id };
}

async function lockServiceReportShareRow(tx, shareId) {
  await tx.$queryRaw`SELECT "id" FROM "ServiceReportShare" WHERE "id" = ${shareId} FOR UPDATE`;
}

/** Märgib OPENED alles pärast seda, kui klient on kogu vastuse edukalt vastu võtnud. */
export async function confirmShareDelivery(
  deliveryToken,
  { membershipIds, actorUserId, shareId },
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  const payload = verifyReportDeliveryToken(deliveryToken, {
    actorUserId,
    membershipIds,
    shareId,
    now,
    env
  });
  return db.$transaction(async (tx) => {
    await lockServiceReportShareRow(tx, payload.shareId);
    const share = await tx.serviceReportShare.findFirst({
      where: {
        id: payload.shareId,
        recipientMembershipId: payload.recipientMembershipId,
        recalledAt: null
      },
      select: {
        id: true,
        status: true,
        organizationId: true,
        ownerUserId: true,
        month: true,
        sha256: true,
        updatedAt: true
      }
    });
    if (!share || !signaturesMatch(share.sha256, payload.sha256)) throw notFound();
    if (share.status === ShareStatus.OPENED) return { id: share.id, alreadyOpened: true };
    if (share.status !== ShareStatus.SENT) throw conflict();

    const updated = await tx.serviceReportShare.updateMany({
      where: { id: share.id, status: ShareStatus.SENT, updatedAt: share.updatedAt },
      data: { status: ShareStatus.OPENED, openedAt: now }
    });
    if (updated.count !== 1) throw conflict();

    /* Audit EI OLE best-effort: tema tõrge keerab OPENED muutuse samas tehingus tagasi. */
    await writeOrgAudit(tx, {
      actorUserId,
      targetUserId: share.ownerUserId,
      action: OrgAuditAction.SERVICE_REPORT_SHARE_OPENED,
      resourceType: OrgAuditResource.SERVICE_REPORT_SHARE,
      resourceId: share.id,
      meta: { organizationId: share.organizationId, month: share.month }
    });
    return { id: share.id, alreadyOpened: false };
  });
}

/** Omanik võtab jagamise tagasi. Rida jääb alles (vt faili päise punkt 4). */
export async function recallShare(shareId, { ownerUserId }, { db = prisma, now = new Date() } = {}) {
  if (!shareId || !ownerUserId) throw notFound();
  return db.$transaction(async (tx) => {
    await lockServiceReportShareRow(tx, shareId);
    const share = await tx.serviceReportShare.findFirst({
      where: { id: shareId, ownerUserId },
      select: { id: true, status: true, recalledAt: true, organizationId: true, month: true, updatedAt: true }
    });
    if (!share) throw notFound();
    if (share.recalledAt) return { id: share.id, alreadyRecalled: true };
    if (![ShareStatus.SENT, ShareStatus.OPENED].includes(share.status)) throw conflict();

    const updated = await tx.serviceReportShare.updateMany({
      where: { id: share.id, updatedAt: share.updatedAt, recalledAt: null },
      data: { status: ShareStatus.RECALLED, recalledAt: now }
    });
    if (updated.count !== 1) throw conflict();

    await writeOrgAudit(tx, {
      actorUserId: ownerUserId,
      action: OrgAuditAction.SERVICE_REPORT_SHARE_RECALLED,
      resourceType: OrgAuditResource.SERVICE_REPORT_SHARE,
      resourceId: share.id,
      meta: { organizationId: share.organizationId, month: share.month }
    });

    return { id: share.id, alreadyRecalled: false };
  });
}

export async function purgeServiceReportShareFiles({
  db = prisma,
  now = new Date(),
  preparingBefore = new Date(now.getTime() - 60 * 60 * 1000),
  deleteFile = deleteStoredDocument,
  limit = 100
} = {}) {
  const rows = await db.serviceReportShare.findMany({
    where: {
      OR: [
        { status: "PREPARING", createdAt: { lt: preparingBefore } },
        { retentionEndsAt: { lte: now } }
      ]
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, storagePath: true, stagingStoragePath: true }
  });
  let purged = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      for (const path of [row.stagingStoragePath, row.storagePath].filter(Boolean)) await deleteFile(path);
      await db.serviceReportShare.delete({ where: { id: row.id } });
      purged += 1;
    } catch {
      failed += 1;
    }
  }
  return { scanned: rows.length, purged, failed };
}
