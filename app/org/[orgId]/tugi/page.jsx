import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import OrgSupportClient from "@/components/org/OrgSupportClient";
import { hasCapability } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { listSupportRecipients } from "@/lib/org/support";
import { listOrganizationSupportMeasures } from "@/lib/org/supportMeasures";
import { listOwnSupportSharePage, listReceivedSupportSharePage } from "@/lib/org/supportShare";

import { requireOrgPageContext } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Tugi - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * Tugivaade on IGA aktiivse liikme oma — siin ei ole capability-väravat.
 *
 * Põhjus: toeavaldus on töötaja õigus, mitte haldusfunktsioon. Kui selle taha
 * paneks capability, oleks tugi asi, mida organisatsioon lubab — mitte asi,
 * mida inimene ise algatab.
 *
 * Moodulivärav on samuti teadlikult puudu: `PROFESSIONAL_SUPPORT` reguleerib
 * seda, kas organisatsioon tugikontakte HALDAB. Kui tugiteid ei ole, näeb
 * inimene tühja loendit — mitte 404-t, mis jätaks mulje, et tuge ei ole olemas.
 */
export default async function OrgSupportPage({ params }) {
  noStore();
  const { orgId } = await params;
  const auth = await requireOrgPageContext(orgId, `/org/${orgId}/tugi`);
  const membershipId = auth.context.membership?.id;
  if (!membershipId) notFound();

  const [recipients, receivedPage, sentPage, measures] = await Promise.all([
    listSupportRecipients(orgId, membershipId),
    listReceivedSupportSharePage(membershipId),
    listOwnSupportSharePage(auth.userId, { organizationId: orgId }),
    listOrganizationSupportMeasures(orgId)
  ]);
  /* Muutmise nupp on mugavus; tõde on route'i `SUPPORT_CONTACT_ADMIN` värav. */
  const canManageMeasures =
    auth.context.writable !== false && hasCapability(auth.context, OrganizationCapability.SUPPORT_CONTACT_ADMIN);

  return (
    <OrgSupportClient
      context={auth.context}
      recipients={recipients}
      receivedPage={receivedPage}
      sentPage={sentPage}
      measures={measures}
      canManageMeasures={canManageMeasures}
    />
  );
}
