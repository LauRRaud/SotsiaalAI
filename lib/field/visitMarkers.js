/**
 * FIELD-V1 — SAABUMISE JA LAHKUMISE MARKERID (doc ptk 3, SOL-FIELD-04).
 *
 * MIKS SEE ON OMA MOODUL. Marker on välitöötaja ainus tõend selle kohta, et ta
 * kohal käis, ja ta sünnib just siis, kui võrku EI OLE. Vana kood elas kahes
 * `useCallback`-is ja tegi kolm viga, mida ilma Reactita mõõta ei saanud:
 *
 *  1. `storePack()` koostas payload'i KINNISE väljaloendi järgi ega kopeerinud
 *     kumbagi markerivälja — marker oli kadunud juba järgmisel lugemisel, kuigi
 *     ekraan ütles „salvestatud";
 *  2. sama kutse ANDIS ETTE võltsvisiidi (`{ id, ...markers }`), seega läks
 *     ülekirjutamisel kaotsi ka kogu ettevalmistuspaketi sisu — eesmärk,
 *     asukoht ja OHUTUSINFO — mille inimene just offline-kasutuseks võttis;
 *  3. flush eemaldas markeri PÄRAST IGA täidetud päringut, vastuse staatust
 *     vaatamata: 401, 409, 429 ja 500 kustutasid tõendi samamoodi nagu edu.
 *
 * LEPING SIIN: marker kaob AINULT kahel juhul — server vastas 2xx, või värske
 * külastus tõendab, et sama sündmus on juba olemas. Kõik muu jätab ta alles ja
 * annab talle NÄHTAVA tõrkeseisu. Vaikne kadu on keelatud, sest ta on
 * eristamatu edust.
 */

/** Pakiskeem on nüüd versioonitud — marker EI OLE lahtine väli payload'i sees. */
export const FIELD_PACK_SCHEMA_VERSION = 2;

export const FIELD_MARKER = Object.freeze({
  ARRIVAL: "arrival",
  DEPARTURE: "departure"
});

export const FIELD_MARKERS = Object.freeze(Object.values(FIELD_MARKER));

export const FIELD_MARKER_STATE = Object.freeze({
  PENDING: "PENDING",
  FAILED: "FAILED"
});

/** Tõrke põhjus on ANDMEVÄLI, mitte tekst — liides tõlgib ta ise. */
export const FIELD_MARKER_REASON = Object.freeze({
  AUTH: "auth",
  CONFLICT: "conflict",
  RATE_LIMIT: "rate_limit",
  SERVER: "server",
  NETWORK: "network"
});

const MARKER_ACTION = Object.freeze({
  [FIELD_MARKER.ARRIVAL]: "confirm_arrival",
  [FIELD_MARKER.DEPARTURE]: "confirm_departure"
});

const MARKER_SERVER_FIELD = Object.freeze({
  [FIELD_MARKER.ARRIVAL]: "arrivedConfirmedAt",
  [FIELD_MARKER.DEPARTURE]: "departedConfirmedAt"
});

export function fieldMarkerAction(which) {
  return MARKER_ACTION[which] || null;
}

export function fieldMarkerServerField(which) {
  return MARKER_SERVER_FIELD[which] || null;
}

/**
 * Vastuse staatus → otsus.
 *
 * SEE ON LEID ISE, ühe funktsioonina: `ok` otsustab AINULT 2xx, ja mitte ükski
 * tõrge ei anna „kustuta". Tundmatu staatus läheb `SERVER`-i alla, sest
 * vaikimisi ALLES on ainus suund, mis ei kaota tõendit.
 */
export function classifyMarkerResponse(status) {
  const code = Number(status) || 0;
  if (code >= 200 && code < 300) return { ok: true, reason: null };
  if (code === 401 || code === 403) return { ok: false, reason: FIELD_MARKER_REASON.AUTH };
  if (code === 409) return { ok: false, reason: FIELD_MARKER_REASON.CONFLICT };
  if (code === 429) return { ok: false, reason: FIELD_MARKER_REASON.RATE_LIMIT };
  if (!code) return { ok: false, reason: FIELD_MARKER_REASON.NETWORK };
  return { ok: false, reason: FIELD_MARKER_REASON.SERVER };
}

function emptyMarkers() {
  return { [FIELD_MARKER.ARRIVAL]: null, [FIELD_MARKER.DEPARTURE]: null };
}

function normalizeMarker(value) {
  if (!value || typeof value !== "object" || !value.at) return null;
  return {
    at: String(value.at),
    state: value.state === FIELD_MARKER_STATE.FAILED ? FIELD_MARKER_STATE.FAILED : FIELD_MARKER_STATE.PENDING,
    reason: value.reason || null,
    attempts: Number(value.attempts || 0),
    lastTriedAt: value.lastTriedAt || null
  };
}

/**
 * Loe markerid payload'ist ja tõsta VANA kuju uude.
 *
 * Vana lahtine väli (`localArrivalAt`) ei jõudnud tegelikult kunagi kettale —
 * see oligi viga. Aga kui mõnel seadmel ta siiski on, EI tohi skeemivahetus teda
 * ära visata: tõendi kaotamine on täpselt see, mida siin parandatakse.
 */
