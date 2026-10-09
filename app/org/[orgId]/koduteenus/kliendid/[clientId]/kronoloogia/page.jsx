import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareChronology from "@/components/homeCare/HomeCareChronology";
import { getChronologyClient } from "@/lib/homeCare/chronology";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
/* Pealkirjas EI OLE kliendi nime. */
export const metadata = {
  title: "Kliendi kronoloogia - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Kronoloogia koostamine. Ainult hooldusjuht, kelle skoobis klient on; muu on 404. */
export default async function HomeCareChronologyPage({ params }) {
  noStore();
  const { orgId, clientId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(
    orgId,
    `/org/${orgId}/koduteenus/kliendid/${clientId}/kronoloogia`
  );

  let client;
  try {
    client = await getChronologyClient(fullContext, clientId);
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareChronology context={auth.context} client={client} />;
}
