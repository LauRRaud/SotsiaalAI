/**
 * TÖÖHEAOLU — TÖÖANDJA TUGIMEETMETE KATALOOG („Minu tugivõimalused").
 *
 * Allikas: TÜ küsitluse „Sotsiaaltöötajate tööheaolu toetavad praktikad ja
 * tugisüsteemi arendamine" küsimus 20, mis kontrollib TLÜ 2024 uuringu soovitusi
 * (`docs/Tooheaolu-uuring.pdf`, ptk 4). Töötasu on teadlikult välja jäetud:
 * see ei ole platvormi küsimus.
 *
 * ÜKS ALLIKAS: vorm, arvutus, kuvasildid ja piloodi aruanne loevad meetmed
 * siit. Failil ei ole importe, et kõik need saaksid teda tsükliteta kasutada.
 * Väärtused on serveri lepingu osa — olemasolevat väärtust ei nimetata ümber.
 */

export const SUPPORT_MEASURE_GROUPS = Object.freeze({
  development: Object.freeze([
    ["mentoring", "Mentorlus"],
    ["covision", "Kovisioon"],
    ["supervision", "Supervisioon"],
    ["development_talks", "Arenguvestlused"],
    ["training", "Täiendkoolitused"],
    ["degree_study", "Kraadi- või mikrokraadiõpe"],
    ["study_visits", "Õppereisid ja töövarjutamine"],
    ["inter_municipal_exchange", "Omavalitsustevaheline kogemuste vahetus"],
    ["rotation", "Ajutine töö teises organisatsioonis"]
  ]),
  health: Object.freeze([
    ["psychological_counselling", "Psühholoogiline nõustamine"],
    ["mental_health_training", "Vaimse tervise koolitused"],
    ["health_days", "Tervisepäevad"],
    ["health_promoting_network", "Tervist edendavate töökohtade (TET) võrgustik"],
    ["safety_measures", "Turvalisuse ja vägivalla ennetamise meetmed"]
  ]),
  organisation: Object.freeze([
    ["flexible_hours", "Paindlik tööaeg"],
    ["workload_review", "Töökoormuse regulaarne hindamine"],
    ["overtime_compensation", "Ületundide hüvitamine"],
    ["substitution_rules", "Selge asendamise kord"],
    ["recognition", "Töötajate tunnustamine"]
  ])
});

export const SUPPORT_MEASURE_LABELS = Object.freeze(
  Object.fromEntries(Object.values(SUPPORT_MEASURE_GROUPS).flat())
);

export const SUPPORT_MEASURE_VALUES = Object.freeze(Object.keys(SUPPORT_MEASURE_LABELS));

/** Koondi tegur: meedet vajatakse, aga töötaja teada seda ei ole. */
export const supportMeasureGapKey = (value) => `measures.gap.${value}`;

/** Sildi algustäht väikeseks (TET-i ja muude lühendite sees ei muudeta midagi). */
export const lowerFirstLabel = (label) => label.charAt(0).toLocaleLowerCase("et") + label.slice(1);
