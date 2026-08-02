import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import OrgAuditClient from "@/components/org/OrgAuditClient";
import { listOrgAuditEvents } from "@/lib/org/audit";

import { requireOrgPageContext } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Organisatsiooni audit - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

export default async function OrgAuditPage({ params }) {
  noStore();
  const { orgId } = await params;
  const auth = await requireOrgPageContext(orgId, `/org/${orgId}/audit`);

  const granted = new Set((auth.context.capabilities || []).map((grant) => grant.capability));
  if (!granted.has("AUDIT_VIEWER")) notFound();

  const events = await listOrgAuditEvents(orgId, { take: 100 });
  return <OrgAuditClient context={auth.context} events={events} />;
}
