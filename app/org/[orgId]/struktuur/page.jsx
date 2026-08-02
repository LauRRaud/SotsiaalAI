import { unstable_noStore as noStore } from "next/cache";

import OrgStructureClient from "@/components/org/OrgStructureClient";
import { listUnits } from "@/lib/org/structure";

import { requireOrgPageContext } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Organisatsiooni struktuur - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * Struktuur on iga aktiivse liikme jaoks loetav; muutmine nõuab `MEMBER_ADMIN`-it
 * ja seda kontrollib route, mitte see leht.
 */
export default async function OrgStructurePage({ params }) {
  noStore();
  const { orgId } = await params;
  const auth = await requireOrgPageContext(orgId, `/org/${orgId}/struktuur`);
  const units = await listUnits(orgId);
  return <OrgStructureClient context={auth.context} initialUnits={units} />;
}
