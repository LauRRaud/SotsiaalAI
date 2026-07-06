import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authConfig } from "@/auth";
import { serverT } from "@/lib/i18n/serverMessages";
import { getLocaleFromCookies } from "@/lib/i18n";
import { localizePath } from "@/lib/localizePath";
import { unstable_noStore as noStore } from "next/cache";
import AdminAnalyticsClient from "./AdminAnalyticsClient";
import {
  ragAdminPageShellClassName,
  ragAdminShellInnerClassName
} from "@/components/admin/rag/ragAdminShellStyles";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: serverT("en", "admin.pages.analytics.meta_title", undefined, "Analytics - SotsiaalAI"),
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};
export default async function AdminAnalyticsPage() {
  noStore();
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig);
  if (!session) {
    const params = new URLSearchParams({
      callbackUrl: localizePath("/admin/analytics", locale)
    });
    redirect(`/api/auth/signin?${params.toString()}`);
  }
  const isAdmin = !!session?.user?.isAdmin || String(session?.user?.role || "").toUpperCase() === "ADMIN";
  if (!isAdmin) redirect(localizePath("/", locale));
  return (
    <section className={ragAdminPageShellClassName}>
      <div className={`${ragAdminShellInnerClassName} max-w-[72rem] text-[color:var(--documents-page-text)]`}>
        <AdminAnalyticsClient />
      </div>
    </section>
  );
}
