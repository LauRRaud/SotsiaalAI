/* A4 — teenuse sidumine loakataloogiga.

   See on ainus koht, kus `serviceKey` muutub. Profiili salvestus teda ei
   puuduta (server säilitab varasema väärtuse), sest vale seos = vale märgis
   ja seos peab olema teadlik toiming, mitte vormivälja kõrvalmõju.

   NELI REEGLIT, mis siin jõustuvad:

   1. **Kataloog on ainus lubatud väärtus.** Tundmatu võti lükatakse tagasi —
      muidu tekiks hinnang, mille kohta E2 ei tea midagi.
   2. **Vana hinnang ei kehti uuele teenuseliigile.** Sidumine viib seisu KOHE
      `NOT_CHECKED` peale ja kustutab tõendi: „kontrollitud" oli väide EELMISE
      liigi kohta ja ta ei tohi uue külge rännata.
   3. **Iga muudatus jätab jälje** (`DataAuditLog`): kes, millal, vana võti,
      uus võti. Usaldusmärgise alust ei muudeta anonüümselt.
   4. **Automaatset sidumist nime järgi EI OLE.** Tuvastaja tohib pakkuda
      kandidaate, aga kinnitab inimene (omanik 05.08). */

import { prisma as defaultPrisma } from "../prisma.js";

import { LICENCE_PUBLIC_STATUS } from "./assessment.js";
import { CHECK_TRIGGER, runLicenceCheck } from "./licenceCheckService.js";
import {
  LICENCE_REQUIREMENT,
  LICENSED_SERVICE_CATALOGUE_VERSION,
  detectServiceCandidates,
  findServiceByKey
} from "./licensedServices.js";

export const BINDING_AUDIT_ACTION = "mtr.service_licence_binding";

export const BINDING_ERROR = Object.freeze({
  SERVICE_NOT_FOUND: "SERVICE_NOT_FOUND",
  UNKNOWN_SERVICE_KEY: "UNKNOWN_SERVICE_KEY"
});

/** Kandidaadid admini jaoks — ETTEPANEK, mitte otsus. */
export async function bindingCandidates({ providerServiceId, prisma = defaultPrisma } = {}) {
  const service = await prisma.serviceProviderService.findUnique({
    where: { id: providerServiceId },
    select: { id: true, name: true, description: true, category: true, categories: true, serviceKey: true }
  });
  if (!service) return { ok: false, error: BINDING_ERROR.SERVICE_NOT_FOUND };

  const haystack = [service.name, service.category, ...(service.categories || []), service.description]
    .filter(Boolean)
    .join(" ");

  return {
    ok: true,
    service: { id: service.id, name: service.name, serviceKey: service.serviceKey || null },
    /* Tuvastaja annab KANDIDAADID koos vaste põhjuse ja kindlusastmega.
       Automaatset valikut ei tehta: madala kindlusega alias („lapsehoid")
       tähendab tänases seaduses hoopis teist teenust. */
    candidates: detectServiceCandidates(haystack).map((candidate) => ({
      serviceKey: candidate.key,
      label: candidate.label,
      requirement: candidate.requirement,
      legalBasis: candidate.legalBasis,
      matchedText: candidate.matchedText,
      matchedBy: candidate.matchedBy,
      confidence: candidate.confidence,
      note: candidate.note
    }))
  };
}

/**
 * Seob teenuse kataloogi kirjega (või `null` = lahutab).
 *
 * Andmebaasi osa on üks tehing; kohene kontroll käib TEHINGUST VÄLJAS, sest ta
 * ootab võõra registri taga.
 */
export async function bindServiceKey({
  providerServiceId,
  serviceKey = null,
  actorUserId = null,
  prisma = defaultPrisma,
  now = new Date(),
  checkNow = true,
  runCheck = runLicenceCheck
} = {}) {
  const nextKey = serviceKey ? String(serviceKey).trim() : null;
  /* 1. reegel: ainult kataloogis olev võti. */
  if (nextKey && !findServiceByKey(nextKey)) {
    return { ok: false, error: BINDING_ERROR.UNKNOWN_SERVICE_KEY };
  }

  const service = await prisma.serviceProviderService.findUnique({
    where: { id: providerServiceId },
    select: { id: true, name: true, serviceKey: true, providerProfileId: true }
  });
  if (!service) return { ok: false, error: BINDING_ERROR.SERVICE_NOT_FOUND };

  const previousKey = service.serviceKey || null;
  if (previousKey === nextKey) {
    return { ok: true, changed: false, providerServiceId: service.id, serviceKey: nextKey };
  }

  const mapped = nextKey ? findServiceByKey(nextKey) : null;

  await prisma.$transaction(async (tx) => {
    await tx.serviceProviderService.update({ where: { id: service.id }, data: { serviceKey: nextKey } });

    if (nextKey) {
      /* 2. reegel: vana tõend ei rända uue liigi külge. Seis läheb kohe
         `NOT_CHECKED` peale ja kogu varasem tõendus kustub. */
      const reset = {
        serviceKey: nextKey,
        catalogueVersion: LICENSED_SERVICE_CATALOGUE_VERSION,
        requirementAtAssessment: mapped?.requirement || LICENCE_REQUIREMENT.UNKNOWN,
        activityExpected: mapped?.activity?.label || null,
        activityTypeExpected: mapped?.activityType || null,
        coverage: "UNCONFIRMED",
        publicStatus: LICENCE_PUBLIC_STATUS.NOT_CHECKED,
        assessmentReason: null,
        publicStatusValidUntil: null,
        coveringLicenceNumber: null,
        confirmedMissCount: 0,
        lastAttemptCheckId: null,
        statusSourceCheckId: null,
        assessedAt: now
      };
      await tx.serviceLicenceAssessment.upsert({
        where: { providerServiceId: service.id },
        create: { providerServiceId: service.id, ...reset },
        update: reset
      });
    } else {
      /* Lahutatud teenusel ei ole seisu, mida kuvada. */
      await tx.serviceLicenceAssessment.deleteMany({ where: { providerServiceId: service.id } });
    }

    /* 3. reegel: jälg. */
    await tx.dataAuditLog.create({
      data: {
        actorUserId,
        action: BINDING_AUDIT_ACTION,
        resourceType: "ServiceProviderService",
        resourceId: service.id,
        meta: {
          providerProfileId: service.providerProfileId,
          serviceName: service.name,
          previousServiceKey: previousKey,
          nextServiceKey: nextKey,
          catalogueVersion: LICENSED_SERVICE_CATALOGUE_VERSION
        }
      }
    });
  });

  /* Kohene kontroll, et seotud teenus ei jääks ootama järgmist korjet. */
  let check = null;
  if (checkNow && nextKey) {
    check = await runCheck({
      providerProfileId: service.providerProfileId,
      /* AUTO, mitte MANUAL: see ei ole kasutaja nupuvajutus, vaid süsteemi
         järelkäik sidumisele — jahtumisaeg ei tohi seda ära jätta ja jätta
         vastseotud teenust seisu `NOT_CHECKED` kuni järgmise korjeni. */
      trigger: CHECK_TRIGGER.AUTO,
      prisma,
      now
    });
  }

  return {
    ok: true,
    changed: true,
    providerServiceId: service.id,
    previousServiceKey: previousKey,
    serviceKey: nextKey,
    check
  };
}
