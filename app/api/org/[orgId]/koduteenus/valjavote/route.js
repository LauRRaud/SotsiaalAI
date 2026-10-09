import { createHomeCareExport, getHomeCareExportOverview } from "@/lib/homeCare/export";

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
 * link ega eellaadimine. `write` ei ole seatud meelega: ka peatatud või
 * arhiveeritud asutus peab oma andmed kätte saama.
 *
 * Keha on gzip-pakitud ja päis `Content-Encoding: gzip` ütleb seda brauserile:
 * salvestatud fail on tavaline JSON ja selle SHA-256 on päises ning tööloendis.
 */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { rateScope: "export", rateLimit: 3, rateWindowMs: 10 * 60_000, fallbackKey: "home_care.errors.export_failed" },
    async (auth) => {
      const result = await createHomeCareExport(auth.context, await readJsonBody(request));
      return new Response(result.body, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Encoding": "gzip",
          "Content-Length": String(result.body.length),
          "Content-Disposition": `attachment; filename="koduteenus-valjavote-${result.generatedAt.slice(0, 10)}.json"`,
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
    }
  );
}
