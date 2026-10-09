import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { HOME_CARE_MODULE } from "@/lib/homeCare/constants";
import { findDoorTagOrganization, isDoorTagToken, locateDoorTagForViewer } from "@/lib/homeCare/doorTags";
import { isHomeCareEnabled } from "@/lib/homeCare/flags";
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
 * `/org/koduteenus/uks/[token]` — UKSESILDI SIHTKOHT, mitte vaade.
 *
 * Sildi aadress ei kanna asutuse ega kliendi ID-d ega nime: aadress on kliendi
 * kodus seinal ja seda võib näha igaüks. Asutus ja klient loetakse sildilt ning
 * alles PÄRAST sisselogimist ja õiguskontrolli suunatakse kliendi lehele.
 * Kes klienti näha ei tohi, saab 404, sama vastuse mis olematu sildi puhul.
 * Teise kliendi hooldaja jõuab kliendi lehele, kus temalt küsitakse põhjust.
 */
export default async function HomeCareDoorTagRedirectPage({ params }) {
  noStore();
  const { token } = await params;
  if (!isHomeCareEnabled() || !isDoorTagToken(token)) notFound();

  const auth = await requireOrgSession(`/org/koduteenus/uks/${token}`);

  /* Organisatsioon loetakse sildilt, MITTE kasutaja sisendist. */
  const organizationId = await findDoorTagOrganization(token);
  if (!organizationId) notFound();

  let context;
  try {
    context = await resolveOrgAccessContext({
      userId: auth.userId,
      requestedOrganizationId: organizationId,
      isPlatformAdmin: Boolean(auth.roleState?.isAdmin),
      productRole: auth.roleState?.effectiveRole
    });
  } catch {
    notFound();
  }
  if (!(context.activeModules || []).includes(HOME_CARE_MODULE)) notFound();

  let target;
  try {
    target = await locateDoorTagForViewer(context, token);
  } catch {
    notFound();
  }
  redirect(`/org/${organizationId}/koduteenus/kliendid/${target.clientId}`);
}
