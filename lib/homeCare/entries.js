/**
 * KODUTEENUS K1 — kliendi päevik.
 *
 * KIRJET EI KUSTUTATA. Parandus ja tühistus kirjutavad asendatud sisu
 * `CareClientEntryRevision`-i ENNE muudatust samas tehingus (muster:
 * `lib/casework/caseWorkMeetingNote.js`), põhjus on kohustuslik.
 *
 * KORDUSSAATMINE EI TEKITA TEIST KIRJET. Seade genereerib `clientRequestId`
 * enne esimest katset ja hoiab seda korduskatsel; sama võti + sama sisu annab
 * sama kirje, sama võti + muu sisu on 409. Sama alus kannab hiljem võrguta tööd.
 *
 * NÄHTAVUS. `coordinatorOnly` kirjet näevad autor ja hooldusjuht. Filter on
 * päringu `where`-is, mitte järelkontroll.
 */

import { Prisma } from "../../generated/prisma/client.ts";
import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { OrganizationMembershipStatus } from "../org/constants.js";
import { badRequest, conflict, forbidden, notFound } from "../org/errors.js";
import { decodePageCursor, descendingCursorWhere, normalizePageSize, toCursorPage } from "../org/pagination.js";
import { localDateTimeToUtc, shiftLocalDate } from "../time/estonianDay.js";

import {
  assertHomeCareContext,
  membershipDisplayName,
  organizationTimeZone,
  personName,
  recordClientOpen,
  requireClientAccess,
  requireClientCoordinator
} from "./access.js";
import {
  CARE_ENTRY_KINDS,
  COORDINATOR_ONLY_INCIDENT_TYPES,
  CareAccessBasis,
  CareActivityGroup,
  CareActivityOutcome,
  CareChangeAnswer,
  CareClientStatus,
  CareEntryKind,
  CarePlanStatus,
  CareIncidentStatus,
  CareIncidentUpdateKind,
  CareRevisionKind,
  HOME_CARE_LIMITS
} from "./constants.js";
import { openChangeSignalsWithin } from "./changes.js";
import { notifyCoordinatorsOfChange, notifyCoordinatorsOfEntry } from "./notify.js";
import { entrySearchText, entrySearchWhere } from "./search.js";
import {
  asObject,
  entryRequestHash,
  normalizeEntryInput,
  normalizeEnum,
  normalizeId,
  normalizeIncidentStatusInput,
  normalizeIsoDay,
  normalizeReason,
  normalizeRequestId,
  normalizeVersion
} from "./validation.js";

/** Käigul tehtud toimingud kirje küljes (K2-d), märkimise järjekorras. */
export const ENTRY_ACTIVITIES_SELECT = Object.freeze({
  select: {
    id: true,
    planLineId: true,
    activityId: true,
    activityName: true,
    activityGroup: true,
    mode: true,
    outcome: true,
    medicationAction: true,
    outsidePlan: true,
    position: true
  },
  orderBy: [{ position: "asc" }, { id: "asc" }]
});

export const ENTRY_SELECT = Object.freeze({
  id: true,
  clientId: true,
  authorMembershipId: true,
  authorName: true,
  kind: true,
  contactMode: true,
  text: true,
  coordinatorOnly: true,
  occurredAt: true,
  deviceCreatedAt: true,
  deviceQueuedSec: true,
  callTopic: true,
  callCaller: true,
  visitMinutes: true,
  changeAnswer: true,
  changeAreas: true,
  changeMajor: true,
  activities: ENTRY_ACTIVITIES_SELECT,
  companionMembershipId: true,
  companionName: true,
  incidentType: true,
  incidentAssessment: true,
  incidentActions: true,
  incidentStatus: true,
  incidentAssigneeMembershipId: true,
  incidentAssigneeName: true,
  incidentResolvedAt: true,
  incidentResolutionNote: true,
  revision: true,
  retractedAt: true,
  clientRequestId: true,
  requestSha256: true,
  createdAt: true,
  _count: { select: { reads: true } }
});

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function queuedMs(row) {
  return Number.isFinite(row.deviceQueuedSec) && row.deviceQueuedSec > 0 ? row.deviceQueuedSec * 1000 : 0;
}

/**
 * Kas kirje kirjutati märgatavalt pärast sündmust? Võrdluseks on SERVERI
 * salvestusaeg, mitte seadme kell. Aeg, mille kirje ootas seadme järjekorras
 * võrku (`deviceQueuedSec`), ei ole kirjutamisega viivitamine ja arvatakse
 * maha; selle kohta on oma märk (`sentLater`).
 *
 * Ooteaeg on seadme väide, aga märgita see kirjet ei jäta: ooteaeg arvatakse
 * maha AINULT siis, kui kirje saab selle eest märgi „saadetud hiljem". Lühem
 * ooteaeg ei nihuta „hiljem kirjutatud" piiri; hiljem kohale jõudnud kirjel on
 * alati üks kahest märgist ja serveri salvestusaeg on näha.
 */
function writtenLater(row) {
  if (!row.createdAt || !row.occurredAt) return false;
  const explained = sentLater(row) ? queuedMs(row) : 0;
  const gap = new Date(row.createdAt).getTime() - new Date(row.occurredAt).getTime() - explained;
  return gap > HOME_CARE_LIMITS.WRITTEN_LATER_MS;
}

/** Kirje ootas seadmes võrku nii kaua, et seda tasub lugejale öelda. */
function sentLater(row) {
  return queuedMs(row) >= HOME_CARE_LIMITS.SENT_LATER_MS;
}

