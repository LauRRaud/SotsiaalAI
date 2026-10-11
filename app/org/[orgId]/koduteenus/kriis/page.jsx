import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareCrisisList from "@/components/homeCare/HomeCareCrisisList";
import { getCrisisList } from "@/lib/homeCare/crisis";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Kriisinimekiri - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Kriisinimekiri hooldusjuhile. Ilma hooldusjuhi õiguseta on leht 404. */
export default async function HomeCareCrisisPage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/kriis`);

  let list;
  try {
    list = await getCrisisList(fullContext);
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareCrisisList context={auth.context} list={list} />;
}
