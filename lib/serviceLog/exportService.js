/**
 * TEENUSPÄEVIK-V1 E6 — ekspordi lugemiskiht.
 *
 * MITME KOV-i TUGI ON SIIN (DoD punkt 3): eksport filtreeritakse SAAJA järgi,
 * mitte kogu kuu pealt. Mitut KOV-i teenindav osutaja sisestab ÜHE korra ja
 * ekspordib igaühele ainult tema read — see on kogu mooduli müügiargument ja
 * ta ei tohi olla kutsuja hoolsuse küsimus.
 */

import { prisma } from "@/lib/prisma";
import { assertServiceLogEnabled } from "./flags.js";
import { badRequest, notFound } from "./errors.js";
import { requireWritableProfile } from "./entries.js";
import { parseMonth } from "./monthlyView.js";
import { TEMPLATE, buildDocument, isTemplate } from "./export/templates.js";
import { documentToCsv } from "./export/csv.js";

function periodBounds(month) {
  const parsed = parseMonth(month);
  if (!parsed) throw badRequest("service_log.errors.month_invalid");
  return {
    from: new Date(Date.UTC(parsed.year, parsed.month - 1, 1)),
    to: new Date(Date.UTC(parsed.year, parsed.month, 1)),
    year: parsed.year,
    monthNumber: parsed.month
  };
}

/**
 * Kogub ühe ekspordi jaoks kõik andmed ja ehitab dokumendi.
 *
 * @param options.kovName  SAAJA. Kui antud, lähevad eksporti ainult selle
 *   saaja suunamiste kirjed. Ilma selleta läheb kogu kuu — see on lubatud
 *   (osutaja oma ülevaade), aga EI OLE KOV-ile esitatav fail.
 */
export async function buildServiceLogExport(
  userId,
  { month, template, kovName = null, referralId = null, variant, includeDrafts = false, includeClientConfirmation = false, includeTravelTime = false } = {},
  { db = prisma, env = process.env } = {}
) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  if (!isTemplate(template)) throw badRequest("service_log.errors.template_invalid");
  const period = periodBounds(month);

  const profileRow = await db.serviceProviderProfile.findUnique({
    where: { id: profile.id },
    select: { organizationName: true, registryCode: true }
  });

  const referrals = await db.serviceReferral.findMany({
    where: {
      providerProfileId: profile.id,
      ...(kovName ? { kovName } : {}),
      ...(referralId ? { id: referralId } : {})
    },
    select: {
      id: true,
      kovName: true,
      referralNumber: true,
      goalsText: true,
      clientDisplayName: true,
      clientUserId: true
    }
  });

  /* Saaja-filtriga eksport EI TOHI vaikselt kogu kuud anda, kui sellel saajal
     suunamisi ei ole — see oleks andmeleke teise KOV-i ridadest. */
  if ((kovName || referralId) && !referrals.length) {
    throw notFound("service_log.errors.referral_not_found");
  }

  const referralIds = referrals.map((row) => row.id);
  /* VAIKNE PIIR ON HALVEM KUI PUUDUV FAIL. Küsime ÜHE rea rohkem, kui lubame
     eksporti — nii saame aru, kas piir sai täis, ja ütleme selle välja.
     Poolik fail ilma hoiatuseta näeks välja nagu terviklik esitis. */
  const EXPORT_ROW_LIMIT = 5000;
  const fetched = await db.serviceEntry.findMany({
    where: {
      providerProfileId: profile.id,
      date: { gte: period.from, lt: period.to },
      ...(kovName || referralId ? { referralId: { in: referralIds } } : {})
    },
    include: { service: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    take: EXPORT_ROW_LIMIT + 1
  });
  const truncated = fetched.length > EXPORT_ROW_LIMIT;
  const entries = truncated ? fetched.slice(0, EXPORT_ROW_LIMIT) : fetched;

  const referralById = new Map(referrals.map((row) => [row.id, row]));
  const enriched = entries.map((entry) => ({
    ...entry,
    serviceName: entry.service?.name || null,
    referralNumber: referralById.get(entry.referralId)?.referralNumber || null,
    quantity: entry.quantity === null || entry.quantity === undefined ? null : Number(entry.quantity),
    moneyAmount:
      entry.moneyAmount === null || entry.moneyAmount === undefined ? null : Number(entry.moneyAmount)
  }));

  let narrative = null;
  let narrativeReferral = null;
  if (template === TEMPLATE.C_NARRATIVE) {
    /* Mall C on ÜHE kliendi lugu, mitte kuu koond — ilma suunamiseta ei ole
       teada, kelle loost jutt käib. */
    if (!referralId) throw badRequest("service_log.errors.referral_required_for_narrative");
    narrativeReferral = referralById.get(referralId) || null;
    narrative = await db.serviceMonthlyNarrative.findFirst({
      where: {
        providerProfileId: profile.id,
        referralId,
        periodYear: period.year,
        periodMonth: period.monthNumber
      }
    });
  }

  /* P0 PARANDUS. Varem oli siin `kovName || referrals[0]?.kovName` — ilma
     saajata eksport võttis KOGU kuu kirjed, aga kirjutas päisesse ESIMESE
     suunamise KOV-i nime. Tulemus oli fail nimega „Tallinna vald", milles on
     ka Tartu kliendid: väliselt korrektne esitis, sisuliselt andmeleke.

     Nüüd on saajata eksport SELGELT osutaja OMA ülevaade: päises ei ole ühegi
     KOV-i nime ja dokument kannab hoiatust, et teda ei tohi KOV-ile esitada.
     Nime laenamine oli vaikne viga; nime puudumine on nähtav. */
  const isSingleRecipient = Boolean(kovName || referralId);
  const recipientName = kovName || (referralId ? referrals[0]?.kovName || "" : "");

  const document = buildDocument(template, {
    provider: { name: profileRow?.organizationName || "", registryCode: profileRow?.registryCode || "" },
    recipient: { name: recipientName, isSingleRecipient },
    period: {
      from: period.from.toISOString().slice(0, 10),
      to: new Date(period.to.getTime() - 1).toISOString().slice(0, 10)
    },
    entries: enriched,
    referral: narrativeReferral,
    narrative,
    variant,
    includeDrafts,
    includeClientConfirmation,
    includeTravelTime
  });

  if (truncated) {
    document.warnings = [
      ...(document.warnings || []),
      { code: "row_limit_reached", count: EXPORT_ROW_LIMIT }
    ];
  }

  return { document, month, template };
}

/**
 * Failinimi. ASCII-turvaline ja BAITIDES lühike — projekt on juba kord kinni
 * maksnud selle, et deploy kukkus 269-baidise failinime taha (ext4 piir on
 * 255). Ümbertranslitereerimine on siin ettevaatus, mitte ilu.
 */
export function exportFileName({ month, template, kovName, extension = "csv" }) {
  const safeKov = String(kovName || "koond")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .toLowerCase();
  const safeTemplate = String(template).toLowerCase().replace(/_/g, "-");
  /* Laiend tuleb VORMINGUST, mitte konstandist. Varem oli ".csv" siia
     sisse kirjutatud — DOCX-fail oleks laadinud alla nimega ".csv" ja Word
     oleks keeldunud teda avamast. */
  const safeExtension = /^[a-z0-9]{2,5}$/.test(String(extension)) ? String(extension) : "csv";
  return `teenuspaevik-${safeTemplate}-${month}-${safeKov || "koond"}.${safeExtension}`;
}

export function exportToCsv(document, options = {}) {
  return documentToCsv(document, options);
}
