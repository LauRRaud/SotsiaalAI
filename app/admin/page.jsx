import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { ADMIN_SURFACES } from "@/lib/admin/surfaces";
import { getLocaleFromCookies } from "@/lib/i18n";
import { serverT } from "@/lib/i18n/serverMessages";
import { localizePath } from "@/lib/localizePath";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Administration - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

export default async function AdminHubPage() {
  noStore();
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig);
  if (!session) {
    const params = new URLSearchParams({
      callbackUrl: localizePath("/admin", locale)
    });
    redirect(`/api/auth/signin?${params.toString()}`);
  }

  const isAdmin =
    Boolean(session?.user?.isAdmin) ||
    String(session?.user?.role || "").toUpperCase() === "ADMIN";
  if (!isAdmin) redirect(localizePath("/", locale));

  const groups = ["operations", "knowledge"];
  return (
    <section aria-labelledby="admin-hub-title">
      <div>
        <p>{serverT(locale, "admin.hub.eyebrow")}</p>
        <h1 id="admin-hub-title">{serverT(locale, "admin.hub.title")}</h1>
        <p>{serverT(locale, "admin.hub.description")}</p>
      </div>

      {groups.map(group => (
        <section key={group} aria-labelledby={`admin-hub-${group}`}>
          <h2 id={`admin-hub-${group}`}>
            {serverT(locale, `admin.hub.groups.${group}`)}
          </h2>
          <ul>
            {ADMIN_SURFACES.filter(surface => surface.group === group).map(surface => (
              <li key={surface.href}>
                <Link href={localizePath(surface.href, locale)}>
                  {serverT(locale, surface.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
