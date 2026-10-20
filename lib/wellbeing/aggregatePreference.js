/**
 * TÖÖHEAOLU — ANONÜÜMSES KOONDIS OSALEMISE VALIK (TO-3, I13; ideed §20.6).
 *
 * Seni läks iga kirje piloodi koondisse ja töötaja ei saanud seda valida ega
 * teadnud sellest. Nüüd on see inimese valik (`User.wellbeingAggregateEnabled`):
 *
 *   `true`  — tema standardsed vastused võivad koondis osaleda;
 *   `false` — ükski tema kirje, ka varasem, ei osale;
 *   `null`  — ta ei ole valinud ja kehtib `WELLBEING_AGGREGATE_DEFAULT`.
 *
 * VAIKEVÄÄRTUS ON TOOTEOTSUS (TO-3). Tervikanalüüsi soovitus (b): piloodi ajal
 * vaikimisi sees, nähtava selgituse ja väljalülitusega; enne laiemat kasutust
 * kaaluda vaikimisi väljas olekut. Kuna vaikimisi seis on `null`, mitte kirjutatud
 * väärtus, muudab selle otsuse üks rida siin — ühegi inimese tehtud valik ei
 * kao ja andmeid ümber kirjutada ei ole vaja.
 *
 * PIIR ON PÄRINGUS, mitte kirjes. Valik kehtib koondi arvutamise hetkel
 * (`aggregate.js` arvutab elusalt), seega väljalülitus võtab ka varasemad kirjed
 * kohe välja ja sisselülitus toob nad tagasi. Kirje `aggregationEligible` jääb
 * tähendama ainult „see on kehtiv versioon, mitte parandatud" (TO-1).
 *
 * Keeldumine ei piira privaatse Tööheaolu kasutamist (§20.6).
 */

import { prisma as defaultPrisma } from "../prisma.js";

export const WELLBEING_AGGREGATE_DEFAULT = true;

/** Inimese tegelik seis: tema valik või vaikeväärtus. */
export function resolveWellbeingAggregateEnabled(value) {
  return typeof value === "boolean" ? value : WELLBEING_AGGREGATE_DEFAULT;
}

/**
 * Koondi päringutingimus kirje omaniku valiku järgi.
 *
 * `NOT: { wellbeingAggregateEnabled: false }` ei sobi: SQL-is on `NOT (NULL =
 * false)` tundmatu ja jätaks valimata inimesed välja. Seepärast on `null` siin
 * nimeliselt kirjas.
 */
export function wellbeingAggregateOwnerWhere() {
  const allowed = WELLBEING_AGGREGATE_DEFAULT
    ? { OR: [{ wellbeingAggregateEnabled: null }, { wellbeingAggregateEnabled: true }] }
    : { wellbeingAggregateEnabled: true };
  return { owner: { is: allowed } };
}

/** `{ enabled, chosen }` või `null`, kui kontot ei ole. */
export async function readWellbeingAggregatePreference(userId, { db = defaultPrisma } = {}) {
  const id = String(userId || "").trim();
  if (!id || typeof db?.user?.findUnique !== "function") return null;
  const row = await db.user.findUnique({ where: { id }, select: { wellbeingAggregateEnabled: true } });
  if (!row) return null;
  return {
    enabled: resolveWellbeingAggregateEnabled(row.wellbeingAggregateEnabled),
    chosen: typeof row.wellbeingAggregateEnabled === "boolean"
  };
}

/** Salvestab inimese valiku. Tagastab uue seisu või `null`, kui kontot ei ole. */
export async function saveWellbeingAggregatePreference(userId, enabled, { db = defaultPrisma } = {}) {
  const id = String(userId || "").trim();
  if (!id || typeof enabled !== "boolean") return null;
  const updated = await db.user.updateMany({ where: { id }, data: { wellbeingAggregateEnabled: enabled } });
  return updated.count === 1 ? { enabled, chosen: true } : null;
}
