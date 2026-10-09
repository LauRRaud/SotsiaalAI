/**
 * KODUTEENUS K1-d — kliendi kronoloogia ja väljastuste tööloend.
 *
 * Kui politsei, linnavalitsus või klient ise küsib, mis kliendi juures toimus,
 * koostab hooldusjuht kronoloogia: valib ajavahemiku, vaatab kirjed üle, jätab
 * välja selle, mida väljastada ei tohi, eemaldab kolmandate isikute andmed ja
 * kirjutab, kes küsis ja mis alusel.
 *
 * VÄLJASTUS ON HETKEKOOPIA. Dokumendi read salvestatakse koos tekstiga
 * (`CareChronologyReleaseItem`) ja on muutmatud: kui päeviku kirjet hiljem
 * parandatakse, jääb juba väljastatud dokument samaks. Tööloend ütleb, mis
 * dokument, kellele, mis alusel ja kelle poolt koostati; ametlik register on
 * asutuse dokumendihaldus ja `registryRef` viitab sinna.
 *
 * Ainult hooldusjuht, kelle skoobis klient on. Auditisse läheb ainult ID.
 */

import { createHash } from "node:crypto";

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, forbidden, notFound } from "../org/errors.js";
import { decodePageCursor, descendingCursorWhere, normalizePageSize, toCursorPage } from "../org/pagination.js";
import { localDateTimeToUtc, shiftLocalDate } from "../time/estonianDay.js";

import {
  assertHomeCareContext,
  coordinatorScope,
  membershipDisplayName,
  organizationTimeZone,
  recordClientOpen,
  requireClientCoordinator
} from "./access.js";
import { HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import {
  asObject,
  normalizeId,
  normalizeIsoDay,
  normalizeLine,
  normalizeOptionalId,
  normalizeRequestId,
  normalizeText,
  normalizeVersion
} from "./validation.js";

const DRAFT_SELECT = Object.freeze({
  id: true,
  occurredAt: true,
  authorName: true,
  kind: true,
  contactMode: true,
  incidentType: true,
  text: true,
  coordinatorOnly: true,
  revision: true
});

const RELEASE_SELECT = Object.freeze({
  id: true,
  clientId: true,
  clientName: true,
  periodFromDay: true,
  periodToDay: true,
  requester: true,
  basis: true,
  registryRef: true,
  summary: true,
  entryCount: true,
  contentSha256: true,
  createdByName: true,
  createdAt: true
});

const REPEAT_SELECT = Object.freeze({ ...RELEASE_SELECT, requestHash: true });

function isoDayText(parts) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Ajavahemik asutuse kalendripäevades; mõlemad otsad on kohustuslikud ja kaasa arvatud. */
function normalizePeriod(context, input) {
  const from = normalizeIsoDay(input.from);
  const to = normalizeIsoDay(input.to);
  if (!from || !to) throw badRequest("home_care.errors.chronology_period_required");
  const timeZone = organizationTimeZone(context);
  const gte = localDateTimeToUtc(from, timeZone);
  const lt = localDateTimeToUtc(shiftLocalDate(to, 1), timeZone);
  if (gte >= lt) throw badRequest("home_care.errors.invalid_date");
  return { fromDay: isoDayText(from), toDay: isoDayText(to), range: { gte, lt } };
}

function serializeRelease(row) {
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.clientName,
    periodFromDay: row.periodFromDay,
    periodToDay: row.periodToDay,
    requester: row.requester,
    basis: row.basis,
    registryRef: row.registryRef || null,
    summary: row.summary || null,
    entryCount: row.entryCount,
    contentSha256: row.contentSha256,
    createdByName: row.createdByName,
    createdAt: new Date(row.createdAt).toISOString()
  };
}

/**
 * Sisu räsi. Kindel võtmejärjekord, et sama dokument annaks alati sama räsi:
 * kaanelehel olevat räsi saab hiljem tööloendi omaga võrrelda.
 */
