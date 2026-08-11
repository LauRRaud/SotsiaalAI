export function createLatestRequestGate() {
  let version = 0;
  let controller = null;

  return {
    begin(key = "") {
      controller?.abort();
      controller = new AbortController();
      version += 1;

      const requestVersion = version;
      const signal = controller.signal;

      return Object.freeze({
        key,
        signal,
        isCurrent() {
          return !signal.aborted && requestVersion === version;
        }
      });
    },

    invalidate() {
      version += 1;
      controller?.abort();
      controller = null;
    }
  };
}

export function isAbortError(error) {
  return error?.name === "AbortError" || error?.name === "TimeoutError";
}

/**
 * Kliendipoolne UX-ajapiir sama signaali otsa (SOL-VOICE-02).
 *
 * Serveril on oma piir, aga tema ei aita, kui vastus jääb võrku kinni: kasutaja liides
 * ootaks siis lõputult „räägin…" seisus. Feature-check on siin tahtlik — `AbortSignal.any`
 * puudumine ei tohi ettelugemist ÜLDSE katki teha, vaid ainult jätta ta vanaks käitumiseks.
 */
export function withRequestTimeout(signal, timeoutMs) {
  const ms = Number(timeoutMs);
  if (!Number.isFinite(ms) || ms <= 0) return signal;
  if (typeof AbortSignal?.timeout !== "function") return signal;
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  if (typeof AbortSignal.any !== "function") return signal;
  return AbortSignal.any([signal, timeout]);
}
