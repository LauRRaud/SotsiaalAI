import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import OrgMembersClient from "@/components/org/OrgMembersClient";
import { listMembers } from "@/lib/org/members";
import { listUnits } from "@/lib/org/structure";

import { requireOrgPageContext } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Organisatsiooni liikmed - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * Liikmete vaade nõuab `MEMBER_ADMIN`-it. Ilma selleta `notFound()`, mitte 403:
 * navigatsioonis seda linki ei ole ja otse-URL ei tohi kinnitada, et vaade
 * eksisteerib.
 */
export default async function OrgMembersPage({ params }) {
  noStore();
  const { orgId } = await params;
  const auth = await requireOrgPageContext(orgId, `/org/${orgId}/liikmed`);

  const granted = new Set((auth.context.capabilities || []).map((grant) => grant.capability));
  if (!granted.has("MEMBER_ADMIN")) notFound();

  const [members, units] = await Promise.all([listMembers(orgId), listUnits(orgId)]);
  return (
    <OrgMembersClient
      context={auth.context}
      initialMembers={members}
      units={units}
      canGrant={granted.has("ORG_OWNER")}
    />
  );
}
