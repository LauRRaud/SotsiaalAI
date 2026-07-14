import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import CompletedCasesPage from "@/components/covision/CompletedCasesPage";
import { canUseCovisionRole } from "@/lib/covision";
import { getLocaleFromCookies } from "@/lib/i18n";
import { localizePath } from "@/lib/localizePath";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const locale = getLocaleFromCookies(await cookies());
  return buildLocalizedMetadata({
    locale,
    pathname: "/lopetatud-juhtumid",
    title: "Lõpetatud juhtumid",
    description: "Lõpetatud Kovisioonide järelvaate, õppimise ja jätkuotsuste töölaud."
  });
}

export default async function CompletedCasesRoute() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig).catch(() => null);
  const role = String(session?.user?.role || "").toUpperCase();
  const admin = role === "ADMIN" || session?.user?.isAdmin === true;
  if (!session?.user?.id) redirect(localizePath("/vestlus?login=1", locale));
  if (!canUseCovisionRole(role, admin)) redirect(localizePath("/vestlus", locale));

  const email = String(session.user.email || "");
  const name = String(session.user.name || "").trim() || (email ? email.split("@")[0] : "");
  return <CompletedCasesPage owner={{ name, role }} />;
}
