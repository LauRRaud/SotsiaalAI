/**
 * ASUTUSE TUGIMEETMED — mida asutus oma töötajatele pakub (Tööheaolu „Minu
 * tugivõimalused" teine osa; TÜ küsitluse võrdlus ptk 8.2 p 4 ja 8.13).
 *
 * KOLM PIIRI, mis on selle faili mõte:
 *
 *   1. SEE ON ASUTUSE ANDMESTIK, mitte töötaja oma. Siin ei ole ühtegi
 *      töötaja vastust: töötaja „vajan" jääb tema privaatsesse kirjesse ja
 *      asutus ei näe, kes oma loendit vaatas või täitis.
 *   2. HALDAB SAMA INIMENE, KES TUGIKONTAKTE (`SUPPORT_CONTACT_ADMIN`, mis nõuab
 *      professionaalse toe moodulit). Uut õigust ei teki (omaniku volitusel
 *      otsustatud 20.10). Lugeda saab iga aktiivne liige — mida asutus pakub,
 *      ei ole saladus, vaid info, mida töötajad TLÜ 2024 järgi ei leia.
 *   3. MEETMED ON KATALOOGIST (`lib/wellbeing/supportMeasureCatalog.js`): sama
 *      väärtus, mida töötaja vorm kasutab, nii et eeltäitmine on otsene vastavus.
 *      Juhis (`details`) on lühike vaba tekst: kellelt, kuidas, kui tihti.
 */

import prisma from "@/lib/prisma";
import { SUPPORT_MEASURE_VALUES } from "@/lib/wellbeing/supportMeasureCatalog";

import { OrganizationMembershipStatus, OrganizationStatus } from "./constants.js";
import { badRequest } from "./errors.js";
import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "./audit.js";

/** Juhise pikkus: üks-kaks lauset. Pikem tekst ei mahu töötaja tulemuse vaatesse. */
export const SUPPORT_MEASURE_DETAILS_LIMIT = 200;

const catalogOrder = (a, b) => SUPPORT_MEASURE_VALUES.indexOf(a.measureKey) - SUPPORT_MEASURE_VALUES.indexOf(b.measureKey);

/**
 * Kontrollib ja puhastab halduri saadetud loendi: tundmatu meede, kordus või
 * liiga pikk juhis on 400, mitte vaikne kärpimine.
 */
export function normalizeSupportMeasures(input) {
  if (!Array.isArray(input) || input.length > SUPPORT_MEASURE_VALUES.length) {
    throw badRequest("org.errors.support_measures_invalid");
  }
  const seen = new Set();
  const measures = input.map((entry) => {
    const measureKey = typeof entry?.measureKey === "string" ? entry.measureKey.trim() : "";
    if (!SUPPORT_MEASURE_VALUES.includes(measureKey) || seen.has(measureKey)) {
      throw badRequest("org.errors.support_measures_invalid");
    }
    seen.add(measureKey);
    if (entry.details !== undefined && entry.details !== null && typeof entry.details !== "string") {
      throw badRequest("org.errors.support_measures_invalid");
    }
    const details = String(entry.details || "").replace(/\s+/g, " ").trim();
    if (details.length > SUPPORT_MEASURE_DETAILS_LIMIT) {
      throw badRequest("org.errors.support_measure_details_too_long");
    }
    return { measureKey, details: details || null };
  });
  return measures.sort(catalogOrder);
}

/** Asutuse meetmed kataloogi järjekorras: `[{ measureKey, details }]`. */
export async function listOrganizationSupportMeasures(organizationId, { db = prisma } = {}) {
  const rows = await db.organizationSupportMeasure.findMany({
    where: { organizationId },
    select: { measureKey: true, details: true }
  });
  return rows
    .filter((row) => SUPPORT_MEASURE_VALUES.includes(row.measureKey))
    .map((row) => ({ measureKey: row.measureKey, details: row.details || null }))
    .sort(catalogOrder);
}

/**
 * Asendab asutuse meetmete loendi tervikuna (haldur märgib, mis on olemas).
 * Õiguse kontrollib route; see funktsioon on andmekiht.
 */
export async function setOrganizationSupportMeasures(
  organizationId,
  { actorUserId, measures },
  { db = prisma } = {}
) {
  const next = normalizeSupportMeasures(measures);
  const keys = next.map((measure) => measure.measureKey);

  return db.$transaction(async (tx) => {
    await tx.organizationSupportMeasure.deleteMany({
      where: { organizationId, measureKey: { notIn: keys } }
    });
    for (const measure of next) {
      await tx.organizationSupportMeasure.upsert({
        where: { organizationId_measureKey: { organizationId, measureKey: measure.measureKey } },
        create: { organizationId, measureKey: measure.measureKey, details: measure.details },
        update: { details: measure.details }
      });
    }

    await writeOrgAudit(tx, {
      actorUserId,
      action: OrgAuditAction.SUPPORT_MEASURES_SET,
      resourceType: OrgAuditResource.SUPPORT_MEASURES,
      resourceId: organizationId,
      meta: { organizationId, measureKeys: keys }
    });

    return next;
  });
}

/**
 * Tööheaolu jaoks: kasutaja aktiivsete liikmesuste asutused, kes on oma
 * meetmed kirjeldanud. Ainult aktiivne asutus — peatatud või arhiveeritud
 * asutuse lubadusi töötajale eeltäiteks ei pakuta.
 */
export async function listUserOrganizationSupportMeasures(userId, { db = prisma } = {}) {
  const rows = await db.organizationMembership.findMany({
    where: {
      userId,
      status: OrganizationMembershipStatus.ACTIVE,
      organization: { status: OrganizationStatus.ACTIVE }
    },
    select: {
      organization: {
        select: {
          id: true,
          displayName: true,
          supportMeasures: { select: { measureKey: true, details: true } }
        }
      }
    },
    orderBy: { startedAt: "asc" }
  });

  return rows
    .map(({ organization }) => ({
      id: organization.id,
      name: organization.displayName,
      measures: organization.supportMeasures
        .filter((row) => SUPPORT_MEASURE_VALUES.includes(row.measureKey))
        .map((row) => ({ measureKey: row.measureKey, details: row.details || null }))
        .sort(catalogOrder)
    }))
    .filter((organization) => organization.measures.length > 0);
}
