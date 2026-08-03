/**
 * TEENUSPÄEVIK — PÄRIS TEEPIKKUS ISE MAJUTATUD MARSRUUDIMOOTORIST.
 *
 * MIKS ISE MAJUTATUD JA MITTE GOOGLE/MAPBOX. Marsruudi küsimine tähendab
 * lähte- ja sihtkoordinaadi saatmist teenusepakkujale — ja meie lähtepunktid
 * on KLIENTIDE KODUD. See on platvormi kõige tundlikum andmestik ja tema
 * saatmine kolmandale osapoolele „selleks, et kilomeetrid oleksid täpsemad"
 * oleks halb vahetus. OSRM töötab meie enda serveris, kuulab AINULT
 * `127.0.0.1` peal ja ükski koordinaat ei lahku masinast.
 *
 * MIDA SEE MUUDAB. Seni oli kilomeeter „linnulennult × 1,3" — aus hinnang,
 * aga hinnang. Nüüd on ta PÄRIS TEEPIKKUS: mööda teid, ühesuunalisi arvestades.
 * Sõidupäeviku rida lakkab olemast ligikaudne ja muutub esitatavaks.
 *
 * KOLM REEGLIT:
 *
 * 1. TÕRGE EI OLE VIGA, VAID VARUVARIANT. Kui mootor ei vasta (teenus maas,
 *    aeglane, koordinaate ei ole), tagastame `null` ja kutsuja jääb
 *    linnulennulise hinnangu juurde. Sõidupäevik ei tohi kaduda sellepärast,
 *    et üks abiteenus on maas.
 *
 * 2. AJAPIIRANG ON LÜHIKE. Päeva vaade laeb neid ridu kaupa; sekundeid ootav
 *    marsruudipäring teeks lehe kasutuskõlbmatuks. Parem kiire hinnang kui
 *    aeglane täpsus.
 *
 * 3. MOOTOR ON VALIKULINE. Ilma `SERVICE_LOG_OSRM_URL`-ita käitub kõik täpselt
 *    nagu enne — funktsioon on lipp iseenda ees.
 */

const DEFAULT_TIMEOUT_MS = 2500;

export function osrmBaseUrl(env = process.env) {
  const raw = String(env.SERVICE_LOG_OSRM_URL || "").trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

export function isRoutingEnabled(env = process.env) {
  return Boolean(osrmBaseUrl(env));
}

const isPoint = (point) =>
  Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng));

/**
 * Päris teepikkus ja -aeg kahe punkti vahel.
 *
 * @returns `{ km, minutes, geometry }` või `null`. `geometry` on GeoJSON
 *   `LineString` koordinaadid kaardile joonistamiseks.
 */
export async function routeBetween(from, to, { env = process.env, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const base = osrmBaseUrl(env);
  if (!base || !isPoint(from) || !isPoint(to)) return null;

  /* OSRM ootab järjekorda LNG,LAT — vastupidi sellele, kuidas inimesed
     koordinaate ütlevad. See on klassikaline vaikne viga: vahetatud paar annab
     vastuse, mis on lihtsalt vale. */
  const coords = `${Number(from.lng)},${Number(from.lat)};${Number(to.lng)},${Number(to.lat)}`;
  const url = `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=false&steps=false`;

  const controller = new AbortController();
  const timer = setTimeout(() => {
    try {
      controller.abort();
    } catch {}
  }, Math.max(300, timeoutMs));

  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response?.ok) return null;
    const body = await response.json();
    const route = body?.routes?.[0];
    if (!route || !Number.isFinite(Number(route.distance))) return null;
    return {
      km: Math.round((Number(route.distance) / 1000) * 10) / 10,
      minutes: Math.round(Number(route.duration || 0) / 60),
      geometry: Array.isArray(route.geometry?.coordinates) ? route.geometry.coordinates : null
    };
  } catch {
    /* Vt reegel 1: tõrge on varuvariant, mitte viga. */
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Terve päeva marsruut ühe päringuga.
 *
 * ÜKS PÄRING, MITTE N TÜKKI. Kümme järjestikust päringut tähendaks kümme
 * ajapiirangut ja päeva vaate, mis laeb sekundeid. OSRM annab mitme punktiga
 * marsruudi lõikude kaupa ühe vastusega.
 *
 * @returns `{ legs: [{ km, minutes }], km, minutes, geometry }` või `null`
 */
export async function routeDay(points = [], { env = process.env, timeoutMs = 4000, fetchImpl = fetch } = {}) {
  const base = osrmBaseUrl(env);
  const clean = points.filter(isPoint);
  if (!base || clean.length < 2) return null;

  const coords = clean.map((point) => `${Number(point.lng)},${Number(point.lat)}`).join(";");
  const url = `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=false&steps=false`;

  const controller = new AbortController();
  const timer = setTimeout(() => {
    try {
      controller.abort();
    } catch {}
  }, Math.max(500, timeoutMs));

  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response?.ok) return null;
    const body = await response.json();
    const route = body?.routes?.[0];
    if (!route) return null;
    return {
      legs: (route.legs || []).map((leg) => ({
        km: Math.round((Number(leg.distance || 0) / 1000) * 10) / 10,
        minutes: Math.round(Number(leg.duration || 0) / 60)
      })),
      km: Math.round((Number(route.distance || 0) / 1000) * 10) / 10,
      minutes: Math.round(Number(route.duration || 0) / 60),
      geometry: Array.isArray(route.geometry?.coordinates) ? route.geometry.coordinates : null
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
