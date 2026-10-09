import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareDeadlines from "@/components/homeCare/HomeCareDeadlines";
import { getDeadlines } from "@/lib/homeCare/deadlines";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Tähtajad - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Tähtajad hooldusjuhile. Ilma hooldusjuhi õiguseta on leht 404. */
export default async function HomeCareDeadlinesPage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/tahtajad`);

  let deadlines;
  try {
    deadlines = await getDeadlines(fullContext);
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareDeadlines context={auth.context} deadlines={deadlines} />;
}
