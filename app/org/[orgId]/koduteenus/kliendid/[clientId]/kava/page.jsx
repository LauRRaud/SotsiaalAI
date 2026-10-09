import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCarePlanEditor from "@/components/homeCare/HomeCarePlanEditor";
import { getCarePlanEditor } from "@/lib/homeCare/carePlans";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
/* Pealkirjas EI OLE kliendi nime. */
export const metadata = {
  title: "Hoolduskava - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Hoolduskava koostamine. Ainult hooldusjuht, kelle skoobis klient on; muu on 404. */
export default async function HomeCarePlanPage({ params }) {
  noStore();
  const { orgId, clientId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/kliendid/${clientId}/kava`);

  let initial;
  try {
    initial = await getCarePlanEditor(fullContext, clientId);
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCarePlanEditor context={auth.context} initial={initial} />;
}
