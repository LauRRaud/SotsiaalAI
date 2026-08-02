import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import OrgExportClient from "@/components/org/OrgExportClient";

import { requireOrgPageContext } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Organisatsiooni eksport - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

/** Eksport koondab kogu organisatsiooni — see on `ORG_OWNER` otsus. */
export default async function OrgExportPage({ params }) {
  noStore();
  const { orgId } = await params;
  const auth = await requireOrgPageContext(orgId, `/org/${orgId}/eksport`);

  const granted = new Set((auth.context.capabilities || []).map((grant) => grant.capability));
  if (!granted.has("ORG_OWNER")) notFound();

  return <OrgExportClient context={auth.context} />;
}
