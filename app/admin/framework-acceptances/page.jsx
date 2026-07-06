import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";

import { authConfig } from "@/auth";
import { getLocaleFromCookies } from "@/lib/i18n";
import { serverT } from "@/lib/i18n/serverMessages";
import { localizePath } from "@/lib/localizePath";

import AdminFrameworkAcceptancesClient from "./AdminFrameworkAcceptancesClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: serverT(
    "en",
    "admin.pages.framework_acceptances.meta_title",
    undefined,
    "Framework acceptances - SotsiaalAI"
  ),
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

function _getPageCopy(locale) {
  if (locale === "et") {
    return {
      heading: "Tööalase kasutuse kinnitused",
      subtitle: "Admini auditivaade kasutajate tööalase kasutuse ja andmetöötluse kinnitustele."
    };
  }
  if (locale === "ru") {
    return {
      heading: "Подтверждения рабочего использования",
      subtitle: "Админский аудит-представление подтверждений рабочего использования и обработки данных."
    };
  }
  return {
    heading: "Framework acceptances",
    subtitle: "Admin audit view for professional-use and data-processing confirmations."
  };
}

export default async function AdminFrameworkAcceptancesPage() {
  noStore();
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig);
  if (!session) {
    const params = new URLSearchParams({
      callbackUrl: localizePath("/admin/framework-acceptances", locale)
    });
    redirect(`/api/auth/signin?${params.toString()}`);
  }
  const isAdmin = session.user?.isAdmin === true || String(session.user?.role || "").toUpperCase() === "ADMIN";
  if (!isAdmin) {
    redirect(localizePath("/", locale));
  }

  return (
    <section>
      <div>
        <div>
          <Link
            prefetch={false}
            href={localizePath("/#meist", locale)}
            aria-label={serverT(locale, "admin.common.back", undefined, "Back")}
          />

          <header>
            <div>
              <div>
                <h1>
                  {serverT(locale, "admin.framework_acceptances.title", undefined, "Framework acceptances")}
                </h1>
              </div>
              <p>
                {serverT(
                  locale,
                  "admin.framework_acceptances.subtitle",
                  undefined,
                  "Admin audit view for professional-use and data-processing confirmations."
                )}
              </p>
            </div>
          </header>

          <div>
            <AdminFrameworkAcceptancesClient />
          </div>
        </div>
      </div>
    </section>
  );
}
