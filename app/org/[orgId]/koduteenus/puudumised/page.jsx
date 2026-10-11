import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareAbsences from "@/components/homeCare/HomeCareAbsences";
import { getAbsences } from "@/lib/homeCare/absences";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Puudumised - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Töötajate puudumised. Ilma hooldusjuhi õiguseta on leht 404. */
export default async function HomeCareAbsencesPage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/puudumised`);

  let initial;
  try {
    initial = await getAbsences(fullContext);
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareAbsences context={auth.context} initial={initial} />;
}
