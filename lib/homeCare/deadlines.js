/**
 * KODUTEENUS kiht 2, K2-c — tähtajad hooldusjuhile.
 *
 * Kuusteist nimekirja, mida juht muidu peab ise meeles pidama või tabelist otsima
 * (kava II.6.10 „Otsuse tähtajad"):
 *   1. otsused, mis lõpevad 60 päeva jooksul (30 päeva sees eraldi märgiga);
 *   2. kliendid, kellel täna kehtivat otsust ei ole;
 *   3. hoolduskavad, mille ülevaatuse päev on möödas või 30 päeva sees;
 *   4. kliendid, kellel kehtivat hoolduskava ei ole;
 *   5. töö iseloomu märked (K3-g), mille ülevaatuse päev on möödas või 30 päeva sees;
 *   6. täitmata eeltingimused enne teenuse algust (K4-a);
 *   7. kliendi raha, mis on töötaja käes olnud üle nädala (K4-c);
 *   8. kliendid, kellelt ei ole üle aasta tagasisidet küsitud (K4-d);
 *   9. viimase kolme kuu jooksul lõppenud teenused, mille kohta tagasisidet ei ole (K4-d);
 *  10. varud, mis hakkavad lõppema või on otsas (K4-e);
 *  11. kliendid, kes on olnud ajutiselt ära üle kuu (K4-g);
 *  12. märkamised, mis ootavad hooldusjuhi vastust (K5-a);
 *  13. töötajate koolitused ja taustakontrollid, mis on aegunud, aeguvad varsti või puuduvad (K5-e;
 *      ainult kogu asutuse hooldusjuhile);
 *  14. püsikaardi ohuread, mida ei ole aasta jooksul üle vaadatud (K5-f);
 *  15. lähedaste jagamiskokkulepped, mida ei ole poole aasta jooksul kliendilt üle küsitud (K5-k);
 *  16. ohutuskaardid, mis on täitmata või üle aasta vanad (K5-n).
 *
 * Loetakse teenusel olevaid ja ajutiselt ära olevaid kliente hooldusjuhi skoobis
 * (kogu asutus või tema üksuste alampuu). Lõppenud teenusega kliente ei loeta.
 * Vastuses on kliendi nimi ja päevad; otsuse ega kava sisu siin ei ole.
 */

import prisma from "@/lib/prisma";

import { forbidden } from "../org/errors.js";

import { assertHomeCareContext, coordinatorScope, organizationTimeZone } from "./access.js";
import {
  CARE_FEEDBACK_INCIDENT_TYPES,
  CareCardLineKind,
  CareClientStatus,
  CareEndReason,
  CareEntryKind,
  CarePlanStatus,
  HOME_CARE_COORDINATOR,
  HOME_CARE_LIMITS
} from "./constants.js";
import { loadOpenChangeSignals } from "./changes.js";
import { daysBetween, todayText } from "./decisions.js";
import { loadOpenBalances } from "./money.js";
import { serializePrecondition } from "./preconditions.js";
import { shiftDay } from "./slots.js";
import { loadOpenSupplies } from "./supplies.js";
import { loadRelativesDue } from "./relatives.js";
import { loadFirstVisitsAhead } from "./dayPlan.js";
import { loadDecisionNoticesDue } from "./decisionNotices.js";
import { loadLockedMonthsChanged, loadOverVolumeStreak } from "./monthLock.js";
import { loadSafetyDue } from "./safetyCard.js";
import { loadTransportOpen } from "./transport.js";
import { loadWorkerRecordsDue } from "./workerRecords.js";

const byDaysThenName = (a, b) => a.daysLeft - b.daysLeft || a.client.displayName.localeCompare(b.client.displayName, "et");

/**
 * Ühe kliendi otsuste seis tänase päeva suhtes. Eraldi funktsioon, et reeglit saaks
 * testida ilma andmebaasita.
 *
 * `coveredUntil` on viimane päev, milleni mõni kehtiv või tulevane otsus ulatub;
 * `null` tähendab, et kehtib tähtajatu otsus (või tähtajatu otsus on tulemas).
 */
export function decisionCoverage(decisions, today) {
  const live = decisions.filter((decision) => !decision.retractedAt);
  const inForce = live.filter((decision) => decision.validFrom <= today && (!decision.validUntil || decision.validUntil >= today));
  const upcoming = live.filter((decision) => decision.validFrom > today);
  const ended = live.filter((decision) => decision.validUntil && decision.validUntil < today);
  const latest = (rows, field) => rows.map((row) => row[field]).sort().at(-1) || null;
  const earliest = (rows, field) => rows.map((row) => row[field]).sort()[0] || null;

  if (!inForce.length) {
    return { inForce: false, lastEndedOn: latest(ended, "validUntil"), nextFrom: earliest(upcoming, "validFrom"), coveredUntil: null };
  }
  const chain = [...inForce, ...upcoming];
  const openEnded = chain.some((decision) => !decision.validUntil);
  return { inForce: true, lastEndedOn: null, nextFrom: null, coveredUntil: openEnded ? null : latest(chain, "validUntil") };
}

