import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import OrgSettingsClient from "@/components/org/OrgSettingsClient";

import { requireOrgPageContext } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Organisatsiooni seaded - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

export default async function OrgSettingsPage({ params }) {
  noStore();
  const { orgId } = await params;
  const auth = await requireOrgPageContext(orgId, `/org/${orgId}/seaded`);

  const granted = new Set((auth.context.capabilities || []).map((grant) => grant.capability));
  if (!granted.has("ORG_OWNER")) notFound();

  return (
    <OrgSettingsClient context={auth.context} isPlatformAdmin={Boolean(auth.roleState?.isAdmin)} />
  );
}
