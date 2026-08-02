/**
 * TEENUSPÄEVIK-V1 E3 — SUUNAMISE JÄÄK.
 *
 * Lepingu ptk 1: „suunamisotsus kannab mahtu — osutaja PEAB jälgima jääki,
 * sest üle suunatud mahu ei maksta." See moodul on see jälgimine.
 *
 * PUHAS FUNKTSIOON, teadlikult (leping 8.2): saldo on koht, kus viga maksab
 * raha, ja seda peab saama tõendada ilma andmebaasita, ilma UI-ta ja ilma
 * kuupäeva-mängudeta. Sisse kirjed ja suunamine, välja number.
 *
 * NELI REEGLIT, mis kõik on rahalise tagajärjega:
 *
 * 1. TÜHISTATUD KIRJE EI LOE. `VOID` on tühistatud dokument — tema mahu
 *    arvestamine tähendaks, et osutaja kaotab kvoodi töö eest, mida ta ise
 *    tühistas.
 *
 * 2. MUSTAND LOEB ERALDI. `DRAFT` ei ole veel arve alus, aga ta on juba tehtud
 *    töö. Kui teda jäägist välja jätta, näeb osutaja vaba mahtu, mida tegelikult
 *    ei ole, ja avastab ülekulu alles kuu lõpus. Seepärast on `used` (kinnitatud)
 *    ja `pending` (mustandid) ERALDI numbrid — hoiatus arvestab mõlemat, arve
 *    ainult esimest.
 *
 * 3. AINULT SAMA ÜHIK. Tunnipõhine kirje ei tarbi kord-põhist mahtu. Eri ühikute
 *    liitmine annaks numbri, mis näeb välja õige ja ei ole seda kunagi.
 *
 * 4. `MONTH` VS `TOTAL`. Kuupõhine maht taastub iga kuu; perioodipõhine mitte.
 *    Ilma selle vaheta oleks „40 h kuus" ja „40 h kokku" sama asi — esimene
 *    lubaks aasta jooksul 480 h, teine 40.
 */

import { ALLOCATION_PERIOD, ENTRY_STATUS } from "./constants.js";

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `YYYY-MM` kirje kuupäevast. Kuupiir loetakse UTC-s, nagu `date` salvestus. */
export function monthKey(value) {
  const date = toDate(value);
  if (!date) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Kas kirje kuulub SELLE suunamise arvestusse.
 *
 * Kirje peab viitama suunamisele SÕNASELGELT. Kliendi ja teenuse järgi
 * „arvatavasti sobiv" kirje EI loe: kui sidet ei ole kirja pandud, ei tohi
 * saldo teda vaikselt ära süüa.
 */
function countsTowardReferral(entry, referral) {
  if (!entry || !referral) return false;
  if (entry.referralId !== referral.id) return false;
  if (entry.status === ENTRY_STATUS.VOID) return false;
  if (referral.unit && entry.unit && referral.unit !== entry.unit) return false;
  return true;
}

/**
 * Arvutab ühe suunamise jäägi.
 *
 * @param referral  { id, unit, allocatedQuantity, allocationPeriod, periodStart, periodEnd }
 * @param entries   teenuskirjed (vähemalt { referralId, unit, quantity, date, status })
 * @param options.month  `YYYY-MM` — kuupõhise mahu puhul KOHUSTUSLIK aken.
 *                       Ilma selleta ei ole „jääk" kuupõhisel suunamisel
 *                       defineeritud ja vaikiv „kogu periood" annaks vale numbri.
 */
export function computeReferralBalance(referral, entries = [], { month = null } = {}) {
  const allocated =
    referral?.allocatedQuantity === null || referral?.allocatedQuantity === undefined
      ? null
      : Number(referral.allocatedQuantity);

  const isMonthly = (referral?.allocationPeriod || ALLOCATION_PERIOD.MONTH) === ALLOCATION_PERIOD.MONTH;
  const window = isMonthly ? month : null;

  let used = 0;
  let pending = 0;
  let counted = 0;

  for (const entry of entries) {
    if (!countsTowardReferral(entry, referral)) continue;
    if (window && monthKey(entry.date) !== window) continue;
    const quantity = Number(entry.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    counted += 1;
    if (entry.status === ENTRY_STATUS.DRAFT) pending += quantity;
    else used += quantity;
  }

  used = round2(used);
  pending = round2(pending);
  const committed = round2(used + pending);

  /* Ilma määratud mahuta EI OLE jääki. Tagastame `null`-i, mitte nulli: „maht
     on määramata" ja „maht on otsas" on osutaja jaoks vastandlikud olukorrad
     ja null tähendaks teist. */
  if (allocated === null || !Number.isFinite(allocated)) {
    return {
      allocated: null,
      used,
      pending,
      committed,
      remaining: null,
      overrun: false,
      overrunBy: 0,
      entriesCounted: counted,
      allocationPeriod: isMonthly ? ALLOCATION_PERIOD.MONTH : ALLOCATION_PERIOD.TOTAL,
      month: window,
      unit: referral?.unit || null
    };
  }

  const remaining = round2(allocated - committed);
  return {
    allocated: round2(allocated),
    used,
    pending,
    committed,
    remaining,
    overrun: remaining < 0,
    overrunBy: remaining < 0 ? round2(-remaining) : 0,
    entriesCounted: counted,
    allocationPeriod: isMonthly ? ALLOCATION_PERIOD.MONTH : ALLOCATION_PERIOD.TOTAL,
    month: window,
    unit: referral?.unit || null
  };
}

/**
 * Kas UUS kirje viiks mahu üle. Kutsutakse ENNE salvestamist.
 *
 * HOIATAB, EI BLOKEERI (leping DoD 4: „ületamine hoiatab"). Töö on tehtud ja
 * dokumenteerimata töö on halvem kui üle mahu dokumenteeritud töö — osutaja
 * peab nägema, et ta läheb üle, ja ise otsustama, kas ta kirje siiski kirja
 * paneb ja KOV-iga räägib.
 */
export function checkOverrun(referral, entries, candidate, { month = null } = {}) {
  const window = month || monthKey(candidate?.date);
  const balance = computeReferralBalance(referral, entries, { month: window });
  if (balance.remaining === null) {
    return { warn: false, balance, wouldRemain: null };
  }

  const quantity = Number(candidate?.quantity);
  const addition = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const wouldRemain = round2(balance.remaining - addition);

  return {
    warn: wouldRemain < 0,
    /* `overBy` on see number, mille osutaja peab KOV-iga kokku leppima —
       mitte kogu ületus, vaid see osa, mille SEE kirje lisab. */
    overBy: wouldRemain < 0 ? round2(Math.min(addition, -wouldRemain)) : 0,
    wouldRemain,
    balance
  };
}
