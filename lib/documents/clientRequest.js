/**
 * Dokumentide lehtede ja koostamisruumi päringute kaks ühist reeglit.
 *
 * 1. LEHE KEEL LÄHEB PÄRINGUGA KAASA. Server valib veateate keele päringu
 *    järgi (`localeFromRequest` failis ./server.js): päis `x-ui-locale`, selle
 *    puudumisel brauseri keel. Ilma päiseta sai eestikeelsel lehel ingliskeelse
 *    brauseriga inimene ingliskeelse veateate. Kinnitamisel otsustab sama päis
 *    ka kinnitatud failide siltide keele (./exportLabels.js).
 *
 * 2. BRAUSERI VEATEKST EI JÕUA EKRAANILE. Võrgutõrke korral viskab `fetch` vea,
 *    mille tekst on brauseri oma („Failed to fetch”). Ekraanile sobib ainult
 *    lause, mis tuli serveri vastusest või kataloogist: selline viga visatakse
 *    `RequestFailure`-na ja kõik muu saab lehe enda lause (`failureText`).
 *
 * Puhas moodul: seda loevad kliendi lehed ja testid.
 */

/** Päringu päised koos lehe keelega. `headers`: muud päised, mis päring vajab. */
export function localeHeaders(locale, headers = {}) {
  return { ...headers, "x-ui-locale": String(locale || "et") };
}

/** Viga, mille sõnum tuli serveri vastusest või kataloogist ja mida võib inimesele näidata. */
export class RequestFailure extends Error {}

/**
 * Vea lause inimesele. `RequestFailure` kannab lauset, mis sobib ekraanile;
 * võrgu- ja muu viga kannab brauseri ingliskeelset teksti ja selle asemel on
 * lehe oma lause (`fallback`).
 */
export function failureText(error, fallback) {
  return error instanceof RequestFailure && error.message ? error.message : fallback;
}
