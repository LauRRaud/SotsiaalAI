import { unstable_noStore as noStore } from "next/cache";

import OrgOverviewClient from "@/components/org/OrgOverviewClient";
import { isServiceLogDayRouteEnabled, isServiceLogEnabled } from "@/lib/serviceLog/flags";

import { requireOrgPageContext } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Organisatsiooni ülevaade - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

export default async function OrgOverviewPage({ params }) {
  noStore();
  const { orgId } = await params;
  const auth = await requireOrgPageContext(orgId, `/org/${orgId}`);
  /* Osad, mille leht on lipuga suletud (`aruanded` ja `graafik` vastavad siis
     „ei leitud"): nende plaati lauale ei tule. */
  const closedParts = [isServiceLogEnabled() ? "" : "service_reports", isServiceLogDayRouteEnabled() ? "" : "dispatch"].filter(Boolean);
  return <OrgOverviewClient context={auth.context} closedParts={closedParts} />;
}
