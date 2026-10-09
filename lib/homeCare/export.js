/**
 * KODUTEENUS K1-i — täielik väljavõte asutuse enda nupust.
 *
 * MIKS. Asutuse andmed on asutuse omad. Ta peab saama need igal päeval kätte
 * ühe failina, mida loeb ka teine tarkvara, ilma meilt küsimata: varukoopiaks,
 * järelevalve nõudel või lahkudes. Kliendi ja perioodi väljavõte ametiasutusele
 * on kronoloogia (K1-d); see siin on kõik korraga.
 *
 * KES. Kogu asutuse hooldusjuht. Üksuse hooldusjuht näeb ainult oma üksust ja
 * tema fail ei oleks täielik; asutuse omanik ilma hooldusjuhi õiguseta ei näe
 * kliente ka ekraanil, seega väljavõte ei tohi olla talle tagauks. Omanik näeb
 * asutuse auditist, ET väljavõte tehti, kes ja milleks.
 *
 * KUIDAS. Kogu lugemine käib ühes REPEATABLE READ tehingus: fail on üks hetk
 * andmebaasist, mitte ridade kaupa eri hetkedest, nii et iga viide leiab oma rea
 * ja koguarvud klapivad ka siis, kui keegi samal ajal kirjutab. Read loetakse
 * lehtede kaupa ja pakitakse kohe: mälus on korraga üks leht ja pakitud fail.
 * Sisu kontrollsumma (SHA-256 pakkimata failist) ja koguarvud lähevad asutuse
 * tööloendisse ENNE kui fail välja antakse; kui tööloendi rida ei salvestu,
 * faili ei anta.
 *
 * Auditisse lähevad ainult ID, kood, arvud ja kontrollsumma. Sisu ei lähe.
 */

import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createGzip } from "node:zlib";

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { OrgError, forbidden } from "../org/errors.js";

import { assertHomeCareContext, coordinatorScope, organizationTimeZone, personName } from "./access.js";
import { CARE_EXPORT_REASONS, HOME_CARE_COORDINATOR } from "./constants.js";
import {
  HOME_CARE_EXPORT_COLLECTIONS,
  HOME_CARE_EXPORT_EXCLUSIONS,
  HOME_CARE_EXPORT_FORMAT,
  HOME_CARE_EXPORT_KEYS,
  HOME_CARE_EXPORT_VERSION
} from "./exportFormat.js";
import { asObject, normalizeEnum } from "./validation.js";

const PAGE_SIZE = 500;
/** Pakitud faili ülempiir mälus. Tekst pakib umbes kuus korda; see on sadu megabaite sisu. */
export const HOME_CARE_EXPORT_MAX_PACKED_BYTES = 64 * 1024 * 1024;
const TRANSACTION_TIMEOUT_MS = 120_000;
const RECENT_EXPORTS = 10;
const HOME_CARE_AUDIT_PREFIX = "org.home_care_";
/** Väljad, mis igas kogus viitavad töötaja liikmesusele. */
const PEOPLE_FIELDS = Object.fromEntries(HOME_CARE_EXPORT_COLLECTIONS.map((collection) => [collection.key, collection.people]));

function requireWholeOrgCoordinator(context) {
  const scope = coordinatorScope(context);
  if (!scope) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
  if (!scope.wholeOrg) throw forbidden("home_care.errors.export_whole_org_only");
}

/**
 * Kogude lugemise kirjeldus. Veerud on VALGE NIMEKIRI: uus veerg ei satu
 * väljavõttesse enne, kui keegi on otsustanud, et see sinna kuulub (ja mida
 * välja jätta, on kirjas `HOME_CARE_EXPORT_EXCLUSIONS`-is).
 */
