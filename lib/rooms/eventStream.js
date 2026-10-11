/**
 * Ruumi sündmuste voog ühele kuulajale (SSE keha).
 *
 * AUDIT T01. Varem kontrolliti ligipääsu ühenduse loomisel ja siis iga 20 sekundi
 * järel; sündmus kirjutati voogu kohe, kui see saabus. Inimene, kes ruumist lahkus
 * või kelle ligipääs lõppes, sai seega kuni 20 sekundit veel uusi sõnumeid.
 *
 * Nüüd kontrollitakse ligipääsu ENNE iga sündmuse väljasaatmist. Kontroll algab
 * pärast sündmuse saabumist, mitte enne: varem tehtud kontrolli tulemus ei kata
 * hiljem saabunud sündmust. Kontrolli ajal saabunud sündmused ootavad järgmist
 * kontrolli; nii jääb järjekord alles ja sõnumivalang ei tee iga sõnumi kohta
 * eraldi päringut. Kui kontroll ütleb „ei" või ebaõnnestub, voog suletakse ja
 * ootel sündmusi välja ei saadeta.
 *
 * Perioodiline kontroll jääb alles: see sulgeb ka vaikse ruumi voo, kui ligipääs
 * on lõppenud.
 *
 * Puhas moodul: tellimine, ligipääsukontroll ja taimerid antakse sisse.
 */
export const ROOM_STREAM_HEARTBEAT_MS = 15000;
export const ROOM_STREAM_RECHECK_MS = 20000;

/**
 * @param {object} options
 * @param {(listener: (event: unknown) => void) => () => void} options.subscribe tellib ruumi sündmused, tagastab tühistaja
 * @param {() => Promise<boolean>} options.checkAccess kas kuulajal on PRAEGU lugemisõigus; ainult `true` loeb
 * @returns {ReadableStream<Uint8Array>}
 */
export function createRoomEventStream({
  subscribe,
  checkAccess,
  heartbeatMs = ROOM_STREAM_HEARTBEAT_MS,
  recheckMs = ROOM_STREAM_RECHECK_MS,
  timers = { setInterval, clearInterval }
}) {
  let cleanup = null;
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const pending = [];
      let ended = false;
      let draining = false;
      let unsubscribe = () => {};
      let heartbeat = null;
      let recheck = null;

      const end = () => {
        if (ended) return;
        ended = true;
        pending.length = 0;
        timers.clearInterval(heartbeat);
        timers.clearInterval(recheck);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      cleanup = end;

      const write = (text) => {
        if (ended) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          end();
        }
      };

      /* Kontrolli viga on keeldumine: kahtluse korral ei saadeta midagi. */
      const allowed = async () => {
        try {
          return (await checkAccess()) === true;
        } catch {
          return false;
        }
      };

      const drain = async () => {
        if (draining) return;
        draining = true;
        try {
          while (pending.length && !ended) {
            /* Selle kontrolli alla lähevad ainult sündmused, mis on juba saabunud. */
            const batch = pending.splice(0, pending.length);
            if (!(await allowed())) {
              end();
              return;
            }
            for (const event of batch) {
              let line;
              try {
                line = `data: ${JSON.stringify(event)}\n\n`;
              } catch {
                end();
                return;
              }
              write(line);
            }
          }
        } finally {
          draining = false;
        }
      };

      unsubscribe = subscribe((event) => {
        if (ended) return;
        pending.push(event);
        void drain();
      });
      heartbeat = timers.setInterval(() => write(": keep-alive\n\n"), heartbeatMs);
      recheck = timers.setInterval(async () => {
        if (!ended && !(await allowed())) end();
      }, recheckMs);
      write(": connected\n\n");
    },
    cancel() {
      cleanup?.();
    }
  });
}
