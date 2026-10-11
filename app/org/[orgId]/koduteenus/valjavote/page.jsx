import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareExport from "@/components/homeCare/HomeCareExport";
import { getHomeCareExportOverview } from "@/lib/homeCare/export";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Täielik väljavõte - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Koduteenuse täielik väljavõte. Ilma kogu asutuse hooldusjuhi õiguseta on leht 404. */
export default async function HomeCareExportPage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/valjavote`);

  let initial;
  try {
    initial = await getHomeCareExportOverview(fullContext);
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareExport context={auth.context} initial={initial} />;
}
