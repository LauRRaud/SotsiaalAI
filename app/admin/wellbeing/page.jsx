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
import AdminWellbeingClient from "./AdminWellbeingClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Tööheaolu koondandmestik - SotsiaalAI",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function AdminWellbeingPage() {
  noStore();
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig);
  if (!session) {
    const params = new URLSearchParams({
      callbackUrl: localizePath("/admin/wellbeing", locale)
    });
    redirect(`/api/auth/signin?${params.toString()}`);
  }

  const isAdmin =
    Boolean(session?.user?.isAdmin) ||
    String(session?.user?.role || "").toUpperCase() === "ADMIN";
  if (!isAdmin) redirect(localizePath("/", locale));

  return (
    <section className={ragAdminPageShellClassName}>
      <div className={`${ragAdminShellInnerClassName} max-w-[72rem] text-[color:var(--documents-page-text)]`}>
        <AdminWellbeingClient />
      </div>
    </section>
  );
}