function serializeVisit(row, retracted) {
  const activities = Array.isArray(row.activities) ? row.activities : [];
  if (retracted || (!row.visitMinutes && !activities.length)) return null;
  return {
    minutes: row.visitMinutes ?? null,
    activities: activities.map((item) => ({
      id: item.id,
      activityId: item.activityId || null,
      name: item.activityName,
      group: item.activityGroup,
      mode: item.mode,
      /* Tulemus: tehtud või tegemata jäämise põhjus (K2-f). */
      outcome: item.outcome || CareActivityOutcome.DONE,
      /* Ravimitoimingu märge (K5-d): mida hooldaja tegi; muul toimingul puudub. */
      medication: item.medicationAction || null,
      outsidePlan: Boolean(item.outsidePlan)
    }))
  };
}

export function serializeEntry(row, { viewerMembershipId = null } = {}) {
  const retracted = Boolean(row.retractedAt);
  return {
    id: row.id,
    clientId: row.clientId,
    kind: row.kind,
    contactMode: row.contactMode,
    /* Tühistatud kirje tekst ei ole aktiivsel pinnal; see on parandusjäljes. */
    text: retracted ? null : row.text,
    coordinatorOnly: Boolean(row.coordinatorOnly),
    occurredAt: iso(row.occurredAt),
    createdAt: iso(row.createdAt),
    writtenLater: writtenLater(row),
    sentLater: sentLater(row),
    authorName: row.authorName,
    isMine: Boolean(viewerMembershipId && row.authorMembershipId === viewerMembershipId),
    companionMembershipId: row.companionMembershipId || null,
    companionName: row.companionName || null,
    /* Kõnemärge: kes helistas ja mille pärast (ainult telefonikontaktil). */
    call: row.callTopic ? { topic: row.callTopic, caller: row.callCaller } : null,
    /* Käigu kirje: kestus ja tehtud toimingud. Tühistatud kirjel neid aktiivsel pinnal ei ole. */
    visit: serializeVisit(row, retracted),
    /* Vastus küsimusele „kas midagi oli teisiti?" (K5-a). Tühistatud kirjel seda aktiivsel pinnal ei ole. */
    change:
      row.changeAnswer && !retracted
        ? { answer: row.changeAnswer, areas: Array.isArray(row.changeAreas) ? row.changeAreas : [], major: Boolean(row.changeMajor) }
        : null,
    incident:
      row.kind === CareEntryKind.INCIDENT
        ? {
            type: row.incidentType,
            assessment: retracted ? null : row.incidentAssessment || null,
            actions: Array.isArray(row.incidentActions) ? row.incidentActions : [],
            status: row.incidentStatus || CareIncidentStatus.OPEN,
            assignee: row.incidentAssigneeMembershipId
              ? { membershipId: row.incidentAssigneeMembershipId, name: row.incidentAssigneeName || "" }
              : null,
            resolvedAt: iso(row.incidentResolvedAt),
            resolutionNote: row.incidentResolutionNote || null
          }
        : null,
    revision: row.revision,
    corrected: row.revision > 1 && !retracted,
    retractedAt: iso(row.retractedAt),
    readCount: row._count?.reads ?? 0
  };
}

/** Mida see vaataja kliendi päevikust näeb. */
function visibilityWhere(context, access) {
  if (access.isCoordinator) return {};
  const membershipId = context.membership?.id || "";
  return { OR: [{ coordinatorOnly: false }, { authorMembershipId: membershipId }] };
}

function dayRangeWhere(context, { from, to }) {
  const timeZone = organizationTimeZone(context);
  const fromDay = normalizeIsoDay(from);
  const toDay = normalizeIsoDay(to);
  if (!fromDay && !toDay) return {};
  const range = {};
  if (fromDay) range.gte = localDateTimeToUtc(fromDay, timeZone);
  /* „Kuni" on kaasav kalendripäev: piir on JÄRGMISE päeva algus asutuse
     ajavööndis, mitte +24 h (kellakeeramise päev on 23 või 25 tundi). */
  if (toDay) range.lt = localDateTimeToUtc(shiftLocalDate(toDay, 1), timeZone);
  if (range.gte && range.lt && range.gte >= range.lt) throw badRequest("home_care.errors.invalid_date");
  return { occurredAt: range };
}

/**
 * Kirjete leht juba avatud tehingus. Õigus on otsustatud kutsuja poolel
 * (`access` tuleb `requireClientAccess`-ist).
 */
export async function listEntriesWithin(tx, context, access, query = {}) {
  const pageSize = normalizePageSize(query.take, HOME_CARE_LIMITS.ENTRIES_PAGE, HOME_CARE_LIMITS.ENTRIES_PAGE_MAX);
  const cursor = decodePageCursor(query.cursor, { dateKeys: ["occurredAt"], stringKeys: ["id"] });
  const kind = query.kind ? normalizeEnum(query.kind, CARE_ENTRY_KINDS, "home_care.errors.invalid_entry_kind") : null;

  const and = [visibilityWhere(context, access), dayRangeWhere(context, query)];
  const cursorWhere = descendingCursorWhere(cursor, ["occurredAt", "id"]);
  if (cursorWhere) and.push(cursorWhere);
  /* Otsing: tingimused on ette arvutatud (`searchEntries`), sest morfoloogiat
     ei kutsuta tehingu sees. Tühistatud kirje teksti ei näidata, seega seda ka
     ei leita. */
  if (Array.isArray(query.searchAnd) && query.searchAnd.length) {
    and.push({ retractedAt: null }, ...query.searchAnd);
  }

  const rows = await tx.careClientEntry.findMany({
    where: {
      clientId: access.client.id,
      organizationId: context.organization.id,
      ...(kind ? { kind } : {}),
      AND: and
    },
    select: ENTRY_SELECT,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: pageSize + 1
  });

  const page = toCursorPage(rows, pageSize, (row) => ({ occurredAt: row.occurredAt, id: row.id }));
  const viewerMembershipId = context.membership?.id || null;
  return {
    items: page.items.map((row) => serializeEntry(row, { viewerMembershipId })),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor
  };
}