/**
 * Kas kliendilt on aeg tagasisidet küsida (puhas reegel, K4-d). Tagasisidet küsitakse
 * vähemalt kord aastas; kliendilt, kellelt ei ole kordagi küsitud, esimest korda siis,
 * kui teenus on kestnud kolm kuud. `days` on päevi viimasest tagasisidest või teenuse
 * algusest.
 */
export function feedbackDue({ startedOn, lastFeedbackOn, today }) {
  if (lastFeedbackOn) {
    const days = daysBetween(lastFeedbackOn, today);
    return { due: days > HOME_CARE_LIMITS.FEEDBACK_EVERY_DAYS, days };
  }
  const days = daysBetween(startedOn, today);
  return { due: days >= HOME_CARE_LIMITS.FEEDBACK_FIRST_DAYS, days };
}

export async function getDeadlines(context, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const scope = coordinatorScope(context);
  if (!scope) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });

  const today = todayText(now, organizationTimeZone(context));
  const limit = HOME_CARE_LIMITS.DEADLINE_CLIENTS_MAX;
  const rows = await db.careClient.findMany({
    where: {
      organizationId: context.organization.id,
      status: { in: [CareClientStatus.ACTIVE, CareClientStatus.AWAY] },
      ...(scope.wholeOrg ? {} : { unitId: { in: scope.unitIds } })
    },
    select: {
      id: true,
      displayName: true,
      status: true,
      statusReason: true,
      statusChangedAt: true,
      createdAt: true,
      decisions: { where: { retractedAt: null }, select: { validFrom: true, validUntil: true, retractedAt: true } },
      carePlans: { where: { status: CarePlanStatus.ACTIVE }, select: { number: true, reviewOn: true } },
      workNatures: { where: { endedAt: null }, select: { reviewOn: true } },
      /* Kehtivad ohuread püsikaardil (K5-f): vanima vanuse järgi tuleb ülevaatus. */
      cardLines: { where: { endedAt: null, kind: CareCardLineKind.RISK }, select: { createdAt: true } },
      preconditions: {
        where: { closedAt: null },
        select: { id: true, kind: true, note: true, responsible: true, dueOn: true, createdByName: true, createdAt: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      }
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: limit + 1
  });

  const decisionsEnding = [];
  const noDecision = [];
  const plansDue = [];
  const noPlan = [];
  const workNatureDue = [];
  const preconditionsOpen = [];
  /* Ohuread, mida ei ole aasta jooksul üle vaadatud (K5-f, kava II.6.4): kõige vanem ees. */
  const riskLinesDue = [];
  for (const row of rows.slice(0, limit)) {
    const client = { id: row.id, displayName: row.displayName, status: row.status };
    if (row.cardLines.length) {
      const oldestOn = row.cardLines.map((line) => todayText(line.createdAt, organizationTimeZone(context))).sort()[0];
      const days = daysBetween(oldestOn, today);
      if (days > HOME_CARE_LIMITS.RISK_LINE_REVIEW_DAYS) riskLinesDue.push({ client, lines: row.cardLines.length, oldestOn, days });
    }
    const coverage = decisionCoverage(row.decisions, today);
    if (!coverage.inForce) {
      noDecision.push({ client, lastEndedOn: coverage.lastEndedOn, nextFrom: coverage.nextFrom });
    } else if (coverage.coveredUntil) {
      const daysLeft = daysBetween(today, coverage.coveredUntil);
      if (daysLeft <= HOME_CARE_LIMITS.DEADLINE_LATER_DAYS) {
        decisionsEnding.push({ client, validUntil: coverage.coveredUntil, daysLeft, soon: daysLeft <= HOME_CARE_LIMITS.DEADLINE_SOON_DAYS });
      }
    }

    const plan = row.carePlans[0] || null;
    if (!plan) {
      noPlan.push({ client });
    } else if (plan.reviewOn) {
      const daysLeft = daysBetween(today, plan.reviewOn);
      if (daysLeft <= HOME_CARE_LIMITS.DEADLINE_SOON_DAYS) {
        plansDue.push({ client, planNumber: plan.number, reviewOn: plan.reviewOn, daysLeft, overdue: daysLeft < 0 });
      }
    }

    /* Töö iseloomu märge (K3-g), mille ülevaatuse päev on möödas või 30 päeva sees. */
    const reviewOn = row.workNatures[0]?.reviewOn || null;
    if (reviewOn) {
      const daysLeft = daysBetween(today, reviewOn);
      if (daysLeft <= HOME_CARE_LIMITS.DEADLINE_SOON_DAYS) workNatureDue.push({ client, reviewOn, daysLeft, overdue: daysLeft < 0 });
    }

    /* Täitmata eeltingimused enne teenuse algust (K4-a): kõik, ka ilma tähtajata. */
    for (const precondition of row.preconditions) preconditionsOpen.push({ client, ...serializePrecondition(precondition, today) });
  }

  /* TAGASISIDE (K4-d). Viimane tagasiside kirje (kaebus, tänu või suuline tagasiside) kliendi kaupa. */
  const timeZone = organizationTimeZone(context);
  const organizationId = context.organization.id;
  const unitScope = scope.wholeOrg ? {} : { unitId: { in: scope.unitIds } };
  const endedSince = new Date(now.getTime() - HOME_CARE_LIMITS.FEEDBACK_END_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  /* Viimase kolme kuu jooksul lõppenud teenused; surma korral tagasisidet siin ei küsita. */
  const endings = await db.careClientStatusChange.findMany({
    where: {
      organizationId,
      toStatus: CareClientStatus.ENDED,
      changedAt: { gte: endedSince },
      /* Vanal lõppenud kliendil võib alus puududa: `not` jätaks NULL-i välja, seega on see eraldi kirjas. */
      client: { status: CareClientStatus.ENDED, OR: [{ statusReason: null }, { statusReason: { not: CareEndReason.DIED } }], ...unitScope }
    },
    select: { clientId: true, changedAt: true, reason: true, client: { select: { displayName: true, status: true } } },
    orderBy: [{ changedAt: "desc" }, { id: "desc" }],
    take: limit
  });
  const endedOf = new Map();
  for (const row of endings) if (!endedOf.has(row.clientId)) endedOf.set(row.clientId, row);
  const feedbackClientIds = [...rows.slice(0, limit).map((row) => row.id), ...endedOf.keys()];
  const feedbackRows = feedbackClientIds.length
    ? await db.careClientEntry.groupBy({
        by: ["clientId"],
        where: {
          organizationId,
          clientId: { in: feedbackClientIds },
          kind: CareEntryKind.INCIDENT,
          incidentType: { in: [...CARE_FEEDBACK_INCIDENT_TYPES] },
          retractedAt: null
        },
        _max: { occurredAt: true }
      })
    : [];
  const lastFeedbackOf = new Map(feedbackRows.map((row) => [row.clientId, row._max.occurredAt ? todayText(row._max.occurredAt, timeZone) : null]));

  /* Ajutiselt ära üle kuu (K4-g, kava II.6.5): aeg meelde tuletada teenuse peatamise avaldust. */
  const awayLong = [];
  for (const row of rows.slice(0, limit)) {
    if (row.status !== CareClientStatus.AWAY || !row.statusChangedAt) continue;
    const since = todayText(row.statusChangedAt, timeZone);
    const days = daysBetween(since, today);
    if (days > HOME_CARE_LIMITS.AWAY_REMINDER_DAYS) {
      awayLong.push({ client: { id: row.id, displayName: row.displayName, status: row.status }, since, days, reason: row.statusReason || null });
    }
  }

  const feedbackOverdue = [];
  for (const row of rows.slice(0, limit)) {
    const lastOn = lastFeedbackOf.get(row.id) || null;
    const state = feedbackDue({ startedOn: todayText(row.createdAt, timeZone), lastFeedbackOn: lastOn, today });
    if (state.due) feedbackOverdue.push({ client: { id: row.id, displayName: row.displayName, status: row.status }, lastOn, days: state.days });
  }
  const feedbackAtEnd = [];
  for (const [clientId, ending] of endedOf) {
    const endedOn = todayText(ending.changedAt, timeZone);
    const lastOn = lastFeedbackOf.get(clientId) || null;
    /* Loeb tagasiside, mis on kirjas alates kuu enne teenuse lõppu. */
    if (lastOn && lastOn >= shiftDay(endedOn, -HOME_CARE_LIMITS.FEEDBACK_END_LOOKBACK_DAYS)) continue;
    feedbackAtEnd.push({ client: { id: clientId, displayName: ending.client.displayName, status: ending.client.status }, endedOn, lastOn });
  }

  /* Varud, mis hakkavad lõppema või on otsas (K4-e): teenusel ja ajutiselt ära olevate klientide omad. */
  const suppliesOpen = await loadOpenSupplies(db, organizationId, {
    status: { in: [CareClientStatus.ACTIVE, CareClientStatus.AWAY] },
    ...unitScope
  });

  /* Kliendi raha, mis on töötaja käes olnud üle nädala (K4-c); ka lõppenud teenusega kliendi oma. */
  const moneyOpen = await loadOpenBalances(db, context.organization.id, scope.wholeOrg ? {} : { unitId: { in: scope.unitIds } }, today);

  /* Märkamised, mis ootavad vastust (K5-a): kõige kauem oodanu ees. */
  const changesOpen = await loadOpenChangeSignals(db, context.organization.id, scope.wholeOrg ? {} : { unitId: { in: scope.unitIds } }, { now, timeZone });

  return {
    today,
    clientCount: Math.min(rows.length, limit),
    changesOpen,
    truncated: rows.length > limit,
    decisionsEnding: decisionsEnding.sort(byDaysThenName),
    noDecision,
    plansDue: plansDue.sort(byDaysThenName),
    noPlan,
    workNatureDue: workNatureDue.sort(byDaysThenName),
    /* Tähtajaga enne (varasem ees), tähtajata lõpus. */
    preconditionsOpen: preconditionsOpen.sort(
      (a, b) =>
        (a.daysLeft === null) - (b.daysLeft === null) ||
        (a.daysLeft ?? 0) - (b.daysLeft ?? 0) ||
        a.client.displayName.localeCompare(b.client.displayName, "et")
    ),
    moneyOpen,
    suppliesOpen,
    /* Esmakäigud lähipäevil, mille kohta kliendile ei ole teatatud (K6-c). */
    firstVisitsAhead: await loadFirstVisitsAhead(db, {
      organizationId: context.organization.id,
      timeZone: organizationTimeZone(context),
      now,
      clientWhere: scope.wholeOrg ? {} : { unitId: { in: scope.unitIds } }
    }),
    /* Transpordi soovid, mis ootavad korraldamist (K5-w): teenusel olevate klientide omad, varasem sõit ees. */
    transportOpen: await loadTransportOpen(
      db,
      context.organization.id,
      { status: { in: [CareClientStatus.ACTIVE, CareClientStatus.AWAY] }, ...(scope.wholeOrg ? {} : { unitId: { in: scope.unitIds } }) },
      { today }
    ),
    /* Teated otsustajale (K5-r): vastuseta teated ja lubatud uus hindamine, mille päev on möödas. */
    ...(await loadDecisionNoticesDue(db, context.organization.id, scope.wholeOrg ? {} : { unitId: { in: scope.unitIds } }, { today })),
    /* Lukustatud kuud, kuhu on hiljem lisatud või muudetud (K5-p). */
    monthLocksChanged: await loadLockedMonthsChanged(db, context, { now }),
    /* Osutatud aeg kolm lukustatud kuud järjest üle otsustatu (K5-q). */
    overVolumeStreak: await loadOverVolumeStreak(db, context, { now }),
    /* Töötajate kaardid (K5-e): üksuse hooldusjuhile tühi nimekiri. */
    workerRecordsDue: await loadWorkerRecordsDue(db, context, today),
    safetyDue: await loadSafetyDue(db, context.organization.id, scope.wholeOrg ? {} : { unitId: { in: scope.unitIds } }, { today, timeZone: organizationTimeZone(context) }),
    relativesDue: await loadRelativesDue(db, context.organization.id, { status: { in: [CareClientStatus.ACTIVE, CareClientStatus.AWAY] }, ...(scope.wholeOrg ? {} : { unitId: { in: scope.unitIds } }) }, today),
    riskLinesDue: riskLinesDue.sort((a, b) => b.days - a.days || a.client.displayName.localeCompare(b.client.displayName, "et")),
    awayLong: awayLong.sort((a, b) => b.days - a.days || a.client.displayName.localeCompare(b.client.displayName, "et")),
    /* Kauem küsimata enne; ilma ühegi tagasisideta kliendid teenuse kestuse järgi. */
    feedbackOverdue: feedbackOverdue.sort((a, b) => b.days - a.days || a.client.displayName.localeCompare(b.client.displayName, "et")),
    feedbackAtEnd: feedbackAtEnd.sort((a, b) => (a.endedOn < b.endedOn ? 1 : a.endedOn > b.endedOn ? -1 : a.client.displayName.localeCompare(b.client.displayName, "et")))
  };
}
