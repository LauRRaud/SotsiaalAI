import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import OrgInvitesClient from "@/components/org/OrgInvitesClient";
import { listInvites } from "@/lib/org/inviteService";
import { listUnits } from "@/lib/org/structure";

import { requireOrgPageContext } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Organisatsiooni kutsed - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

export default async function OrgInvitesPage({ params }) {
  noStore();
  const { orgId } = await params;
  const auth = await requireOrgPageContext(orgId, `/org/${orgId}/kutsed`);

  const granted = new Set((auth.context.capabilities || []).map((grant) => grant.capability));
  if (!granted.has("MEMBER_ADMIN")) notFound();

  const [invites, units] = await Promise.all([listInvites(orgId), listUnits(orgId)]);
  return <OrgInvitesClient context={auth.context} initialInvites={invites} units={units} />;
}