export function chronologyContentHash({ clientName, fromDay, toDay, requester, basis, registryRef, summary, items }) {
  const canonical = JSON.stringify([
    clientName,
    fromDay,
    toDay,
    requester,
    basis,
    registryRef || null,
    summary || null,
    items.map((item) => [
      new Date(item.occurredAt).toISOString(),
      item.authorName,
      item.kind,
      item.contactMode,
      item.incidentType || null,
      item.text
    ])
  ]);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Kordussaatmise võrdlus: räsi sellest, mida päring ütles (klient, ajavahemik,
 * dokumendi andmed, valitud kirjed ja muudetud tekstid). Sama võtmega teine
 * päring peab ütlema sama; kirjete hilisem parandus räsi ei muuda.
 */
function releaseRequestHash({ clientId, period, requester, basis, registryRef, summary, requested }) {
  const canonical = JSON.stringify([
    clientId,
    period.fromDay,
    period.toDay,
    requester,
    basis,
    registryRef || null,
    summary || null,
    requested.map((item) => [item.entryId, item.revision, item.text])
  ]);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Mustand: ajavahemiku kirjed vanemast uuemani, hooldusjuhile ülevaatamiseks.
 * Tühistatud kirjeid ei ole. Piiratud nähtavusega kirjed (mure, kahtlus) on
 * kaasas ja märgitud: kas neid väljastada, otsustab koostaja.
 */
export async function draftChronology(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const period = normalizePeriod(context, asObject(input));

  return db.$transaction(async (tx) => {
    const access = await requireClientCoordinator(tx, context, id, { now });
    await recordClientOpen(tx, context, access, { now });
    const rows = await tx.careClientEntry.findMany({
      where: {
        clientId: id,
        organizationId: context.organization.id,
        retractedAt: null,
        occurredAt: period.range
      },
      select: DRAFT_SELECT,
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      take: HOME_CARE_LIMITS.CHRONOLOGY_MAX + 1
    });
    /* Liiga pikk ajavahemik: parem keelduda kui vaikselt osa kirjeid välja jätta. */
    if (rows.length > HOME_CARE_LIMITS.CHRONOLOGY_MAX) {
      throw badRequest("home_care.errors.chronology_too_many", { limit: HOME_CARE_LIMITS.CHRONOLOGY_MAX });
    }
    return {
      client: { id: access.client.id, displayName: access.client.displayName },
      from: period.fromDay,
      to: period.toDay,
      items: rows.map((row) => ({
        entryId: row.id,
        occurredAt: new Date(row.occurredAt).toISOString(),
        authorName: row.authorName,
        kind: row.kind,
        contactMode: row.contactMode,
        incidentType: row.incidentType || null,
        text: row.text,
        coordinatorOnly: Boolean(row.coordinatorOnly),
        revision: row.revision
      }))
    };
  });
}

function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw badRequest("home_care.errors.chronology_items_required");
  if (rawItems.length > HOME_CARE_LIMITS.CHRONOLOGY_MAX) {
    throw badRequest("home_care.errors.chronology_too_many", { limit: HOME_CARE_LIMITS.CHRONOLOGY_MAX });
  }
  const seen = new Set();
  const items = [];
  for (const rawItem of rawItems) {
    const item = asObject(rawItem);
    const entryId = normalizeId(item.entryId, "home_care.errors.chronology_entry_invalid");
    if (seen.has(entryId)) continue;
    seen.add(entryId);
    /* Koostaja ütleb, MILLIST kirje versiooni ta üle vaatas (mustand annab
       selle kaasa). Dokumenti ei tohi minna tekst, mida ta ei näinud. */
    const revision = normalizeVersion(item.revision);
    /* `text` puudub = väljasta kirje tekst muutmata. Antud tekst peab olema
       sisuga: tühja tekstiga rida ei ole dokumendis mõtet hoida, selle jaoks
       jäetakse kirje valikust välja. */
    const text =
      item.text === undefined || item.text === null
        ? null
        : normalizeText(item.text, HOME_CARE_LIMITS.ENTRY_TEXT_MAX, {
            required: true,
            errorKey: "home_care.errors.chronology_text_required"
          });
    items.push({ entryId, revision, text });
  }
  return items;
}

/**
 * Koostab väljastuse: tööloendi rea ja dokumendi read (hetkekoopiad).
 * Kirje peab kuuluma sellele kliendile, olema tühistamata ja jääma valitud
 * ajavahemikku; kehast tulnud ID üksi ei tõenda midagi. Kirje peab olema ka
 * samas versioonis, mida koostaja mustandis nägi: kui autor on kirjet vahepeal
 * parandanud, tuleb kirjed uuesti üle vaadata.
 *
 * KORDUSSAATMINE. Tööloend on muutmatu, seega topeltklõps või võrgu kordus ei
 * tohi jätta sinna kaht rida. `clientRequestId` (vorm annab selle ühele
 * koostamiskatsele) teeb teisest saatmisest sama väljastuse tagastamise.
 */
export async function createChronologyRelease(
  context,
  clientId,
  input = {},
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const body = asObject(input);
  const period = normalizePeriod(context, body);
  const requester = normalizeLine(body.requester, HOME_CARE_LIMITS.CHRONOLOGY_LINE_MAX, {
    required: true,
    errorKey: "home_care.errors.chronology_requester_required"
  });
  const basis = normalizeLine(body.basis, HOME_CARE_LIMITS.CHRONOLOGY_LINE_MAX, {
    required: true,
    errorKey: "home_care.errors.chronology_basis_required"
  });
  const registryRef = normalizeLine(body.registryRef, HOME_CARE_LIMITS.CHRONOLOGY_REF_MAX);
  const summary = normalizeText(body.summary, HOME_CARE_LIMITS.ENTRY_TEXT_MAX);
  const requested = normalizeItems(body.items);
  const clientRequestId = normalizeRequestId(body.clientRequestId);
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id;
  if (!membershipId) throw notFound("home_care.errors.client_not_found");
  const requestHash = clientRequestId
    ? releaseRequestHash({ clientId: id, period, requester, basis, registryRef, summary, requested })
    : null;
  const repeatOf = (row) => {
    if (row.requestHash !== requestHash) throw conflict("home_care.errors.idempotency_conflict");
    return { release: serializeRelease(row), repeated: true };
  };

  return db.$transaction(async (tx) => {
    /* Kordus enne kõike muud (sama reegel mis kirjel). Otsing sisaldab
       koostajat, seega võõra võtmega võõrast väljastust kätte ei saa. */
    if (clientRequestId) {
      const repeat = await tx.careChronologyRelease.findFirst({
        where: { organizationId, createdByMembershipId: membershipId, clientRequestId },
        select: REPEAT_SELECT
      });
      if (repeat) return repeatOf(repeat);
    }

    const access = await requireClientCoordinator(tx, context, id, { now });
    const rows = await tx.careClientEntry.findMany({
      where: {
        id: { in: requested.map((item) => item.entryId) },
        clientId: id,
        organizationId,
        retractedAt: null,
        occurredAt: period.range
      },
      select: DRAFT_SELECT,
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }]
    });
    if (rows.length !== requested.length) throw badRequest("home_care.errors.chronology_entry_invalid");

    const chosen = new Map(requested.map((item) => [item.entryId, item]));
    if (rows.some((row) => row.revision !== chosen.get(row.id).revision)) {
      throw conflict("home_care.errors.chronology_entry_changed");
    }
    const items = rows.map((row, index) => {
      const text = chosen.get(row.id).text ?? row.text;
      return {
        position: index + 1,
        entryId: row.id,
        entryRevision: row.revision,
        occurredAt: row.occurredAt,
        authorName: row.authorName,
        kind: row.kind,
        contactMode: row.contactMode,
        incidentType: row.incidentType || null,
        text,
        redacted: text !== row.text
      };
    });

    const clientName = access.client.displayName;
    const contentSha256 = chronologyContentHash({
      clientName,
      fromDay: period.fromDay,
      toDay: period.toDay,
      requester,
      basis,
      registryRef,
      summary,
      items
    });

    const data = {
      organizationId,
      clientId: id,
      clientName,
      periodFromDay: period.fromDay,
      periodToDay: period.toDay,
      requester,
      basis,
      registryRef,
      summary,
      entryCount: items.length,
      contentSha256,
      createdByMembershipId: membershipId,
      createdByName: await membershipDisplayName(tx, context),
      clientRequestId,
      requestHash,
      createdAt: now
    };
    let release;
    if (clientRequestId) {
      /* Kaks samaaegset saatmist sama võtmega: kirjutab üks, teine loeb sama rea
         (`skipDuplicates` jätab tehingu terveks). */
      const { count } = await tx.careChronologyRelease.createMany({ data: [data], skipDuplicates: true });
      release = await tx.careChronologyRelease.findFirst({
        where: { createdByMembershipId: membershipId, clientRequestId },
        select: REPEAT_SELECT
      });
      if (!release) throw conflict("home_care.errors.save_failed");
      if (count === 0) return repeatOf(release);
    } else {
      release = await tx.careChronologyRelease.create({ data, select: RELEASE_SELECT });
    }
    await tx.careChronologyReleaseItem.createMany({
      data: items.map((item) => ({ ...item, releaseId: release.id }))
    });
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_CHRONOLOGY_RELEASED,
      resourceType: OrgAuditResource.CARE_CHRONOLOGY_RELEASE,
      resourceId: release.id,
      meta: { organizationId, clientId: id, releaseId: release.id }
    });
    return { release: serializeRelease(release) };
  });
}

