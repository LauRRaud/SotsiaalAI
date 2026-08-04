import { handleUrgentRoute, requireUrgentUser, urgentError, urgentJson } from "@/lib/urgent/routes";
import { resolveUsableDesk } from "@/lib/urgent/request";
import { publicDeskProjection } from "@/lib/urgent/desk";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Kas selles piirkonnas on kiireloomulise abipalve rada avatud?
 *
 * See marsruut kasutab TÄPSELT sama reeglit, mis loomine (`resolveUsableDesk`).
 * Kaks eraldi reeglit läheksid ühel päeval lahku ja nupp jääks nähtavaks pärast
 * seda, kui laud kinni pandi.
 *
 * Suletud piirkonnas tagastatakse `available: false` ja MITTE MIDAGI MUUD —
 * põhjused on admini asi. Pöörduja jaoks on ainus vastus „seda rada siin ei
 * ole", koos viitega tavalisele teenuseotsingule ja eelpöördumisele.
 */
export async function GET(req) {
  const auth = await requireUrgentUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);

  const url = new URL(req.url);
  const municipalityId = String(url.searchParams.get("municipalityId") || "").trim();

  return handleUrgentRoute(async () => {
    const resolved = await resolveUsableDesk({
      prisma,
      municipalityId,
      recipientType: url.searchParams.get("recipientType") || undefined
    });
    if (!resolved.ready) return urgentJson({ ok: true, available: false, desk: null });
    return urgentJson({ ok: true, available: true, desk: publicDeskProjection(resolved.desk) });
  });
}
