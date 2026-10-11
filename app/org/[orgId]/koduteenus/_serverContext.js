import { notFound } from "next/navigation";

import { HOME_CARE_MODULE } from "@/lib/homeCare/constants";
import { isHomeCareEnabled } from "@/lib/homeCare/flags";
import { resolveOrgAccessContext } from "@/lib/org/accessContext";

import { requireOrgPageContext } from "../../_serverContext";

/**
 * KODUTEENUS K1 — lehtede serveripoolne värav.
 *
 * Sama järjekord mis API-l: lipp, sessioon, liikmesus, moodul. Lipu või mooduli
 * puudumine on `notFound()`, mitte „pole õigust": suletud pind ei tohi paista
 * olemasolevana.
 *
 * Tagastab KAKS konteksti. Kliendiprojektsioon läheb komponendile; täiskontekst
 * (üksuste puuga) jääb serverisse ja seda vajab hooldusjuhi skoobi arvutus.
 */
export async function requireHomeCarePage(orgId, returnPath) {
  if (!isHomeCareEnabled()) notFound();

  const auth = await requireOrgPageContext(orgId, returnPath);
  if (!(auth.context.activeModules || []).includes(HOME_CARE_MODULE)) notFound();

  const fullContext = await resolveOrgAccessContext({
    userId: auth.userId,
    requestedOrganizationId: orgId,
    isPlatformAdmin: Boolean(auth.roleState?.isAdmin),
    productRole: auth.roleState?.effectiveRole
  });
  return { auth, fullContext };
}
