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
  return error?.name === "AbortError";
}
