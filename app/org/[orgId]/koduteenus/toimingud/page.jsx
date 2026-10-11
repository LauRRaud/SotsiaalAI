import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareActivities from "@/components/homeCare/HomeCareActivities";
import { listActivities } from "@/lib/homeCare/activities";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Toimingud - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Asutuse toimingute kataloog. Asutuse töötajale, kes ei ole hooldaja, on leht 404. */
export default async function HomeCareActivitiesPage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/toimingud`);

  let initial;
  try {
    initial = await listActivities(fullContext, { includeArchived: true });
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareActivities context={auth.context} initial={initial} />;
}
