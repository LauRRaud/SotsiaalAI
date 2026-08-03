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
import { SERVICE_LOG_REPORT_KIND } from "./reportArchive.js";
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
        status: true,
        /* KINNITAMINE KOLIS SIIA, seega peab siin olema ka SISU. Kuu lõpus
           vaatab inimene koondi ja kinnitab korraga — aga ta ei tohi kinnitada
           rida, mille sisu ta ei näe. Märkus ja tema päritolu on täpselt see,
           mida ta üle vaatab: kas „kliendi öeldu" on tõesti kliendi öeldu. */
        note: true,
        noteProvenance: true,
        confirmedManually: true
        /* `travelMinutes` EI OLE skeemi väli, vaid tuletis
           (`deriveTravelMinutes`) — tema panek `select`-i oleks andnud
           `Unknown field` ja kogu kuuvaate 500-ga maha võtnud. Sama pere viga
           mis `User.name`: fake-prisma ei valideeri skeemi, seega roheline
           sviit ei tõenda ühtegi `select`-i. */
      },
      take: 5000
    }),
    /* LÕPETATUD SUUNAMINE EI TOHI KUUVAATEST KADUDA.
       Varem oli siin `status: "ACTIVE"` — kuu, mille SEES suunamine lõppes,
       kaotas oma jäägirea täpselt siis, kui teda kõige rohkem vaja on: lõpparve
       tehakse just sellest kuust. Nüüd tulevad kaasa aktiivsed JA need
       lõpetatud, millel on selles kuus kirjeid. */
    db.serviceReferral.findMany({
      where: {
        providerProfileId: profile.id,
        OR: [
          { status: "ACTIVE" },
          { entries: { some: { date: { gte: from, lt: to } } } }
        ]
      },
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

  /* ESITATUD ARUANDED. Kuni siiani ei näinud kuuvaade, kas selle kuu kohta on
     midagi üldse KOV-ile saadetud — eksport oli allalaadimine ja jäljetu. Nüüd
     on ta dokument (`reportArchive.js`) ja kuu enda vaade on esimene koht, kust
     inimene küsib „kas ma mai aruande juba saatsin".

     PÄRING KÄIB METAANDMETE JÄRGI, mitte pealkirja järgi: pealkiri on inimesele
     lugemiseks ja tema kuju võib muutuda. */
  const archivedReports = await db.userDocument.findMany({
    where: {
      ownerId: userId,
      kind: SERVICE_LOG_REPORT_KIND,
      metadata: { path: ["month"], equals: window }
    },
    select: { id: true, title: true, originalName: true, size: true, createdAt: true, metadata: true },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  /* KINNITAMATA ETTE. Kuu koond on tähtis, aga esimene küsimus kuu lõpus on
     „mis on veel kinnitamata" — need read otsustavad, kas eksport tuleb täis
     või tühi. */
  const monthEntries = entries
    .map((row) => ({
      id: row.id,
      date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
      clientDisplayName: row.clientDisplayName || null,
      clientExternalRef: row.clientExternalRef || null,
      unit: row.unit,
      quantity: row.quantity === null || row.quantity === undefined ? null : Number(row.quantity),
      status: row.status,
      note: row.note || null,
      noteProvenance: row.noteProvenance || null,
      confirmedManually: Boolean(row.confirmedManually)
    }))
    .sort((a, b) => {
      const draftFirst = (a.status === "DRAFT" ? 0 : 1) - (b.status === "DRAFT" ? 0 : 1);
      return draftFirst || a.date.localeCompare(b.date);
    });

  return {
    month: window,
    summary,
    entries: monthEntries,
    reports: archivedReports.map((row) => ({
      id: row.id,
      title: row.title,
      fileName: row.originalName,
      size: row.size,
      createdAt: row.createdAt?.toISOString?.() || null,
      template: row.metadata?.template || null,
      format: row.metadata?.format || null,
      kovName: row.metadata?.kovName || null,
      entryCount: row.metadata?.entryCount ?? null,
      issuedCount: Number(row.metadata?.issuedCount) || 1,
      lastIssuedAt: row.metadata?.lastIssuedAt || null
    })),
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
