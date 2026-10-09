import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareOverview from "@/components/homeCare/HomeCareOverview";
import { getCoordinatorOverview } from "@/lib/homeCare/overview";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Hooldusjuhi ülevaade - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Hooldusjuhi ülevaade. Ilma hooldusjuhi õiguseta on leht 404. */
export default async function HomeCareOverviewPage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/ulevaade`);

  let overview;
  try {
    overview = await getCoordinatorOverview(fullContext);
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareOverview context={auth.context} overview={overview} />;
}
