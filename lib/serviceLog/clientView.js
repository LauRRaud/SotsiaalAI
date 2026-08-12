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

import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { ENTRY_STATUS } from "./constants.js";
import { assertServiceLogEnabled, isServiceLogClientViewEnabled } from "./flags.js";
import { ServiceLogDisabledError } from "./flags.js";
import { badRequest, conflict } from "./errors.js";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Kuvapiir. Ta on olemas, et üks kuu ei tooks tuhandeid ridu, ja tema kõrval
 * käib `totalCount`: klient ei tohi kinnitada rohkem, kui talle näidati.
 */
export const CLIENT_VIEW_LIMIT = 500;

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

function snapshotValue(row) {
  return {
    id: row.id,
    date: row.date instanceof Date ? row.date.toISOString() : String(row.date || ""),
    unit: row.unit || null,
    quantity: row.quantity === null || row.quantity === undefined ? null : String(row.quantity),
    providerName: row.providerProfile?.organizationName || null
  };
}

/**
 * Võti seob kinnituse just kliendile näidatud dokumendiga. Kinnituse enda
 * ajatempel ei kuulu võtmesse: sama POST-i turvaline kordamine peab jääma
 * idempotentseks, kuid uus rida või nähtava sisu muutus peab võtme muutma.
 */
export function buildClientMonthSnapshotToken(rows = []) {
  const canonical = rows
    .map(snapshotValue)
    .sort((left, right) => left.id.localeCompare(right.id));
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
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
    take: CLIENT_VIEW_LIMIT
  });

  /* KUVATU JA KINNITATAV PEAVAD KOKKU LANGEMA. Vaade näitas kuni 500 rida, aga
     kinnitus käis KÕIGI kuu ridade peale — kuu, milles on rohkem ridu, oleks
     kinnitatud osaliselt nähtamatuna. Loeme tegeliku arvu ja ütleme selle
     välja; kinnitusnupp on peidus, kuni kõik read on nähtavad. */
  const totalCount = await db.serviceEntry.count({
    where: {
      clientUserId: userId,
      status: ENTRY_STATUS.FINAL,
      date: { gte: from, lt: to }
    }
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
    confirmedCount: entries.filter((entry) => entry.confirmedByClientAt).length,
    totalCount,
    snapshotToken: totalCount > entries.length ? null : buildClientMonthSnapshotToken(rows),
    /* Kui ridu on rohkem kui kuvatud, EI TOHI kinnitada: klient kinnitaks
       midagi, mida ta ei näinud. */
    truncated: totalCount > entries.length
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
  { month, snapshotToken } = {},
  { db = prisma, env = process.env } = {}
) {
  assertClientViewEnabled(env);
  const { from, to } = monthBounds(month);
  const expectedSnapshot = String(snapshotToken || "").trim();
  if (!expectedSnapshot) throw badRequest("service_log.errors.client_snapshot_required");

  try {
    return await db.$transaction(
      async (tx) => {
        /* PostgreSQLi SHARE-lukk sulgeb fantoomirea akna: FINAL-rea loomine või
           finaliseerimine ootab selle lühikese kinnitustehingu lõpuni. Ilma
           selleta võiks serialiseeritav snapshot tehingu lihtsalt uue rea EELSEKS
           järjestada ja 409 asemel edu anda. */
        if (typeof tx.$executeRawUnsafe === "function") {
          await tx.$executeRawUnsafe('LOCK TABLE "ServiceEntry" IN SHARE MODE');
        }
        /* ID-LOEND KÜLMUTATAKSE ENNE KIRJUTUST. Kuu tingimusega `updateMany`
           kinnitaks ka rea, mis lisandus selle kontrolli järel; ID-dega kirjutus
           saab puudutada ainult seda dokumenti, mida klient tegelikult nägi. */
        const rows = await tx.serviceEntry.findMany({
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
          orderBy: [{ date: "asc" }, { id: "asc" }],
          take: CLIENT_VIEW_LIMIT + 1
        });
        if (rows.length > CLIENT_VIEW_LIMIT) {
          throw badRequest("service_log.errors.client_month_too_large");
        }
        if (buildClientMonthSnapshotToken(rows) !== expectedSnapshot) {
          throw conflict("service_log.errors.client_month_changed");
        }

        const frozenIds = rows.map((row) => row.id);
        if (!frozenIds.length) return { month, confirmedNow: 0 };

        const result = await tx.serviceEntry.updateMany({
          where: {
            id: { in: frozenIds },
            clientUserId: userId,
            status: ENTRY_STATUS.FINAL,
            date: { gte: from, lt: to },
            confirmedByClientAt: null
          },
          data: { confirmedByClientAt: new Date() }
        });

        return { month, confirmedNow: result.count };
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    /* Prisma P2034 on serialiseerimisvõistlus ei ole serveriviga: kuu muutus
       kinnitamise ajal ja klient peab värsket dokumenti uuesti vaatama. */
    if (error?.code === "P2034") throw conflict("service_log.errors.client_month_changed");
    throw error;
  }
}
