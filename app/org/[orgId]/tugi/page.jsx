import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import OrgSupportClient from "@/components/org/OrgSupportClient";
import { listSupportRecipients } from "@/lib/org/support";
import { listOwnSupportSharePage, listReceivedSupportSharePage } from "@/lib/org/supportShare";

import { requireOrgPageContext } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Tugi - SotsiaalAI",
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

  const [recipients, receivedPage, sentPage] = await Promise.all([
    listSupportRecipients(orgId, membershipId),
    listReceivedSupportSharePage(membershipId),
    listOwnSupportSharePage(auth.userId, { organizationId: orgId })
  ]);

  return (
    <OrgSupportClient
      context={auth.context}
      recipients={recipients}
      receivedPage={receivedPage}
      sentPage={sentPage}
    />
  );
}
