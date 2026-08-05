/* A4 E4 (teenuskiht) — ahel, mis paneb E1, E2 ja E3 kokku.

   Üks kontroll = identiteedivärav + lubade päring + kirje + iga teenuse
   hinnang. Liidest siin ei ole: see fail on kutsutav nii admini nupu,
   ajastatud korje kui osutaja „kontrolli uuesti" alt.

   VIIS REEGLIT, mis siin jõustuvad:

   1. Ilma registrikoodita EI TEHTA päringut ega kirjet. Teenused jäävad
      seisu, mis ütleb „ei saanud kinnitada" — mitte „luba puudub".
   2. Identiteedivärav käib ENNE tulemuse tõlgendamist: kui registrikood ei
      lahendunud, ei teki ühtki avalikku väidet, isegi kui lubade päring
      õnnestus. Kirje kannab MÕLEMA allika tulemust eraldi, et hilisem kood
      ei saaks lugeda ainult üldist `result`-i ja eksida.
   3. Andmebaasi osa on ÜKS TEHING. Poolik seis — uus kontroll, pooled
      hinnangud vanad — ei tohi usaldusmärgise juures olemas olla.
   4. Paralleelsed kontrollid ei kirjuta üksteist üle: enne kirjutamist
      kontrollitakse, et vahepeal ei ole uuemat kontrolli tekkinud.
   5. Käsitsi kontroll austab jahtumisaega (`policy.js`), et „kontrolli
      uuesti" nupp ei muutuks koormuseks võõrale registrile.

   MTR-i päringud käivad TEHINGUST VÄLJAS — võõra süsteemi ootamine ei tohi
   hoida andmebaasi lukku. */

import { prisma as defaultPrisma } from "../prisma.js";

import { assessServiceLicence, publicClaimIsCurrent } from "./assessment.js";
import { MTR_RESULT, fetchLicencesByRegistryCode, resolveEntityByRegistryCode } from "./licences.js";
import { MTR_CHECK_POLICY, manualCheckAllowed, nextCheckAfter } from "./policy.js";

export const CHECK_TRIGGER = Object.freeze({
  AUTO: "AUTO",
  MANUAL: "MANUAL"
});

export const CHECK_SKIPPED = Object.freeze({
  COOLDOWN: "COOLDOWN",
  NO_REGISTRY_CODE: "NO_REGISTRY_CODE",
  PROFILE_NOT_FOUND: "PROFILE_NOT_FOUND",
  SUPERSEDED: "SUPERSEDED"
});

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function assessmentData(assessment, now) {
  return {
    serviceKey: assessment.serviceKey || "",
    catalogueVersion: assessment.catalogueVersion,
    requirementAtAssessment: assessment.requirementAtAssessment,
    activityExpected: assessment.activityExpected,
    activityTypeExpected: assessment.activityTypeExpected,
    coverage: assessment.coverage,
    publicStatus: assessment.publicStatus,
    assessmentReason: assessment.assessmentReason,
    publicStatusValidUntil: assessment.publicStatusValidUntil,
    coveringLicenceNumber: assessment.coveringLicenceNumber,
    coverageScope: assessment.coverageScope,
    confirmedMissCount: assessment.confirmedMissCount,
    lastAttemptCheckId: assessment.lastAttemptCheckId,
    statusSourceCheckId: assessment.statusSourceCheckId,
    assessedAt: now
  };
}