function tableSpecs(organizationId) {
  const ofOrg = { organizationId };
  const fields = (names) => Object.fromEntries(names.map((name) => [name, true]));
  return {
    units: {
      model: "organizationUnit",
      where: ofOrg,
      select: fields(["id", "name", "type", "status", "parentUnitId", "archivedAt"])
    },
    clients: {
      model: "careClient",
      where: ofOrg,
      select: fields([
        "id",
        "unitId",
        "displayName",
        "internalCode",
        "address",
        "contactPhone",
        "contactNote",
        "status",
        "statusNote",
        "statusChangedAt",
        "version",
        "clientErasedAt",
        "createdByMembershipId",
        "createdAt",
        "updatedAt"
      ])
    },
    teamMembers: {
      model: "careClientTeamMember",
      where: { client: ofOrg },
      select: fields(["id", "clientId", "membershipId", "startedAt", "endedAt", "addedByMembershipId", "endedByMembershipId", "createdAt"])
    },
    cardLines: {
      model: "careClientCardLine",
      where: { client: ofOrg },
      select: fields(["id", "clientId", "kind", "text", "position", "addedByMembershipId", "createdAt", "endedAt", "endedByMembershipId"])
    },
    entries: {
      model: "careClientEntry",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "authorMembershipId",
        "authorName",
        "kind",
        "contactMode",
        "text",
        "coordinatorOnly",
        "occurredAt",
        "deviceCreatedAt",
        "deviceQueuedSec",
        "callTopic",
        "callCaller",
        "companionMembershipId",
        "companionName",
        "incidentType",
        "incidentAssessment",
        "incidentActions",
        "incidentStatus",
        "incidentAssigneeMembershipId",
        "incidentAssigneeName",
        "incidentResolvedAt",
        "incidentResolvedByMembershipId",
        "incidentResolutionNote",
        "revision",
        "retractedAt",
        "createdAt",
        "updatedAt"
      ])
    },
    entryRevisions: {
      model: "careClientEntryRevision",
      where: { entry: ofOrg },
      select: fields([
        "id",
        "entryId",
        "clientId",
        "kind",
        "text",
        "entryKind",
        "contactMode",
        "occurredAt",
        "snapshot",
        "revision",
        "reason",
        "actorMembershipId",
        "actorName",
        "createdAt"
      ])
    },
    entryReads: {
      model: "careClientEntryRead",
      where: { entry: ofOrg },
      select: fields(["id", "entryId", "membershipId", "readAt"])
    },
    incidentUpdates: {
      model: "careIncidentUpdate",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "entryId",
        "kind",
        "text",
        "fromStatus",
        "toStatus",
        "assigneeMembershipId",
        "assigneeName",
        "actorMembershipId",
        "actorName",
        "byCoordinator",
        "createdAt"
      ])
    },
    accessLog: {
      model: "careClientAccess",
      where: ofOrg,
      select: fields(["id", "clientId", "membershipId", "actorName", "basis", "reasonCode", "reason", "validUntil", "createdAt"])
    },
    chronologyReleases: {
      model: "careChronologyRelease",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "clientName",
        "periodFromDay",
        "periodToDay",
        "requester",
        "basis",
        "registryRef",
        "summary",
        "entryCount",
        "contentSha256",
        "createdByMembershipId",
        "createdByName",
        "createdAt"
      ])
    },
    chronologyReleaseItems: {
      model: "careChronologyReleaseItem",
      where: { release: ofOrg },
      select: fields([
        "id",
        "releaseId",
        "position",
        "entryId",
        "entryRevision",
        "occurredAt",
        "authorName",
        "kind",
        "contactMode",
        "incidentType",
        "text",
        "redacted"
      ])
    },
    importedHistories: {
      model: "careImportedHistory",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "title",
        "charCount",
        "blockCount",
        "contentSha256",
        "importedByMembershipId",
        "importedByName",
        "createdAt"
      ])
    },
    importedHistoryBlocks: {
      model: "careImportedHistoryBlock",
      where: ofOrg,
      select: fields(["id", "historyId", "clientId", "position", "text"])
    },
    doorTags: {
      model: "careClientDoorTag",
      where: ofOrg,
      select: fields(["id", "clientId", "createdByMembershipId", "createdAt", "revokedAt", "revokedByMembershipId"])
    },
    auditEvents: {
      model: "dataAuditLog",
      where: { action: { startsWith: HOME_CARE_AUDIT_PREFIX }, meta: { path: ["organizationId"], equals: organizationId } },
      select: fields(["id", "createdAt", "action", "resourceType", "resourceId", "actorUserId", "meta"])
    }
  };
}

/** Loeb kogu lehtede kaupa ID järjekorras. ID on võti, seega leht ei jäta rida vahele ega korda. */
async function* readPages(tx, spec) {
  let after = null;
  for (;;) {
    const rows = await tx[spec.model].findMany({
      where: after ? { AND: [spec.where, { id: { gt: after } }] } : spec.where,
      select: spec.select,
      orderBy: { id: "asc" },
      take: PAGE_SIZE
    });
    if (rows.length) yield rows;
    if (rows.length < PAGE_SIZE) return;
    after = rows[rows.length - 1].id;
  }
}

/**
 * Asutuse liikmesused nimega. Faili lähevad neist ainult need, kellele mõni
 * koduteenuse rida viitab (kogu `people` on failis viimane): hooldusjuht ei pea
 * väljavõttest saama asutuse kogu töötajate nimekirja.
 */
