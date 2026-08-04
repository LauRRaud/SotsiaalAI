import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { unstable_noStore as noStore } from "next/cache";

import { authConfig } from "@/auth";
import UrgentDeskView from "@/components/urgent/UrgentDeskView";
import { getLocaleFromCookies } from "@/lib/i18n";
import { localizePath } from "@/lib/localizePath";

/**
 * SK-V1 E4 — vastuvõtu laud töölaual.
 *
 * Ligipääs käib LAUA LIIKMELISUSEST, mitte rollist: sotsiaaltöötaja roll ei ava
 * võõra valla lauda. Seepärast on siin ainult sessioonikontroll — ülejäänu
 * otsustab server iga päringu juures eraldi, ja kui inimene ei istu ühegi laua
 * taga, ütleb vaade seda välja.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Kiireloomuline vastuvõtt - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

export default async function UrgentDeskPage() {
  noStore();
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig).catch(() => null);
  if (!session) {
    const params = new URLSearchParams({ callbackUrl: localizePath("/toolaud/kiireloomuline-abi", locale) });
    redirect(`/api/auth/signin?${params.toString()}`);
  }

  return <UrgentDeskView />;
}
