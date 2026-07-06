import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import WellbeingPage from "@/components/wellbeing/WellbeingPage";
import { requireSubscription, resolveSessionRoleState } from "@/lib/authz";
import { getLocaleFromCookies } from "@/lib/i18n";
import { localizePath } from "@/lib/localizePath";
import { buildLocalizedMetadata } from "@/lib/metadata";
import { canUseWellbeingRole, getWellbeingToolBySlug } from "@/lib/wellbeingTools";

export async function generateMetadata({ params }) {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const resolvedParams = await params;
  const tool = getWellbeingToolBySlug(resolvedParams?.tool);

  return buildLocalizedMetadata({
    locale,
    pathname: tool?.route || "/tooheaolu",
    title: tool ? `${tool.title} | Tööheaolu` : "Tööheaolu",
    description: tool?.description || "Sotsiaaltöö spetsialisti tööheaolu tööruum."
  });
}

export default async function TooheaoluToolPage({ params }) {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig).catch(() => null);
  const roleState = resolveSessionRoleState(session, cookieStore);
  const resolvedParams = await params;
  const tool = getWellbeingToolBySlug(resolvedParams?.tool);

  if (!tool) {
    notFound();
  }

  const gate = await requireSubscription(session, roleState.effectiveRole);
  if (!gate.ok) {
    redirect(localizePath(gate.redirect || "/tellimus", locale));
  }

  if (!canUseWellbeingRole(roleState.effectiveRole, Boolean(roleState.isAdmin))) {
    redirect(localizePath("/vestlus", locale));
  }

  return <WellbeingPage activeTool={tool} locale={locale} />;
}
