import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";

import { authConfig } from "@/auth";
import { getLocaleFromCookies } from "@/lib/i18n";
import { localizePath } from "@/lib/localizePath";

export async function requireAdminRagAccess(callbackPath = "/admin/rag") {
  noStore();

  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig);

  if (!session) {
    const params = new URLSearchParams({
      callbackUrl: localizePath(callbackPath, locale)
    });
    redirect(`/api/auth/signin?${params.toString()}`);
  }

  const isAdmin =
    session.user?.isAdmin === true ||
    String(session.user?.role || "").toUpperCase() === "ADMIN";

  if (!isAdmin) {
    redirect(localizePath("/", locale));
  }

  return { locale, session };
}
