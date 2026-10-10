import { unstable_noStore as noStore } from "next/cache";

import HomeCareHome from "@/components/homeCare/HomeCareHome";
import { listClientUnitOptions, listClients } from "@/lib/homeCare/clients";
import { getMyDay } from "@/lib/homeCare/dayPlan";
import { getOwnName } from "@/lib/homeCare/ownName";
import { getReferralContacts } from "@/lib/homeCare/referralContacts";
import { coordinatorSetupHint } from "@/lib/homeCare/setupHint";

import { requireHomeCarePage } from "./_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Koduteenus - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * Koduteenuse avaleht. Värav on MOODUL, mitte capability: hooldajal ei ole
 * ühtegi capability't, aga ta peab oma kliente nägema. Loend on teenuskihis
 * skoobitud (meeskond või hooldusjuht); õiguseta liige näeb tühja loendit.
 */
export default async function HomeCarePage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus`);

  const initial = await listClients(fullContext);
  const unitOptions = initial.isCoordinator ? await listClientUnitOptions(fullContext) : null;
  /* Hooldaja päevad (K3-a, K3-d): talle määratud tänased ja järgmise nädala käigud. */
  const myDay = await getMyDay(fullContext);
  /* „Kuhu suunata" (K5-c): asutuse enda loend, käepärast igale koduteenuse liikmele. */
  const referrals = await getReferralContacts(fullContext);
  /* Värske organisatsioon: kui hooldusjuhti ei ole, ütleb leht, kust see õigus antakse. */
  const setupHint = initial.isCoordinator ? null : await coordinatorSetupHint(fullContext);
  /* Oma nimi kolleegidele: kuni see on kirja panemata, on vorm avalehel lahti. */
  const ownName = await getOwnName(fullContext);

  return (
    <HomeCareHome
      context={auth.context}
      initial={initial}
      unitOptions={unitOptions}
      myDay={myDay}
      referrals={referrals}
      setupHint={setupHint}
      ownName={ownName}
    />
  );
}
