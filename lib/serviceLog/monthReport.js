/**
 * TEENUSPÄEVIK-V1 E4 — kuuvaate lugemiskiht.
 *
 * `monthlyView.js` jääb PUHTAKS (koondamine, tähtajad, rütmid). Siin on ainus
 * asi, mida seal olla ei tohi: andmebaas. See vahe hoiab kuu summade loogika
 * testitavana ilma DB-ta — ja kuu summad on arve alus.
 */

import { prisma } from "@/lib/prisma";
import { assertServiceLogEnabled } from "./flags.js";
import { requireWritableProfile } from "./entries.js";
import { computeReferralBalance } from "./saldo.js";
import {
  buildMonthlySummary,
  evaluateAnnualRhythms,
  evaluateReportRhythm,
  parseMonth
} from "./monthlyView.js";
import { badRequest } from "./errors.js";

function currentMonth(now) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Kuu terviklik pilt: koond, suunamiste jäägid ja rütm ÜHES vastuses.
 *
 * Kolm eraldi päringut tähendaks kolme kohta, kus vaade võib jääda poolikuks —
 * ja kuu lõpp on täpselt see hetk, mil poolik pilt maksab raha.
 */
export async function getMonthlyReport(
  userId,
  { month = null } = {},
  { db = prisma, env = process.env, now = new Date() } = {}
) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const window = month || currentMonth(now);
  if (!parseMonth(window)) throw badRequest("service_log.errors.month_invalid");

  const parsed = parseMonth(window);
  const from = new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
  const to = new Date(Date.UTC(parsed.year, parsed.month, 1));

  const [entries, referrals] = await Promise.all([
    db.serviceEntry.findMany({
      where: { providerProfileId: profile.id, date: { gte: from, lt: to } },
      select: {
        id: true,
        clientUserId: true,
        clientDisplayName: true,
        clientExternalRef: true,
        serviceId: true,
        referralId: true,
        unit: true,
        quantity: true,
        date: true,
        status: true
      },
      take: 5000
    }),
    db.serviceReferral.findMany({
      where: { providerProfileId: profile.id, status: "ACTIVE" },
      take: 500
    })
  ]);

  /* Saldo vajab KÕIKI selle suunamise kirjeid, mitte ainult selle kuu omi:
     `TOTAL`-mahuga suunamise jääk arvestab tervet perioodi. Kuu-filtriga
     entries andmine annaks perioodipõhisel suunamisel liiga suure jäägi. */
  const referralEntries = referrals.length
    ? await db.serviceEntry.findMany({
        where: { providerProfileId: profile.id, referralId: { in: referrals.map((row) => row.id) } },
        select: { referralId: true, unit: true, quantity: true, date: true, status: true },
        take: 5000
      })
    : [];

  const summary = buildMonthlySummary(entries, { month: window });

  return {
    month: window,
    summary,
    referrals: referrals.map((referral) => ({
      id: referral.id,
      kovName: referral.kovName,
      clientDisplayName: referral.clientDisplayName || null,
      clientUserId: referral.clientUserId || null,
      unit: referral.unit,
      balance: computeReferralBalance(referral, referralEntries, { month: window })
    })),
    rhythm: evaluateReportRhythm(window, {
      now,
      unconfirmed: summary.unconfirmed
    }),
    /* Aastased rütmid kannavad `source: "quality_guide"`. UI PEAB selle välja
       kuvama — vale vastavusväide töövahendis on tõsisem viga kui puuduv
       meeldetuletus. */
    annualRhythms: evaluateAnnualRhythms({ now })
  };
}
