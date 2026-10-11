import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareIncidents from "@/components/homeCare/HomeCareIncidents";
import { getIncident, listIncidents } from "@/lib/homeCare/incidents";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Erijuhtumite register - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * Erijuhtumite register. Ilma hooldusjuhi õiguseta on leht 404.
 *
 * `?juhtum=<id>` tuleb teavituse suunajast: see juhtum näidatakse esimesena ka
 * siis, kui ta on suletud või ei mahu esimesele lehele. Vigane või võõras ID
 * jäetakse vaikselt kõrvale, register avaneb ikka.
 */
export default async function HomeCareIncidentsPage({ params, searchParams }) {
  noStore();
  const { orgId } = await params;
  const query = (await searchParams) || {};
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/erijuhtumid`);

  let initial;
  try {
    initial = await listIncidents(fullContext, {});
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  let focused = null;
  const focusId = typeof query.juhtum === "string" ? query.juhtum : "";
  if (focusId) {
    try {
      focused = await getIncident(fullContext, focusId);
    } catch (error) {
      if (!isOrgError(error)) throw error;
    }
  }

  return <HomeCareIncidents context={auth.context} initial={initial} focused={focused} />;
}
