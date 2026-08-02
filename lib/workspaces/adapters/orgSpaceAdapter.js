import prisma from "@/lib/prisma";

import { assertWorkspaceDescriptor, WorkspaceLifecycle, WorkspaceVisibility } from "../descriptor.js";
import { WorkspaceKind } from "../registry.js";

/**
 * T25 ORG-FOUNDATION-V1 — K1 `org_space` adapter (otsus O-E0-2).
 *
 * `WorkspaceKind.ORG_SPACE` oli registris juba RESERVED; see fail aktiveerib ta.
 * Tänu sellele on organisatsioonikontekstil olemas KANOONILINE ajajoone- ja
 * auditivõti (`workspaceKind = "org_space"`, `workspaceId = Organization.id`)
 * ning teist org-mõistet ei teki.
 *
 * TÄHELEPANU nimede kokkulangevusele: siinne „workspace" on K1 TÖÖ-OBJEKTI
 * mõiste. Organisatsiooni juurdepääsukontekst on eraldi asi ja elab
 * `lib/org/accessContext.js`-is (`resolveOrgAccessContext`). Need kaks ei ole
 * sünonüümid ja neid ei tohi ühte funktsiooni liita.
 *
 * MIDA DESKRIPTOR EI KANNA: mitte ühtegi liikmete arvu, tegevusmõõdikut ega
 * privaatobjekti. `participants` on TEADLIKULT `{ active: 1, invited: 0 }` —
 * vaataja ise. Päris liikmete arv oleks organisatsioonisisene fakt, mille
 * lekitamine tööruumiloendisse ei ole selle kihi asi (arenduskava §7.4).
 */

const LIFECYCLE_BY_STATUS = Object.freeze({
  DRAFT: WorkspaceLifecycle.DRAFT,
  PENDING_VERIFICATION: WorkspaceLifecycle.DRAFT,
  ACTIVE: WorkspaceLifecycle.ACTIVE,
  SUSPENDED: WorkspaceLifecycle.PAUSED,
  ARCHIVED: WorkspaceLifecycle.ARCHIVED
});

/**
 * @param {Object} row `OrganizationMembership` rida koos organisatsiooniga
 * @param {string} viewerUserId
 */
export function toOrgSpaceWorkspaceDescriptor(row, viewerUserId) {
  const organization = row?.organization || {};
  const id = String(organization.id || "").trim();
  /* K1 deskriptor nõuab kasutaja-ID-d. Organisatsioonil EI OLE üht inimomanikku
     (see ongi org-kihi mõte), seega kasutame vaatajat: deskriptor on
     kasutajapõhine lugemismudel, mitte omandiväide. */
  const viewer = String(viewerUserId || "").trim();

  return assertWorkspaceDescriptor({
    ref: { kind: WorkspaceKind.ORG_SPACE, id },
    title: String(organization.displayName || "workspace.kind.org_space").trim(),
    ownerId: viewer,
    responsibleId: viewer,
    lifecycle: LIFECYCLE_BY_STATUS[organization.status] || WorkspaceLifecycle.ACTIVE,
    phase: null,
    goal: null,
    nextAction: null,
    progress: null,
    /* ORG_META, mitte PRIVATE ega SHARED_PARTICIPANTS: organisatsiooni tööruum
       on organisatsiooni haldusmeta, mitte isiklik ega osalejapõhine objekt. */
    visibility: WorkspaceVisibility.ORG_META,
    participants: { active: 1, invited: 0 },
    lastMeaningfulActivityAt: new Date(organization.updatedAt || row?.startedAt || Date.now()).toISOString(),
    href: { action: "open_workspace", target: `${WorkspaceKind.ORG_SPACE}:${id}` }
  });
}

/**
 * Kasutaja organisatsiooni-tööruumid. AINULT aktiivsed liikmesused — lõppenud
 * liikmesus ei tohi tööruumiloendis alles jääda (arenduskava §E10).
 */
export async function listWorkspaces(userId, { db = prisma } = {}) {
  const viewerUserId = String(userId || "").trim();
  if (!viewerUserId) return [];

  const rows = await db.organizationMembership.findMany({
    where: {
      userId: viewerUserId,
      status: "ACTIVE",
      organization: { status: { not: "ARCHIVED" } }
    },
    select: {
      startedAt: true,
      organization: { select: { id: true, displayName: true, status: true, updatedAt: true } }
    },
    orderBy: [{ startedAt: "asc" }],
    take: 100
  });

  return rows
    .filter((row) => row.organization?.id)
    .map((row) => toOrgSpaceWorkspaceDescriptor(row, viewerUserId));
}

export const listOrgSpaceWorkspaces = listWorkspaces;
