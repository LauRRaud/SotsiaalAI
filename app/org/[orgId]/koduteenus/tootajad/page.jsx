import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import Workers from "@/components/homeCare/workers/Workers";
import { getWorkerCards } from "@/lib/homeCare/workerRecords";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Töötajad - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Töötajate kaardid kogu asutuse hooldusjuhile. Ilma selle õiguseta on leht 404. */
export default async function HomeCareWorkersPage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/tootajad`);

  let cards;
  try {
    cards = await getWorkerCards(fullContext);
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <Workers context={auth.context} initial={cards} />;
}
