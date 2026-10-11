import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareWeek from "@/components/homeCare/HomeCareWeek";
import { getWeekPlan } from "@/lib/homeCare/dayPlan";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Nädalaplaan - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Hooldusjuhi nädalaplaan. Ilma hooldusjuhi õiguseta on leht 404. */
export default async function HomeCareWeekPage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/nadal`);

  let initial;
  try {
    initial = await getWeekPlan(fullContext, {});
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareWeek context={auth.context} initial={initial} />;
}
