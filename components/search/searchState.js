/**
 * „Minu otsingu” lehe reeglid ilma joonistamiseta: mida küsitakse, mis jääb
 * ekraanile ja mida öeldakse, kui server keeldub. Leht
 * (PersonalSearchPage.jsx) ainult joonistab siit tuleva vaate. JSX-i ega
 * React'i siin ei ole, nii et reegleid kontrollib tests/personal-search.test.mjs
 * päris kutsetega.
 */

/* Üks rida = üks siht: sama kirje teist korda loendisse ei lähe. */
export function resultKey(item) {
  return `${item?.kind}:${item?.href}`;
}

/**
 * Liidab juurde laetud read ekraanil olevate lõppu. Juba nähtud siht jääb oma
 * kohale (uuema sisuga), uus läheb lõppu. `firstNewIndex` on esimese päriselt
 * lisandunud rea koht: sinna läheb fookus, et inimene jätkaks sealt, kus loend
 * enne lõppes (-1, kui ühtegi uut rida ei tulnud).
 */
export function mergeResults(current, incoming) {
  const before = Array.isArray(current) ? current : [];
  const byTarget = new Map(before.map((item) => [resultKey(item), item]));
  for (const item of Array.isArray(incoming) ? incoming : []) byTarget.set(resultKey(item), item);
  const rows = Array.from(byTarget.values());
  const added = rows.length - before.length;
  return { rows, added, firstNewIndex: added > 0 ? before.length : -1 };
}

/**
 * Mis keeldumisega on tegu. Kiirusepiir (429) ja kadunud seanss (401) saavad oma
 * lause: üldine „proovi uuesti” kutsus kohe uuesti proovima seal, kus see ei aita.
 * `seconds` tuleb serveri päisest Retry-After; 0 tähendab, et aega ei ole teada.
 */
export function faultFromResponse(status, retryAfter) {
  const code = Number(status) || 0;
  if (code === 401) return { kind: "session", seconds: 0 };
  if (code === 429) {
    const seconds = Math.ceil(Number(retryAfter));
    return { kind: "rate", seconds: Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 3600) : 0 };
  }
  return { kind: "general", seconds: 0 };
}

/**
 * Vaate seis pärast esimese lehe vastust. Kui ridu ei ole, aga mõni allikas jäi
 * lugemata, EI OLE see „vasteid ei leitud”: lugemata allikas võis vaste sisaldada.
 */
export function viewAfterFirstPage({ rows, unavailableKinds } = {}) {
  if (Array.isArray(rows) && rows.length) return "results";
  return Array.isArray(unavailableKinds) && unavailableKinds.length ? "partial-empty" : "empty";
}

/**
 * Üks päring serverile. Ekraanile jõuab ainult see, mis on kokku pandud serveri
 * vastusest: brauseri enda veateksti (nt „Failed to fetch”) siit edasi ei anta.
 * `fetch` loetakse kutse hetkel, mitte faili laadimisel.
 */
export async function requestSearchPage(body, signal, fetchImpl) {
  try {
    const response = await (fetchImpl || fetch)("/api/otsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) {
      return { ok: false, fault: faultFromResponse(response.status, response.headers?.get?.("Retry-After")) };
    }
    return {
      ok: true,
      rows: Array.isArray(payload.results) ? payload.results : [],
      hasMore: Boolean(payload?.pagination?.hasMore),
      nextCursor: payload?.pagination?.nextCursor || null,
      unavailable: Array.isArray(payload?.unavailableKinds) ? payload.unavailableKinds : []
    };
  } catch (error) {
    if (error?.name === "AbortError") return { aborted: true };
    return { ok: false, fault: faultFromResponse(0) };
  }
}

/**
 * Vaade, mida leht joonistab.
 *   state            idle | loading | results | empty | partial-empty | error
 *   fault            esimese lehe keeldumine (võtab loendi koha)
 *   moreFault        juurde laadimise keeldumine (seisab loendi lõpus, read jäävad)
 *   unavailableKinds allikad, mida viimane vastus lugeda ei saanud
 *   announce         mitu vastet tuli (ekraanilugeja rida)
 *   appended         viimane õnnestunud juurde laadimine: kuhu fookus läheb
 */
