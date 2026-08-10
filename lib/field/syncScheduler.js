/**
 * FIELD-V1 — ISE ÄRKAV SÜNKROONIMOOTOR (SOL-FIELD-06).
 *
 * MIS PUUDUS. Olekumasin arvutas retryable vea järel `nextAttemptAt` väärtuse ja
 * `isUploadDue()` lubas uue katse alles selle saabumisel — aga MITTE KEEGI ei
 * küsinud enam pärast seda hetke. `runSync()` käivitus ainult mount'il, brauseri
 * `online` sündmusel ja kasutaja enda vajutusel. Lubatud 5 s → 5 min backoff oli
 * olemas ainult arvutusena: ajutise 429 või 5xx järel võis kinnitatud välitöösisu
 * jääda kogu avatud rakenduse ajaks järjekorda, kuigi ühendus oli ammu tagasi.
 *
 * MIKS OMA MOODUL. Taimer on React-i väline asi ja tema õigsus on AJALINE —
 * „viis katset kasvava vahega" ei ole midagi, mida saaks renderdamata mõõta.
 * Siin on `setTimer`/`clearTimer`/`now` süstitavad, seega kogu ahel jookseb
 * testis võltskella all, ilma ühegi päris ootamiseta.
 *
 * KOLM REEGLIT, mis hoiavad teda ohutuna:
 *  1. korraga ÜKS ootel äratus — enne uut plaani tühistatakse vana;
 *  2. tähtaeg arvutatakse PÄRAST iga katset uuesti, mitte ette;
 *  3. minevikus olev tähtaeg ei anna kunagi nulliga silmust — kui käik teda ei
 *     lahendanud, lükkub järgmine katse põranda võrra edasi.
 */

import { FIELD_SYNC_BACKOFF_BASE_MS } from "./constants.js";

/**
 * @param run        `async () => void` — üks sünkroonimiskäik.
 * @param wakeupAt   `() => number|null` — varaseim tähtaeg (ms epoch) või null,
 *                   kui ärgata ei ole mõtet (nt võrku ei ole).
 * @param floorMs    minimaalne vahe kahe automaatse katse vahel.
 */
export function createFieldSyncScheduler({
  run,
  wakeupAt,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = () => Date.now(),
  floorMs = FIELD_SYNC_BACKOFF_BASE_MS
} = {}) {
  let handle = null;
  let stopped = false;
  let running = false;

  function cancel() {
    if (handle !== null) {
      clearTimer(handle);
      handle = null;
    }
  }

  function schedule() {
    cancel();
    if (stopped || typeof wakeupAt !== "function") return null;
    const at = wakeupAt();
    if (at === null || at === undefined || !Number.isFinite(Number(at))) return null;
    /* Möödunud tähtaeg tähendab „küps kohe". Käik ise on just läbi, seega
       kohene kordus oleks tihe silmus — põrand on lepingu enda baas-backoff. */
    const delay = Math.max(Number(at) - now(), 0) || floorMs;
    handle = setTimer(tick, delay);
    return delay;
  }

  async function tick() {
    handle = null;
    if (stopped || running) return;
    running = true;
    try {
      await run();
    } finally {
      running = false;
    }
    schedule();
  }

  return {
    schedule,
    cancel,
    stop() {
      stopped = true;
      cancel();
    },
    get scheduled() {
      return handle !== null;
    }
  };
}
