import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { resolveSessionRoleState } from "@/lib/authz";
import { getLocaleFromCookies } from "@/lib/i18n";
import { localizePath } from "@/lib/localizePath";
import { resolveOrgAccessContext, toClientContext } from "@/lib/org/accessContext";
import { isOrgWorkspaceEnabled } from "@/lib/org/flags";

/**
 * T25 ORG-FOUNDATION-V1 — org-lehtede serveripoolne värav.
 *
 * Sama kolmene ring kui API-l ja samas järjekorras. Leht ei tohi olla nõrgem
 * värav kui API: kui keegi jõuab lehele, mille API talle keelaks, on see
 * infoleke ka siis, kui leht ise midagi ei näita.
 *
 * Gate väljas → `notFound()`, MITTE ümbersuunamine sisselogimisse. Väravaga
 * suletud pind ei tohi paista „olemas, aga pole õigust".
 */

export async function requireOrgSession(returnPath) {
  if (!isOrgWorkspaceEnabled()) notFound();

  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    const params = new URLSearchParams({ callbackUrl: localizePath(returnPath, locale) });
    redirect(`/api/auth/signin?${params.toString()}`);
  }

  return {
    locale,
    session,
    userId: String(session.user.id),
    userEmail: String(session.user.email || "").trim().toLowerCase(),
    roleState: resolveSessionRoleState(session, cookieStore)
  };
}

/**
 * Lehe organisatsioonikontekst. Tagastab KLIENDIPROJEKTSIOONI, mitte täiskonteksti
 * — sisemine üksuste puu ei tohi jõuda serverikomponendist kliendisse.
 */
export async function requireOrgPageContext(organizationId, returnPath) {
  const auth = await requireOrgSession(returnPath);
  try {
    const context = await resolveOrgAccessContext({
      userId: auth.userId,
      requestedOrganizationId: organizationId,
      isPlatformAdmin: Boolean(auth.roleState?.isAdmin),
      productRole: auth.roleState?.effectiveRole
    });
    return { ...auth, organizationId, context: toClientContext(context) };
  } catch {
    // Võõras, arhiveeritud ja olematu organisatsioon näevad välja ühesugused.
    notFound();
  }
}
