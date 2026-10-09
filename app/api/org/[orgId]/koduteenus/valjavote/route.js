import { enforceChatRateLimit } from "@/lib/chat-api-rate-limit";
import { createHomeCareExport, getHomeCareExportOverview, prepareHomeCareExport } from "@/lib/homeCare/export";

import { homeCareRoute, orgJson, readJsonBody } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Väljavõtte lehe sisu: põhiarvud ja viimased väljavõtted. Ainult kogu asutuse hooldusjuht. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) =>
    orgJson({ ok: true, ...(await getHomeCareExportOverview(auth.context)) })
  );
}

/**
 * Täielik väljavõte ühe JSON-failina.
 *
 * POST, mitte GET: väljavõte jätab tööloendisse rea ja seda ei tohi käivitada
 * link ega eellaadimine. `write` ei ole seatud meelega: ka peatatud asutus peab
 * oma andmed kätte saama. Arhiveeritud asutus ja asutus, mille koduteenuse
 * moodul on lõppenud, siia ei jõua (ühine värav annab 404): väljavõte tuleb
 * teha enne seda.
 *
 * Sageduspiir tuleb PÄRAST õiguse ja põhjuse kontrolli: vigane päring ei kuluta
 * inimese kolme katset kümne minuti kohta.
 *
 * Keha on gzip-pakitud. Kui klient gzip-i vastu võtab (iga brauser), ütleb päis
 * `Content-Encoding: gzip` seda ja salvestatud fail on tavaline JSON, mille
 * SHA-256 on päises ning tööloendis. Kliendile, kes gzip-i ei küsi, läheb sama
 * sisu ausalt `.json.gz` failina, mitte pakitud baitidena `.json` nime all.
 */
export async function POST(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.export_failed" }, async (auth) => {
    const body = await readJsonBody(request);
    prepareHomeCareExport(auth.context, body);
    const limited = enforceChatRateLimit(request, {
      scope: "home_care_export",
      userId: auth.userId,
      limit: 3,
      windowMs: 10 * 60_000
    });
    if (limited) return limited;

    const result = await createHomeCareExport(auth.context, body, { signal: request.signal });
    const day = result.generatedAt.slice(0, 10);
    const acceptsGzip = /\bgzip\b/i.test(request.headers.get("accept-encoding") || "");
    return new Response(result.body, {
      status: 200,
      headers: {
        ...(acceptsGzip
          ? {
              "Content-Type": "application/json; charset=utf-8",
              "Content-Encoding": "gzip",
              "Content-Disposition": `attachment; filename="koduteenus-valjavote-${day}.json"`
            }
          : {
              "Content-Type": "application/gzip",
              "Content-Disposition": `attachment; filename="koduteenus-valjavote-${day}.json.gz"`
            }),
        "Content-Length": String(result.body.length),
        "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
        "X-Content-Type-Options": "nosniff",
        "X-Home-Care-Export-Id": result.exportId,
        "X-Home-Care-Export-Sha256": result.contentSha256,
        "X-Home-Care-Export-Rows": String(result.rowCount),
        "X-Home-Care-Export-Bytes": String(result.byteCount)
      }
    });
  });
}
