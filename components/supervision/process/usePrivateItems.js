"use client";

/**
 * Minu eeskambri kirjed selles protsessis: seis, kirjed, uus katse ja vaikne
 * värskendus.
 *
 * MIKS LEHE TASEMEL. Vana eeskambri paneel laadis loendi ise ja ainult siis,
 * kui sakk oli lahti. Laual peab loendit nägema ka kõigi osade vaate plaat
 * („eeskambris on …"), seepärast hoiab loendit leht ja annab selle osale edasi.
 *
 * LOEND EI OLE PROTSESSI VASTUSE OSA. Eeskamber on ainult omaniku oma (ka
 * superviisor ei näe osaleja kirjeid) ja tuleb omaette päringuga omaette
 * serializer'ist; protsessi jagatud vastusesse see ei jõua (SUP-P3).
 *
 * `reload()` värskendab loendit ilma laadimise seisuta (pärast salvestamist ei
 * tohi loend vilkuda ega avatud vorm kaduda) ja annab värske loendi tagasi. Kui
 * värskendus ei õnnestu, jääb senine loend ette ja tagasi tuleb `null`: avatud
 * kirje ja pooleli tekst ei tohi võrguvea pärast kaduda. `retry()` on vea järel
 * uus katse laadimise seisuga.
 *
 * `enabled`: päring algab alles siis, kui on teada, et vaataja on protsessi
 * liige (kutsutule server eeskambrit ei anna). Seni on seis „laadimine".
 *
 * @returns {{ status: "loading" | "error" | "ready", data: object[], error: string, retry: () => void, reload: () => Promise<object[]|null> }}
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { supervisionMessage, supervisionRequest } from "../supervisionClient";

const LOADING = Object.freeze({ status: "loading", data: [], error: "" });

export default function usePrivateItems(processId, t, enabled = true) {
  const [state, setState] = useState(LOADING);

  const load = useCallback(
    async (signal, { silent = false } = {}) => {
      try {
        const { ok, status, payload } = await supervisionRequest(
          `/api/supervision/processes/${encodeURIComponent(processId)}/private-items`,
          { signal }
        );
        if (signal?.aborted) return null;
        if (!ok) {
          if (!silent) setState({ status: "error", data: [], error: supervisionMessage({ status, payload, t }) });
          return null;
        }
        const items = Array.isArray(payload?.items) ? payload.items : [];
        setState({ status: "ready", data: items, error: "" });
        return items;
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) return null;
        if (!silent) setState({ status: "error", data: [], error: t("supervision.errors.load_failed") });
        return null;
      }
    },
    [processId, t]
  );

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState(LOADING);
    void load(controller.signal);
    return () => controller.abort();
  }, [enabled, load]);

  const retry = useCallback(() => {
    setState(LOADING);
    void load();
  }, [load]);
  const reload = useCallback(() => load(undefined, { silent: true }), [load]);

  return useMemo(() => ({ ...state, retry, reload }), [state, retry, reload]);
}