export async function listEntries(context, clientId, query = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    /* Päeviku lugemine ON kliendi lehe avamine, ka siis, kui seda tehakse
       lehe marsruudist mööda. Vaikne aken hoiab ära korduvad read lehitsemisel. */
    await recordClientOpen(tx, context, access, { now });
    const page = await listEntriesWithin(tx, context, access, asObject(query));
    await markHandoversReadWithin(tx, context, access, page.items, { now });
    return page;
  });
}

/**
 * Otsing kliendi päevikust. Sama ligipääs, nähtavus ja avamisjälg mis loendil;
 * liigi ja ajavahemiku filter kehtivad koos otsinguga. Otsisõna tuleb päringu
 * kehas (POST), mitte aadressis: see võib sisaldada nime või terviseinfot ega
 * tohi jääda URL-i ega ligipääsulogidesse.
 */
export async function searchEntries(
  context,
  clientId,
  input = {},
  { db = prisma, now = new Date(), env = process.env, analyzer } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const body = asObject(input);
  const searchAnd = await entrySearchWhere(body.q, { analyzer });

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    await recordClientOpen(tx, context, access, { now });
    const page = await listEntriesWithin(tx, context, access, {
      kind: body.kind || undefined,
      from: body.from || undefined,
      to: body.to || undefined,
      cursor: body.cursor || undefined,
      searchAnd
    });
    await markHandoversReadWithin(tx, context, access, page.items, { now });
    return page;
  });
}

/**
 * Lugemismärk teatele järgmisele. Hooldusjuhi lugemist EI LOETA: küsimus on,
 * kas teade jõudis järgmise hooldajani, mitte kas juht seda nägi.
 */
export async function markHandoversReadWithin(tx, context, access, items, { now = new Date() } = {}) {
  const membershipId = context.membership?.id;
  if (!membershipId || access.basis === CareAccessBasis.COORDINATOR) return 0;
  const unread = items.filter(
    (item) => item.kind === CareEntryKind.HANDOVER && !item.isMine && !item.retractedAt
  );
  if (!unread.length) return 0;
  const { count } = await tx.careClientEntryRead.createMany({
    data: unread.map((item) => ({ entryId: item.id, membershipId, readAt: now })),
    skipDuplicates: true
  });
  return count;
}

async function resolveCompanion(tx, context, companionMembershipId) {
  if (!companionMembershipId) return { companionMembershipId: null, companionName: null };
  if (companionMembershipId === context.membership?.id) throw badRequest("home_care.errors.invalid_companion");
  const row = await tx.organizationMembership.findFirst({
    where: {
      id: companionMembershipId,
      organizationId: context.organization.id,
      status: OrganizationMembershipStatus.ACTIVE
    },
    select: { id: true, jobTitle: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } }
  });
  if (!row) throw badRequest("home_care.errors.invalid_companion");
  return { companionMembershipId: row.id, companionName: personName(row) || null };
}

/**
 * Käigul tehtud toimingud andmebaasi ridadeks. Toiming võetakse kliendi KEHTIVAST
 * hoolduskavast (rida kannab kava sõnastust ja viidet kava reale); kui seda kavas ei
 * ole, asutuse kehtivast kataloogist ja rida on kavaväline. Tundmatu toiming on viga.
 *
 * `existing` on parandatava kirje read: juba kirjel olev toiming jääb oma nime ja
 * kavaviitega ka siis, kui kava on vahepeal asendatud või toiming arhiveeritud;
 * muutuda saab ainult see, kuidas tehti, ja tulemus.
 *
 * TEGEMATA saab jääda ainult kava toiming (K2-f): kavaväline toiming on kirjel
 * sellepärast, et see tehti. Tegemata toimingu real jääb tegemise viisiks kava rea viis.
 */
