import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import TeemaseemnedPage from "@/components/teemaseeme/TeemaseemnedPage";
import { canUseCovisionRole } from "@/lib/covision";
import { getLocaleFromCookies } from "@/lib/i18n";
import { localizePath } from "@/lib/localizePath";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);

  return buildLocalizedMetadata({
    locale,
    pathname: "/teemaseemned",
    title: "Teemaseemned",
    description: "Professionaalsed tööseemned — juhtumi märkamisest kovisioonini ja üldistatud õppimiseni."
  });
}

export default async function TeemaseemnedRoute() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig).catch(() => null);
  const role = String(session?.user?.role || "").toUpperCase();
  const admin = role === "ADMIN" || session?.user?.isAdmin === true;

  if (!session?.user?.id) {
    redirect(localizePath("/vestlus?login=1", locale));
  }

  if (!canUseCovisionRole(role, admin)) {
    redirect(localizePath("/vestlus", locale));
  }

  return <TeemaseemnedPage />;
}