export function readPackMarkers(payload) {
  const markers = emptyMarkers();
  if (!payload || typeof payload !== "object") return markers;

  for (const which of FIELD_MARKERS) {
    markers[which] = normalizeMarker(payload.markers?.[which]);
  }
  const legacy = {
    [FIELD_MARKER.ARRIVAL]: payload.localArrivalAt,
    [FIELD_MARKER.DEPARTURE]: payload.localDepartureAt
  };
  for (const which of FIELD_MARKERS) {
    if (!markers[which] && legacy[which]) {
      markers[which] = normalizeMarker({ at: legacy[which], state: FIELD_MARKER_STATE.PENDING });
    }
  }
  return markers;
}

export function hasPendingMarkers(payload) {
  const markers = readPackMarkers(payload);
  return FIELD_MARKERS.some((which) => Boolean(markers[which]));
}

function withMarkers(payload, markers) {
  const next = { ...(payload || {}), schemaVersion: FIELD_PACK_SCHEMA_VERSION, markers };
  // Vana kuju ei jää kummitama, kui ta on uude tõstetud.
  delete next.localArrivalAt;
  delete next.localDepartureAt;
  return next;
}

/**
 * Inimene kinnitas saabumise või lahkumise ilma võrguta.
 *
 * IDEMPOTENTNE: teine vajutus EI liiguta aega. Esimene kord, mil inimene ütles
 * „ma olen kohal", on tõde; hilisem vajutus ei tohi seda ilusamaks teha.
 */
export function applyLocalMarker(payload, which, now = new Date()) {
  if (!FIELD_MARKERS.includes(which)) return payload || {};
  const markers = readPackMarkers(payload);
  if (!markers[which]) {
    markers[which] = {
      at: now.toISOString(),
      state: FIELD_MARKER_STATE.PENDING,
      reason: null,
      attempts: 0,
      lastTriedAt: null
    };
  }
  return withMarkers(payload, markers);
}

/** Marker on läinud: server on ta üle võtnud. */
export function clearLocalMarker(payload, which) {
  const markers = readPackMarkers(payload);
  markers[which] = null;
  return withMarkers(payload, markers);
}

function failMarker(marker, reason, now) {
  return {
    ...marker,
    state: FIELD_MARKER_STATE.FAILED,
    reason,
    attempts: Number(marker.attempts || 0) + 1,
    lastTriedAt: now.toISOString()
  };
}

/**
 * Üks flush-käik.
 *
 * `fetchImpl` on süstitav, sest just VASTUSE KÄSITLUS on see, mis katki oli —
 * teda peab saama mõõta ilma serverita ja ilma brauseri võrgukihita.
 *
 * @returns `{ confirmed, kept, failedReasons }`
 */
export async function flushVisitMarkers({ store, visitId, fetchImpl, now = new Date() } = {}) {
  const result = { confirmed: [], kept: [], reasons: {} };
  const id = String(visitId || "").trim();
  if (!store?.getPack || !id || typeof fetchImpl !== "function") return result;

  const pack = await store.getPack(id);
  if (!pack) return result;
  let markers = readPackMarkers(pack.payload);
  const pending = FIELD_MARKERS.filter((which) => markers[which]);
  if (!pending.length) return result;

  const base = `/api/field/visits/${encodeURIComponent(id)}`;
  const persist = async () => {
    await store.putPack({ ...pack, payload: withMarkers(pack.payload, markers) });
  };
  const keep = (which, reason) => {
    markers = { ...markers, [which]: failMarker(markers[which], reason, now) };
    result.kept.push(which);
    result.reasons[which] = reason;
  };

  let visit = null;
  try {
    const response = await fetchImpl(base, { method: "GET" });
    const decision = classifyMarkerResponse(response?.status);
    if (!decision.ok) {
      for (const which of pending) keep(which, decision.reason);
      await persist();
      return result;
    }
    visit = (await response.json())?.visit || null;
  } catch {
    for (const which of pending) keep(which, FIELD_MARKER_REASON.NETWORK);
    await persist();
    return result;
  }
  if (!visit) {
    for (const which of pending) keep(which, FIELD_MARKER_REASON.SERVER);
    await persist();
    return result;
  }

  for (const which of pending) {
    /* Detail tõendab sama sündmuse olemasolu — teist PATCH-i ei ole vaja ja
       marker on ausalt üle antud. */
    if (visit[fieldMarkerServerField(which)]) {
      markers = { ...markers, [which]: null };
      result.confirmed.push(which);
      continue;
    }
    try {
      const response = await fetchImpl(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: fieldMarkerAction(which), version: visit.version })
      });
      const decision = classifyMarkerResponse(response?.status);
      if (!decision.ok) {
        keep(which, decision.reason);
        continue;
      }
      markers = { ...markers, [which]: null };
      result.confirmed.push(which);
      /* Versioon liikus — järgmine marker peab kasutama uut, muidu saab ta 409
         iseenda eelkäija pärast. */
      const body = await response.json().catch(() => null);
      if (body?.visit) visit = body.visit;
    } catch {
      keep(which, FIELD_MARKER_REASON.NETWORK);
    }
  }

  await persist();
  return result;
}
