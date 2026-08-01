import { unstable_noStore as noStore } from "next/cache";

import OrgOverviewClient from "@/components/org/OrgOverviewClient";

import { requireOrgPageContext } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Organisatsiooni ülevaade - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

export default async function OrgOverviewPage({ params }) {
  noStore();
  const { orgId } = await params;
  const auth = await requireOrgPageContext(orgId, `/org/${orgId}`);
  return <OrgOverviewClient context={auth.context} />;
}
