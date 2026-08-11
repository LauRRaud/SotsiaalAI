import { isAbortError } from "@/lib/client/latestRequestGate";

/**
 * RUUMI SÕNUMIVOOG KUULUB ÜHELE RUUMILE KORRAGA (SOL-ROOM-02, SOL-ROOM-03).
 *
 * MIS OLI VALESTI, kaks leidu ühes olekumasinas:
 *
 *  -02: laadimispäring ei kandnud abort-signaali ega põlvkonda, seega ruumi A hiline vastus
 *       kirjutas ruumi B vaatesse A ajaloo. Kasutaja võis olla mõlema õigustatud liige, aga
 *       sisu ilmus vale osalejaskonna all — ekraani jagamisel või kliendikohtumisel on see
 *       praktiline konfidentsiaalsusleke. Pealkirja valvas `metaMatchesRoom`, sõnumiloendil
 *       samaväärset valvet EI OLNUD.
 *
 *  -03: React-effect sõltus `load`-ist ja `connectSse`-st, need omakorda `useSse`, `blocked`
 *       ja `authRequired` OLEKUTEST. `onopen` seadis `useSse=true` → callback'id sündisid
 *       uuesti → cleanup sulges just avatud ühenduse → uus ühendus. 401/403 seadsid lipud,
 *       mille järgmine effect-jooks kohe nullis: keelatud sessioon küsis lõputult edasi.
 *
 * MIKS SEE ON REACTIST VÄLJAS. Mõlemad leiud ON ajastus, ja ajastust ei saa tõendada
 * lähtekoodi kuju vaadates. Testijooksja ei renderda hooke, seega otsused elavad siin —
 * täpselt nagu SOL-CALL-11…-13 puhul (`lib/calls/clientState.js`). Hook on kest, mis annab
 * siia päris `fetch`-i ja `EventSource`-i ning peegeldab seisu Reacti.
 *
 * KOLM INVARIANTI, mida see moodul kannab:
 *   1. iga võrguvastus küsib enne kirjutamist `isCurrent()` — suletud seanss ei kirjuta;
 *   2. sulgemine katkestab päringu, taimerid ja voo, ning hiline vastus ei ärata neid ellu;
 *   3. 401/403 on TERMINAALSED seansi sees, mitte olekus, mille järgmine jooks nullib.
 */

