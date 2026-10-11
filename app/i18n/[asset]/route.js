import { packedCatalogAsset, resolveCatalogAsset } from "@/lib/i18n/catalogAsset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tekstikataloog skriptifailina: `/i18n/<keel>.<räsi>.js`.
 *
 * Avalik fail (samad tekstid olid enne iga lehe HTML-is, ka sisselogimata
 * lehtedel): sisselogimist ei küsita ja küpsiseid ei loeta.
 *
 * VAHEMÄLU. Nimes on sisu räsi, seega õige räsiga fail ei muutu kunagi:
 * brauser hoiab seda aasta ja uuesti ei küsi (`immutable`). Vana räsiga nimi
 * (leht on avatud enne tekstide muutumist) saab praeguse kataloogi ilma
 * vahemäluta: leht jääb tööle, aga vale sisu ei jää vana nime alla hoiule.
 *
 * PAKKIMINE. Server selle marsruudi vastust ise ei paki, seepärast pakib fail
 * end ise (brotli või gzip brauseri päise järgi, vt lib/i18n/catalogAsset.js).
 */
export async function GET(request, { params }) {
  const { asset: name } = await params;
  const asset = resolveCatalogAsset(name);
  if (!asset) {
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
  const { bytes, encoding } = await packedCatalogAsset(asset, request.headers.get("accept-encoding"));
  const headers = {
    "Content-Type": "text/javascript; charset=utf-8",
    "Content-Length": String(bytes.length),
    "Cache-Control": asset.current ? "public, max-age=31536000, immutable" : "no-store",
    Vary: "Accept-Encoding"
  };
  if (encoding) headers["Content-Encoding"] = encoding;
  return new Response(bytes, { status: 200, headers });
}
