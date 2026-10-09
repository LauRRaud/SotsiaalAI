import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareDay from "@/components/homeCare/HomeCareDay";
import { getDayPlan } from "@/lib/homeCare/dayPlan";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Päevaplaan - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Hooldusjuhi päevaplaan. Ilma hooldusjuhi õiguseta on leht 404. */
export default async function HomeCareDayPage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/paev`);

  let initial;
  try {
    initial = await getDayPlan(fullContext, {});
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareDay context={auth.context} initial={initial} />;
}