async function writeAssessments({ tx, services, check, previousByService, now }) {
  const assessments = [];
  for (const service of services) {
    const assessment = assessServiceLicence({
      serviceKey: service.serviceKey || null,
      check,
      previous: previousByService.get(service.id) || null,
      now
    });
    const data = assessmentData(assessment, now);
    await tx.serviceLicenceAssessment.upsert({
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
 * `completed` ütleb, kas töö jõudis lõpuni; `succeeded` ütleb, kas register
 * päriselt vastas. Need EI OLE sama asi.
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
        select: { id: true, attemptedAt: true, result: true, consecutiveFailureCount: true }
      }
    }
  });
  if (!profile) return { completed: false, succeeded: false, skipped: CHECK_SKIPPED.PROFILE_NOT_FOUND };

  const services = profile.serviceItems || [];
  const existing = await prisma.serviceLicenceAssessment.findMany({
    where: { providerServiceId: { in: services.map((service) => service.id) } },
    select: {
      providerServiceId: true,
      publicStatus: true,
      coverage: true,
      confirmedMissCount: true,
      publicStatusValidUntil: true,
      statusSourceCheckId: true,
      coveringLicenceNumber: true
    }
  });
  const previousByService = new Map(existing.map((row) => [row.providerServiceId, row]));

  const lastCheck = profile.licenceChecks?.[0] || null;
  const lastAttemptAt = toDate(lastCheck?.attemptedAt);
  if (trigger === CHECK_TRIGGER.MANUAL && !manualCheckAllowed({ lastAttemptAt, now })) {
    return {
      completed: false,
      succeeded: false,
      skipped: CHECK_SKIPPED.COOLDOWN,
      lastAttemptAt,
      /* Millal TOHIB uuesti proovida — mitte millal viimati proovisime. */
      retryAfter: new Date(lastAttemptAt.getTime() + MTR_CHECK_POLICY.manualCooldownMs)
    };
  }

  /* 1. reegel: ilma koodita ei ole, mille järgi küsida. Teenused saavad seisu,
     aga ühtki kontrollikirjet ega päringut ei teki. */
  if (!profile.registryCode) {
    const assessments = await prisma.$transaction((tx) =>
      writeAssessments({ tx, services, check: null, previousByService, now })
    );
    return { completed: true, succeeded: false, skipped: CHECK_SKIPPED.NO_REGISTRY_CODE, assessments };
  }

  /* Võõra registri ootamine käib TEHINGUST VÄLJAS.

     JÄRJESTIKU, mitte paralleelselt: kumbki päring on ise kolmesammuline ja
     paralleelselt kahekordistuv koormus ajas MÕÕDETUD 05.08 üksikpäringu üle
     ajapiiri (mõlemad andsid TIMEOUT, kuigi eraldi töötasid mõlemad). Aeglasem
     tervik on siin õige vahetus: me ei koorma võõrast registrit kahe
     samaaegse otsinguga ühe osutaja pärast. */
  const entity = await resolveEntity(profile.registryCode, options);
  const licences = await fetchLicences(profile.registryCode, options);

  const licenceOk = licences.status === MTR_RESULT.OK;
  const entityOk = entity.status === MTR_RESULT.OK;
  /* 2. reegel: identiteet enne tõlgendamist. Lahendamata kood tähendab, et me
     ei tea, KELLE kohta vastus käis — ka siis, kui ridu tuli. */
  const entityResolved = entityOk && entity.found === true;
  const succeeded = licenceOk && entityResolved;
  const consecutiveFailureCount = succeeded ? 0 : (Number(lastCheck?.consecutiveFailureCount) || 0) + 1;

  const checkPayload = {
    providerProfileId: profile.id,
    registryCode: profile.registryCode,
    result: succeeded ? "OK" : "UNCONFIRMED",
    licenceSourceResult: licenceOk ? "OK" : "UNCONFIRMED",
    entitySourceResult: entityOk ? "OK" : "UNCONFIRMED",
    licenceReason: licences.reason || null,
    entityReason: entity.reason || (entityOk && !entity.found ? "ENTITY_NOT_FOUND" : null),
    entityResolved,
    entityName: entity.name || null,
    /* Kolm väärtust: puuduv teadmine ei ole `false`. */
    checksumValid: typeof licences.checksumValid === "boolean" ? licences.checksumValid : null,
    attemptedAt: toDate(licences.attemptedAt) || now,
    licenceSourceCheckedAt: toDate(licences.checkedAt),
    /* Üldine kinnitusaeg tekib AINULT siis, kui kogu kontroll õnnestus. */
    verifiedAt: succeeded ? toDate(licences.checkedAt) : null,
    nextCheckAt: nextCheckAfter({ succeeded, consecutiveFailures: consecutiveFailureCount - 1, now }),
    consecutiveFailureCount,
    unknownColumns: licences.unknownColumns || [],
    missingOrderedColumns: licences.missingOrderedColumns || []
  };

  /* 3. ja 4. reegel: kirje, load ja KÕIK hinnangud ühe tehinguga, ja ainult
     siis, kui vahepeal ei ole uuemat kontrolli tekkinud. */
  const written = await prisma.$transaction(async (tx) => {
    const newest = await tx.licenceCheck.findFirst({
      where: { providerProfileId: profile.id },
      orderBy: { attemptedAt: "desc" },
      select: { id: true }
    });
    if ((newest?.id || null) !== (lastCheck?.id || null)) return { superseded: true };

    const check = await tx.licenceCheck.create({
      data: {
        ...checkPayload,
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
      tx,
      services,
      check: {
        id: check.id,
        result: succeeded ? "OK" : "UNCONFIRMED",
        reason: licences.reason || (entityResolved ? null : entity.reason || null),
        entityResolved,
        verifiedAt: toDate(licences.checkedAt),
        licences: licences.licences || []
      },
      previousByService,
      now
    });

    return { checkId: check.id, assessments };
  });

  if (written.superseded) return { completed: false, succeeded: false, skipped: CHECK_SKIPPED.SUPERSEDED };

  return {
    completed: true,
    succeeded,
    result: succeeded ? "OK" : "UNCONFIRMED",
    checkId: written.checkId,
    entityResolved,
    entityName: entity.name || null,
    /* Nimeanomaalia on ADMINI signaal, mitte avalik seis. */
    nameMismatch:
      entityResolved && entity.name
        ? entity.name.trim().toLocaleLowerCase("et") !== String(profile.organizationName || "").trim().toLocaleLowerCase("et")
        : false,
    missingOrderedColumns: licences.missingOrderedColumns || [],
    unknownColumns: licences.unknownColumns || [],
    assessments: written.assessments
  };
}

