import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareReleases from "@/components/homeCare/HomeCareReleases";
import { listChronologyReleases } from "@/lib/homeCare/chronology";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Väljastuste loend - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Väljastuste tööloend. Ilma hooldusjuhi õiguseta on leht 404. */
export default async function HomeCareReleasesPage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/valjastused`);

  let initial;
  try {
    initial = await listChronologyReleases(fullContext, {});
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareReleases context={auth.context} initial={initial} />;
}
