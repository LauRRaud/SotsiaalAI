import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import OrgFundingClient from "@/components/org/OrgFundingClient";
import { isOrgSeatsEnabled } from "@/lib/org/flags";
import { listMembers } from "@/lib/org/members";
import { listSeatPlans } from "@/lib/org/seats";
import { listClientSponsorshipPage } from "@/lib/org/sponsorship";

import { requireOrgPageContext } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Organisatsiooni rahastus - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * Rahastus nõuab `BILLING_MANAGER`-it — raha ja liikmesus on eri usaldustasemed.
 * Ilma selleta `notFound()`, mitte 403: navigatsioonis linki ei ole ja otse-URL
 * ei tohi kinnitada, et vaade eksisteerib.
 */
export default async function OrgFundingPage({ params }) {
  noStore();
  const { orgId } = await params;
  if (!isOrgSeatsEnabled()) notFound();

  const auth = await requireOrgPageContext(orgId, `/org/${orgId}/arveldus`);
  const granted = new Set((auth.context.capabilities || []).map((grant) => grant.capability));
  if (!granted.has("BILLING_MANAGER")) notFound();

  const [seatPlans, sponsorshipPage, members] = await Promise.all([
    listSeatPlans(orgId),
    listClientSponsorshipPage(orgId),
    listMembers(orgId)
  ]);

  return (
    <OrgFundingClient
      context={auth.context}
      initialSeatPlans={seatPlans}
      initialSponsorshipPage={sponsorshipPage}
      members={members}
    />
  );
}
