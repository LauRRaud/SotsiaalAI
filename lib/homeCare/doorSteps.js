/**
 * KODUTEENUS K4-f — sammud „kui uks ei avane" (kava II.6.5).
 *
 * Kliendiga lepitakse ette kokku, mida hooldaja teeb, kui uks ei avane, ja mis
 * järjekorras: koputa magamistoa aknale, helista naabrile, kellel on võti, helista
 * pojale. Sammud on kliendi juures kirjas tema enda sõnadega; juures võib olla ka rida,
 * mida EI tehta („ära helista kohe tütrele Soome").
 *
 * Ukse taga vajutab hooldaja „Ei saa sisse" ja puudutab tehtud samme. Igale puudutusele
 * jääb kellaaeg ja neist saab erijuhtumi kirje (liik „uks ei avanenud") tavalise kirje
 * teed pidi: sama õigus, sama teade hooldusjuhile, sama seadme järjekord, kui võrku ei
 * ole. Seepärast siin kirjet ei looda: see fail hoiab ainult sammude loendit.
 *
 * Loendit muudavad kliendi meeskond ja hooldusjuht (nagu püsikaarti); loeb igaüks, kes
 * tohib kliendi lehte avada. Samme ei muudeta ega kustutata: uus loend lõpetab eelmise
 * read, nii on näha, mis oli varem kokku lepitud.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, forbidden } from "../org/errors.js";

import { assertHomeCareContext, membershipDisplayName, requireClientAccess } from "./access.js";
import { HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { asObject, normalizeId, normalizeLine } from "./validation.js";

/** Kliendi kehtivad sammud järjekorras. */
export async function loadDoorStepsWithin(tx, clientId) {
  const rows = await tx.careDoorStep.findMany({
    where: { clientId, endedAt: null },
    select: { id: true, position: true, text: true },
    orderBy: [{ position: "asc" }]
  });
  return rows.map((row) => ({ id: row.id, position: row.position, text: row.text }));
}

/** Sisend on tekstide loend; tühjad read jäetakse välja, järjekord jääb. Puhas funktsioon. */
export function normalizeDoorSteps(rawSteps) {
  if (!Array.isArray(rawSteps)) throw badRequest("home_care.errors.door_steps_invalid");
  const steps = rawSteps.map((value) => normalizeLine(value, HOME_CARE_LIMITS.DOOR_STEP_TEXT_MAX)).filter(Boolean);
  if (steps.length > HOME_CARE_LIMITS.DOOR_STEPS_MAX) {
    throw badRequest("home_care.errors.door_steps_too_many", { limit: HOME_CARE_LIMITS.DOOR_STEPS_MAX });
  }
  return steps;
}

/**
 * Salvestab sammude loendi tervikuna: eelmised read lõpevad ja uued tekivad. Tühi loend
 * tähendab, et kokkulepitud samme enam ei ole. Kui loend ei muutunud, ei tehta midagi.
 */
export async function saveDoorSteps(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const steps = normalizeDoorSteps(asObject(input).steps);

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { lock: true, now });
    /* Põhjusega avaja loeb, aga kokkulepet ei muuda. */
    if (!access.isCoordinator && !access.isTeam) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });

    const current = await loadDoorStepsWithin(tx, id);
    const same = current.length === steps.length && current.every((row, index) => row.text === steps[index]);
    if (same) return { doorSteps: current };

    const membershipId = context.membership?.id || null;
    await tx.careDoorStep.updateMany({ where: { clientId: id, endedAt: null }, data: { endedAt: now, endedByMembershipId: membershipId } });
    if (steps.length) {
      const createdByName = await membershipDisplayName(tx, context);
      await tx.careDoorStep.createMany({
        data: steps.map((text, index) => ({
          organizationId: context.organization.id,
          clientId: id,
          position: index + 1,
          text,
          createdByMembershipId: membershipId,
          createdByName,
          createdAt: now
        }))
      });
    }
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_DOOR_STEPS_CHANGED,
      resourceType: OrgAuditResource.CARE_CLIENT,
      resourceId: id,
      meta: { organizationId: context.organization.id, clientId: id, change: steps.length ? "saved" : "cleared" }
    });
    return { doorSteps: await loadDoorStepsWithin(tx, id) };
  });
}
