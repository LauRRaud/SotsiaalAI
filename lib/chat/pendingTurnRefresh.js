/**
 * OOTEL KÄIGU UUS VAATAMINE (#288, Codex R3 30.09).
 *
 * Aken, mis laadis vestluse keset piloodi vastust (teine aken või lehe laadimine), vaatab käiku
 * uuesti, kuni server ütleb, et see on valmis. Voogav aken saab vastuse ise ega vaata.
 *
 * MIS OLI VALESTI. Järgmine taimer tehti ainult õnnestunud `PENDING` vastuse järel. Taimeri GET,
 * mis sai HTTP 503, `ok: false` või võrgutõrke, ei jätnud ühtegi taimerit: kasutaja nägi
 * „Pooleliolev katse“, kuni fookus või nähtavus uue laadimise käivitas, kuigi 45 katsest oli
 * kasutatud üks.
 *
 * MIKS OMA MOODUL. Sama põhjus mis `lib/chat/requestGeneration.js`-il: testijooksja ei renderda
 * React-hooke; siin on järjekord võltstaimeriga deterministlikult mõõdetav.
 *
 * REEGEL: ahel algab ainult ootel käigust. Ajutine tõrge (`isTransientStatus`, `ok: false`, võrk)
 * ahela sees planeerib uue katse SAMA eelarve piires; muu HTTP-viga lõpetab ahela; tõrge ahelast
 * väljaspool (fookus, kui midagi ei oota) ahelat ei alusta.
 * Katkestatud või uuemaga asendatud päring ei tee midagi — otsustab uuem. Valmis käik, vestluse
 * vahetus ja unmount lõpetavad ahela.
 */

// Iga 4 s, kõige rohkem 45 korda (umbes kolm minutit); ka tõrke järel tehtud katse loeb.
export const PENDING_REFRESH_MS = 4000;
export const PENDING_REFRESH_TRIES = 45;

// Mööduv HTTP-viga: server või vahelüli on hetkel hõivatud. 401, 403 ja 404 (väljalogimine, õigus, kustutatud
// vestlus) uuel katsel ei parane, need lõpetavad ahela.
export const isTransientStatus = status => status === 408 || status === 429 || status >= 500;

export function createPendingTurnRefresh({
  delayMs = PENDING_REFRESH_MS,
  maxTries = PENDING_REFRESH_TRIES,
  setTimer = (run, ms) => setTimeout(run, ms),
  clearTimer = timer => clearTimeout(timer)
} = {}) {
  let timer = null;
  let tries = 0;
  let active = false;
  const clear = () => {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  };
  // Eelarve lõpus jääb viimane juba loetud katse alles.
  const schedule = run => {
    if (tries >= maxTries) return false;
    clear();
    tries += 1;
    timer = setTimer(() => {
      timer = null;
      run();
    }, delayMs);
    return true;
  };
  const stop = () => {
    clear();
    tries = 0;
    active = false;
  };
  return {
    /** Laadimine nägi ootel käiku: vaata uuesti, kui eelarvet on. @returns kas planeeriti. */
    pending(run) {
      active = true;
      return schedule(run);
    },
    /** Laadimine ebaõnnestus. Ahela sees planeeri uus katse; asendatud päring ja ahelata tõrge ei tee midagi. */
    failed(run, { superseded = false } = {}) {
      if (superseded || !active) return false;
      return schedule(run);
    },
    /** Käik ei ole enam ootel (või voogab see aken ise): ahel lõpeb ja eelarve algab otsast. */
    settled: stop,
    /** Vestluse vahetus, unmount. */
    stop,
    /** Ainult diagnostikaks ja testideks. */
    get tries() {
      return tries;
    },
    get scheduled() {
      return timer !== null;
    }
  };
}
