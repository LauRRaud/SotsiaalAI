/* Inimese nimeosa kuju ja pikkus. Üks reegel kõigile kohtadele, kus nimi kirja pannakse:
   koduteenuse oma nime vorm ja organisatsiooni kutse. Puhas fail ilma andmebaasikliendita,
   sest seda loeb ka brauseri vorm. */

export const PERSON_NAME_MAX = 60;

/* Täht alguses, edasi tähed, tühik, sidekriips, ülakoma ja punkt (nt „Mari-Liis", „O'Brien",
   „J. K."). Numbrid ja muu jäävad välja: nimi läheb kliendi koju prinditavale lehele. */
const NAME_SHAPE = /^\p{L}[\p{L}\p{M} .'’-]*$/u;

/** Puhastatud nimeosa või `null`, kui tekst ei ole nime kujuga või on liiga pikk. */
export function cleanPersonName(value) {
  const text = typeof value === "string" ? value.normalize("NFC").replace(/\s+/g, " ").trim() : "";
  return text && text.length <= PERSON_NAME_MAX && NAME_SHAPE.test(text) ? text : null;
}

/** Kas inimesel on profiilis nimi (kas või üks osa)? Tühikutest tekst ei ole nimi. */
export function hasPersonName(profile) {
  return Boolean(String(profile?.firstName || "").trim() || String(profile?.lastName || "").trim());
}
