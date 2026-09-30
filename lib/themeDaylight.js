/* Automaatne teema (omanik 30.09): päeval hele (päevane tuba), õhtul ja
   öösel tume (õhtune tuba). Piiriks on päris päikesetõus ja -loojang Eestis
   (Tallinna koordinaadid), mitte kindel kellaaeg: talvel läheb tuba
   pimedaks juba pärastlõunal, suvel alles hilisõhtul — nagu aknast väljas.

   Arvutus käib UTC-s, seega ei sõltu tulemus seadme ajavööndist ning server
   ja brauser jõuavad sama kella juures sama vastuseni. Asukohta ei küsita.

   Funktsioon on TEADLIKULT isemajandav (ükski muutuja ega abifunktsioon
   ei ole väljaspool tema keha): app/layout.js paneb tema lähteteksti
   (Function#toString) teema-init skripti sisse, mis jookseb enne esimest
   värvimist — nii ei vilgu vale teema ka automaatses režiimis.

   Algoritm: päikesetõusu võrrand (NOAA lihtsustus), täpsus ~1–2 minutit. */
export function isEstonianDaytime(date) {
  var ms = date && typeof date.getTime === "function" ? date.getTime() : Date.now();
  var lat = 59.437;
  var lon = 24.754;
  var rad = Math.PI / 180;
  var jd = ms / 86400000 + 2440587.5;
  // Tänasele hetkele lähim päikese kulminatsioon (Juliuse päevades 2000.0-st).
  var n = Math.round(jd - 2451545 - 0.0009 + lon / 360);
  var jStar = n + 0.0009 - lon / 360;
  var m = (357.5291 + 0.98560028 * jStar) % 360;
  var c = 1.9148 * Math.sin(m * rad) + 0.02 * Math.sin(2 * m * rad) + 0.0003 * Math.sin(3 * m * rad);
  var eclLon = (m + c + 180 + 102.9372) % 360;
  var transit = 2451545 + jStar + 0.0053 * Math.sin(m * rad) - 0.0069 * Math.sin(2 * eclLon * rad);
  var sinDecl = Math.sin(eclLon * rad) * Math.sin(23.4397 * rad);
  var cosDecl = Math.cos(Math.asin(sinDecl));
  var cosHour = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinDecl) / (Math.cos(lat * rad) * cosDecl);
  if (cosHour <= -1) return true; // kesköine päike
  if (cosHour >= 1) return false; // polaaröö
  var halfDay = Math.acos(cosHour) / rad / 360;
  return Math.abs(jd - transit) < halfDay;
}

/* Teema-eelistus → nähtav teema. "auto" lahendub kellaaja järgi; "dark"
   jääb (kõrgkontrasti baas); kõik muu on tume (mid). */
export function resolveThemePreference(preference, date) {
  if (preference === "auto") return isEstonianDaytime(date) ? "light" : "mid";
  if (preference === "light" || preference === "dark") return preference;
  return "mid";
}
