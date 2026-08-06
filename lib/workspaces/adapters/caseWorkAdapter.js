import prisma from "@/lib/prisma";

import { caseDisplayLabel, resolveClientNames } from "@/lib/casework/caseWorkAssist";
import { isCaseWorkEnabled } from "@/lib/casework/flags";

import { assertWorkspaceDescriptor, WorkspaceLifecycle, WorkspaceVisibility } from "../descriptor.js";
import { WorkspaceKind } from "../registry.js";

/**
 * JUHTUM-V1 (CASEWORK-P7) — K1 `case_work` adapter.
 *
 * `WorkspaceKind.CASE_WORK` oli registris juba RESERVED; see fail aktiveerib ta.
 * Sama käik, mille `org_space` tegi, ja sama põhjus: reserveeritud võti tähendab,
 * et objektil on ÜKS kanooniline ajajoone- ja auditivõti
 * (`workspaceKind = "case_work"`, `workspaceId = CaseWorkAssist.id`) ega teist
 * paralleelset juhtumi mõistet ei teki.
 *
 * MIDA DESKRIPTOR EI KANNA (leping E5):
 *   - `nextContactAt` — ta on juhtumi SISU, mitte tööruumi metaandmed. Tööruumi-
 *     loend on kohtade nimekiri, mitte tööplaan, ja järgmise kontakti kuupäev
 *     inimese kohta ei tohi sinna lekkida.
 *   - kliendiviide ise, avatud punktide arv, seoste arv, päritolu — mitte midagi,
 *     mis kirjeldaks juhtumi sisu.
 *
 * PEALKIRI TULEB `caseDisplayLabel()`-ist — TÄPSELT SAMAST funktsioonist, mida
 * kasutab liides. Kaks kuvanime-loogikat tähendaks, et loend ja tööruumiloend
 * nimetavad sama juhtumit eri moodi, ja kustutatud kliendiviide võiks ühes kohas
 * veel paista.
 */

/**
 * Retention → K1 elutsükkel.
 *
 * `READ_ONLY` on `CLOSED`, mitte `PAUSED`: paus tähendab, et töö jätkub, ja
 * juhtumil ei ole V1-s tagasiteed (leping L14).
 */
const LIFECYCLE_BY_RETENTION = Object.freeze({
  ACTIVE: WorkspaceLifecycle.ACTIVE,
  READ_ONLY: WorkspaceLifecycle.CLOSED,
  ARCHIVED: WorkspaceLifecycle.ARCHIVED
});

export function toCaseWorkWorkspaceDescriptor(row, resolvedClientName = null) {
  const id = String(row?.id || "").trim();
  const ownerId = String(row?.ownerUserId || "").trim();
  const label = caseDisplayLabel(row, resolvedClientName);

  return assertWorkspaceDescriptor({
    ref: { kind: WorkspaceKind.CASE_WORK, id },
    /* Kui teksti ei ole (kustutatud viide või nimetu juhtum), läheb pealkirjaks
       TÕLKEVÕTI, mitte andmebaasist tulnud string — sama reegel mis mujal K1-s. */
    title: label.text || label.labelKey,
    ownerId,
    responsibleId: ownerId,
    lifecycle: LIFECYCLE_BY_RETENTION[row?.retentionState] || WorkspaceLifecycle.ACTIVE,
    phase: null,
    goal: null,
    nextAction: null,
    progress: null,
    /* PRIVATE: juhtum on ühe töötaja töökorraldus. Osalejaid ei ole ja
       `participants` kannab ainult teda ennast. */
    visibility: WorkspaceVisibility.PRIVATE,
    participants: { active: 1, invited: 0 },
    lastMeaningfulActivityAt: new Date(row?.updatedAt || Date.now()).toISOString(),
    href: { action: "open_workspace", target: `${WorkspaceKind.CASE_WORK}:${id}` }
  });
}

/**
 * Kasutaja juhtumid tööruumideskriptoritena. READ-ONLY ja omaniku-skoobitud;
 * võõras saab tühja loendi.
 *
 * PAGINEERIMINE järgib K1 tava (`take: 100`), mitte JUHTUM-V1 oma cursor-mustrit.
 * `listWorkspaces(userId, { db })` ei võta pagineerimisparameetrit ja KÕIK 12
 * adapterit kasutavad kõva piiri — cursori nõudmine siin tähendaks K1
 * adapterilepingu muutmist üle platvormi, mis on lepingus selgelt VÄLJAS.
 */
export async function listWorkspaces(userId, { db = prisma } = {}) {
  const ownerUserId = String(userId || "").trim();
  if (!ownerUserId) return [];
  /* Väravaga väljas ei ole seda tööruumiliiki olemas — tühi loend, mitte viga:
     tööruumiloend koondab paljusid liike ja üks väljalülitatud liik ei tohi
     kogu loendit kukutada. */
  if (!isCaseWorkEnabled()) return [];

  const rows = await db.caseWorkAssist.findMany({
    where: { ownerUserId },
    select: {
      id: true,
      ownerUserId: true,
      clientUserId: true,
      clientDisplayName: true,
      clientExternalRef: true,
      clientErasedAt: true,
      retentionState: true,
      updatedAt: true
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 100
  });

  const names = await resolveClientNames(rows, { db });
  return rows.map((row) => toCaseWorkWorkspaceDescriptor(row, names.get(row.clientUserId) || null));
}

export const listCaseWorkWorkspaces = listWorkspaces;