async function resolveVisitActivities(tx, context, clientId, wanted, existing = []) {
  if (!wanted.length) return [];
  const kept = new Map(existing.filter((row) => row.activityId).map((row) => [row.activityId, row]));
  const fresh = wanted.filter((item) => !kept.has(item.activityId)).map((item) => item.activityId);
  const planLines = fresh.length
    ? await tx.carePlanLine.findMany({
        where: { clientId, activityId: { in: fresh }, plan: { status: CarePlanStatus.ACTIVE } },
        select: { id: true, activityId: true, activityName: true, activityGroup: true, mode: true }
      })
    : [];
  const fromPlan = new Map(planLines.map((line) => [line.activityId, line]));
  const outside = fresh.filter((activityId) => !fromPlan.has(activityId));
  const catalogue = outside.length
    ? await tx.careActivity.findMany({
        where: { organizationId: context.organization.id, id: { in: outside }, archivedAt: null },
        select: { id: true, name: true, group: true }
      })
    : [];
  const fromCatalogue = new Map(catalogue.map((activity) => [activity.id, activity]));

  /* Ravimitoimingu märge (K5-d) käib ainult rühma MEDICATION tehtud toiminguga. Muu toimingu
     juurde saadetud märge on viga, mitte vaikselt kõrvale jäetav väli. Paranduses jääb
     saatmata märge nii, nagu see real on. */
  const medicationFor = (item, group, isDone, previous = null) => {
    if (group !== CareActivityGroup.MEDICATION) {
      if (item.medication) throw badRequest("home_care.errors.medication_action_not_allowed");
      return null;
    }
    if (!isDone) return null;
    return item.medication || previous || null;
  };

  return wanted.map((item, position) => {
    const outcome = item.outcome || CareActivityOutcome.DONE;
    const isDone = outcome === CareActivityOutcome.DONE;
    const old = kept.get(item.activityId);
    if (old) {
      if (!isDone && old.outsidePlan) throw badRequest("home_care.errors.visit_outcome_plan_only");
      return {
        medicationAction: medicationFor(item, old.activityGroup, isDone, old.medicationAction),
        planLineId: old.planLineId || null,
        activityId: old.activityId,
        activityName: old.activityName,
        activityGroup: old.activityGroup,
        outsidePlan: Boolean(old.outsidePlan),
        mode: isDone ? item.mode : old.mode,
        outcome,
        position
      };
    }
    const line = fromPlan.get(item.activityId);
    if (line) {
      return {
        medicationAction: medicationFor(item, line.activityGroup, isDone),
        planLineId: line.id,
        activityId: line.activityId,
        activityName: line.activityName,
        activityGroup: line.activityGroup,
        outsidePlan: false,
        mode: isDone ? item.mode : line.mode,
        outcome,
        position
      };
    }
    const activity = fromCatalogue.get(item.activityId);
    if (!activity) throw badRequest("home_care.errors.visit_activity_unknown");
    if (!isDone) throw badRequest("home_care.errors.visit_outcome_plan_only");
    return {
      medicationAction: medicationFor(item, activity.group, isDone),
      planLineId: null,
      activityId: activity.id,
      activityName: activity.name,
      activityGroup: activity.group,
      outsidePlan: true,
      mode: item.mode,
      outcome,
      position
    };
  });
}

async function writeVisitActivities(tx, context, entryId, clientId, rows) {
  if (!rows.length) return;
  await tx.careEntryActivity.createMany({
    data: rows.map((row) => ({ ...row, organizationId: context.organization.id, entryId, clientId }))
  });
}

function isCoordinatorOnly(data) {
  if (data.kind === CareEntryKind.CONCERN) return true;
  return data.kind === CareEntryKind.INCIDENT && COORDINATOR_ONLY_INCIDENT_TYPES.includes(data.incidentType);
}

/**
 * Lisab kirje. Kirjutada tohib igaüks, kes klienti parajasti näeb (meeskond,
 * hooldusjuht, täna põhjusega avanud asendaja): käigu teinud inimene peab
 * saama selle kirja panna.
 */
export async function createEntry(
  context,
  clientId,
  input = {},
  { db = prisma, now = new Date(), env = process.env, notify = notifyCoordinatorsOfEntry, notifyChange, analyzer } = {}
) {
  const result = await createEntryInTransaction(context, clientId, input, { db, now, env, analyzer });
  /* Märkamine, mille see kirje avas (K5-a): teade hooldusjuhtidele, sisuta. Ilma teavitusteta
     kutsuja (`notify: null`) ei saada ka seda. */
  const tellChange = notifyChange !== undefined ? notifyChange : notify ? notifyCoordinatorsOfChange : null;
  if (result.signalIds?.length && tellChange) {
    await tellChange(
      { signalIds: result.signalIds, organizationId: context.organization.id, unitId: result.unitId, actorMembershipId: context.membership?.id || null },
      { db, now }
    );
  }
  /* Teade hooldusjuhile uue erijuhtumi ja mure kohta. PÄRAST tehingut ja ainult
     päriselt loodud kirje kohta (kordussaatmine teist teadet ei tee). Teate sees
     on ainult kirje ID. */
  const kind = result.entry.kind;
  /* Ka KORDUSE puhul: kui esimene katse salvestas kirje, aga teavitus jäi
     tegemata (server taaskäivitus, andmebaasi viga), teeb selle korduskatse.
     Teist teadet ei teki, sest teavituse kordumatuse võti on sama. */
  if ((result.created || result.repeated) && (kind === CareEntryKind.INCIDENT || kind === CareEntryKind.CONCERN) && notify) {
    await notify(
      {
        entryId: result.entry.id,
        organizationId: context.organization.id,
        unitId: result.unitId,
        kind,
        actorMembershipId: context.membership?.id || null
      },
      { db, now }
    );
  }
  return { entry: result.entry, created: result.created };
}

