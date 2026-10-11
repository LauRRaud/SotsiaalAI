import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import prisma from "@/lib/prisma";
import { HOME_CARE_MODULE, CareEntryKind } from "@/lib/homeCare/constants";
import { isHomeCareEnabled } from "@/lib/homeCare/flags";
import { locateEntryForViewer } from "@/lib/homeCare/incidents";
import { resolveOrgAccessContext } from "@/lib/org/accessContext";

import { requireOrgSession } from "../../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Koduteenus - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * `/org/koduteenus/kirje/[entryId]` — TEAVITUSE SIHTKOHT, mitte vaade.
 *
 * Teavituse link ei kanna organisatsiooni ega kliendi ID-d (sama põhjus mis
 * `/org/vastuvott/[itemId]`): aadress ise ei tohi öelda, millise asutuse ja
 * millise kliendi kohta teade käib. Mõlemad loetakse kirjelt ja alles PÄRAST
 * õiguskontrolli suunatakse päris vaatesse. Kes kirjet näha ei tohi, saab 404,
 * sama vastuse mis olematu kirje puhul.
 */
export default async function HomeCareEntryRedirectPage({ params }) {
  noStore();
  const { entryId } = await params;
  if (!isHomeCareEnabled()) notFound();

  const auth = await requireOrgSession(`/org/koduteenus/kirje/${entryId}`);

  /* Organisatsioon loetakse kirjelt, MITTE kasutaja sisendist. */
  const entry = await prisma.careClientEntry.findUnique({
    where: { id: String(entryId) },
    select: { id: true, organizationId: true }
  });
  if (!entry) notFound();

  let context;
  try {
    context = await resolveOrgAccessContext({
      userId: auth.userId,
      requestedOrganizationId: entry.organizationId,
      isPlatformAdmin: Boolean(auth.roleState?.isAdmin),
      productRole: auth.roleState?.effectiveRole
    });
  } catch {
    notFound();
  }
  if (!(context.activeModules || []).includes(HOME_CARE_MODULE)) notFound();

  /* Sama värav mis päris vaates; iga keeldumine (ka „vali põhjus") on siin 404,
     et suunaja ei muutuks olemasolu-oraakliks. */
  let target;
  try {
    target = await locateEntryForViewer(context, entry.id);
  } catch {
    notFound();
  }

  const base = `/org/${entry.organizationId}/koduteenus`;
  if (target.isCoordinator && target.kind === CareEntryKind.INCIDENT && !target.retracted) {
    redirect(`${base}/erijuhtumid?juhtum=${encodeURIComponent(entry.id)}`);
  }
  redirect(`${base}/kliendid/${target.clientId}`);
}
