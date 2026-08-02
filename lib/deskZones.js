/**
 * Sügavuslaua tsoonid — töölaua ja tööheaolu astmete jaotus.
 *
 * Töölaud ei ole lehitsetav riiul, vaid ruumis taanduv pind: kaardid
 * seisavad astmetel, lähim aste all. Aste = tsoon, ja tsoon TÄHENDAB
 * midagi — mida vahetum on suhe teise inimesega, seda lähemal ta seisab.
 * Nii on kõik kaardid korraga nähtavad (varem elas kolmandik neist
 * kolmandal lehel) ja kaugus kannab tähendust, mitte lehenumbrit.
 *
 * See fail on JAOTUSE ainus allikas: kui rühmitust muuta, siis siin.
 * Sildid elavad i18n-is (messages/*.json → room.zones.<id>.name/.hint),
 * mitte siin — tsooni ID on tehniline võti, mitte kuvatav tekst.
 */

/* Jaotus käib TEGEVUSE järgi, mitte lehe järgi:
 *   juhtum   — kõik, mille teises otsas on inimene;
 *   teadmine — kõik, mis on info (otsin, koostan, hoian);
 *   mina     — kõik, mis puudutab mind kui spetsialisti.
 *
 * Varasem jaotus (inimesed / töö / mina) lubas kaks kaarti valesse kohta:
 * Teenusekaart seisis "Inimeste" all, kuigi ta on otsinguvahend, mitte
 * keegi, kes sind ootab; ja Välitöö seisis üldise "Töö" all, kuigi
 * kodukülastus on kõige otsesem inimesega kohtumine, mis platvormil on.
 * Nüüd on Teenusekaart koos Minu otsingu ja Materjalidega (kõik kolm =
 * "leian info") ning Välitöö juhtumitöö juures.
 *
 * Järjekord loeb: massiivi ESIMENE tsoon on silmale kõige lähemal.
 */
export const WORKSPACE_ZONES = Object.freeze({
  CLIENT: Object.freeze(["minu_tee", "leian_abi"]),
  SOCIAL_WORKER: Object.freeze(["juhtum", "teadmine", "mina"]),
  SERVICE_PROVIDER: Object.freeze(["juhtum", "teadmine", "mina"])
});

export const WELLBEING_ZONES = Object.freeze(["vaade", "olukord", "korraldus"]);

/* Kliendi kaardid kannavad sama võtit mis spetsialisti omad, aga elavad
   teistes tsoonides: temal ei ole "Töö" ega "Mina", vaid oma teekond ja
   koht, kust abi tuleb. Sama kaart, teine maailm. */
export const CLIENT_ZONE = Object.freeze({
  teekond: "minu_tee",
  poordumised: "minu_tee",
  abisoovid: "minu_tee",
  abipakkumised: "minu_tee",
  teenusekaart: "leian_abi",
  otsi: "leian_abi",
  koosta: "leian_abi",
  lisa: "leian_abi",
  /* Minu jagamised on kliendil "minu tee", MITTE "leian abi": see on tema
     enda jälje ülevaade ja tagasivõtt, mitte koht, kust abi tuleb. Ilma selle
     reata langeks ta vaikival varuvariandil valesse tsooni. */
  jagamised: "minu_tee"
});

/* Tööheaolu tööriistad (lib/wellbeingTools.js) astmetele:
   kus ma olen → mis praegu juhtus → kuidas tööd pikas plaanis hoida. */
export const WELLBEING_ZONE = Object.freeze({
  "quick-check": "vaade",
  overview: "vaade",
  "my-records": "vaade",
  "hard-case": "olukord",
  "workplace-violence": "olukord",
  interruptions: "olukord",
  recovery: "olukord",
  "work-boundaries": "korraldus",
  "role-boundaries": "korraldus",
  "work-processes": "korraldus",
  "starter-support": "korraldus"
});

/** Rolli tsooniloend; tundmatu roll käitub kliendina (kitsaim vaade). */
export function workspaceZonesForRole(role) {
  const key = String(role || "CLIENT").trim().toUpperCase();
  return WORKSPACE_ZONES[key] || WORKSPACE_ZONES.CLIENT;
}
