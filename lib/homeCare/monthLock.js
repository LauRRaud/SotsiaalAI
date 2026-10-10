/**
 * KODUTEENUS K5-p — kuu lukustamine (kava II.6.10, kuu sulgemise kolmas samm).
 *
 * Kui hooldusjuht on kuu üle vaadanud, lukustab ta selle. LUKK ON ARVUDE HETKTÕMMIS: kliendi
 * kaupa käigud ja aeg otsustatud mahu kõrval, töötajate aeg, ära jäänud käigud. Pärast seda
 * näitab kuu kokkuvõte lukustatud arve, mitte jooksvat seisu, nii et linnale ja
 * raamatupidamisele lähevad samad numbrid, mida hooldusjuht lukustades nägi.
 *
 * PÄEVIKUT LUKK KINNI EI PANE. Käigu teinud inimene peab saama selle kirja panna ka siis,
 * kui kuu on juba lukus (ununenud kirje; võrguta kirjutatud kirje, mis jõuab kohale hiljem):
 * hoolduskirjet ei lükata arvepidamise pärast tagasi. Hilisem kirje, parandus, tühistus ja
 * päevaplaani muudatus loetakse siin eraldi kokku („pärast lukustamist"), ja lukustatud
 * arvude kõrval on näha, kui palju praegune seis neist erineb. Kui muudatused peavad
 * arvudesse jõudma, avab hooldusjuht kuu põhjusega uuesti ja lukustab uuesti; varasem lukk
 * jääb alles.
 *
 * HETKTÕMMISES ON KLIENDI ID, MITTE NIMI. Nimi loetakse näitamise hetkel kliendi realt.
 *
 * Lukustab ja avab ainult kogu asutuse hooldusjuht: hetktõmmis on kogu asutuse kohta. Üksuse
 * hooldusjuht näeb, et kuu on lukus, ja oma üksuse jooksvaid arve.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, forbidden } from "../org/errors.js";

import { assertHomeCareContext, coordinatorScope, membershipDisplayName, organizationTimeZone } from "./access.js";
import { monthRange, monthText, resolveCallMonth, shiftMonth } from "./calls.js";
import { CareRevisionKind, HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { getMonthOpenItems } from "./monthClose.js";
import { getMonthSummary } from "./provided.js";
import { asObject, normalizeLine } from "./validation.js";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const TOTAL_KEYS = Object.freeze(["visits", "minutes", "withoutLength", "missed", "cancelled", "notDone"]);

/** Kuu lahtiste asjade koguarv (K5-j nimekirja neli liiki kokku). */
export function openItemTotal(openItems) {
  return (
    (Number(openItems?.missingCount) || 0) +
    (Number(openItems?.openIncidents) || 0) +
    (Number(openItems?.openSignals) || 0) +
    (Number(openItems?.medicationUnmarked) || 0)
  );
}

/** Kuu kokkuvõttest hetktõmmis: kliendi rida kannab ID-d ja arve, nime ega seisu mitte. */
export function snapshotOf(summary, openItems) {
  return {
    fromDay: summary.fromDay,
    untilDay: summary.untilDay,
    totals: { ...summary.totals },
    clients: summary.clients.map(({ client, ...numbers }) => ({ clientId: client.id, ...numbers })),
    workers: summary.workers.map((row) => ({ ...row })),
    missed: summary.missed.map((row) => ({ entryId: row.entryId, clientId: row.client.id, occurredAt: row.occurredAt, type: row.type })),
    open: {
      missing: Number(openItems?.missingCount) || 0,
      incidents: Number(openItems?.openIncidents) || 0,
      signals: Number(openItems?.openSignals) || 0,
      medication: Number(openItems?.medicationUnmarked) || 0
    }
  };
}

/**
 * Hetktõmmisest kuu kokkuvõtte kuju. `names` on praegune kliendiloend (ID → nimi ja seis);
 * kliendil, keda seal enam ei ole, on nimi ja seis `null`.
 */
export function summaryFromSnapshot(snapshot, names = new Map()) {
  const clientOf = (id) => ({ id, displayName: names.get(id)?.displayName ?? null, status: names.get(id)?.status ?? null });
  const data = asObject(snapshot);
  return {
    totals: { ...asObject(data.totals) },
    clients: (Array.isArray(data.clients) ? data.clients : []).map(({ clientId, ...numbers }) => ({ client: clientOf(clientId), ...numbers })),
    workers: Array.isArray(data.workers) ? data.workers : [],
    missed: (Array.isArray(data.missed) ? data.missed : []).map((row) => ({
      entryId: row.entryId,
      client: clientOf(row.clientId),
      occurredAt: row.occurredAt,
      type: row.type
    }))
  };
}

