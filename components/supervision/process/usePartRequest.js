"use client";

/**
 * Protsessi osa kirjutav päring: üks koht, kus tegu õnnestub või annab lause.
 *
 * Vanal lehel oli sama `run` kolmes paneelis (kontrakt, kohtumised,
 * kokkuvõtted). Reegel on sama, mis seal:
 *  - 409 ei ole selle osa viga: leht ütleb seda lava kohal ja toob värske seisu
 *    (`onConflict(payload)`);
 *  - muu keeldumine on lause selle osa tegevusreal (`message`);
 *  - õnnestumise järel laetakse protsess uuesti (`onReload`).
 *
 * ÜKS PÄRING KORRAGA. Kuni päring käib, ei alusta teine vajutus uut (`running`
 * on viide, mitte seis: topeltvajutus jõuab siia enne, kui nupp jõuab end
 * keelata). Välju päringu ajaks ei keelata: keelamine võtaks väljalt fookuse.
 *
 * @returns {{ busy: string, message: string, setMessage: (text: string) => void, run: Function }}
 */

import { useCallback, useRef, useState } from "react";

import { isConflict, supervisionMessage, supervisionRequest } from "../supervisionClient";

export default function usePartRequest({ t, onReload, onConflict }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const running = useRef(false);

  const run = useCallback(
    async (key, url, { method = "POST", body } = {}) => {
      if (running.current) return false;
      running.current = true;
      setBusy(key);
      setMessage("");
      try {
        const { ok, status, payload } = await supervisionRequest(url, { method, body });
        if (!ok) {
          if (isConflict(status)) {
            await onConflict?.(payload);
            return false;
          }
          setMessage(supervisionMessage({ status, payload, t, fallbackKey: "supervision.errors.save_failed" }));
          return false;
        }
        await onReload?.();
        return true;
      } catch {
        setMessage(t("supervision.errors.save_failed"));
        return false;
      } finally {
        running.current = false;
        setBusy("");
      }
    },
    [onConflict, onReload, t]
  );

  return { busy, message, setMessage, run };
}
