import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";

import { authConfig } from "@/auth";
import { getLocaleFromCookies } from "@/lib/i18n";
import { localizePath } from "@/lib/localizePath";
import AdminMentoringPage from "@/components/mentoring/AdminMentoringPage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function AdminMentoringRoute() {
  noStore();
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig);
  if (!session) {
    const params = new URLSearchParams({
      callbackUrl: localizePath("/admin/mentorlus", locale)
    });
    redirect(`/api/auth/signin?${params.toString()}`);
  }
  const isAdmin = session.user?.isAdmin === true || String(session.user?.role || "").toUpperCase() === "ADMIN";
  if (!isAdmin) {
    redirect(localizePath("/", locale));
  }
  return <AdminMentoringPage />;
}
