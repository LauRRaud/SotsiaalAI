import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import prisma from "@/lib/prisma";
import { resolveOrgAccessContext } from "@/lib/org/accessContext";

import { requireOrgSession } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Tugi - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * `/org/tugi/[shareId]` — TEAVITUSE SIHTKOHT, mitte vaade.
 *
 * Teade „sulle saadeti toeavaldus" kannab ainult avalduse rea ID-d (lib/notifications.js,
 * `WELLBEING_SUPPORT_SHARE`): link ei tohi öelda, millisesse organisatsiooni avaldus kuulub.
 * Seda lehte varem ei olnud ja teate link vastas 404.
 *
 * Organisatsioon loetakse realt ja ainult siis, kui avalduse SAAJA on vaataja ise. Pärast
 * õiguskontrolli suunatakse saaja oma organisatsiooni tugivaatesse, kus saadud avaldused on
 * nimekirjas. Kes saaja ei ole, saab 404, sama vastuse mis olematu rea puhul.
 */
export default async function OrgSupportShareRedirectPage({ params }) {
  noStore();
  const { shareId } = await params;

  const auth = await requireOrgSession(`/org/tugi/${shareId}`);

  const share = await prisma.wellbeingSupportShare.findFirst({
    where: { id: String(shareId), recipient: { is: { userId: auth.userId } } },
    select: { organizationId: true }
  });
  if (!share?.organizationId) notFound();

  /* Sama värav mis tugivaatel endal: liikmesus peab olema aktiivne. */
  try {
    await resolveOrgAccessContext({
      userId: auth.userId,
      requestedOrganizationId: share.organizationId,
      isPlatformAdmin: Boolean(auth.roleState?.isAdmin),
      productRole: auth.roleState?.effectiveRole
    });
  } catch {
    notFound();
  }

  redirect(`/org/${share.organizationId}/tugi`);
}
