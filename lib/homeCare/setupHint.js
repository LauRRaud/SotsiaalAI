/* KODUTEENUS — juhis värskele organisatsioonile, kus ei ole veel hooldusjuhti.

   Leitud päris saidi läbimängus 10.10.2026: moodul oli sees, aga ühelgi liikmel
   ei olnud hooldusjuhi õigust. Avaleht ütles omanikule „sa ei ole veel ühegi
   kliendi meeskonnas" ega öelnud, et kliente ei saa keegi lisada enne, kui
   õigus on antud, ega seda, kust õigus antakse.

   Juhis ilmub AINULT siis, kui kogu organisatsioonis ei ole ühtegi kehtivat
   hooldusjuhi õigust. Üksuse hooldusjuht loeb: siis on, kelle poole pöörduda. */

import { prisma } from "../prisma.js";
import { OrganizationMembershipStatus } from "../org/constants.js";

import { HOME_CARE_COORDINATOR } from "./constants.js";

export const SETUP_HINT_VIEWER = Object.freeze({
  /* Omanik saab õiguse ise anda: juhis viib lehele „Liikmed". */
  OWNER: "OWNER",
  /* Kõik teised: õiguse annab omanik. */
  OTHER: "OTHER"
});

/**
 * `null`, kui hooldusjuht on olemas; muidu see, kellele juhis on mõeldud.
 * Vaataja, kes on ise hooldusjuht, päringut ei tee.
 */
export async function coordinatorSetupHint(context, { db = prisma, now = new Date() } = {}) {
  const organizationId = context?.organization?.id;
  if (!organizationId) return null;

  const own = new Set((context.capabilities || []).map((grant) => grant.capability));
  if (own.has(HOME_CARE_COORDINATOR)) return null;

  const coordinators = await db.organizationCapabilityGrant.count({
    where: {
      capability: HOME_CARE_COORDINATOR,
      revokedAt: null,
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      membership: { organizationId, status: OrganizationMembershipStatus.ACTIVE }
    }
  });
  if (coordinators > 0) return null;

  return { viewer: own.has("ORG_OWNER") ? SETUP_HINT_VIEWER.OWNER : SETUP_HINT_VIEWER.OTHER };
}
