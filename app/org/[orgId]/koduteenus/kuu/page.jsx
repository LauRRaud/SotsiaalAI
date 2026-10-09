import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareMonth from "@/components/homeCare/HomeCareMonth";
import { getMonthOpenItems } from "@/lib/homeCare/monthClose";
import { getMonthSummary } from "@/lib/homeCare/provided";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Kuu kokkuvõte - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Kuu kokkuvõte hooldusjuhile. Ilma hooldusjuhi õiguseta on leht 404. */
export default async function HomeCareMonthPage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/kuu`);

  let initial;
  try {
    initial = { ...(await getMonthSummary(fullContext, {})), openItems: await getMonthOpenItems(fullContext, {}) };
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareMonth context={auth.context} initial={initial} />;
}
