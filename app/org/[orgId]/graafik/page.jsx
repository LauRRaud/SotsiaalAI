import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import OrgDispatchBoard from "@/components/org/OrgDispatchBoard";
import { getDispatchBoard } from "@/lib/serviceLog/dispatchBoard";
import { isServiceLogDayRouteEnabled } from "@/lib/serviceLog/flags";

import { requireOrgPageContext } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Graafik - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * Juhi staatustahvel (E10).
 *
 * ÕIGUS TULEB CAPABILITY'st, mitte lehe olemasolust: `UNIT_LEAD`,
 * `WORK_ASSIGNER` või `ORG_OWNER`. Õiguseta liige EI SAA 404-t, vaid tühja
 * tahvli koos selgitusega — veakood ütleks talle, et siin on midagi, mida ta
 * näha ei tohi, ja seegi on info.
 */
export default async function OrgDispatchPage({ params }) {
  noStore();
  const { orgId } = await params;
  const auth = await requireOrgPageContext(orgId, `/org/${orgId}/graafik`);
  if (!auth.context.membership?.id) notFound();

  /* Lipp väljas = päevateekonda ei ole olemas, seega ka tahvlit ei ole. */
  if (!isServiceLogDayRouteEnabled()) notFound();

  const board = await getDispatchBoard(auth.userId, { organizationId: orgId });
  return <OrgDispatchBoard organizationId={orgId} initialBoard={board} />;
}
