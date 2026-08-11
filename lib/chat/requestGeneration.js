/**
 * ÜKS AKTIIVNE PÄRING, MONOTOONNE PÕLVKOND (SOL-CHAT-12).
 *
 * MIS OLI VALESTI. Vestluse ajaloo laadimist (`hydrateFromServer`) käivitasid mount, fookus,
 * nähtavuse muutus ja `sotsiaalai:refresh-conversations` — kahe eri throttle'i kaudu, ilma
 * `AbortController`-i ja ilma põlvkonnata. Kaks laadimist said kattuda ja AEGLASEM VAREM alanud
 * vastus võis lõpetada hiljem ning kirjutada uuema loendi vanemaga üle. Vestluse ID kontroll seda
 * ei püüdnud: mõlemad päringud olid SAMA vestluse omad.
 *
 * MIKS OMA MOODUL, MITTE HOOKI SEES. Testijooksja ei renderda React-hooke, seega hooki sees oleks
 * see reegel mõõtmatu — sama põhjus, mille pärast `lib/calls/clientState.js` (SOL-CALL-11…-13) ja
 * `lib/chat/sidebarListState.js` olemas on. Siin on ta puhas ja järjekord on deterministlikult
 * mõõdetav, ilma brauserita.
 *
 * REEGEL: kirjutada tohib AINULT viimasena ALANUD päring. Mitte viimasena lõppenud — just see vahe
 * ongi leid.
 */

export function createRequestGeneration() {
  let current = 0;
  return {
    /** Alusta uut päringut. @returns selle päringu tunnus. */
    next() {
      current += 1;
      return current;
    },
    /** Kas see tunnus on endiselt viimane alanu? */
    isCurrent(token) {
      return token === current;
    },
    /** Ainult diagnostikaks ja testideks. */
    get value() {
      return current;
    }
  };
}
