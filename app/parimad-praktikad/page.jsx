import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import EffectivePracticesPage from "@/components/covision/EffectivePracticesPage";
import { canUseCovisionRole } from "@/lib/covision";
import { getLocaleFromCookies } from "@/lib/i18n";
import { localizePath } from "@/lib/localizePath";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const locale = getLocaleFromCookies(await cookies());
  return buildLocalizedMetadata({
    locale,
    pathname: "/parimad-praktikad",
    title: "Parimad praktikad",
    description: "Praktikas katsetatud ja professionaalselt üle vaadatud tööviiside teadmistekogu."
  });
}

export default async function EffectivePracticesRoute() {
  const locale = getLocaleFromCookies(await cookies());
  const session = await getServerSession(authConfig).catch(() => null);
  const role = String(session?.user?.role || "").toUpperCase();
  const admin = role === "ADMIN" || session?.user?.isAdmin === true;
  if (!session?.user?.id) redirect(localizePath("/vestlus?login=1", locale));
  if (!canUseCovisionRole(role, admin)) redirect(localizePath("/vestlus", locale));
  const email = String(session.user.email || "");
  const name = String(session.user.name || "").trim() || (email ? email.split("@")[0] : "");
  return <EffectivePracticesPage user={{ name, role }} />;
}