async function createEntryInTransaction(context, clientId, input, { db, now, env, analyzer }) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  /* Liiga pikk ooteaeg ei tohi KORDUST tagasi lükata. Kirje, mis salvestus
     esimesel katsel, aga mille vastus seadmeni ei jõudnud, võib uuesti tulla
     siis, kui ooteaeg on juba üle piiri; seade peab saama vastuseks
     „salvestatud", mitte juhise sama kirje uuesti kirjutada. Ooteaeg räsi ei
     muuda, seega kordust saab otsida ka ilma selleta; viga visatakse alles
     siis, kui kordust ei leitud. */
  let data;
  let waitedError = null;
  try {
    data = normalizeEntryInput(input, { now });
  } catch (error) {
    if (error?.messageKey !== "home_care.errors.invalid_waited") throw error;
    waitedError = error;
    data = normalizeEntryInput({ ...asObject(input), waitedMs: undefined }, { now });
  }
  const clientRequestId = normalizeRequestId(asObject(input).clientRequestId);
  if (waitedError && !clientRequestId) throw waitedError;
  const requestSha256 = entryRequestHash(id, data);
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id;
  if (!membershipId) throw notFound("home_care.errors.client_not_found");
  /* Otsinguabi ENNE tehingut: morfoloogia on eraldi protsess ja selle ootamine
     ei tohi andmebaasi tehingut lahti hoida. Kui see ei vasta, salvestub kirje
     ikka (ainult tüvedega). */
  const search = await entrySearchText([data.text, data.incidentAssessment], { analyzer });

  return db.$transaction(async (tx) => {
    /* KORDUS ENNE KÕIKE MUUD. Kirje, mis juba salvestus ja mille vastus
       seadmeni ei jõudnud, peab vastama „salvestatud" ka siis, kui vahepeal
       teenus lõpetati, autor eemaldati meeskonnast või kaasas olnud kolleegi
       liikmesus lõppes. Otsing sisaldab AUTORIT: võõra võtmega ei saa kätte
       võõrast kirjet, oma kirje tagastamine ei avalda midagi uut. */
    if (clientRequestId) {
      const repeat = await tx.careClientEntry.findFirst({
        where: { organizationId, authorMembershipId: membershipId, clientRequestId },
        select: ENTRY_SELECT
      });
      if (repeat) {
        if (repeat.clientId !== id || repeat.requestSha256 !== requestSha256) {
          throw conflict("home_care.errors.idempotency_conflict");
        }
        const owner = await tx.careClient.findFirst({ where: { id, organizationId }, select: { unitId: true } });
        return {
          entry: serializeEntry(repeat, { viewerMembershipId: membershipId }),
          created: false,
          repeated: true,
          unitId: owner?.unitId || null
        };
      }
    }

    if (waitedError) throw waitedError;

    const access = await requireClientAccess(tx, context, id, { now });
    /* Lõpetatud teenuse päevik on loetav. Hilinenud viimase kirje lisab
       hooldusjuht, et lõpetatud kliendi alla ei tekiks märkamatult uut tööd. */
    if (access.client.status === CareClientStatus.ENDED && !access.isCoordinator) {
      throw conflict("home_care.errors.client_ended");
    }
    const companion = await resolveCompanion(tx, context, data.companionMembershipId);
    const authorName = await membershipDisplayName(tx, context);
    /* Tehtud toimingud lahendatakse ENNE kirje kirjutamist: tundmatu toiming ei jäta poolikut kirjet. */
    const doneActivities = await resolveVisitActivities(tx, context, id, data.visitActivities || []);

    const row = {
      organizationId,
      clientId: id,
      authorMembershipId: membershipId,
      authorName,
      kind: data.kind,
      contactMode: data.contactMode,
      text: data.text,
      coordinatorOnly: isCoordinatorOnly(data),
      occurredAt: data.occurredAt,
      deviceCreatedAt: data.deviceCreatedAt,
      deviceQueuedSec: data.deviceQueuedSec ?? null,
      callTopic: data.callTopic,
      callCaller: data.callCaller,
      visitMinutes: data.visitMinutes,
      changeAnswer: data.change?.answer ?? null,
      changeAreas: data.change?.areas ?? [],
      changeMajor: data.change?.major ?? false,
      companionMembershipId: companion.companionMembershipId,
      companionName: companion.companionName,
      incidentType: data.incidentType,
      incidentAssessment: data.incidentAssessment,
      incidentActions: data.incidentActions ?? undefined,
      incidentStatus: data.kind === CareEntryKind.INCIDENT ? CareIncidentStatus.OPEN : null,
      clientRequestId,
      requestSha256,
      searchText: search.searchText,
      searchVersion: search.searchVersion,
      createdAt: now
    };

    const unitId = access.client.unitId || null;
    /* Märkamise reegel (K5-a) samas tehingus: ainult vastusega „jah" ja ainult päriselt loodud kirjel. */
    const openSignals = (entryId) =>
      data.change?.answer === CareChangeAnswer.YES
        ? openChangeSignalsWithin(tx, {
            organizationId,
            clientId: id,
            entryId,
            authorMembershipId: membershipId,
            occurredAt: data.occurredAt,
            areas: data.change.areas,
            major: data.change.major,
            now
          })
        : [];
    if (!clientRequestId) {
      const made = await tx.careClientEntry.create({ data: row, select: { id: true } });
      await writeVisitActivities(tx, context, made.id, id, doneActivities);
      const signalIds = await openSignals(made.id);
      const created = await tx.careClientEntry.findFirst({ where: { id: made.id }, select: ENTRY_SELECT });
      return { entry: serializeEntry(created, { viewerMembershipId: membershipId }), created: true, unitId, signalIds };
    }

    /* IDEMPOTENTSUS ON KIRJUTAMISE TULEMUS, mitte eelnev lugemine (vt
       `lib/org/inbox.js`): `create` + `catch (P2002)` keeraks Postgresis kogu
       tehingu katki. `skipDuplicates` jätab tehingu terveks ja `count` ütleb,
       kas see päring kirjutas. Otsing sisaldab AUTORIT, muidu saaks võõra
       võtmega kätte võõra kirje. */
    const { count } = await tx.careClientEntry.createMany({ data: [row], skipDuplicates: true });
    const written = await tx.careClientEntry.findFirst({
      where: { authorMembershipId: membershipId, clientRequestId },
      select: { id: true }
    });
    if (!written) throw conflict("home_care.errors.save_failed");
    /* Toimingute read kirjutab ainult see päring, mis kirje päriselt lõi. */
    if (count === 1) await writeVisitActivities(tx, context, written.id, id, doneActivities);
    const signalIds = count === 1 ? await openSignals(written.id) : [];
    const stored = await tx.careClientEntry.findFirst({ where: { id: written.id }, select: ENTRY_SELECT });
    if (!stored) throw conflict("home_care.errors.save_failed");
    if (count === 0 && (stored.clientId !== id || stored.requestSha256 !== requestSha256)) {
      throw conflict("home_care.errors.idempotency_conflict");
    }
    return {
      entry: serializeEntry(stored, { viewerMembershipId: membershipId }),
      created: count === 1,
      repeated: count === 0,
      unitId,
      signalIds
    };
  });
}

