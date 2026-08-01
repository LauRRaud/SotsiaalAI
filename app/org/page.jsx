import { unstable_noStore as noStore } from "next/cache";

import { listUserOrganizations } from "@/lib/org/organizations";
import { listPendingInvitesForEmail } from "@/lib/org/inviteService";
import { isOrgCreationEnabled } from "@/lib/org/flags";

import OrgHomeClient from "./OrgHomeClient";
import { requireOrgSession } from "./_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Organisatsioonid - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * `/org` — tööruumivahetaja kodu: organisatsioonide valik ja kutsete vastuvõtt.
 *
 * Isiklik tööruum on ALATI eraldi valik ja seda ei saa organisatsioon üle võtta
 * (arenduskava §7.2, §D1).
 */
export default async function OrgHomePage() {
  noStore();
  const auth = await requireOrgSession("/org");

  const [organizations, pendingInvites] = await Promise.all([
    listUserOrganizations(auth.userId),
    listPendingInvitesForEmail(auth.userEmail)
  ]);

  return (
    <OrgHomeClient
      organizations={organizations}
      pendingInvites={pendingInvites}
      canCreate={isOrgCreationEnabled()}
      canCreateRole={["SOCIAL_WORKER", "SERVICE_PROVIDER"].includes(auth.roleState?.effectiveRole)}
    />
  );
}
