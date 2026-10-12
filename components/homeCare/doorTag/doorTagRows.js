/**
 * Uksesildi reeglid ilma joonistamiseta: mis tegevused on lubatud ja mis tekst
 * vaate all servas on.
 *
 * Silt on QR-kood kliendi ukse kõrval (seespool): hooldaja skannib selle ja
 * jõuab otse õige kliendi lehele. Silt ei anna ligipääsu, leht avaneb ikka ainult
 * sisse logitud töötajale, kes klienti näeb. Kliendil on üks kehtiv silt. Uue
 * tegemine ja tühistamine teevad seinal oleva sildi kasutuks, seepärast küsivad
 * need teist vajutust. Olek ja päringud on konksus ./useDoorTag.js, vaated on
 * failis ./DoorTagViews.jsx ja ühised (../client/PartViews.jsx), kokku paneb need
 * ./DoorTag.jsx.
 */

/** Mida inimene sildiga teha tohib: tegija on see, kes tohib kirjutada; silti saab tühistada ainult siis, kui see on. */
export function tagRights({ writable }, tag) {
  return { make: Boolean(writable && !tag), manage: Boolean(writable && tag) };
}

/** Sildi tegemise aeg ühe lausena. */
export function madeLine(t, tag, moment) {
  return t("home_care.door_tag.made_at", { time: moment(tag.createdAt) });
}
