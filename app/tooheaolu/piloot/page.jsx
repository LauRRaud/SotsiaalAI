import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";

import { authConfig } from "@/auth";
import {
  ragAdminPageShellClassName,
  ragAdminShellInnerClassName
} from "@/components/admin/rag/ragAdminShellStyles";
import { getLocaleFromCookies } from "@/lib/i18n";
import { localizePath } from "@/lib/localizePath";
import { resolveWellbeingPilotAccess } from "@/lib/wellbeing/pilotAccess";
import WellbeingPilotClient from "./WellbeingPilotClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "KOV piloodi koondvaade - SotsiaalAI",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function WellbeingPilotPage() {
  noStore();
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig);
  if (!session) {
    const params = new URLSearchParams({
      callbackUrl: localizePath("/tooheaolu/piloot", locale)
    });
    redirect(`/api/auth/signin?${params.toString()}`);
  }

  const access = await resolveWellbeingPilotAccess(session);
  if (!access.ok) redirect(localizePath("/tooheaolu", locale));

  return (
    <section className={ragAdminPageShellClassName}>
      <div className={`${ragAdminShellInnerClassName} max-w-[72rem] text-[color:var(--documents-page-text)]`}>
        <WellbeingPilotClient
          allowedRoleGroups={access.allowedRoleGroups || []}
          pilotScopes={access.pilotScopes || []}
          isAdmin={Boolean(access.isAdmin)}
        />
      </div>
    </section>
  );
}
