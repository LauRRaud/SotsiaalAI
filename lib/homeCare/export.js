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

import { ORG_AUDIT_ACTIONS, OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { OrgError, conflict, forbidden } from "../org/errors.js";

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
/**
 * Faili ülempiirid. Pakkimata sisu 256 MB: nii palju võtab brauser kontrollsumma
 * arvutamiseks mällu ja nii suurt faili loeb ka käsurea kontroll. Pakitud kuju
 * 64 MB on see, mida server korraga mälus hoiab. Üle piiri on viga, mitte poolik fail.
 */
export const HOME_CARE_EXPORT_MAX_RAW_BYTES = 256 * 1024 * 1024;
export const HOME_CARE_EXPORT_MAX_PACKED_BYTES = 64 * 1024 * 1024;
const TRANSACTION_TIMEOUT_MS = 120_000;
const RECENT_EXPORTS = 10;
/** Koduteenuse tööloendi toimingud. Loend, mitte eesliide: nii saab päring kasutada toimingu indeksit. */
const HOME_CARE_AUDIT_ACTIONS = ORG_AUDIT_ACTIONS.filter((action) => action.startsWith("org.home_care_"));
/** Asutused, mille väljavõte on praegu koostamisel: üks korraga, sest iga väljavõte hoiab ühendust ja mälu. */
const exportsInProgress = new Set();
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
        "statusReason",
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
      /* K5-y: `forDriver` (rida läheb transpordikaardile). */
      select: fields(["id", "clientId", "kind", "text", "position", "forDriver", "addedByMembershipId", "createdAt", "endedAt", "endedByMembershipId"])
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
        "visitMinutes",
        "changeAnswer",
        "changeAreas",
        "changeMajor",
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
    clientStatusChanges: {
      model: "careClientStatusChange",
      where: ofOrg,
      select: fields(["id", "clientId", "fromStatus", "toStatus", "reason", "note", "actorMembershipId", "actorName", "changedAt"])
    },
    activities: {
      model: "careActivity",
      where: ofOrg,
      select: fields(["id", "group", "name", "note", "position", "version", "archivedAt", "createdByMembershipId", "createdAt", "updatedAt"])
    },
    carePlans: {
      model: "carePlan",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "number",
        "status",
        "goals",
        "reviewOn",
        "note",
        "version",
        "createdByMembershipId",
        "createdByName",
        "activatedAt",
        "activatedByMembershipId",
        "activatedByName",
        "replacedAt",
        "createdAt",
        "updatedAt"
      ])
    },
    carePlanLines: {
      model: "carePlanLine",
      where: { plan: ofOrg },
      select: fields([
        "id",
        "planId",
        "clientId",
        "activityId",
        "activityName",
        "activityGroup",
        "frequencyKind",
        "frequencyCount",
        "frequencyNote",
        "mode",
        "critical",
        "note",
        "position",
        "createdAt"
      ])
    },
    decisions: {
      model: "careDecision",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "kind",
        "issuerName",
        "documentNumber",
        "decidedOn",
        "validFrom",
        "validUntil",
        "volumeMinutes",
        "volumePeriod",
        "feeNote",
        "note",
        /* K6-h: lepingu allkirja märge ja originaali hoiukoht. */
        "signState",
        "signedOn",
        "originalKept",
        "version",
        "createdByMembershipId",
        "createdByName",
        "retractedAt",
        "retractedByMembershipId",
        "retractedByName",
        "createdAt",
        "updatedAt"
      ])
    },
    entryActivities: {
      model: "careEntryActivity",
      where: ofOrg,
      select: fields([
        "id",
        "entryId",
        "clientId",
        "planLineId",
        "activityId",
        "activityName",
        "activityGroup",
        "mode",
        "outcome",
        "medicationAction",
        "outsidePlan",
        "position",
        "createdAt"
      ])
    },
    visitSlots: {
      model: "careVisitSlot",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "weekday",
        "startMinute",
        "plannedMinutes",
        "priority",
        "workerMembershipId",
        "note",
        "validFrom",
        "validUntil",
        "version",
        "createdByMembershipId",
        "createdAt",
        "updatedAt"
      ])
    },
    visitChanges: {
      model: "careVisitChange",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "slotId",
        "day",
        "kind",
        "workerMembershipId",
        "startMinute",
        "reason",
        "note",
        "createdByMembershipId",
        "createdByName",
        "createdAt",
        "updatedAt"
      ])
    },
    absences: {
      model: "careAbsence",
      where: ofOrg,
      select: fields(["id", "membershipId", "fromDay", "toDay", "kind", "version", "createdByMembershipId", "createdByName", "createdAt", "updatedAt"])
    },
    usualStates: {
      model: "careUsualState",
      where: ofOrg,
      select: fields(["id", "clientId", "area", "text", "createdByMembershipId", "createdByName", "createdAt", "endedAt", "endedByMembershipId"])
    },
    changeSignals: {
      model: "careChangeSignal",
      where: ofOrg,
      select: fields(["id", "clientId", "area", "reason", "entryId", "openedAt", "handledAt", "handledByMembershipId", "handledByName", "outcome", "note"])
    },
    transportRequests: {
      model: "careTransportRequest",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "wantedOn",
        "wantedTime",
        "destination",
        "needs",
        "requestedByMembershipId",
        "requestedByName",
        "createdAt",
        "state",
        "pickupTime",
        "answerNote",
        "answeredAt",
        "answeredByMembershipId",
        "answeredByName",
        "withdrawnAt",
        "withdrawnByMembershipId"
      ])
    },
    firstVisitNotices: {
      model: "careFirstVisitNotice",
      where: ofOrg,
      select: fields(["id", "clientId", "workerMembershipId", "day", "outcome", "createdByMembershipId", "createdByName", "createdAt", "endedAt", "endedByMembershipId"])
    },
    decisionNotices: {
      model: "careDecisionNotice",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "reason",
        "text",
        "recipient",
        "channel",
        "sentOn",
        "entryIds",
        "sentText",
        "createdByMembershipId",
        "createdByName",
        "createdAt",
        "answer",
        "answeredOn",
        "reassessBy",
        "answerNote",
        "answeredAt",
        "answeredByMembershipId",
        "answeredByName",
        "withdrawnAt",
        "withdrawnByMembershipId",
        "withdrawReason"
      ])
    },
    monthLocks: {
      model: "careMonthLock",
      where: ofOrg,
      select: fields([
        "id",
        "month",
        "snapshot",
        "openItemCount",
        "lockedByMembershipId",
        "lockedByName",
        "lockedAt",
        "reopenedAt",
        "reopenedByMembershipId",
        "reopenedByName",
        "reopenReason"
      ])
    },
    safetyItems: {
      model: "careSafetyItem",
      where: ofOrg,
      select: fields(["id", "clientId", "topic", "answer", "note", "createdByMembershipId", "createdByName", "createdAt", "endedAt", "endedByMembershipId"])
    },
    clientRelatives: {
      model: "careClientRelative",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "name",
        "relation",
        "phone",
        "level",
        "noTell",
        "agreedOn",
        "createdByMembershipId",
        "createdByName",
        "createdAt",
        "endedAt",
        "endedByMembershipId",
        /* K5-u: „klient ei mäleta, et lubas" märge (aeg ja märkija nimi). */
        "doubtAt",
        "doubtByName"
      ])
    },
    /* K6-k: soovid „soovin sellest rääkida", ka tagasi võetud ja räägitud. */
    talkRequests: {
      model: "careTalkRequest",
      where: ofOrg,
      select: fields(["id", "clientId", "entryId", "membershipId", "requesterName", "createdAt", "withdrawnAt", "handledAt", "handledByMembershipId", "handledByName"])
    },
    /* K6-i: esindusõiguse kirjed, ka lõpetatud. */
    clientRepresentatives: {
      model: "careClientRepresentative",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "name",
        "phone",
        "basis",
        "scope",
        "validFrom",
        "validUntil",
        "copyKept",
        "checkedOn",
        "createdByMembershipId",
        "createdByName",
        "createdAt",
        "endedAt",
        "endedByMembershipId",
        "endedByName"
      ])
    },
    tripEntries: {
      model: "careTripEntry",
      where: ofOrg,
      select: fields([
        "id",
        "membershipId",
        "workerName",
        "day",
        "vehicle",
        "plate",
        "startOdometer",
        "endOdometer",
        "purpose",
        "createdByMembershipId",
        "createdAt",
        "retractedAt",
        "retractedByMembershipId",
        "retractReason"
      ])
    },
    workerRecords: {
      model: "careWorkerRecord",
      where: ofOrg,
      select: fields(["id", "membershipId", "kind", "title", "doneOn", "validUntil", "createdByMembershipId", "createdByName", "createdAt", "endedAt", "endedByMembershipId"])
    },
    referralContacts: {
      model: "careReferralContact",
      where: ofOrg,
      select: fields(["id", "position", "name", "phone", "note", "createdByMembershipId", "createdByName", "createdAt", "endedAt", "endedByMembershipId"])
    },
    crisisProfiles: {
      model: "careCrisisProfile",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "level",
        "dependencies",
        "helper",
        "note",
        "createdByMembershipId",
        "createdByName",
        "createdAt",
        "endedAt",
        "endedByMembershipId",
        "endedByName"
      ])
    },
    doorSteps: {
      model: "careDoorStep",
      where: ofOrg,
      select: fields(["id", "clientId", "position", "text", "createdByMembershipId", "createdByName", "createdAt", "endedAt", "endedByMembershipId"])
    },
    supplies: {
      model: "careClientSupply",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "kind",
        "responsible",
        "state",
        "stateNote",
        "checkedAt",
        "checkedByMembershipId",
        "checkedByName",
        "createdByMembershipId",
        "createdByName",
        "createdAt",
        "endedAt",
        "endedByMembershipId",
        "endedByName"
      ])
    },
    supplyChecks: {
      model: "careSupplyCheck",
      where: ofOrg,
      select: fields(["id", "supplyId", "clientId", "state", "note", "checkedByMembershipId", "checkedByName", "createdAt"])
    },
    moneyEntries: {
      model: "careMoneyEntry",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "holderMembershipId",
        "holderName",
        "kind",
        "amountCents",
        "note",
        "occurredOn",
        "createdAt",
        "retractedAt",
        "retractedByMembershipId",
        "retractedByName"
      ])
    },
    keys: {
      model: "careKey",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "tag",
        "label",
        "holderMembershipId",
        "holderName",
        "heldSince",
        "createdByMembershipId",
        "createdByName",
        "createdAt",
        "closedAt",
        "outcome",
        "closedByMembershipId",
        "closedByName"
      ])
    },
    keyHandovers: {
      model: "careKeyHandover",
      where: ofOrg,
      select: fields(["id", "keyId", "fromMembershipId", "fromName", "toMembershipId", "toName", "recordedByMembershipId", "recordedByName", "createdAt"])
    },
    preconditions: {
      model: "carePrecondition",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "kind",
        "note",
        "responsible",
        "dueOn",
        "createdByMembershipId",
        "createdByName",
        "createdAt",
        "closedAt",
        "outcome",
        "closedByMembershipId",
        "closedByName"
      ])
    },
    workNatures: {
      model: "careWorkNature",
      where: ofOrg,
      select: fields([
        "id",
        "clientId",
        "kinds",
        "reason",
        "reviewOn",
        "createdByMembershipId",
        "createdByName",
        "createdAt",
        "endedAt",
        "endedByMembershipId",
        "endedByName"
      ])
    },
    obstacles: {
      model: "careObstacle",
      where: ofOrg,
      select: fields(["id", "membershipId", "day", "kind", "withdrawnAt", "handledAt", "handledByMembershipId", "handledByName", "createdAt", "updatedAt"])
    },
    auditEvents: {
      model: "dataAuditLog",
      where: { action: { in: HOME_CARE_AUDIT_ACTIONS }, meta: { path: ["organizationId"], equals: organizationId } },
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
      status: true,
      startedAt: true,
      jobTitle: true,
      user: { select: { profile: { select: { firstName: true, lastName: true } } } }
    },
    orderBy: { id: "asc" }
  });
  /* Tööloendi real on kasutaja, failis liikmesus. Kui inimesel on asutuses mitu
     liikmesust (lahkus ja tuli tagasi), valitakse kehtiv, selle puudumisel hiliseim. */
  const chosen = new Map();
  for (const row of rows) {
    if (!row.userId) continue;
    const current = chosen.get(row.userId);
    const active = row.status === "ACTIVE";
    const currentActive = current?.status === "ACTIVE";
    if (!current || (active && !currentActive) || (active === currentActive && row.startedAt > current.startedAt)) {
      chosen.set(row.userId, row);
    }
  }
  return {
    people: rows.map((row) => ({ id: row.id, name: personName(row) || null })),
    membershipByUser: new Map([...chosen].map(([userId, row]) => [userId, row.id]))
  };
}

