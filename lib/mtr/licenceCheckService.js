/* A4 E4 (teenuskiht) — ahel, mis paneb E1, E2 ja E3 kokku.

   Üks kontroll = identiteedivärav + lubade päring + kirje + iga teenuse
   hinnang. Liidest siin ei ole: see fail on kutsutav nii admini nupu,
   ajastatud korje kui osutaja „kontrolli uuesti" alt.

   KOLM REEGLIT, mis siin jõustuvad:

   1. Ilma registrikoodita EI TEHTA päringut ega kirjet. Teenused jäävad
      seisu, mis ütleb „ei saanud kinnitada" — mitte „luba puudub".
   2. Identiteedivärav käib ENNE tulemuse tõlgendamist: kui registrikood ei
      lahendunud, ei teki ühtki avalikku väidet, isegi kui lubade päring
      õnnestus.
   3. Käsitsi kontroll austab jahtumisaega (`policy.js`), et „kontrolli
      uuesti" nupp ei muutuks koormuseks võõrale registrile. */

import { prisma as defaultPrisma } from "../prisma.js";

import { assessServiceLicence } from "./assessment.js";
import { MTR_RESULT, fetchLicencesByRegistryCode, resolveEntityByRegistryCode } from "./licences.js";
import { manualCheckAllowed, nextCheckAfter } from "./policy.js";

export const CHECK_TRIGGER = Object.freeze({
  AUTO: "AUTO",
  MANUAL: "MANUAL"
});

export const CHECK_SKIPPED = Object.freeze({
  COOLDOWN: "COOLDOWN",
  NO_REGISTRY_CODE: "NO_REGISTRY_CODE",
  PROFILE_NOT_FOUND: "PROFILE_NOT_FOUND"
});

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Hindab profiili teenused ja kirjutab tulemused; kontroll võib olla ka `null`. */
async function writeAssessments({ prisma, services, check, previousByService, now }) {
  const assessments = [];
  for (const service of services) {
    const previous = previousByService.get(service.id) || null;
    const assessment = assessServiceLicence({
      serviceKey: service.serviceKey || null,
      check,
      previous,
      now
    });

    const data = {
      serviceKey: assessment.serviceKey || "",
      catalogueVersion: assessment.catalogueVersion,
      requirementAtAssessment: assessment.requirementAtAssessment,
      activityExpected: assessment.activityExpected,
      activityTypeExpected: assessment.activityTypeExpected,
      coverage: assessment.coverage,
      publicStatus: assessment.publicStatus,
      consecutiveMissCount: assessment.consecutiveMissCount,
      checkId: check?.id || null,
      assessedAt: now
    };

    await prisma.serviceLicenceAssessment.upsert({
      where: { providerServiceId: service.id },
      create: { providerServiceId: service.id, ...data },
      update: data
    });

    assessments.push({ providerServiceId: service.id, ...assessment });
  }
  return assessments;
}

/**
 * Käivitab ühe osutaja profiili loakontrolli.
 *
 * Ei viska erindit MTR-i pärast — allikaklient annab alati seisu, mitte vea.
 */
