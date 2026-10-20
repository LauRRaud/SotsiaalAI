/**
 * TÖÖHEAOLU — „MIDA TAHAKSIN ÕPPIDA" (TÜ küsitluse küsimus 16; võrdlus ptk 8.2 p 5).
 *
 * Valdkonnad on küsitluse 16. küsimusest ja need on kõigi töötajate, mitte ainult
 * alustajate küsimus (omaniku volitusel otsustatud 20.10: samm on „Minu
 * tugivõimaluste" osa, kus on juba arenguvormid — küsimus 17). Platvorm ei ole
 * koolitaja: valik suunab sinna, kus platvorm juba aitab (Luna, Meetodipeegel,
 * Eetikaruum, materjalid, Tööheaolu tööriistad, kovisioon).
 *
 * See jääb töötajale: arenguvajadus ei lähe praegu anonüümsesse koondisse (see
 * on S6 otsus koos kutse ja arenguvajaduse kihiga). Failil ei ole importe.
 * Väärtused on serveri lepingu osa — olemasolevat väärtust ei nimetata ümber.
 */

export const LEARNING_AREAS = Object.freeze([
  ["legislation", "Õigusaktid ja menetlus"],
  ["case_management", "Juhtumikorraldus"],
  ["needs_assessment", "Abivajaduse hindamine"],
  ["impact_assessment", "Mõju hindamine"],
  ["complex_clients", "Töö keeruliste klientidega"],
  ["crisis_trauma", "Kriisi- ja traumateadlik töö"],
  ["ethics", "Eetika ja eetilised dilemmad"],
  ["mental_health", "Vaimse tervise küsimused"],
  ["digital_skills", "STAR ja digioskused"],
  ["self_care", "Enesehoid"],
  ["time_management", "Töökorraldus ja ajajuhtimine"],
  ["teamwork_network", "Meeskonna- ja võrgustikutöö"]
]);

export const LEARNING_AREA_LABELS = Object.freeze(Object.fromEntries(LEARNING_AREAS));

export const LEARNING_AREA_VALUES = Object.freeze(LEARNING_AREAS.map(([value]) => value));

/** Kuhu platvormil iga valdkonna puhul minna (soovituse töövoo liik). */
export const LEARNING_AREA_DESTINATIONS = Object.freeze({
  legislation: "luna",
  digital_skills: "materials",
  case_management: "method_mirror",
  needs_assessment: "method_mirror",
  impact_assessment: "method_mirror",
  complex_clients: "method_mirror",
  crisis_trauma: "materials",
  mental_health: "materials",
  ethics: "ethics_room",
  self_care: "recovery",
  time_management: "work-processes",
  teamwork_network: "covision"
});
