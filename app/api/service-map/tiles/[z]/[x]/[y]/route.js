import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import { fetchServiceMapTile, parseServiceMapTileCoordinates } from "@/lib/serviceMap/tileProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERROR_HEADERS = { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" };

export async function GET(request, context = {}, deps = {}) {
  const params = await context.params;
  const coords = parseServiceMapTileCoordinates(params);
  if (!coords) return new Response("", { status: 400, headers: ERROR_HEADERS });
  const limiter = (deps.consumeRateLimit || consumeRateLimit)(`service-map:tile:${getRequestIpFromRequest(request)}`, 600, 60_000);
  if (!limiter.allowed) return new Response("", { status: 429, headers: ERROR_HEADERS });
  const result = await fetchServiceMapTile(coords, { fetchImpl: deps.fetchImpl, requestSignal: request.signal });
  if (!result.ok) return new Response("", { status: result.status, headers: ERROR_HEADERS });
  return new Response(result.bytes, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "image/png",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
