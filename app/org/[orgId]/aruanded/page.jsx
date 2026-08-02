import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import OrgServiceReportsClient from "@/components/org/OrgServiceReportsClient";
import { isServiceLogEnabled } from "@/lib/serviceLog/flags";
import { listReceivedShares } from "@/lib/serviceLog/reportShare";

import { requireOrgPageContext } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Teenuspäeviku aruanded - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * Juhile saadetud teenuspäeviku kuuaruanded.
 *
 * CAPABILITY-VÄRAVAT EI OLE ja see on teadlik. Õigus näha tuleb SAATMISEST,
 * mitte rollist: töötaja saadab oma aruande konkreetsele inimesele ja see
 * inimene näeb täpselt seda, mis talle saadeti. Capability otsustab hoopis
 * teise küsimuse — KELLELE tohib saata (vt `listShareRecipients`).
 *
 * Ilma selle vahetegemiseta juhtuks üks kahest: kas juhi õigus laieneks kõigi
 * aruannete peale, keda ta juhib (ka nende, mida talle ei saadetud), või ei
 * näeks endine juht enam seda, mis talle ametis olles saadeti.
 *
 * Õiguseta liige saab TÜHJA LOENDI, mitte 404 — vt route'i kommentaari.
 */
export default async function OrgServiceReportsPage({ params }) {
  noStore();
  const { orgId } = await params;
  const auth = await requireOrgPageContext(orgId, `/org/${orgId}/aruanded`);
  const membershipId = auth.context.membership?.id;
  if (!membershipId) notFound();

  /* Lipp väljas = funktsiooni ei ole olemas. Tühi loend hoiaks alles vale
     mulje, et aruandeid ei ole saadetud — seepärast siin 404, mitte tühjus. */
  if (!isServiceLogEnabled()) notFound();

  const items = await listReceivedShares([membershipId]);

  return <OrgServiceReportsClient organizationId={orgId} items={items} />;
}
