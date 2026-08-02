import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import prisma from "@/lib/prisma";
import OrgProfileClient from "@/components/org/OrgProfileClient";
import { listProfileEditors } from "@/lib/org/serviceProfile";

import { requireOrgPageContext } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Organisatsiooni teenuseprofiil - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

export default async function OrgProfilePage({ params }) {
  noStore();
  const { orgId } = await params;
  const auth = await requireOrgPageContext(orgId, `/org/${orgId}/teenusprofiil`);

  const granted = new Set((auth.context.capabilities || []).map((grant) => grant.capability));
  if (!granted.has("SERVICE_PROFILE_EDITOR")) notFound();
  if (!(auth.context.activeModules || []).includes("SERVICE_DELIVERY")) notFound();

  const [profile, editors] = await Promise.all([
    prisma.serviceProviderProfile.findFirst({
      where: { organizationId: orgId, ownershipMode: "ORGANIZATION" }
    }),
    listProfileEditors(orgId)
  ]);

  /* Kui organisatsioonil profiili veel ei ole, pakume ülemineku rada —
     aga AINULT vaataja ENDA solo-profiili, mitte kellegi teise oma.
     Üleandmise saab kinnitada ainult profiili omanik ise (§5.9). */
  const convertibleProfile = profile
    ? null
    : await prisma.serviceProviderProfile.findFirst({
        where: { ownerId: auth.userId, ownershipMode: "SOLO" },
        select: { id: true, organizationName: true }
      });

  return (
    <OrgProfileClient
      context={auth.context}
      profile={profile}
      editors={editors}
      convertibleProfile={convertibleProfile}
    />
  );
}
