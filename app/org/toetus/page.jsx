import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import OrgSponsorshipClient from "@/components/org/OrgSponsorshipClient";
import { isOrgSeatsEnabled } from "@/lib/org/flags";

import { requireOrgSession } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Tasutud ligipääs - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * `/org/toetus?token=...` — pöörduja sponsorluse eelvaade ja nõustumine.
 *
 * See leht on PÖÖRDUJA jaoks, mitte organisatsiooni liikme jaoks: ta ei näita
 * ühtegi organisatsiooni tööruumi elementi ega vaja liikmesust. Token ei liigu
 * serverirenderdatud HTML-i — eelvaate laeb klient API kaudu.
 */
export default async function OrgSponsorshipPage() {
  noStore();
  if (!isOrgSeatsEnabled()) notFound();
  await requireOrgSession("/org/toetus");
  return <OrgSponsorshipClient />;
}