/**
 * Pakkija: võtab teksti, annab pakitud tükid. Kontrollsumma ja suurus arvutatakse
 * PAKKIMATA tekstist, sest brauser pakib faili salvestades lahti ja asutus
 * võrdleb oma faili summat tööloendi omaga.
 */
function createPackedSink({ maxPackedBytes, maxRawBytes }) {
  const gzip = createGzip({ level: 6 });
  const hash = createHash("sha256");
  const chunks = [];
  let packedBytes = 0;
  let rawBytes = 0;
  let failure = null;
  const tooLarge = () => new OrgError(413, "home_care.errors.export_too_large");
  gzip.on("data", (chunk) => {
    packedBytes += chunk.length;
    if (packedBytes > maxPackedBytes) {
      failure = failure || tooLarge();
      return;
    }
    chunks.push(chunk);
  });
  /* Pakkija viga jääb meelde: järgmine kirjutus viskab selle, mitte ei jää ootama
     äravoolu, mida enam ei tule. */
  gzip.on("error", (error) => {
    failure = failure || error;
  });
  /* Lõpp, viga ja sulgemine lõpetavad kõik ootamise; kumb juhtus, ütleb `failure`. */
  const settled = new Promise((resolve) => {
    gzip.once("end", resolve);
    gzip.once("error", resolve);
    gzip.once("close", resolve);
  });

  return {
    async write(text) {
      if (failure) throw failure;
      rawBytes += Buffer.byteLength(text, "utf8");
      if (rawBytes > maxRawBytes) {
        failure = tooLarge();
        throw failure;
      }
      hash.update(text, "utf8");
      if (!gzip.write(text, "utf8")) await Promise.race([once(gzip, "drain"), settled]);
      if (failure) throw failure;
    },
    async finish() {
      gzip.end();
      await settled;
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
     Platvormi kasutaja ID ei ole asutuse andmed. Kustutatud konto tegijat ei saa
     enam liikmesusega siduda ja väli jääb tühjaks (manifest ütleb seda). */
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
 * Värav ja sisendi kontroll ilma midagi koostamata. Marsruut teeb selle enne
 * sageduspiiri, et vigane päring ei kulutaks inimese kolme katset.
 */
export function prepareHomeCareExport(context, rawInput = {}, { env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  requireWholeOrgCoordinator(context);
  return {
    reasonCode: normalizeEnum(asObject(rawInput).reasonCode, CARE_EXPORT_REASONS, "home_care.errors.invalid_export_reason")
  };
}

/**
 * Koostab täieliku väljavõtte. Tagastab pakitud faili (gzip) koos sellega, mida
 * vastuse päistes ja lehel näidata.
 *
 * `signal`: kui küsija katkestab (sulgeb lehe), jäetakse töö pooleli ja
 * tööloendisse rida ei teki: faili, mida keegi ei saanud, ei ole väljastatud.
 */
export async function createHomeCareExport(context, rawInput = {}, options = {}) {
  const { env = process.env } = options;
  const { reasonCode } = prepareHomeCareExport(context, rawInput, { env });
  const organizationId = context.organization.id;
  if (exportsInProgress.has(organizationId)) throw conflict("home_care.errors.export_in_progress");
  exportsInProgress.add(organizationId);
  try {
    return await buildHomeCareExport(context, reasonCode, options);
  } finally {
    exportsInProgress.delete(organizationId);
  }
}

async function buildHomeCareExport(
  context,
  reasonCode,
  {
    db = prisma,
    now = null,
    maxPackedBytes = HOME_CARE_EXPORT_MAX_PACKED_BYTES,
    maxRawBytes = HOME_CARE_EXPORT_MAX_RAW_BYTES,
    signal = null
  } = {}
) {
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id || null;
  const exportId = randomUUID();
  const specs = tableSpecs(organizationId);
  const sink = createPackedSink({ maxPackedBytes, maxRawBytes });
  const totals = {};
  let generatedAt = null;

  try {
    await db.$transaction(
      async (tx) => {
        const organization = await tx.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, displayName: true, legalName: true, registryCode: true, timezone: true }
        });
        /* Hetktõmmis algas eelmise päringuga. Kell võetakse PÄRAST seda: failis ei
           ole siis midagi, mis oleks tekkinud hiljem kui `generatedAt`. */
        generatedAt = (now || new Date()).toISOString();
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
              "Kõik read on ühest andmebaasi hetkest; midagi hilisemat kui „generatedAt” failis ei ole. Kogud on ID " +
              "järjekorras; ajad on UTC-s (ISO 8601) ja asutuse ajavöönd on päises. Töötajale viitab liikmesuse ID, " +
              "mille nimi on kogus „people”. Tööloendi real („auditEvents”) on tegija liikmesus; kui tegija konto on " +
              "kustutatud, on see väli tühi. Faili lõpus on koguarvud: kui neid ei ole, on fail poolik."
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
              signal?.throwIfAborted();
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
    /* Tehingu ajapiir tähendab, et fail on ühe korraga lugemiseks liiga suur:
       inimene peab nägema seda, mitte „proovi uuesti". */
    if (error?.code === "P2028") throw new OrgError(413, "home_care.errors.export_too_large");
    throw error;
  }

  const packed = await sink.finish();
  const rowCount = Object.values(totals).reduce((sum, count) => sum + count, 0);
  signal?.throwIfAborted();

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