/**
 * Profiili teenuste avalikud loaseisud — E4 ja E5 lugemisrada.
 *
 * JÕUSTAB aegumise: salvestatud `VERIFIED` ei ole igavene. Kui
 * `publicStatusValidUntil` on möödas, ei tohi positiivset märgist enam
 * kuvada, ka siis, kui korje pole veel jõudnud seisu ümber kirjutama.
 */
export async function licenceStatusesForProfile({ providerProfileId, prisma = defaultPrisma, now = new Date() } = {}) {
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
          assessmentReason: true,
          publicStatusValidUntil: true,
          coveringLicenceNumber: true,
          coverageScope: true,
          requirementAtAssessment: true,
          activityExpected: true,
          activityTypeExpected: true,
          catalogueVersion: true,
          assessedAt: true,
          confirmedMissCount: true,
          statusSource: { select: { verifiedAt: true, registryCode: true } },
          lastAttempt: { select: { attemptedAt: true, result: true, licenceReason: true, entityReason: true } }
        }
      }
    }
  });

  return services.map((service) => {
    const assessment = service.licenceAssessment || null;
    const claimCurrent = publicClaimIsCurrent(assessment, now);
    return {
      serviceId: service.id,
      name: service.name,
      serviceKey: service.serviceKey || null,
      assessment,
      /* Mida TOHIB praegu avalikult kuvada. Kui positiivne seis on aegunud,
         langeb ta „ei saanud kinnitada" peale. */
      publicStatus: assessment
        ? claimCurrent || !["VERIFIED", "ACTIVITY_VERIFIED"].includes(assessment.publicStatus)
          ? assessment.publicStatus
          : "UNCONFIRMED"
        : null,
      publicClaimIsCurrent: claimCurrent,
      /* Kuupäev tuleb TÕENDI kontrollist, mitte viimasest katsest. */
      verifiedAt: assessment?.statusSource?.verifiedAt || null
    };
  });
}
