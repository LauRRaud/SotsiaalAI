import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareClientPage from "@/components/homeCare/HomeCareClientPage";
import { listClientUnitOptions, openClient } from "@/lib/homeCare/clients";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
/* Pealkirjas EI OLE kliendi nime: vahelehe pealkiri jääb brauseri ajalukku ja
   jagatud ekraanile. */
export const metadata = {
  title: "Koduteenus - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

const ACCESS_REASON_REQUIRED = "home_care.errors.access_reason_required";

/**
 * Kliendi leht. Avamine jätab jälje avamislogisse samas tehingus, milles sisu
 * loetakse, seepärast viivad kõik lingid siia `prefetch={false}`-iga.
 *
 * Meeskonda mittekuuluv hooldaja saab sisu asemel põhjuse küsimise. Kõik muu
 * (võõras asutus, olematu klient, õiguseta liige) on 404.
 */
export default async function HomeCareClientRoute({ params }) {
  noStore();
  const { orgId, clientId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/kliendid/${clientId}`);

  let initial = null;
  let needsReason = false;
  try {
    initial = await openClient(fullContext, clientId);
  } catch (error) {
    if (!isOrgError(error)) throw error;
    if (error.messageKey !== ACCESS_REASON_REQUIRED) notFound();
    needsReason = true;
  }

  const unitOptions = initial?.access?.isCoordinator ? await listClientUnitOptions(fullContext) : null;

  return (
    <HomeCareClientPage
      context={auth.context}
      clientId={clientId}
      initial={initial}
      needsReason={needsReason}
      unitOptions={unitOptions}
    />
  );
}
