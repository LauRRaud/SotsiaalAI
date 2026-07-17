import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { readDataExportForOwner } from "@/lib/dataExport/service";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) return Response.json({ ok: false, messageKey: "api.common.unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const resolved = await params;
  try {
    const { content } = await readDataExportForOwner(userId, resolved?.id);
    return new Response(content, { headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=andmekoopia.zip",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff"
    } });
  } catch (error) {
    if (error?.status === 404) return Response.json({ ok: false, messageKey: "api.common.not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    console.error("[data-export] download failed", safeError(error));
    return Response.json({ ok: false, messageKey: "data_export.download_failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
