/**
 * TEENUSPÄEVIK-V1 — rakendustaseme sõnastikud.
 *
 * K1 reegel: ühikud, staatused ja päritolu EI OLE PostgreSQL-i enumid, vaid
 * elavad siin. Skeem hoiab neid String-ina.
 *
 * PÄRITOLU EI DUBLEERITA. `PROVENANCE` tuleb `lib/workspaces/provenance.js`-ist,
 * mis on tema AINUS sõnastik kogu platvormil (FIELD ja juhtumitugi kasutavad
 * sedasama). Teine koopia vananeks eraldi ja tekitaks olukorra, kus sama märge
 * tähendab kahes moodulis eri asja.
 */

import { PROVENANCE, PROVENANCES, isProvenance } from "@/lib/workspaces/provenance";

export { PROVENANCE, PROVENANCES, isProvenance };

/**
 * Ühik erineb teenuseti (leping ptk 1): tund koduteenusel ja tugiisikul,
 * kord/külastus, ööpäev majutusel, kuu kohatasul.
 */
export const SERVICE_UNIT = Object.freeze({
  HOUR: "HOUR",
  SESSION: "SESSION",
  DAY: "DAY",
  MONTH: "MONTH"
});

export const SERVICE_UNITS = Object.freeze(Object.values(SERVICE_UNIT));

export function isServiceUnit(value) {
  return typeof value === "string" && SERVICE_UNITS.includes(value);
}

/**
 * Ühikud, mille kogus on TULETATAV kellaaegadest. `SESSION` on loendatav kord —
 * üks külastus on üks kord, olenemata sellest, kui kaua ta kestis. `MONTH` on
 * kohatasu-laadne periood, mida ei mõõdeta visiidi pikkusega.
 */
export const DURATION_DERIVABLE_UNITS = Object.freeze([SERVICE_UNIT.HOUR]);

/** Suunamise maht: kas kuupõhine või kogu perioodi peale. */
export const ALLOCATION_PERIOD = Object.freeze({
  MONTH: "MONTH",
  TOTAL: "TOTAL"
});

export const ALLOCATION_PERIODS = Object.freeze(Object.values(ALLOCATION_PERIOD));

export function isAllocationPeriod(value) {
  return typeof value === "string" && ALLOCATION_PERIODS.includes(value);
}

/**
 * Teenuskirje elutsükkel (omaniku otsus 02.08).
 *
 *   DRAFT — veel dokument-eelne. Tohib kustutada; ta ei ole millegi alus.
 *   FINAL — arve alusdokument. Ei kustutata ega kirjutata vaikselt üle:
 *           parandus on jälgitav (RPS § 10), tühistus jätab rea alles.
 *   VOID  — tühistatud. Aruandest väljas, jälg alles.
 */
export const ENTRY_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  FINAL: "FINAL",
  VOID: "VOID"
});

export const ENTRY_STATUSES = Object.freeze(Object.values(ENTRY_STATUS));

export const REFERRAL_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  ENDED: "ENDED"
});

export const REFERRAL_STATUSES = Object.freeze(Object.values(REFERRAL_STATUS));

/**
 * Nelja märke voog (leping E2b): „läksin, sain kohale, sain tagasi".
 *
 * Järjekord on tähenduslik ja seda kasutab valideerimine: templid peavad
 * kasvama. KOHAL–LAHKUSIN on TEENUSE kestus; LÄKSIN–KOHAL ja LAHKUSIN–TAGASI
 * on SÕIDUAEG (mall A valikuline veerg). Distantsi neist EI arvutata — see on
 * sõidukidomeen ja jääb teadlikult välja.
 */
export const VISIT_STAMP = Object.freeze({
  DEPARTED: "departedForVisitAt",
  ARRIVED: "arrivedAt",
  LEFT: "leftAt",
  RETURNED: "returnedAt"
});

/** Ajaline järjekord, milles templid tohivad tekkida. */
export const VISIT_STAMP_ORDER = Object.freeze([
  VISIT_STAMP.DEPARTED,
  VISIT_STAMP.ARRIVED,
  VISIT_STAMP.LEFT,
  VISIT_STAMP.RETURNED
]);

/**
 * Märkme pikkuse piir. Teadlikult LÜHIKE: kirjemärge on sisuaruande tooraine,
 * mitte juhtumilugu. Tundlik sisu ei kuulu siia (leping 8.9 minimeerimine) ja
 * pikk väli kutsuks teda sinna.
 */
export const MAX_NOTE_LENGTH = 2000;

/** Kliendi kuvanime ja välise viite piirid — minimeerimine, mitte mugavus. */
export const MAX_CLIENT_NAME_LENGTH = 200;
export const MAX_EXTERNAL_REF_LENGTH = 100;
export const MAX_WORKER_NAME_LENGTH = 200;

/**
 * Kogus: kaks kohta pärast koma (skeemis `Decimal(10,2)`), mitte-negatiivne ja
 * ülalt piiratud. Ülempiir ei ole ilu — ta hoiab ära näpuvea, kus „1.5 h"
 * muutub „15000 h"-ks ja rikub kuuaruande summa.
 */
export const MAX_QUANTITY = 10000;
export const QUANTITY_DECIMALS = 2;
