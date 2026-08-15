import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import OrgInboxItemClient from "@/components/org/OrgInboxItemClient";
import { hasCapability, resolveOrgAccessContext, toClientContext } from "@/lib/org/accessContext";
import { isOrgInboxEnabled } from "@/lib/org/flags";
import { getInboxItem } from "@/lib/org/inbox";
import { listMemberOptions } from "@/lib/org/members";

import { requireOrgSession } from "../../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Pöördumine - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * Ühe pöördumise vaade.
 *
 * `getInboxItem` on ise värav: ta viskab 404, kui vaataja ei ole selle kirje
 * koordinaator ega määratud töötaja. Siin lehes EI OLE eraldi õiguskontrolli —
 * kaks kontrolli kahes kohas lahkneksid ajapikku ja üks neist jääks vanaks.
 *
 * Avamine märgib pöördujale nähtava `openedAt` ajatempli ja lõpetab tema
 * tagasivõtmisõiguse. See on tahtlik ja kasutajale kirjas.
 */
export default async function OrgInboxItemPage({ params }) {
  noStore();
  const { orgId, itemId } = await params;
  if (!isOrgInboxEnabled()) notFound();

  const auth = await requireOrgSession(`/org/${orgId}/vastuvott/${itemId}`);

  let context;
  try {
    context = await resolveOrgAccessContext({
      userId: auth.userId,
      requestedOrganizationId: orgId,
      isPlatformAdmin: Boolean(auth.roleState?.isAdmin),
      productRole: auth.roleState?.effectiveRole
    });
  } catch {
    notFound();
  }
  if (!(context.activeModules || []).includes("KOV_INTAKE")) notFound();

  let item;
  try {
    item = await getInboxItem(context, itemId);
  } catch {
    notFound();
  }

  const canAssign = hasCapability(context, "WORK_ASSIGNER", { unitId: item.unitId });
  /* Liikmete loend on määramise ja üleandmise valikuloend — seepärast ainult
     siis, kui inimene tohib määrata või on ise vastutaja. */
  const members = canAssign || item.isAssignee ? await listMemberOptions(orgId) : [];

  return (
    <OrgInboxItemClient
      context={toClientContext(context)}
      item={item}
      members={members}
      canAssign={canAssign}
    />
  );
}
