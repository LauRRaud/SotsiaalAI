import { unstable_noStore as noStore } from "next/cache";

import OrgJoinClient from "@/components/org/OrgJoinClient";

import { requireOrgSession } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Organisatsiooni kutse - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * `/org/liitu?token=...` — kutse eelvaade ja teadlik nõustumine.
 *
 * Token EI liigu serverikomponendist edasi: eelvaate laeb klient `/api/org/join`
 * kaudu. Nii ei jõua ta kunagi serverirenderdatud HTML-i, mida brauser võib
 * vahemällu või ajalukku jätta.
 */
export default async function OrgJoinPage() {
  noStore();
  await requireOrgSession("/org/liitu");
  return <OrgJoinClient />;
}
