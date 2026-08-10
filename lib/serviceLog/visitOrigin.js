/**
 * TEENUSPÄEVIK — KÜLASTUSE ORGANISATSIOONILINE PÄRITOLU (SOL-SLOG-17, -18).
 *
 * ÜKS INVARIANT, ÜKS FAIL. Sama reegel elab kolmes kohas — juhi määramine,
 * töötaja enda lisatud töö ja juhi tahvli filter — ja kolm koopiat lahkneksid
 * täpselt nii, nagu SOL-SLOG-14 puhul juba korra juhtus. Seepärast on siin üks
 * lause, mille kõik kolm sisse kutsuvad:
 *
 *   **Külastus kuulub sellele organisatsioonile, kelle tööna ta SÜNDIS —
 *   ja kui see ei ole tõendatav, ei kuulu ta ühelegi.**
 *
 * MIKS INIMESE KAUDU TULETAMINE EI KÕLBA. Teenuspäevik on SOLO-profiili
 * põhine: ühel töötajal on üks profiil ja üks tööpäev, ka siis, kui ta töötab
 * kahes organisatsioonis. „Selle juhi töötajate tööd" on seega täiesti õige
 * loend täiesti valest hulgast — temas on ka teise maja kliendid.
 *
 * `NULL` EI OLE „KÕIGILE", VAID „MITTE KELLELEGI". Töötaja enda lisatud töö,
 * mida ei saa ühemõtteliselt ühe organisatsiooni külge siduda, jääb tema enda
 * päevikusse ega ilmu ühelegi juhi tahvlile. Vastupidine vaikeväärtus oleks
 * täpselt see leke, mida parandame.
 */

import { prisma } from "@/lib/prisma";

import { OrganizationMembershipStatus } from "@/lib/org/constants";

/**
 * Töötaja enda lisatud töö päritolu.
 *
 * ÜHEMÕTTELISUS ON TINGIMUS, MITTE MUGAVUS. Ühe aktiivse liikmesuse korral on
 * vastus tõendatav ilma oletamiseta: muud organisatsiooni ei ole olemas. Kahe
 * korral ei ole platvormil ühtegi allikat, mis ütleks, KUMMA majale see
 * konkreetne külastus tehti — ja vale vastus siin tähendaks kliendi nime vale
 * juhi ekraanil. Seepärast on kahe puhul vastus `null`, mitte esimene leitu.
 *
 * @returns organisatsiooni ID või `null`, kui päritolu ei ole tõendatav.
 */
export async function resolveSelfAssignedOrganizationId(workerUserId, { db = prisma } = {}) {
  if (!workerUserId) return null;
  const memberships = await db.organizationMembership.findMany({
    where: { userId: workerUserId, status: OrganizationMembershipStatus.ACTIVE },
    select: { organizationId: true },
    /* Kaks piisab otsuseks: kolmas rida ei muuda vastust, aga maksab. */
    take: 2
  });
  if (memberships.length !== 1) return null;
  return memberships[0]?.organizationId || null;
}

/**
 * Kas SEE külastus on SELLE organisatsiooni oma.
 *
 * Kutsuja peab käsitlema `false`-i **404-na, mitte 403-na**: võõra maja töö
 * olemasolu on ise info ja „sul ei ole õigust" ütleks selle välja.
 */
export function belongsToOrganization(visit, organizationId) {
  if (!organizationId) return false;
  return Boolean(visit?.assignedOrganizationId) && visit.assignedOrganizationId === organizationId;
}

/** Juhi tahvli ja määramisradade ühine WHERE-fragment. */
export function organizationVisitScope(organizationId) {
  return { assignedOrganizationId: organizationId };
}
