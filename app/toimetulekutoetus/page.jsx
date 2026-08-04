import { cookies } from "next/headers";

import SubsistenceCalculator from "@/components/benefits/SubsistenceCalculator";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

/**
 * A2 — toimetulekutoetuse eelkalkulaator.
 *
 * KONTO ON NÕUTAV (omaniku otsus 04.08). Värav elab komponendis, sama mustriga
 * mis teekonnal: `useSession()` → sisselogimise kutse.
 *
 * See EI muuda seda, kus arvutus toimub. Arvutus käib endiselt brauseris ja
 * sisestatud andmed ei lähe kuhugi — sisselogimine avab lehe, aga ei tee
 * sissetulekut serverile nähtavaks.
 *
 * Kontota avalik versioon (lepingu P3, „SEO-uks") jääb seega lahtiseks
 * küsimuseks, mitte tehtud tööks.
 */

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const subsistence = messages?.subsistence || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/toimetulekutoetus",
    title: subsistence.title || "Toimetulekutoetuse eelhinnang",
    description: subsistence.not_a_decision || ""
  });
}

export default function Page() {
  return <SubsistenceCalculator />;
}