async function readPeople(tx, organizationId) {
  const rows = await tx.organizationMembership.findMany({
    where: { organizationId },
    select: {
      id: true,
      userId: true,
      jobTitle: true,
      user: { select: { profile: { select: { firstName: true, lastName: true } } } }
    },
    orderBy: { id: "asc" }
  });
  const membershipByUser = new Map();
  const people = rows.map((row) => {
    if (row.userId) membershipByUser.set(row.userId, row.id);
    return { id: row.id, name: personName(row) || null };
  });
  return { people, membershipByUser };
}

/**
 * Pakkija: võtab teksti, annab pakitud tükid. Kontrollsumma ja suurus arvutatakse
 * PAKKIMATA tekstist, sest brauser pakib faili salvestades lahti ja asutus
 * võrdleb oma faili summat tööloendi omaga.
 */
function createPackedSink(maxPackedBytes) {
  const gzip = createGzip({ level: 6 });
  const hash = createHash("sha256");
  const chunks = [];
  let packedBytes = 0;
  let rawBytes = 0;
  let failure = null;
  gzip.on("data", (chunk) => {
    packedBytes += chunk.length;
    if (packedBytes > maxPackedBytes) {
      failure = failure || new OrgError(413, "home_care.errors.export_too_large");
      return;
    }
    chunks.push(chunk);
  });
  const ended = new Promise((resolve, reject) => {
    gzip.once("end", resolve);
    gzip.once("error", reject);
  });
  /* Viga ei tohi jääda käsitlemata lubaduseks, kui kirjutaja katkestab enne lõppu. */
  ended.catch(() => {});

  return {
    async write(text) {
      if (failure) throw failure;
      hash.update(text, "utf8");
      rawBytes += Buffer.byteLength(text, "utf8");
      if (!gzip.write(text, "utf8")) await once(gzip, "drain");
      if (failure) throw failure;
    },
    async finish() {
      gzip.end();
      await ended;
      if (failure) throw failure;
      return { body: Buffer.concat(chunks), rawBytes, packedBytes, sha256: hash.digest("hex") };
    },
    abort() {
      gzip.destroy();
    }
  };
}

function toAuditRow(row, membershipByUser) {
  /* Tegija on väljavõttes liikmesuse ID-na nagu igal pool mujal selles failis.
     Platvormi kasutaja ID ei ole asutuse andmed. */
  return {
    id: row.id,
    createdAt: row.createdAt,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    actorMembershipId: (row.actorUserId && membershipByUser.get(row.actorUserId)) || null,
    meta: row.meta || null
  };
}

/**
 * Koostab täieliku väljavõtte. Tagastab pakitud faili (gzip) koos sellega, mida
 * vastuse päistes ja lehel näidata.
 */
