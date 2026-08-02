/**
 * TEENUSPÄEVIK E7 — kliendi enda kuuvaade ja digikinnitus.
 *
 * LÜLITI TAGA JA VAIKIMISI VÄLJAS (omaniku otsus nr 2, leping 8.8). Siin on
 * kogu funktsioon valmis ehitatud; omaniku otsus on ainult `SERVICE_LOG_CLIENT_VIEW`
 * keeramine. Nii ei ole „kas klient näeb" enam arendusküsimus.
 *
 * KLIENT NÄEB VÄHEM KUI OSUTAJA — teadlikult:
 *
 *   ei näe `note`-t ega `noteProvenance`-t. Märge on osutaja FAKTIMÄRGE aruande
 *   jaoks („uks ei avanenud", „poeg oli kohal") ja tema lugemine kliendi poolt
 *   muudaks selle märke sisu: osutaja hakkaks kirjutama kliendile, mitte
 *   aruandele. Sisuline aruanne (mall C) on eraldi asi ja käib eraldi teed.
 *
 *   ei näe teisi kliente ega osutaja mahtusid. Skoop on `clientUserId = userId`
 *   — mitte suunamise, mitte profiili, mitte KOV-i kaupa.
 *
 * AINULT KINNITATUD KIRJED. Mustand on osutaja pooleliolev töö; kliendile
 * näitamine tähendaks, et ta näeb numbrit, mis võib veel muutuda, ja kinnitab
 * midagi, mida ei ole veel olemas.
 */

import { prisma } from "@/lib/prisma";
import { ENTRY_STATUS } from "./constants.js";
import { assertServiceLogEnabled, isServiceLogClientViewEnabled } from "./flags.js";
import { ServiceLogDisabledError } from "./flags.js";
import { badRequest } from "./errors.js";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Väljas kliendivaade vastab TÄPSELT nagu väljas peavärav: 404, mitte 403.
 * Kliendile ei tohi paista, et tema andmetega on kuskil vaade olemas, mida
 * talle lihtsalt ei näidata.
 */
function assertClientViewEnabled(env) {
  assertServiceLogEnabled(env);
  if (!isServiceLogClientViewEnabled(env)) throw new ServiceLogDisabledError();
}

function monthBounds(month) {
  if (!MONTH_PATTERN.test(String(month || ""))) throw badRequest("service_log.errors.month_invalid");
  const [year, index] = String(month).split("-").map(Number);
  return {
    from: new Date(Date.UTC(year, index - 1, 1)),
    to: new Date(Date.UTC(index === 12 ? year + 1 : year, index === 12 ? 0 : index, 1))
  };
}

/** Kliendi vaate projektsioon. Iga väli siin on TEADLIK valik, mitte jääk. */
function toClientRow(row) {
  return {
    id: row.id,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
    unit: row.unit,
    quantity: row.quantity === null || row.quantity === undefined ? null : Number(row.quantity),
    /* Osutaja nimi on kliendile vajalik: ta peab teadma, KES tema juures käis. */
    providerName: row.providerProfile?.organizationName || null,
    confirmedByClientAt: row.confirmedByClientAt?.toISOString?.() || null
  };
}

export async function readClientMonth(
  userId,
  { month } = {},
  { db = prisma, env = process.env } = {}
) {
  assertClientViewEnabled(env);
  const { from, to } = monthBounds(month);

  const rows = await db.serviceEntry.findMany({
    where: {
      clientUserId: userId,
      status: ENTRY_STATUS.FINAL,
      date: { gte: from, lt: to }
    },
    select: {
      id: true,
      date: true,
      unit: true,
      quantity: true,
      confirmedByClientAt: true,
      providerProfile: { select: { organizationName: true } }
    },
    orderBy: { date: "asc" },
    take: 500
  });

  const entries = rows.map(toClientRow);
  const totals = {};
  for (const entry of entries) {
    if (!entry.unit) continue;
    totals[entry.unit] = Math.round(((totals[entry.unit] || 0) + (entry.quantity || 0)) * 100) / 100;
  }

  return {
    month,
    entries,
    totals,
    /* Kuu on kinnitatud siis, kui KÕIK read on kinnitatud. Osaline kinnitus ei
       ole kinnitus — ja tühja kuud ei saa kinnitatuks lugeda. */
    confirmed: entries.length > 0 && entries.every((entry) => entry.confirmedByClientAt),
    confirmedCount: entries.filter((entry) => entry.confirmedByClientAt).length
  };
}

/**
 * Digikinnitus (U10 muster): klient kinnitab, et kuu kirjed vastavad sellele,
 * mis tegelikult toimus.
 *
 * KINNITUS ON PÖÖRDUMATU JA AINULT ÜHES SUUNAS. Tagasivõtmist siin ei ole:
 * kinnitatud arve alusdokumendi vaikne „ei kinnitanud siiski" jätaks osutaja
 * olukorda, kus ta ei tea, mille alusel ta arve esitas. Vaidluse koht on
 * inimeste vahel, mitte nupu all.
 *
 * KORDUSKINNITUS EI OLE VIGA. Kaks vajutust või kordussaatmine annavad sama
 * tulemuse; `updateMany` ei puuduta juba kinnitatud ridu.
 */
export async function confirmClientMonth(
  userId,
  { month } = {},
  { db = prisma, env = process.env } = {}
) {
  assertClientViewEnabled(env);
  const { from, to } = monthBounds(month);

  const result = await db.serviceEntry.updateMany({
    where: {
      clientUserId: userId,
      status: ENTRY_STATUS.FINAL,
      date: { gte: from, lt: to },
      confirmedByClientAt: null
    },
    data: { confirmedByClientAt: new Date() }
  });

  return { month, confirmedNow: result.count };
}
