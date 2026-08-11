/**
 * VÄLISE TEENUSEPAKKUJA KUTSEL ON AJAPIIR JA TA KANNAB KLIENDI KATKESTUST (SOL-VOICE-02).
 *
 * MIS OLI VALESTI. STT väline fetch, OpenAI STT SDK-kutse ning Google ja OpenAI TTS
 * sünteesikutsed olid kõik ilma ajapiirita ja ilma päringu signaalita. Aeglane või poolavatud
 * provider hoidis seega Next-i töölõnga, kasutaja liidese JA kasutusreservatsiooni määramata
 * aja kinni: vabastus elab `catch`-is, kuhu igavesti ootel promise ei jõua kunagi. Ainus
 * ajapiir kogu pinnal oli katselise TartuNLP fetch'i oma.
 *
 * MIS SIIN ON. Üks signaal, mis kannab KAHTE eri sündmust, ja mõlemad on eristatavad:
 *
 *   - **timeout** (`TimeoutError`) — meie oma ülempiir. Kasutaja ootab veel, aga meie ei oota:
 *     vastus on 504 ja reservatsioon vabaneb.
 *   - **kliendi katkestus** (`AbortError`) — kasutaja vajutas Stop või lahkus lehelt. Töö
 *     lõpetatakse ka provideri poolel, sest signaal antakse kutsesse edasi (SOL-VOICE-03).
 *
 * Eristus ei ole kosmeetika: „kasutaja katkestas" ei ole tõrge, mida logisse veaks kirjutada,
 * ja „meie ajapiir sai täis" ei ole midagi, mille eest kasutaja peaks maksma. Kumbki jõuab
 * marsruudini eri koodiga, seega mõlemad on eraldi mõõdetavad.
 *
 * MIKS `AbortSignal.any` JA `AbortSignal.timeout`, mitte oma `setTimeout` + `controller`:
 * ise kokku pandud taimer jätab lahtise `setTimeout`-i iga õnnestunud kutse järel (kutsuja
 * peab meeles pidama `clearTimeout`-i, ja just see unustatakse) ning kaotab põhjuse — oma
 * `controller.abort()` annab `AbortError`, seega timeout ja kasutaja Stop näevad välja
 * ÜHTEMOODI. Siin tuleb põhjus platvormilt.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

function positiveMs(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

/** Kõne transkribeerimine on pikem toiming kui süntees, seega eraldi piirid. */
export const STT_PROVIDER_TIMEOUT_MS = positiveMs(process.env.STT_PROVIDER_TIMEOUT_MS, 60_000);
export const TTS_PROVIDER_TIMEOUT_MS = positiveMs(process.env.TTS_PROVIDER_TIMEOUT_MS, 20_000);

/**
 * Signaal, mis katkestab kutse ENNE seda, kui providerist saab ummik.
 *
 * @param requestSignal marsruudi `req.signal` — kliendi katkestus. Puuduv signaal on lubatud
 *                      (nt taustatöö), siis jääb ainult ajapiir.
 * @param timeoutMs     rakenduse ülempiir.
 */
export function providerAbortSignal(requestSignal, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const timeout = AbortSignal.timeout(positiveMs(timeoutMs, DEFAULT_TIMEOUT_MS));
  if (!requestSignal || typeof requestSignal.addEventListener !== "function") {
    return timeout;
  }
  return AbortSignal.any([requestSignal, timeout]);
}

/**
 * Marsruudi enda ajapiir ka siis, kui SDK signaali eirab.
 *
 * `fetch` katkeb signaali peale päriselt, aga iga klienditeek ei tee seda: gRPC-kliendil on
 * oma ajapiiri parameeter ja mõni SDK ignoreerib `signal`-it vaikides. Ilma selle kihita
 * sõltuks „Next-i töölõng ei jää kinni" sellest, kas KOLMAS OSAPOOL käitub hästi — ja just
 * see eeldus oli leiu sees. Signaal antakse kutsesse ikka edasi (et ka ülesvool lõpetaks),
 * see siin on lisaks, mitte asemel.
 */
export function withAbort(promise, signal) {
  if (!signal || typeof signal.addEventListener !== "function") return promise;
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

/** Meie ülempiir sai täis. */
export function isProviderTimeout(error) {
  return error?.name === "TimeoutError" || error?.code === "ETIMEDOUT";
}

/** Kasutaja katkestas — Stop, navigeerimine, vahekaardi sulgemine. */
export function isClientAbort(error) {
  return error?.name === "AbortError" || error?.code === "ABORT_ERR";
}

/**
 * Marsruudi jaoks üks otsus kolmes tükis, et iga kutsekoht ei kirjutaks oma varianti.
 *
 * `aborted` tähendab, et vastust EI OLE ja seda ei tule — mõlemal juhul tuleb reservatsioon
 * vabastada. Erinevus on ainult selles, mida kasutajale öelda ja kas logisse kirjutada.
 */
export function describeProviderFailure(error) {
  if (isProviderTimeout(error)) {
    return { aborted: true, reason: "provider_timeout", status: 504, log: true };
  }
  if (isClientAbort(error)) {
    return { aborted: true, reason: "client_aborted", status: 499, log: false };
  }
  return { aborted: false, reason: "provider_failed", status: 502, log: true };
}