/**
 * Väljastatud dokument koos ridadega. Avada tohib hooldusjuht, kelle skoobis
 * klient praegu on; avamine jätab kliendi avamislogisse rea.
 */
export async function getChronologyRelease(context, releaseId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(releaseId, "home_care.errors.release_not_found");

  return db.$transaction(async (tx) => {
    const release = await tx.careChronologyRelease.findFirst({
      where: { id, organizationId: context.organization.id },
      select: RELEASE_SELECT
    });
    if (!release) throw notFound("home_care.errors.release_not_found");
    let access;
    try {
      access = await requireClientCoordinator(tx, context, release.clientId, { now });
    } catch {
      /* Võõra üksuse hooldusjuht, hooldaja ja kõrvaline liige saavad sama
         vastuse mis olematu väljastuse puhul. */
      throw notFound("home_care.errors.release_not_found");
    }
    await recordClientOpen(tx, context, access, { now });
    const items = await tx.careChronologyReleaseItem.findMany({
      where: { releaseId: release.id },
      select: {
        position: true,
        occurredAt: true,
        authorName: true,
        kind: true,
        contactMode: true,
        incidentType: true,
        text: true,
        redacted: true
      },
      orderBy: { position: "asc" }
    });
    return {
      release: serializeRelease(release),
      items: items.map((item) => ({ ...item, occurredAt: new Date(item.occurredAt).toISOString() })),
      organization: {
        displayName: context.organization.displayName,
        legalName: context.organization.legalName || null,
        timezone: organizationTimeZone(context) || "Europe/Tallinn",
        defaultLocale: context.organization.defaultLocale || "et"
      }
    };
  });
}