/** Kirje, mida see vaataja näeb, SELLE kliendi all. Muu on 404. */
export async function requireVisibleEntry(tx, context, access, entryId) {
  const entry = await tx.careClientEntry.findFirst({
    where: {
      id: entryId,
      clientId: access.client.id,
      organizationId: context.organization.id,
      AND: [visibilityWhere(context, access)]
    },
    select: ENTRY_SELECT
  });
  if (!entry) throw notFound("home_care.errors.entry_not_found");
  return entry;
}

/** Parandada ja tühistada tohib autor ise ja hooldusjuht. */
function assertEntryEditor(context, access, entry) {
  const isAuthor = entry.authorMembershipId && entry.authorMembershipId === context.membership?.id;
  if (!isAuthor && !access.isCoordinator) throw forbidden("home_care.errors.entry_not_editable");
}

function revisionSnapshot(entry) {
  const snapshot = {};
  if (entry.companionName) snapshot.companionName = entry.companionName;
  if (entry.incidentType) snapshot.incidentType = entry.incidentType;
  if (entry.incidentAssessment) snapshot.incidentAssessment = entry.incidentAssessment;
  if (entry.incidentActions) snapshot.incidentActions = entry.incidentActions;
  if (entry.coordinatorOnly) snapshot.coordinatorOnly = true;
  if (entry.callTopic) {
    snapshot.callTopic = entry.callTopic;
    snapshot.callCaller = entry.callCaller;
  }
  if (entry.visitMinutes || entry.activities?.length) {
    snapshot.visit = {
      minutes: entry.visitMinutes ?? null,
      activities: (entry.activities || []).map((item) => ({
        name: item.activityName,
        mode: item.mode,
        outcome: item.outcome || CareActivityOutcome.DONE,
        ...(item.medicationAction ? { medication: item.medicationAction } : {}),
        outsidePlan: Boolean(item.outsidePlan)
      }))
    };
  }
  return Object.keys(snapshot).length ? snapshot : undefined;
}

async function writeRevision(tx, context, entry, { kind, reason, now }) {
  await tx.careClientEntryRevision.create({
    data: {
      entryId: entry.id,
      clientId: entry.clientId,
      kind,
      text: entry.text,
      entryKind: entry.kind,
      contactMode: entry.contactMode,
      occurredAt: entry.occurredAt,
      snapshot: revisionSnapshot(entry),
      revision: entry.revision,
      reason,
      actorMembershipId: context.membership.id,
      actorName: await membershipDisplayName(tx, context),
      createdAt: now
    },
    select: { id: true }
  });
}

export async function correctEntry(
  context,
  clientId,
  entryId,
  input = {},
  { db = prisma, now = new Date(), env = process.env, notify = notifyCoordinatorsOfEntry, analyzer } = {}
) {
  const result = await correctEntryInTransaction(context, clientId, entryId, input, { db, now, env, analyzer });
  /* Kirje, mis parandusega MUUDETI mureks, on hooldusjuhile uus mure: ilma
     teateta näeks ta seda alles ülevaadet lugedes. */
  if (result.becameConcern && notify) {
    await notify(
      {
        entryId: result.entry.id,
        organizationId: context.organization.id,
        unitId: result.unitId,
        kind: CareEntryKind.CONCERN,
        actorMembershipId: context.membership?.id || null,
        dedupeSuffix: `corrected:${result.entry.revision}`
      },
      { db, now }
    );
  }
  return { entry: result.entry };
}

