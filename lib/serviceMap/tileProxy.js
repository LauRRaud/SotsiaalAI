import { providerAbortSignal, isProviderTimeout } from "../net/providerRequest.js";

const MAX_TILE_BYTES = 2 * 1024 * 1024;
const UPSTREAM_BASE = "https://tiles.maaamet.ee/tm/tms/1.0.0/hallkaart@GMC";

export function parseServiceMapTileCoordinates(params = {}) {
  const values = [params.z, params.x, params.y].map((value) => Number(String(value).replace(/\.png$/i, "")));
  const [z, x, y] = values;
  if (!values.every(Number.isInteger) || z < 8 || z > 18 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) return null;
  return { z, x, y };
}

export async function fetchServiceMapTile(coords, { fetchImpl = globalThis.fetch, requestSignal } = {}) {
  const url = `${UPSTREAM_BASE}/${coords.z}/${coords.x}/${coords.y}.png&ASUTUS=SOTSIAALAI&KESKKOND=LIVE&IS=TEENUSEKAART`;
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "image/png", "User-Agent": "SotsiaalAI-ServiceMap-Proxy/1.0" },
      redirect: "error",
      signal: providerAbortSignal(requestSignal, 8_000)
    });
    if (!response.ok) return { ok: false, status: 502 };
    if (!String(response.headers.get("content-type") || "").toLowerCase().startsWith("image/png")) return { ok: false, status: 502 };
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_TILE_BYTES) return { ok: false, status: 502 };
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_TILE_BYTES) return { ok: false, status: 502 };
    return { ok: true, bytes };
  } catch (error) {
    return { ok: false, status: isProviderTimeout(error) ? 504 : 502 };
  }
}
