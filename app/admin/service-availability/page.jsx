import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { unstable_noStore as noStore } from "next/cache";

import { authConfig } from "@/auth";
import {
  ragAdminPageShellClassName,
  ragAdminShellInnerClassName
} from "@/components/admin/rag/ragAdminShellStyles";
import { getLocaleFromCookies } from "@/lib/i18n";
import { localizePath } from "@/lib/localizePath";
import AdminServiceAvailabilityClient from "./AdminServiceAvailabilityClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Service availability - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

export default async function AdminServiceAvailabilityPage() {
  noStore();
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig).catch(() => null);
  if (!session) {
    const params = new URLSearchParams({ callbackUrl: localizePath("/admin/service-availability", locale) });
    redirect(`/api/auth/signin?${params.toString()}`);
  }
  const admin = session?.user?.isAdmin === true || String(session?.user?.role || "").toUpperCase() === "ADMIN";
  if (!admin) redirect(localizePath("/", locale));

  return (
    <section className={ragAdminPageShellClassName}>
      <div className={`${ragAdminShellInnerClassName} max-w-[72rem] text-[color:var(--documents-page-text)]`}>
        <AdminServiceAvailabilityClient />
      </div>
    </section>
  );
}
