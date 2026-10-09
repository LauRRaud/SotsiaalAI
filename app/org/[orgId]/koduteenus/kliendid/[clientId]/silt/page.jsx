import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareDoorTag from "@/components/homeCare/HomeCareDoorTag";
import { getDoorTag } from "@/lib/homeCare/doorTags";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
/* Pealkirjas EI OLE kliendi nime. */
export const metadata = {
  title: "Uksesilt - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Uksesildi haldus. Ainult hooldusjuht, kelle skoobis klient on; muu on 404. */
export default async function HomeCareDoorTagPage({ params }) {
  noStore();
  const { orgId, clientId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/kliendid/${clientId}/silt`);

  let initial;
  try {
    initial = await getDoorTag(fullContext, clientId);
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareDoorTag context={auth.context} client={initial.client} initialTag={initial.tag} />;
}
