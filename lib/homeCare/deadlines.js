/**
 * KODUTEENUS kiht 2, K2-c — tähtajad hooldusjuhile.
 *
 * Kuus nimekirja, mida juht muidu peab ise meeles pidama või tabelist otsima
 * (kava II.6.10 „Otsuse tähtajad"):
 *   1. otsused, mis lõpevad 60 päeva jooksul (30 päeva sees eraldi märgiga);
 *   2. kliendid, kellel täna kehtivat otsust ei ole;
 *   3. hoolduskavad, mille ülevaatuse päev on möödas või 30 päeva sees;
 *   4. kliendid, kellel kehtivat hoolduskava ei ole;
 *   5. töö iseloomu märked (K3-g), mille ülevaatuse päev on möödas või 30 päeva sees;
 *   6. täitmata eeltingimused enne teenuse algust (K4-a).
 *
 * Loetakse teenusel olevaid ja ajutiselt ära olevaid kliente hooldusjuhi skoobis
 * (kogu asutus või tema üksuste alampuu). Lõppenud teenusega kliente ei loeta.
 * Vastuses on kliendi nimi ja päevad; otsuse ega kava sisu siin ei ole.
 */

import prisma from "@/lib/prisma";

import { forbidden } from "../org/errors.js";

import { assertHomeCareContext, coordinatorScope, organizationTimeZone } from "./access.js";
import { CareClientStatus, CarePlanStatus, HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { daysBetween, todayText } from "./decisions.js";
import { serializePrecondition } from "./preconditions.js";

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
      decisions: { where: { retractedAt: null }, select: { validFrom: true, validUntil: true, retractedAt: true } },
      carePlans: { where: { status: CarePlanStatus.ACTIVE }, select: { number: true, reviewOn: true } },
      workNatures: { where: { endedAt: null }, select: { reviewOn: true } },
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
  for (const row of rows.slice(0, limit)) {
    const client = { id: row.id, displayName: row.displayName, status: row.status };
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

  return {
    today,
    clientCount: Math.min(rows.length, limit),
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
    )
  };
}
