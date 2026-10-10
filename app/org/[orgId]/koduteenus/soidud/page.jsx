import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareTrips from "@/components/homeCare/HomeCareTrips";
import { getTripLog } from "@/lib/homeCare/trips";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Sõidupäevik - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Sõidupäevik hooldajale ja hooldusjuhile. Kes kumbki ei ole, saab 404. */
export default async function HomeCareTripsPage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/soidud`);

  let initial;
  try {
    initial = await getTripLog(fullContext, {});
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareTrips context={auth.context} initial={initial} />;
}
