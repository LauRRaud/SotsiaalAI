"use client";

/**
 * Juhtumi sektsioonide (ettevalmistus, märge, STAR2 järjekord, ülekandeajalugu)
 * ühine andmekiht: üks kirjutus korraga ja lehekülgede kaupa laaditav loend.
 *
 * MIKS ÜHES KOHAS. Neli sektsiooni kandsid igaüks oma koopiat samast kahest
 * asjast: „käivita päring, pane viga tõlkevõtmena kirja" ja „laadi loend
 * cursor'iga". Neli koopiat tähendab, et parandus jõuab kolme ja neljas jääb
 * maha.
 *
 * JSX-i siin ei ole: vaated on failides `./*.jsx`, read ja reeglid failis
 * `./sectionRows.js`.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { caseWorkRequest } from "../caseWorkClient";

const PAGE_SIZE = 25;

/**
 * Sektsiooni kirjutused: korraga käib üks, viga jõuab pinnale tõlkevõtmena.
 *
 * `run(task)` annab ülesande tulemuse või `null` (tõrge VÕI teine päring juba
 * käib). VÄLJAD JÄÄVAD PÄRINGU AJAKS LAHTI: välja keelamine viskaks fookuse
 * minema ja pooleli lause jääks kirjutamata. Topeltvajutuse eest kaitseb see
 * siin (`busyRef` kohe, mitte järgmise joonistuse `busy`).
 */
/**
 * Teade vanemale („midagi muutus"), mille tõrge ei ole selle teo tõrge.
 *
 * Vanem laeb teate peale juhtumi uuesti. Kui see laadimine ebaõnnestub, on
 * sektsiooni enda tegu ikkagi tehtud: tagasilükatud lubadus ei tohi jääda
 * käsitlemata ega muuta õnnestunud tegu veaks.
 */
export function notify(callback) {
  try {
    const result = callback?.();
    if (result && typeof result.catch === "function") result.catch(() => {});
  } catch {
    /* vanema värskendus ebaõnnestus; sektsiooni tegu on tehtud */
  }
}

/**
 * Loendist avatava kirje laadimine: `open(id)` märgib rea laadimise ajaks
 * (`openingId`) ja võtab märgi maha, kui just SEE laadimine lõppes. Kui inimene
 * vajutas vahepeal teist rida, jääb märk selle teise külge.
 */
export function useRowOpening(load) {
  const [openingId, setOpeningId] = useState(null);
  const open = useCallback(
    async (id) => {
      setOpeningId(id);
      try {
        await load(id);
      } finally {
        setOpeningId((current) => (current === id ? null : current));
      }
    },
    [load]
  );
  return { openingId, open };
}

export function useSectionRun() {
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState(null);
  const busyRef = useRef(false);

  const run = useCallback(async (task) => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    setErrorKey(null);
    try {
      return await task();
    } catch (error) {
      setErrorKey(error?.messageKey || "casework.errors.unexpected");
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, errorKey, setErrorKey, run };
}

/**
 * Juhtumi alamloend (ettevalmistused, märkmed, elemendid, ülekanded).
 *
 * PAGINEERIMINE ON KOHUSTUSLIK. Ilma cursor'ita jäid vanemad kui 25 rida
 * liidesest kättesaamatuks: teenuskiht toetab lehekülgi ja pind ei tohi seda
 * võimalust ära visata. Juhtumitöö on pikk, 25 kohtumist ei ole palju.
 *
 * `status` ütleb, kas loend on päriselt kohal: `loading` kuni esimese
 * vastuseni, `error`, kui esimene laadimine ebaõnnestus, muidu `ready`. „Ridu
 * ei ole" tohib öelda ainult `ready` juures: ebaõnnestunud laadimise järel
 * oleks see väljamõeldud vastus.
 *
 * `onLoaded(rows)` kutsutakse pärast iga TÄISlaadimist (mitte „näita rohkem"
 * järel): juhtumi ülevaade näitab osa esimest rida. `onError(võti)` saab
 * tõrke tõlkevõtme. Mõlemad on viited, mitte sõltuvused: muidu laadiks vanema
 * iga uus funktsioon loendi uuesti.
 *
 * @param {{ path: string, locale?: string, reloadKey?: unknown, onLoaded?: Function, onError?: Function }} input
 */
export function useCaseList({ path, locale, reloadKey = null, onLoaded, onError }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [status, setStatus] = useState("loading");

  const loadedRef = useRef(onLoaded);
  const errorRef = useRef(onError);
  useEffect(() => {
    loadedRef.current = onLoaded;
    errorRef.current = onError;
  }, [onLoaded, onError]);

  const load = useCallback(
    async ({ cursor: from = null, append = false } = {}) => {
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (from) params.set("cursor", from);
        const body = await caseWorkRequest(`${path}?${params.toString()}`, { locale });
        const rows = body.items || [];
        setItems((previous) => (append ? [...previous, ...rows] : rows));
        setCursor(body.nextCursor || null);
        setStatus("ready");
        if (!append) loadedRef.current?.(rows);
        return true;
      } catch (error) {
        /* Juba laaditud read jäävad ette: tõrge „näita rohkem" või värskenduse
           ajal ei tee loendit tühjaks. */
        setStatus((previous) => (previous === "ready" ? previous : "error"));
        errorRef.current?.(error?.messageKey || "casework.errors.unexpected");
        return false;
      }
    },
    [locale, path]
  );

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  /** Uus katse pärast ebaõnnestunud esimest laadimist. */
  const retry = useCallback(() => {
    setStatus("loading");
    return load();
  }, [load]);

  return { items, cursor, status, load, retry };
}
