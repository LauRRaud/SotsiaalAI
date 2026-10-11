import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareClientImport from "@/components/homeCare/HomeCareClientImport";
import { coordinatorScope } from "@/lib/homeCare/access";
import { listClientUnitOptions } from "@/lib/homeCare/clients";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Klientide sissetoomine - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Klientide nimekirja sissetoomine tabelist. Ilma hooldusjuhi õiguseta on leht 404. */
export default async function HomeCareClientImportPage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/sissetoomine`);
  if (!coordinatorScope(fullContext)) notFound();

  let unitOptions;
  try {
    unitOptions = await listClientUnitOptions(fullContext);
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareClientImport context={auth.context} unitOptions={unitOptions} />;
}
