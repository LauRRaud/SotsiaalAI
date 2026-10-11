import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareCalls from "@/components/homeCare/HomeCareCalls";
import { getCallCounts } from "@/lib/homeCare/calls";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Kõnede loendur - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Kõnede loendur. Ilma hooldusjuhi õiguseta on leht 404. */
export default async function HomeCareCallsPage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/koned`);

  let initial;
  try {
    initial = await getCallCounts(fullContext, {});
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareCalls context={auth.context} initial={initial} />;
}