export async function runLicenceCheck({
  providerProfileId,
  trigger = CHECK_TRIGGER.AUTO,
  prisma = defaultPrisma,
  now = new Date(),
  fetchLicences = fetchLicencesByRegistryCode,
  resolveEntity = resolveEntityByRegistryCode,
  options = {}
} = {}) {
  const profile = await prisma.serviceProviderProfile.findUnique({
    where: { id: providerProfileId },
    select: {
      id: true,
      registryCode: true,
      organizationName: true,
      serviceItems: { select: { id: true, serviceKey: true } },
      licenceChecks: {
        orderBy: { attemptedAt: "desc" },
        take: 1,
        select: { attemptedAt: true, result: true }
      }
    }
  });
  if (!profile) return { ok: false, skipped: CHECK_SKIPPED.PROFILE_NOT_FOUND };

  const services = profile.serviceItems || [];
  const existing = await prisma.serviceLicenceAssessment.findMany({
    where: { providerServiceId: { in: services.map((service) => service.id) } },
    select: { providerServiceId: true, publicStatus: true, coverage: true, consecutiveMissCount: true }
  });
  const previousByService = new Map(existing.map((row) => [row.providerServiceId, row]));

  const lastAttemptAt = toDate(profile.licenceChecks?.[0]?.attemptedAt);
  if (trigger === CHECK_TRIGGER.MANUAL && !manualCheckAllowed({ lastAttemptAt, now })) {
    return { ok: false, skipped: CHECK_SKIPPED.COOLDOWN, retryAfter: lastAttemptAt };
  }

  /* 1. reegel: ilma koodita ei ole, mille järgi küsida. Teenused saavad seisu,
     aga ühtki kontrollikirjet ega päringut ei teki. */
  if (!profile.registryCode) {
    const assessments = await writeAssessments({ prisma, services, check: null, previousByService, now });
    return { ok: false, skipped: CHECK_SKIPPED.NO_REGISTRY_CODE, assessments };
  }

  const [entity, licences] = await Promise.all([
    resolveEntity(profile.registryCode, options),
    fetchLicences(profile.registryCode, options)
  ]);

  /* 2. reegel: identiteet enne tõlgendamist. Lahendamata kood tähendab, et me
     ei tea, KELLE kohta vastus käis — ka siis, kui ridu tuli. */
  const entityResolved = entity.status === MTR_RESULT.OK && entity.found === true;
  const succeeded = licences.status === MTR_RESULT.OK && entityResolved;

  const check = await prisma.licenceCheck.create({
    data: {
      providerProfileId: profile.id,
      registryCode: profile.registryCode,
      result: licences.status === MTR_RESULT.OK ? "OK" : "UNCONFIRMED",
      reason: licences.reason || (entityResolved ? null : entity.reason || null),
      entityResolved,
      entityName: entity.name || null,
      checksumValid: Boolean(licences.checksumValid),
      attemptedAt: toDate(licences.attemptedAt) || now,
      verifiedAt: toDate(licences.checkedAt),
      nextCheckAt: nextCheckAfter({ succeeded, consecutiveFailures: succeeded ? 0 : 1, now }),
      unknownColumns: licences.unknownColumns || [],
      missingOrderedColumns: licences.missingOrderedColumns || [],
      licences: {
        create: (licences.licences || []).map((licence) => ({
          licenceNumber: licence.number,
          registryCode: licence.registryCode,
          activity: licence.activity,
          activityType: licence.activityType || null,
          validFrom: new Date(`${licence.validFrom}T00:00:00.000Z`),
          validUntil: licence.validUntil ? new Date(`${licence.validUntil}T00:00:00.000Z`) : null,
          indefinite: Boolean(licence.indefinite),
          valid: Boolean(licence.valid),
          organizationName: licence.organizationName,
          licensedMaxPersons: licence.licensedMaxPersons ?? null,
          note: licence.note || null,
          locations: {
            create: (licence.locations || []).map((location) => ({
              address: location.address,
              licensedMaxPersons: location.licensedMaxPersons ?? null
            }))
          }
        }))
      }
    },
    select: { id: true }
  });

  const assessments = await writeAssessments({
    prisma,
    services,
    check: {
      id: check.id,
      result: licences.status === MTR_RESULT.OK ? "OK" : "UNCONFIRMED",
      reason: licences.reason || null,
      entityResolved,
      verifiedAt: toDate(licences.checkedAt),
      licences: licences.licences || []
    },
    previousByService,
    now
  });

  return {
    ok: true,
    checkId: check.id,
    entityResolved,
    entityName: entity.name || null,
    /* Nimeanomaalia on ADMINI signaal, mitte avalik seis. */
    nameMismatch:
      entityResolved && entity.name
        ? entity.name.trim().toLocaleLowerCase("et") !== String(profile.organizationName || "").trim().toLocaleLowerCase("et")
        : false,
    missingOrderedColumns: licences.missingOrderedColumns || [],
    unknownColumns: licences.unknownColumns || [],
    assessments
  };
}

/** Profiili teenuste avalikud loaseisud — E4 ja E5 lugemisrada. */
export async function licenceStatusesForProfile({ providerProfileId, prisma = defaultPrisma } = {}) {
  const services = await prisma.serviceProviderService.findMany({
    where: { providerProfileId },
    select: {
      id: true,
      name: true,
      serviceKey: true,
      licenceAssessment: {
        select: {
          publicStatus: true,
          coverage: true,
          requirementAtAssessment: true,
          activityExpected: true,
          activityTypeExpected: true,
          catalogueVersion: true,
          assessedAt: true,
          consecutiveMissCount: true,
          check: { select: { verifiedAt: true, reason: true, registryCode: true } }
        }
      }
    }
  });

  return services.map((service) => ({
    serviceId: service.id,
    name: service.name,
    serviceKey: service.serviceKey || null,
    assessment: service.licenceAssessment || null
  }));
}