function toMillis(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function compareRoomMessagesAsc(a, b) {
  const ta = toMillis(a?.createdAt);
  const tb = toMillis(b?.createdAt);
  if (ta !== tb) return ta - tb;
  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

export function mergeById(prev, incoming) {
  const map = new Map();
  (Array.isArray(prev) ? prev : []).forEach(msg => {
    if (!msg?.id) return;
    map.set(msg.id, msg);
  });
  (Array.isArray(incoming) ? incoming : []).forEach(msg => {
    if (!msg?.id) return;
    const existing = map.get(msg.id);
    map.set(msg.id, existing ? { ...existing, ...msg } : msg);
  });
  return Array.from(map.values()).sort(compareRoomMessagesAsc);
}

export const EMPTY_ROOM_META = Object.freeze({
  roomId: "",
  roomTitle: "",
  roomRole: "",
  isHelpMatchRoom: false,
  roomOrigin: null,
  summaryApprovals: []
});

const READ_MARK_THROTTLE_MS = 5000;
const MAX_RECONNECT_MS = 30000;

/**
 * @param onChange  `(state) => void` — täielik seisupilt iga muutuse järel.
 * @returns `{ start, reload, close, getState, isClosed }`
 */
export function createRoomMessageSession({
  roomId,
  pollMs = 3000,
  initialIsHelpMatchRoom = false,
  onChange = () => {},
  fetchImpl = typeof fetch === "function" ? fetch : null,
  EventSourceImpl = typeof EventSource === "function" ? EventSource : null,
  origin = typeof window !== "undefined" ? window.location.origin : "http://localhost",
  timers = null,
  now = () => Date.now()
}) {
  const clock = timers || {
    setInterval: (...args) => setInterval(...args),
    clearInterval: (...args) => clearInterval(...args),
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: (...args) => clearTimeout(...args)
  };

  const roomKey = String(roomId || "");
  const roomPathId = encodeURIComponent(roomKey);
  const controller = typeof AbortController === "function" ? new AbortController() : null;

  const session = {
    cursor: null,
    es: null,
    pollTimer: null,
    reconnectTimer: null,
    retryMs: 2000,
    lastReadMarkAt: 0,
    sse: false,
    terminal: false,
    closed: false
  };

  const state = {
    messages: [],
    blocked: false,
    authRequired: false,
    useSse: false,
    meta: { ...EMPTY_ROOM_META, roomId: roomKey, isHelpMatchRoom: initialIsHelpMatchRoom }
  };

  const isCurrent = () => !session.closed;

  function emit() {
    if (session.closed) return;
    onChange({ ...state, messages: state.messages.slice(), meta: { ...state.meta } });
  }

  function stopPolling() {
    if (session.pollTimer) {
      clock.clearInterval(session.pollTimer);
      session.pollTimer = null;
    }
  }

  function startPolling() {
    if (session.terminal || session.pollTimer || !isCurrent()) return;
    session.pollTimer = clock.setInterval(() => { void load(false); }, pollMs);
  }

  function closeStream() {
    if (session.reconnectTimer) {
      clock.clearTimeout(session.reconnectTimer);
      session.reconnectTimer = null;
    }
    if (session.es) {
      try {
        session.es.close();
      } catch {}
      session.es = null;
    }
  }

  /** 401/403: lõplik kuni ruumi või sessiooni muutuseni. Ilma temata küsis klient edasi. */
  function goTerminal(kind) {
    session.terminal = true;
    session.sse = false;
    stopPolling();
    closeStream();
    if (!isCurrent()) return;
    state.messages = [];
    state.authRequired = kind === "auth";
    state.blocked = kind === "blocked";
    state.useSse = false;
    emit();
  }

  async function markRead(force = false) {
    if (session.terminal || !isCurrent()) return;
    const at = now();
    if (!force && at - session.lastReadMarkAt < READ_MARK_THROTTLE_MS) return;
    session.lastReadMarkAt = at;
    try {
      await fetchImpl(`/api/rooms/${roomPathId}/read`, {
        method: "PUT",
        signal: controller?.signal
      });
    } catch {}
  }

  async function load(reset = false) {
    if (session.terminal || !isCurrent() || !roomKey) return;

    const url = new URL(`/api/rooms/${roomPathId}/messages`, origin);
    if (!reset && session.sse && session.cursor) {
      url.searchParams.set("cursor", session.cursor);
    }

    let res;
    let data;
    try {
      res = await fetchImpl(url.toString(), { signal: controller?.signal });
      data = await res.json().catch(() => ({}));
    } catch (error) {
      // Katkestatud päring EI ole tõrge: ruum vahetus või vaade võeti maha.
      if (!isAbortError(error)) throw error;
      return;
    }

    // SIIN oli leid: vastus võib saabuda pärast ruumivahetust.
    if (!isCurrent()) return;

    if (res.status === 401) return goTerminal("auth");
    if (res.status === 403) return goTerminal("blocked");
    if (!res.ok || data?.ok === false) return;

    state.authRequired = false;
    state.blocked = false;
    state.meta = {
      roomId: roomKey,
      roomTitle: String(data.roomTitle || ""),
      roomRole: String(data.roomRole || "").trim().toUpperCase(),
      isHelpMatchRoom: data.isHelpMatchRoom === true,
      roomOrigin: data.roomOrigin && typeof data.roomOrigin === "object" ? data.roomOrigin : null,
      /* T20 P2: aktiivsete kinnitusringide seis tuleb sama päringuga. */
      summaryApprovals: Array.isArray(data.summaryApprovals) ? data.summaryApprovals : []
    };

    const items = Array.isArray(data.messages) ? data.messages.slice().reverse() : [];
    if (reset) {
      state.messages = items;
      session.cursor = data.nextCursor || null;
      emit();
      void markRead(true);
      return;
    }
    state.messages = mergeById(state.messages, items);
    emit();
    void markRead(false);
  }

  function connectSse() {
    if (session.terminal || !isCurrent() || !EventSourceImpl || !roomKey) return;
    closeStream();

    const es = new EventSourceImpl(`/api/rooms/${roomPathId}/messages/stream`);
    session.es = es;

    es.onopen = () => {
      if (!isCurrent() || session.es !== es) {
        try {
          es.close();
        } catch {}
        return;
      }
      session.sse = true;
      session.retryMs = 2000;
      stopPolling();
      state.useSse = true;
      emit();
    };

    es.onerror = () => {
      if (session.es !== es) return;
      session.sse = false;
      session.es = null;
      try {
        es.close();
      } catch {}
      if (!isCurrent() || session.terminal) return;
      state.useSse = false;
      emit();
      startPolling();
      const delay = Math.min(MAX_RECONNECT_MS, session.retryMs);
      session.retryMs = Math.min(MAX_RECONNECT_MS, session.retryMs * 2);
      session.reconnectTimer = clock.setTimeout(() => {
        session.reconnectTimer = null;
        connectSse();
      }, delay);
    };

    es.onmessage = ev => {
      if (!isCurrent() || session.es !== es) return;
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "message" && data.message) {
          state.messages = mergeById(state.messages, [data.message]);
          emit();
          void markRead(false);
        } else if (data.type === "delete" && data.id) {
          state.messages = state.messages.filter(m => m.id !== data.id);
          emit();
        }
      } catch {}
    };
  }

  return {
    start() {
      if (!roomKey) return;
      void load(true);
      startPolling();
      connectSse();
    },
    reload() {
      return load(true);
    },
    close() {
      session.closed = true;
      stopPolling();
      closeStream();
      try {
        controller?.abort();
      } catch {}
    },
    isClosed: () => session.closed,
    getState: () => ({ ...state, messages: state.messages.slice(), meta: { ...state.meta } }),
    /** Ainult testidele ja diagnostikale: kas voog on terminaalses seisus. */
    isTerminal: () => session.terminal
  };
}
