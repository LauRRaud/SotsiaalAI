"use client";

/**
 * Üks lugev päring supervisiooni avalehtedele: seis, andmed ja uus katse.
 *
 * Vanal kolmel lehel (avaleht, pakkide loend, pakk) oli sama laadimise kood
 * kolm korda, igaühel veidi erinev: paki lehel ei olnud vea järel üldse teed
 * uuesti proovida. Siin on see üks kord. Vealause tuleb ühisest tõlkijast
 * (`supervisionMessage`): 401 → „logi sisse", 404 → ühetaoline „ei leitud või
 * sul pole ligipääsu".
 *
 * `pick` peab olema püsiv funktsioon (mooduli tasemel), muidu algab päring iga
 * joonistusega uuesti.
 *
 * @returns {{ status: "loading" | "error" | "ready", data: unknown, error: string, retry: () => void }}
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { supervisionMessage, supervisionRequest } from "../supervisionClient";

const LOADING = Object.freeze({ status: "loading", data: null, error: "" });

export default function useSupervisionLoad(url, pick, t) {
  const [state, setState] = useState(LOADING);

  const load = useCallback(
    async (signal) => {
      try {
        const { ok, status, payload } = await supervisionRequest(url, { signal });
        if (signal?.aborted) return;
        if (!ok) {
          setState({ status: "error", data: null, error: supervisionMessage({ status, payload, t }) });
          return;
        }
        setState({ status: "ready", data: pick(payload), error: "" });
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) return;
        setState({ status: "error", data: null, error: t("supervision.errors.load_failed") });
      }
    },
    [pick, t, url]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const retry = useCallback(() => {
    setState(LOADING);
    void load();
  }, [load]);

  return useMemo(() => ({ ...state, retry }), [state, retry]);
}
