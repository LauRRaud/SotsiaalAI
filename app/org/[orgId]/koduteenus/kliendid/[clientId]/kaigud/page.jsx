import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareSlots from "@/components/homeCare/HomeCareSlots";
import { getSlotEditor } from "@/lib/homeCare/slots";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
/* Pealkirjas EI OLE kliendi nime. */
export const metadata = {
  title: "Käigud nädalas - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Kliendi käigumuster. Ainult hooldusjuht, kelle skoobis klient on; muu on 404. */
export default async function HomeCareSlotsPage({ params }) {
  noStore();
  const { orgId, clientId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/kliendid/${clientId}/kaigud`);

  let initial;
  try {
    initial = await getSlotEditor(fullContext, clientId);
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareSlots context={auth.context} initial={initial} />;
}