export const IDLE_VIEW = Object.freeze({
  state: "idle",
  results: [],
  hasMore: false,
  unavailableKinds: [],
  loadingMore: false,
  fault: null,
  moreFault: null,
  announce: null,
  appended: null
});

/* Mille kohta ekraanil olev loend käib: otsisõna, read ja järgmise lehe kursor. */
const NOTHING_SHOWN = Object.freeze({ query: "", rows: [], cursor: null });

/**
 * Ühe lehe otsingu käik.
 *
 * VÄLI EI OLE LOEND. `loadMore` küsib juurde selle otsingu ridu, mille loend on
 * ekraanil (sama sõna, selle loendi kursor), ükskõik mis parajasti väljal seisab:
 * välja teksti järgi küsides liitusid loendisse teise otsingu read ja esimese
 * loendi lõpp jäi kättesaamatuks; tühja väljaga kadus loend üldse.
 *
 * Juurde laadimise viga ei võta midagi ära: read ja kursor jäävad, uus vajutus
 * küsib sama lehte. Uus otsing algab puhtalt: eelmise otsingu teated (osaline
 * vastus, viga) ei käi selle kohta.
 */
export function createSearchSession({ request = requestSearchPage, onChange = () => {} } = {}) {
  let view = IDLE_VIEW;
  let shown = NOTHING_SHOWN;
  /* Viimati küsitud sõna: „Proovi uuesti” kordab sama küsimust. */
  let asked = "";
  let token = 0;
  let controller = null;
  let moreBusy = false;

  const show = (next) => {
    view = next;
    onChange(view);
  };
  /* Iga uus päring katkestab eelmise; hiljaks jäänud vastust ei rakendata. */
  const begin = () => {
    controller?.abort();
    controller = new AbortController();
    token += 1;
    return { mine: token, signal: controller.signal };
  };
  const stop = () => {
    controller?.abort();
    controller = null;
    token += 1;
    moreBusy = false;
  };

  async function search(text) {
    const query = String(text || "").trim();
    stop();
    shown = NOTHING_SHOWN;
    if (!query) {
      show(IDLE_VIEW);
      return;
    }
    asked = query;
    const { mine, signal } = begin();
    show({ ...IDLE_VIEW, state: "loading" });
    const answer = await request({ query, cursor: null }, signal);
    if (answer.aborted || mine !== token) return;
    if (!answer.ok) {
      show({ ...IDLE_VIEW, state: "error", fault: answer.fault });
      return;
    }
    shown = { query, rows: answer.rows, cursor: answer.nextCursor };
    show({
      ...IDLE_VIEW,
      state: viewAfterFirstPage({ rows: answer.rows, unavailableKinds: answer.unavailable }),
      results: answer.rows,
      hasMore: answer.hasMore,
      unavailableKinds: answer.unavailable,
      announce: { append: false, added: answer.rows.length, total: answer.rows.length, hasMore: answer.hasMore }
    });
  }

  async function loadMore() {
    /* Küsida saab ainult siis, kui ekraanil on loend, millel on veel lehti. Teine
       vajutus, kui esimene veel käib, ei saada teist päringut. */
    if (!shown.query || !view.hasMore || moreBusy) return;
    moreBusy = true;
    const list = shown;
    const { mine, signal } = begin();
    show({ ...view, loadingMore: true, moreFault: null });
    const answer = await request({ query: list.query, cursor: list.cursor }, signal);
    /* Katkestas uus otsing: selle seis on juba ekraanil. */
    if (answer.aborted || mine !== token) return;
    moreBusy = false;
    if (!answer.ok) {
      show({ ...view, loadingMore: false, moreFault: answer.fault });
      return;
    }
    const merged = mergeResults(list.rows, answer.rows);
    shown = { query: list.query, rows: merged.rows, cursor: answer.nextCursor };
    show({
      ...view,
      loadingMore: false,
      results: merged.rows,
      hasMore: answer.hasMore,
      unavailableKinds: answer.unavailable,
      announce: { append: true, added: merged.added, total: merged.rows.length, hasMore: answer.hasMore },
      appended: { firstNewIndex: merged.firstNewIndex }
    });
  }

  return {
    search,
    loadMore,
    retry: () => search(asked),
    /* Lehelt lahkumine: pooleli päring katkestatakse, hiljem tulevat vastust ei rakendata. */
    dispose: stop,
    view: () => view,
    shownQuery: () => shown.query
  };
}