export async function createHomeCareExport(
  context,
  rawInput = {},
  { db = prisma, now = new Date(), env = process.env, maxPackedBytes = HOME_CARE_EXPORT_MAX_PACKED_BYTES } = {}
) {
  assertHomeCareContext(context, { env });
  requireWholeOrgCoordinator(context);
  const reasonCode = normalizeEnum(asObject(rawInput).reasonCode, CARE_EXPORT_REASONS, "home_care.errors.invalid_export_reason");
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id || null;
  const exportId = randomUUID();
  const generatedAt = now.toISOString();
  const specs = tableSpecs(organizationId);
  const sink = createPackedSink(maxPackedBytes);
  const totals = {};

  try {
    await db.$transaction(
      async (tx) => {
        const organization = await tx.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, displayName: true, legalName: true, registryCode: true, timezone: true }
        });
        const { people, membershipByUser } = await readPeople(tx, organizationId);
        const exportedBy = people.find((person) => person.id === membershipId) || null;

        const head = {
          format: HOME_CARE_EXPORT_FORMAT,
          version: HOME_CARE_EXPORT_VERSION,
          exportId,
          generatedAt,
          organization: {
            id: organization?.id || organizationId,
            displayName: organization?.displayName || null,
            legalName: organization?.legalName || null,
            registryCode: organization?.registryCode || null,
            timezone: organization?.timezone || organizationTimeZone(context)
          },
          exportedBy: { membershipId, name: exportedBy?.name || null },
          reasonCode,
          manifest: {
            includes: [...HOME_CARE_EXPORT_KEYS],
            excludes: HOME_CARE_EXPORT_EXCLUSIONS.map((item) => ({ key: item.key, why: item.why })),
            note:
              "Kõik read on ühest andmebaasi hetkest. Kogud on ID järjekorras; ajad on UTC-s (ISO 8601) ja asutuse " +
              "ajavöönd on päises. Töötajale viitab liikmesuse ID, mille nimi on kogus „people”. Faili lõpus on " +
              "koguarvud: kui neid ei ole, on fail poolik."
          }
        };
        /* Päis ilma lõpetava loogeliseta: kogud ja koguarvud tulevad samasse objekti. */
        await sink.write(JSON.stringify(head).slice(0, -1));

        /* Kellele read viitavad: koostaja ise ja iga rea töötaja-väljad. */
        const referenced = new Set(membershipId ? [membershipId] : []);
        for (const key of HOME_CARE_EXPORT_KEYS) {
          await sink.write(`,${JSON.stringify(key)}:[`);
          let count = 0;
          const writeRows = async (rows) => {
            if (!rows.length) return;
            for (const field of PEOPLE_FIELDS[key]) {
              for (const row of rows) if (row[field]) referenced.add(row[field]);
            }
            const text = rows.map((row) => JSON.stringify(row)).join(",");
            await sink.write(count ? `,${text}` : text);
            count += rows.length;
          };
          if (key === "people") {
            /* `people` on kogude loendis viimane: selleks ajaks on kõik viited teada. */
            await writeRows(people.filter((person) => referenced.has(person.id)));
          } else {
            for await (const rows of readPages(tx, specs[key])) {
              await writeRows(key === "auditEvents" ? rows.map((row) => toAuditRow(row, membershipByUser)) : rows);
            }
          }
          await sink.write("]");
          totals[key] = count;
        }
        await sink.write(`,"totals":${JSON.stringify(totals)}}`);
      },
      { isolationLevel: "RepeatableRead", maxWait: 5_000, timeout: TRANSACTION_TIMEOUT_MS }
    );
  } catch (error) {
    sink.abort();
    throw error;
  }

  const packed = await sink.finish();
  const rowCount = Object.values(totals).reduce((sum, count) => sum + count, 0);

  /* Tööloendi rida ENNE faili väljaandmist: väljavõtet, millest jälge ei jäänud, ei ole. */
  await writeOrgAudit(db, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_EXPORT_CREATED,
    resourceType: OrgAuditResource.CARE_EXPORT,
    resourceId: exportId,
    meta: {
      organizationId,
      membershipId,
      exportId,
      reasonCode,
      clientCount: totals.clients || 0,
      entryCount: totals.entries || 0,
      rowCount,
      byteCount: packed.rawBytes,
      contentSha256: packed.sha256
    }
  });

  return {
    exportId,
    generatedAt,
    reasonCode,
    totals,
    rowCount,
    byteCount: packed.rawBytes,
    packedByteCount: packed.packedBytes,
    contentSha256: packed.sha256,
    body: packed.body
  };
}

/**
 * Väljavõtte lehe sisu: mida fail praegu sisaldaks (põhiarvud) ja viimased
 * tehtud väljavõtted asutuse tööloendist.
 */
export async function getHomeCareExportOverview(context, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  requireWholeOrgCoordinator(context);
  const organizationId = context.organization.id;
  const ofOrg = { organizationId };

  const [clients, entries, accessLog, importedHistories, chronologyReleases, recentRows] = await Promise.all([
    db.careClient.count({ where: ofOrg }),
    db.careClientEntry.count({ where: ofOrg }),
    db.careClientAccess.count({ where: ofOrg }),
    db.careImportedHistory.count({ where: ofOrg }),
    db.careChronologyRelease.count({ where: ofOrg }),
    db.dataAuditLog.findMany({
      where: {
        action: OrgAuditAction.HOME_CARE_EXPORT_CREATED,
        meta: { path: ["organizationId"], equals: organizationId }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: RECENT_EXPORTS,
      select: { id: true, createdAt: true, resourceId: true, meta: true }
    })
  ]);

  const memberIds = [...new Set(recentRows.map((row) => row.meta?.membershipId).filter((id) => typeof id === "string"))];
  const members = memberIds.length
    ? await db.organizationMembership.findMany({
        where: { organizationId, id: { in: memberIds } },
        select: { id: true, jobTitle: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } }
      })
    : [];
  const names = new Map(members.map((row) => [row.id, personName(row)]));

  const number = (value) => (Number.isFinite(value) ? value : null);
  return {
    counts: { clients, entries, accessLog, importedHistories, chronologyReleases },
    recent: recentRows.map((row) => ({
      id: row.resourceId || row.id,
      createdAt: row.createdAt,
      byName: names.get(row.meta?.membershipId) || "",
      reasonCode: CARE_EXPORT_REASONS.includes(row.meta?.reasonCode) ? row.meta.reasonCode : null,
      clientCount: number(row.meta?.clientCount),
      entryCount: number(row.meta?.entryCount),
      rowCount: number(row.meta?.rowCount),
      byteCount: number(row.meta?.byteCount),
      contentSha256: typeof row.meta?.contentSha256 === "string" ? row.meta.contentSha256 : null
    }))
  };
}