/** Praeguste ja lukustatud koguarvude vahe (praegune miinus lukustatud); `null`, kui vahet ei ole. */
export function totalsDrift(locked, live) {
  const drift = {};
  for (const key of TOTAL_KEYS) {
    const delta = (Number(live?.[key]) || 0) - (Number(locked?.[key]) || 0);
    if (delta) drift[key] = delta;
  }
  return Object.keys(drift).length ? drift : null;
}

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function requireMonth(value) {
  if (typeof value !== "string" || !MONTH_PATTERN.test(value)) throw badRequest("home_care.errors.invalid_month");
  return value;
}

function seenNumber(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Mis on selles kuus pärast lukustamist lisatud või muudetud: uued päeviku kirjed, parandused,
 * tühistused ja päevaplaani muudatused. Parandus loetakse nii kirje praeguse kui ka asendatud
 * aja järgi, et teise kuusse tõstetud kirje ei kaoks kummastki.
 */
async function loadAfterLock(db, { organizationId, month, timeZone, lockedAt, clientScope = null, withItems = true }) {
  const range = monthRange(month, timeZone);
  const name = monthText(month.year, month.month);
  const lastDay = `${name}-${String(new Date(Date.UTC(month.year, month.month, 0)).getUTCDate()).padStart(2, "0")}`;
  const ofClient = clientScope ? { client: clientScope } : {};

  const entryWhere = { organizationId, occurredAt: range, createdAt: { gt: lockedAt }, ...ofClient };
  const revisionWhere = {
    createdAt: { gt: lockedAt },
    entry: { organizationId, ...ofClient },
    OR: [{ occurredAt: range }, { entry: { occurredAt: range } }]
  };
  const added = await db.careClientEntry.count({ where: entryWhere });
  const corrected = await db.careClientEntryRevision.count({ where: { ...revisionWhere, kind: CareRevisionKind.CORRECTION } });
  const retracted = await db.careClientEntryRevision.count({ where: { ...revisionWhere, kind: CareRevisionKind.RETRACTION } });
  const planChanged = await db.careVisitChange.count({
    where: { organizationId, day: { gte: `${name}-01`, lte: lastDay }, updatedAt: { gt: lockedAt }, ...ofClient }
  });
  const counts = { added, corrected, retracted, planChanged, total: added + corrected + retracted + planChanged };
  if (!withItems || !(added + corrected + retracted)) return { ...counts, items: [] };

  const shown = HOME_CARE_LIMITS.MONTH_AFTER_LOCK_SHOWN;
  const entryRows = added
    ? await db.careClientEntry.findMany({
        where: entryWhere,
        select: { id: true, clientId: true, createdAt: true, occurredAt: true, authorName: true, client: { select: { displayName: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: shown
      })
    : [];
  const revisionRows =
    corrected + retracted
      ? await db.careClientEntryRevision.findMany({
          where: revisionWhere,
          select: {
            id: true,
            kind: true,
            clientId: true,
            createdAt: true,
            actorName: true,
            entry: { select: { occurredAt: true, client: { select: { displayName: true } } } }
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: shown
        })
      : [];
  const items = [
    ...entryRows.map((row) => ({
      key: `e:${row.id}`,
      kind: "ADDED",
      at: iso(row.createdAt),
      actorName: row.authorName || "",
      occurredAt: iso(row.occurredAt),
      client: { id: row.clientId, displayName: row.client.displayName }
    })),
    ...revisionRows.map((row) => ({
      key: `r:${row.id}`,
      kind: row.kind === CareRevisionKind.RETRACTION ? "RETRACTED" : "CORRECTED",
      at: iso(row.createdAt),
      actorName: row.actorName || "",
      occurredAt: iso(row.entry.occurredAt),
      client: { id: row.clientId, displayName: row.entry.client.displayName }
    }))
  ]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.key.localeCompare(b.key)))
    .slice(0, shown);
  return { ...counts, items };
}

/**
 * Kuu kokkuvõtte leht hooldusjuhile: arvud, lahtised asjad ja luku seis. Lukustatud kuu
 * puhul on arvud hetktõmmisest (kogu asutuse hooldusjuhile) ja juures on vahe praeguse seisuga.
 */
export async function getMonthPage(context, rawQuery = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  const live = await getMonthSummary(context, rawQuery, { db, now, env });
  const openItems = await getMonthOpenItems(context, { month: live.month }, { db, now, env });
  /* `getMonthSummary` on juba kontrollinud, et vaataja on hooldusjuht. */
  const scope = coordinatorScope(context);
  const organizationId = context.organization.id;
  const timeZone = organizationTimeZone(context);

  const active = await db.careMonthLock.findFirst({
    where: { organizationId, month: live.month, reopenedAt: null },
    select: { id: true, lockedAt: true, lockedByName: true, openItemCount: true, snapshot: scope.wholeOrg }
  });
  const earlier = await db.careMonthLock.findMany({
    where: { organizationId, month: live.month, reopenedAt: { not: null } },
    select: { id: true, lockedAt: true, lockedByName: true, reopenedAt: true, reopenedByName: true, reopenReason: true },
    orderBy: [{ lockedAt: "desc" }, { id: "desc" }],
    take: HOME_CARE_LIMITS.MONTH_LOCK_HISTORY_MAX
  });
  const history = earlier.map((row) => ({
    id: row.id,
    lockedAt: iso(row.lockedAt),
    lockedByName: row.lockedByName,
    reopenedAt: iso(row.reopenedAt),
    reopenedByName: row.reopenedByName || "",
    reopenReason: row.reopenReason || ""
  }));

  if (!active) {
    const canLock = scope.wholeOrg && live.complete;
    return {
      ...live,
      openItems,
      lock: {
        state: "OPEN",
        canLock,
        /* Miks lukustada ei saa: kuu ei ole läbi või vaataja ei ole kogu asutuse hooldusjuht. */
        blocked: canLock ? null : !live.complete ? "NOT_OVER" : "SCOPE",
        openItemCount: openItemTotal(openItems),
        history
      }
    };
  }

  const after = await loadAfterLock(db, {
    organizationId,
    month: resolveCallMonth(live.month, now, timeZone),
    timeZone,
    lockedAt: active.lockedAt,
    clientScope: scope.wholeOrg ? null : { unitId: { in: scope.unitIds } }
  });
  const lock = {
    state: "LOCKED",
    canLock: false,
    blocked: null,
    lockedAt: iso(active.lockedAt),
    lockedByName: active.lockedByName,
    openItemCount: active.openItemCount,
    canReopen: scope.wholeOrg,
    snapshotShown: scope.wholeOrg,
    drift: null,
    after,
    history
  };
  if (!scope.wholeOrg) return { ...live, openItems, lock };

  const snapshot = asObject(active.snapshot);
  const limit = HOME_CARE_LIMITS.DEADLINE_CLIENTS_MAX;
  const rows = Array.isArray(snapshot.clients) ? snapshot.clients : [];
  const shownSnapshot = { ...snapshot, clients: rows.slice(0, limit) };
  const ids = [...new Set([...shownSnapshot.clients.map((row) => row.clientId), ...(Array.isArray(snapshot.missed) ? snapshot.missed : []).map((row) => row.clientId)])];
  const nameRows = ids.length
    ? await db.careClient.findMany({ where: { organizationId, id: { in: ids } }, select: { id: true, displayName: true, status: true } })
    : [];
  const names = new Map(nameRows.map((row) => [row.id, row]));
  return {
    ...live,
    ...summaryFromSnapshot(shownSnapshot, names),
    truncated: rows.length > limit,
    openItems,
    lock: { ...lock, drift: totalsDrift(snapshot.totals, live.totals) }
  };
}

/**
 * Lukustab kuu. Lukku läheb see, mida hooldusjuht nägi: ta saadab kaasa käikude arvu, aja ja
 * lahtiste asjade arvu (`seen`), ja kui need on vahepeal muutunud, lukku ei panda.
 */
export async function lockMonth(context, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  if (!coordinatorScope(context)?.wholeOrg) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
  const body = asObject(input);
  const month = requireMonth(body.month);
  const seen = asObject(body.seen);
  const organizationId = context.organization.id;

  const summary = await getMonthSummary(context, { month }, { db, now, env, clientLimit: HOME_CARE_LIMITS.MONTH_LOCK_CLIENTS_MAX });
  if (!summary.complete) throw conflict("home_care.errors.month_not_over");
  if (summary.truncated) throw conflict("home_care.errors.month_too_large");
  const openItems = await getMonthOpenItems(context, { month }, { db, now, env });
  const openCount = openItemTotal(openItems);
  if (seenNumber(seen.visits) !== summary.totals.visits || seenNumber(seen.minutes) !== summary.totals.minutes || seenNumber(seen.open) !== openCount) {
    throw conflict("home_care.errors.month_changed");
  }

  await db.$transaction(async (tx) => {
    /* Kaks samaaegset lukustamist: asutuse rida lukku, et teine näeks esimese rida. */
    await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;
    const existing = await tx.careMonthLock.findFirst({ where: { organizationId, month, reopenedAt: null }, select: { id: true } });
    if (existing) throw conflict("home_care.errors.month_already_locked");
    const row = await tx.careMonthLock.create({
      data: {
        organizationId,
        month,
        snapshot: snapshotOf(summary, openItems),
        openItemCount: openCount,
        lockedByMembershipId: context.membership?.id || null,
        lockedByName: await membershipDisplayName(tx, context),
        lockedAt: now
      },
      select: { id: true }
    });
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_MONTH_LOCK_CHANGED,
      resourceType: OrgAuditResource.CARE_MONTH_LOCK,
      resourceId: row.id,
      meta: { organizationId, change: "locked", clientCount: summary.clients.length }
    });
  });
  return getMonthPage(context, { month }, { db, now, env });
}

/** Avab lukustatud kuu uuesti. Põhjus on kohustuslik; lukk jääb ajalukku alles. */
export async function reopenMonth(context, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  if (!coordinatorScope(context)?.wholeOrg) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
  const body = asObject(input);
  const month = requireMonth(body.month);
  const reason = normalizeLine(body.reason, HOME_CARE_LIMITS.MONTH_REOPEN_REASON_MAX, { required: true, errorKey: "home_care.errors.month_reopen_reason" });
  const organizationId = context.organization.id;

  await db.$transaction(async (tx) => {
    const active = await tx.careMonthLock.findFirst({ where: { organizationId, month, reopenedAt: null }, select: { id: true } });
    if (!active) throw conflict("home_care.errors.month_not_locked");
    const changed = await tx.careMonthLock.updateMany({
      where: { id: active.id, reopenedAt: null },
      data: {
        reopenedAt: now,
        reopenedByMembershipId: context.membership?.id || null,
        reopenedByName: await membershipDisplayName(tx, context),
        reopenReason: reason
      }
    });
    if (changed.count !== 1) throw conflict("home_care.errors.month_not_locked");
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_MONTH_LOCK_CHANGED,
      resourceType: OrgAuditResource.CARE_MONTH_LOCK,
      resourceId: active.id,
      meta: { organizationId, change: "reopened" }
    });
  });
  return getMonthPage(context, { month }, { db, now, env });
}

