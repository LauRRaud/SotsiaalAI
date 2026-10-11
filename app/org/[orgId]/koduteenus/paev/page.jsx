import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import HomeCareDay from "@/components/homeCare/HomeCareDay";
import { getDayPlan } from "@/lib/homeCare/dayPlan";
import { isOrgError } from "@/lib/org/errors";

import { requireHomeCarePage } from "../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Päevaplaan - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/** Hooldusjuhi päevaplaan. Ilma hooldusjuhi õiguseta on leht 404. */
export default async function HomeCareDayPage({ params, searchParams }) {
  noStore();
  const { orgId } = await params;
  /* `?paev=AAAA-KK-PP` avab selle päeva (takistuse teate link); vigane väärtus annab tänase. */
  const query = (await searchParams) || {};
  const day = typeof query.paev === "string" ? query.paev : undefined;
  const { auth, fullContext } = await requireHomeCarePage(orgId, `/org/${orgId}/koduteenus/paev`);

  const load = async (dayQuery) => {
    try {
      return await getDayPlan(fullContext, dayQuery);
    } catch (error) {
      if (!isOrgError(error)) throw error;
      return error;
    }
  };
  let initial = await load({ day });
  /* Vigane päev aadressis annab tänase plaani; muu keeldumine (hooldusjuhi õigus puudub) on 404. */
  if (initial instanceof Error && initial.messageKey === "home_care.errors.invalid_date") initial = await load({});
  if (initial instanceof Error) notFound();

  return <HomeCareDay context={auth.context} initial={initial} />;
}
