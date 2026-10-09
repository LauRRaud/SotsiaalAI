import { unstable_noStore as noStore } from "next/cache";

import HomeCareHome from "@/components/homeCare/HomeCareHome";
import { listClientUnitOptions, listClients } from "@/lib/homeCare/clients";
import { getMyDay } from "@/lib/homeCare/slots";

import { requireHomeCarePage } from "./_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Koduteenus - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * Koduteenuse avaleht. Värav on MOODUL, mitte capability: hooldajal ei ole
 * ühtegi capability't, aga ta peab oma kliente nägema. Loend on teenuskihis
 * skoobitud (meeskond või hooldusjuht); õiguseta liige näeb tühja loendit.
 */
export default async function HomeCarePage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus`);

  const initial = await listClients(fullContext);
  const unitOptions = initial.isCoordinator ? await listClientUnitOptions(fullContext) : null;
  /* Hooldaja tänane päev (K3-a): talle määratud tänased käigud. */
  const myDay = await getMyDay(fullContext);

  return <HomeCareHome context={auth.context} initial={initial} unitOptions={unitOptions} myDay={myDay} />;
}