async function correctEntryInTransaction(context, clientId, entryId, input, { db, now, env, analyzer }) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const entryKey = normalizeId(entryId, "home_care.errors.entry_not_found");
  const body = asObject(input);
  const reason = normalizeReason(body.reason);
  /* Otsinguabi uue teksti järgi, ENNE tehingut (vt `createEntry`). Erijuhtumi
     hinnang, mida parandus ei saatnud, loetakse kirjelt: see eellugemine ei
     otsusta õigust ega jõua vastusesse, õigus kontrollitakse tehingus. */
  const stored = await db.careClientEntry.findFirst({
    where: { id: entryKey, clientId: id, organizationId: context.organization.id },
    select: { kind: true, incidentAssessment: true }
  });
  const assessmentForSearch =
    stored?.kind === CareEntryKind.INCIDENT
      ? body.incidentAssessment === undefined
        ? stored.incidentAssessment
        : body.incidentAssessment
      : null;
  const search = await entrySearchText([body.text, assessmentForSearch], { analyzer });
  /* Parandaja ütleb, MILLIST versiooni ta nägi. Ilma selleta kirjutaks vana
     vorm üle kellegi vahepealse paranduse ja kordussaatmine teeks sama
     paranduse kaks korda. */
  const seenRevision = normalizeVersion(body.revision);
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    const entry = await requireVisibleEntry(tx, context, access, entryKey);
    assertEntryEditor(context, access, entry);
    if (entry.retractedAt) throw conflict("home_care.errors.entry_retracted");
    if (entry.revision !== seenRevision) throw conflict("home_care.errors.entry_changed");
    /* Saatmata väljad jäävad nii, nagu need kirjel on (vt `normalizeEntryInput`). */
    const data = normalizeEntryInput(body, { now, base: entry });
    /* Erijuhtumi liiki ei saa parandusega tavaliseks kirjeks muuta ega
       vastupidi: registri rida ei tohi vaikselt kaduda ega tekkida. */
    if ((entry.kind === CareEntryKind.INCIDENT) !== (data.kind === CareEntryKind.INCIDENT)) {
      throw badRequest("home_care.errors.incident_kind_fixed");
    }
    /* Muutmata „kaasas" jääb alles ka siis, kui kolleegi liikmesus on vahepeal
       lõppenud: parandus ei tohi kirjelt ajaloolist fakti maha võtta. */
    const companion =
      data.companionMembershipId && data.companionMembershipId === entry.companionMembershipId
        ? { companionMembershipId: entry.companionMembershipId, companionName: entry.companionName }
        : await resolveCompanion(tx, context, data.companionMembershipId);

    /* Tehtud toimingud: `null` = parandus neid ei saatnud ja read jäävad; muidu
       asendatakse read saadetud loendiga (tundmatu toiming on viga enne kirjutamist). */
    const doneActivities =
      data.visitActivities === null ? null : await resolveVisitActivities(tx, context, id, data.visitActivities, entry.activities || []);

    await writeRevision(tx, context, entry, { kind: CareRevisionKind.CORRECTION, reason, now });
    const result = await tx.careClientEntry.updateMany({
      where: { id: entry.id, clientId: id, revision: entry.revision, retractedAt: null },
      data: {
        kind: data.kind,
        contactMode: data.contactMode,
        text: data.text,
        visitMinutes: data.visitMinutes,
        /* Piiratud nähtavust saab maha võtta ainult hooldusjuht. Kirjel võib
           juba olla tema lahendusmärkus, mida autor ei tohi liigi muutmisega
           kogu meeskonnale nähtavaks teha. */
        coordinatorOnly: entry.coordinatorOnly && !access.isCoordinator ? true : isCoordinatorOnly(data),
        callTopic: data.callTopic,
        callCaller: data.callCaller,
        occurredAt: data.occurredAt,
        companionMembershipId: companion.companionMembershipId,
        companionName: companion.companionName,
        incidentType: data.incidentType,
        incidentAssessment: data.incidentAssessment,
        /* JSON-veeru tühjendamine vajab selget DbNull-i; `undefined` jätaks vana
           väärtuse alles ja parandus ei eemaldaks eksikombel märgitud sammu. */
        incidentActions: data.incidentActions ?? Prisma.DbNull,
        searchText: search.searchText,
        searchVersion: search.searchVersion,
        revision: entry.revision + 1
      }
    });
    if (result.count !== 1) throw conflict("home_care.errors.entry_changed");
    if (doneActivities) {
      await tx.careEntryActivity.deleteMany({ where: { entryId: entry.id } });
      await writeVisitActivities(tx, context, entry.id, id, doneActivities);
    }

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_ENTRY_CORRECTED,
      resourceType: OrgAuditResource.CARE_CLIENT_ENTRY,
      resourceId: entry.id,
      meta: { organizationId, clientId: id, entryId: entry.id }
    });
    const fresh = await tx.careClientEntry.findFirst({ where: { id: entry.id, clientId: id }, select: ENTRY_SELECT });
    return {
      entry: serializeEntry(fresh, { viewerMembershipId: context.membership?.id || null }),
      becameConcern: entry.kind !== CareEntryKind.CONCERN && data.kind === CareEntryKind.CONCERN,
      unitId: access.client.unitId || null
    };
  });
}

export async function retractEntry(
  context,
  clientId,
  entryId,
  input = {},
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const entryKey = normalizeId(entryId, "home_care.errors.entry_not_found");
  const body = asObject(input);
  const reason = normalizeReason(body.reason);
  const seenRevision = normalizeVersion(body.revision);
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    /* Kliendi rea lukk järjestab tühistuse erijuhtumi täiendusega
       (`addIncidentUpdate` võtab sama luku): muidu võiks täiendus jõuda käiku
       pärast seda, kui juhtum on juba tühistatud. */
    const access = await requireClientAccess(tx, context, id, { now, lock: true });
    const entry = await requireVisibleEntry(tx, context, access, entryKey);
    assertEntryEditor(context, access, entry);
    /* Erijuhtumi tühistab hooldusjuht. Autori tühistus võtaks lahtise juhtumi
       registrist ja ülevaatest vaikselt maha; sama põhjusega ei saa parandus
       erijuhtumit tavaliseks kirjeks muuta. */
    if (entry.kind === CareEntryKind.INCIDENT && !access.isCoordinator) {
      throw forbidden("home_care.errors.incident_retract_coordinator");
    }
    if (entry.retractedAt) throw conflict("home_care.errors.entry_retracted");
    if (entry.revision !== seenRevision) throw conflict("home_care.errors.entry_changed");

    await writeRevision(tx, context, entry, { kind: CareRevisionKind.RETRACTION, reason, now });
    const result = await tx.careClientEntry.updateMany({
      where: { id: entry.id, clientId: id, revision: entry.revision, retractedAt: null },
      /* Tühistatud kirje teksti ei näidata, seega ei jää ka otsinguabi. */
      data: { retractedAt: now, revision: entry.revision + 1, searchText: null, searchVersion: null }
    });
    if (result.count !== 1) throw conflict("home_care.errors.entry_changed");

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_ENTRY_RETRACTED,
      resourceType: OrgAuditResource.CARE_CLIENT_ENTRY,
      resourceId: entry.id,
      meta: { organizationId, clientId: id, entryId: entry.id }
    });
    const fresh = await tx.careClientEntry.findFirst({ where: { id: entry.id, clientId: id }, select: ENTRY_SELECT });
    return { entry: serializeEntry(fresh, { viewerMembershipId: context.membership?.id || null }) };
  });
}

