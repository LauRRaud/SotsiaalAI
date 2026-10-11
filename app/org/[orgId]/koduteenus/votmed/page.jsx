import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareKeyRegister from "@/components/homeCare/HomeCareKeyRegister";
import { getKeyRegister } from "@/lib/homeCare/keys";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Võtmeraamat - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Võtmeraamat hooldusjuhile. Ilma hooldusjuhi õiguseta on leht 404. */
export default async function HomeCareKeysPage({ params }) {
  noStore();
  const { orgId } = await params;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/votmed`);

  let register;
  try {
    register = await getKeyRegister(fullContext);
  } catch (error) {
    if (!isOrgError(error)) throw error;
    notFound();
  }

  return <HomeCareKeyRegister context={auth.context} register={register} />;
}