/**
 * Klient kronoloogia koostamise lehe jaoks: ainult nimi. Sama värav mis
 * mustandil (hooldusjuht, kelle skoobis klient on); avamisjälge siin ei
 * kirjutata, selle kirjutab mustandi laadimine.
 */
export async function getChronologyClient(context, clientId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  return db.$transaction(async (tx) => {
    const access = await requireClientCoordinator(tx, context, id, { now });
    return { id: access.client.id, displayName: access.client.displayName };
  });
}

/** Väljastuste tööloend hooldusjuhi skoobis: ainult andmed dokumendi kohta, mitte selle sisu. */
export async function listChronologyReleases(context, rawQuery = {}, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const scope = coordinatorScope(context);
  if (!scope) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
  const query = asObject(rawQuery);
  const clientId = normalizeOptionalId(query.clientId, "home_care.errors.client_not_found");
  const pageSize = normalizePageSize(query.take, HOME_CARE_LIMITS.ENTRIES_PAGE, HOME_CARE_LIMITS.ENTRIES_PAGE_MAX);
  const cursor = decodePageCursor(query.cursor, { dateKeys: ["createdAt"], stringKeys: ["id"] });

  const and = [];
  if (clientId) and.push({ clientId });
  const cursorWhere = descendingCursorWhere(cursor, ["createdAt", "id"]);
  if (cursorWhere) and.push(cursorWhere);

  const rows = await db.careChronologyRelease.findMany({
    where: {
      organizationId: context.organization.id,
      ...(scope.wholeOrg ? {} : { client: { unitId: { in: scope.unitIds } } }),
      AND: and
    },
    select: RELEASE_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1
  });
  const page = toCursorPage(rows, pageSize, (row) => ({ createdAt: row.createdAt, id: row.id }));
  return { items: page.items.map(serializeRelease), hasMore: page.hasMore, nextCursor: page.nextCursor };
}