/** Kirje parandusjälg autorile ja hooldusjuhile. */
export async function listEntryRevisions(
  context,
  clientId,
  entryId,
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const entryKey = normalizeId(entryId, "home_care.errors.entry_not_found");

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    const entry = await requireVisibleEntry(tx, context, access, entryKey);
    assertEntryEditor(context, access, entry);
    await recordClientOpen(tx, context, access, { now });
    const rows = await tx.careClientEntryRevision.findMany({
      where: { entryId: entry.id, clientId: id },
      select: {
        id: true,
        kind: true,
        text: true,
        entryKind: true,
        contactMode: true,
        occurredAt: true,
        snapshot: true,
        revision: true,
        reason: true,
        actorName: true,
        createdAt: true
      },
      orderBy: [{ revision: "desc" }, { id: "desc" }]
    });
    return {
      revisions: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        text: row.text,
        entryKind: row.entryKind,
        contactMode: row.contactMode,
        occurredAt: iso(row.occurredAt),
        /* Asendatud käigu kirje: kestus ja toimingud, nagu need enne parandust olid. */
        visit: row.snapshot && typeof row.snapshot === "object" && row.snapshot.visit ? row.snapshot.visit : null,
        revision: row.revision,
        reason: row.reason,
        actorName: row.actorName,
        createdAt: iso(row.createdAt)
      }))
    };
  });
}

/** Erijuhtumi seisu muudab hooldusjuht. */
export async function setIncidentStatus(
  context,
  clientId,
  entryId,
  input = {},
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const entryKey = normalizeId(entryId, "home_care.errors.entry_not_found");
  const { status, note } = normalizeIncidentStatusInput(input);
  const organizationId = context.organization.id;
  if (!context.membership?.id) throw notFound("home_care.errors.client_not_found");

  return db.$transaction(async (tx) => {
    const access = await requireClientCoordinator(tx, context, id, { now });
    const entry = await requireVisibleEntry(tx, context, access, entryKey);
    if (entry.kind !== CareEntryKind.INCIDENT) throw badRequest("home_care.errors.not_an_incident");
    if (entry.retractedAt) throw conflict("home_care.errors.entry_retracted");
    const fromStatus = entry.incidentStatus || CareIncidentStatus.OPEN;
    if (fromStatus === status) {
      return { entry: serializeEntry(entry, { viewerMembershipId: context.membership?.id || null }) };
    }

    const closing = status === CareIncidentStatus.CLOSED;
    const result = await tx.careClientEntry.updateMany({
      where: { id: entry.id, clientId: id, incidentStatus: entry.incidentStatus, retractedAt: null },
      data: {
        incidentStatus: status,
        incidentResolvedAt: closing ? now : null,
        incidentResolvedByMembershipId: closing ? context.membership?.id || null : null,
        incidentResolutionNote: note ?? (closing ? null : entry.incidentResolutionNote)
      }
    });
    if (result.count !== 1) throw conflict("home_care.errors.entry_changed");

    /* Seisumuutus läheb juhtumi käiku: kes, millal, mis seisust mis seisu. */
    await tx.careIncidentUpdate.create({
      data: {
        organizationId,
        clientId: id,
        entryId: entry.id,
        kind: CareIncidentUpdateKind.STATUS,
        text: note || null,
        fromStatus,
        toStatus: status,
        actorMembershipId: context.membership.id,
        actorName: await membershipDisplayName(tx, context),
        byCoordinator: true,
        createdAt: now
      },
      select: { id: true }
    });

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_INCIDENT_STATUS_CHANGED,
      resourceType: OrgAuditResource.CARE_CLIENT_ENTRY,
      resourceId: entry.id,
      meta: { organizationId, clientId: id, entryId: entry.id, fromStatus, toStatus: status }
    });
    const fresh = await tx.careClientEntry.findFirst({ where: { id: entry.id, clientId: id }, select: ENTRY_SELECT });
    return { entry: serializeEntry(fresh, { viewerMembershipId: context.membership?.id || null }) };
  });
}

/**
 * Kas kliendil on värske mure, mida see vaataja ei näe? Siis näitab leht rida
 * „enne käiku räägi hooldusjuhiga" (kava II.6.7), ilma sisu avaldamata.
 */
export async function hasHiddenConcernWithin(tx, context, access, { now = new Date() } = {}) {
  if (access.isCoordinator) return false;
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const row = await tx.careClientEntry.findFirst({
    where: {
      clientId: access.client.id,
      organizationId: context.organization.id,
      kind: CareEntryKind.CONCERN,
      retractedAt: null,
      createdAt: { gte: since },
      NOT: { authorMembershipId: context.membership?.id || "" }
    },
    select: { id: true }
  });
  return Boolean(row);
}