/**
 * Tähtaegade vaatele: viimaste kuude kehtivad lukud, mille kuus on pärast lukustamist midagi
 * lisatud või muudetud. Ilma selleta märkaks hooldusjuht hilisemat kirjet alles siis, kui ta
 * juhtub vana kuu uuesti avama.
 */
export async function loadLockedMonthsChanged(db, context, { now = new Date() } = {}) {
  const scope = coordinatorScope(context);
  if (!scope) return [];
  const organizationId = context.organization.id;
  const timeZone = organizationTimeZone(context);
  const current = resolveCallMonth(undefined, now, timeZone);
  const earliest = shiftMonth(current, -HOME_CARE_LIMITS.MONTH_LOCK_WATCH_MONTHS);
  const locks = await db.careMonthLock.findMany({
    where: { organizationId, reopenedAt: null, month: { gte: monthText(earliest.year, earliest.month) } },
    select: { month: true, lockedAt: true },
    orderBy: [{ month: "desc" }],
    take: HOME_CARE_LIMITS.MONTH_LOCK_WATCH_MONTHS + 1
  });
  const changed = [];
  for (const lock of locks) {
    const [year, month] = lock.month.split("-").map(Number);
    const after = await loadAfterLock(db, {
      organizationId,
      month: { year, month },
      timeZone,
      lockedAt: lock.lockedAt,
      clientScope: scope.wholeOrg ? null : { unitId: { in: scope.unitIds } },
      withItems: false
    });
    if (after.total) changed.push({ month: lock.month, lockedAt: iso(lock.lockedAt), changes: after.total });
  }
  return changed;
}
