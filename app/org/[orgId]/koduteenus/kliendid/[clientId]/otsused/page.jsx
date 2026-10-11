import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareDecisions from "@/components/homeCare/HomeCareDecisions";
import { getDecisionEditor } from "@/lib/homeCare/decisions";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
/* Pealkirjas EI OLE kliendi nime. */
export const metadata = {
  title: "Otsus ja maht - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Kliendi otsused. Ainult hooldusjuht, kelle skoobis klient on; muu on 404. */
export default async function HomeCareDecisionsPage({ params }) {
  noStore();
  const { orgId, clientId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/kliendid/${clientId}/otsused`);

  let initial;
  try {
    initial = await getDecisionEditor(fullContext, clientId);
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareDecisions context={auth.context} initial={initial} />;
}
