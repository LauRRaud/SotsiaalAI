/* A4 E6 — ajastatud korje ja admini alarmid.

   Korje valib profiilid, mille kontroll on tähtajaks küps, ja käib nad ÜKSHAAVAL
   läbi. Paralleelsust siin teadlikult ei ole: MTR on aeglane avalik register ja
   üks kontroll on ise kolm päringut — mitu korraga tähendaks meie enda mõõdetud
   TIMEOUT-i ja oleks võõra süsteemi vastu ebaviisakas.

   Korje ei ole „kõik profiilid iga öö": ta austab `nextCheckAt`-i, mille
   `policy.js` on eelmise tulemuse põhjal juba arvutanud (edu → 24 h, tõrge →
   1/6/24 h). Nii ei kuluta korduv tõrge sama palju päringuid kui edukas rada. */

import { prisma as defaultPrisma } from "../prisma.js";

import { CHECK_TRIGGER, runLicenceCheck } from "./licenceCheckService.js";
import { POSITIVE_STATUSES, publicClaimIsCurrent } from "./assessment.js";

const DEFAULT_BATCH = 25;

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * Profiilid, mille loakontroll on küps.
 *
 * Küps on profiil, millel on registrikood ja vähemalt üks kataloogiga seotud
 * teenus, ning mille viimane kontroll on kas puudu või `nextCheckAt` möödas.
 */
export async function dueProfiles({ prisma = defaultPrisma, now = new Date(), limit = DEFAULT_BATCH } = {}) {
  const candidates = await prisma.serviceProviderProfile.findMany({
    where: {
      registryCode: { not: null },
      serviceItems: { some: { serviceKey: { not: null } } }
    },
    select: {
      id: true,
      organizationName: true,
      licenceChecks: { orderBy: { attemptedAt: "desc" }, take: 1, select: { nextCheckAt: true } }
    },
    orderBy: { updatedAt: "asc" },
    take: Math.max(limit * 4, limit)
  });

  return candidates
    .filter((profile) => {
      const next = profile.licenceChecks?.[0]?.nextCheckAt;
      /* Kontrollimata profiil on alati küps. */
      if (!next) return true;
      return new Date(next).getTime() <= (now instanceof Date ? now.getTime() : Date.now());
    })
    .slice(0, limit);
}

/**
 * Käib küpsed profiilid ükshaaval läbi.
 * Ühe profiili tõrge EI katkesta korjet — järgmine profiil ei ole selles süüdi.
 */
export async function refreshDueLicenceChecks({
  prisma = defaultPrisma,
  now = new Date(),
  limit = positiveInt(process.env.MTR_REFRESH_BATCH, DEFAULT_BATCH),
  runCheck = runLicenceCheck,
  onProgress = null
} = {}) {
  const profiles = await dueProfiles({ prisma, now, limit });
  const summary = { due: profiles.length, checked: 0, succeeded: 0, failed: 0, errors: [] };

  for (const profile of profiles) {
    try {
      const result = await runCheck({
        providerProfileId: profile.id,
        trigger: CHECK_TRIGGER.AUTO,
        prisma,
        now: new Date()
      });
      summary.checked += 1;
      if (result?.succeeded) summary.succeeded += 1;
      else summary.failed += 1;
      if (onProgress) onProgress({ profile, result });
    } catch (error) {
      summary.failed += 1;
      summary.errors.push({ profileId: profile.id, message: error?.message || String(error) });
    }
  }

  return summary;
}

/**
 * Admini alarmivaade: mis vajab inimese pilku.
 *
 * NELI SIGNAALI, mis ei jõua kunagi avaliku sildini, aga mille vaikimine
 * tähendaks, et rikkis korje jääks märkamata:
 *   1. registri väljundi kuju muutus (`missingOrderedColumns`/`unknownColumns`);
 *   2. identiteet ei lahendunud;
 *   3. nimeanomaalia profiili ja registri vahel;
 *   4. aegunud positiivne seis, mida korje ei ole uuendanud.
 */
export async function licenceCheckAlarms({ prisma = defaultPrisma, now = new Date(), limit = 100 } = {}) {
  const checks = await prisma.licenceCheck.findMany({
    orderBy: { attemptedAt: "desc" },
    take: limit,
    select: {
      id: true,
      providerProfileId: true,
      registryCode: true,
      result: true,
      licenceSourceResult: true,
      entitySourceResult: true,
      licenceReason: true,
      entityReason: true,
      entityResolved: true,
      entityName: true,
      attemptedAt: true,
      consecutiveFailureCount: true,
      unknownColumns: true,
      missingOrderedColumns: true,
      providerProfile: { select: { organizationName: true } }
    }
  });

  const schemaDrift = checks.filter(
    (check) => (check.missingOrderedColumns || []).length || (check.unknownColumns || []).length
  );
  const identityUnresolved = checks.filter((check) => !check.entityResolved && check.entitySourceResult === "OK");
  const nameMismatch = checks.filter(
    (check) =>
      check.entityResolved &&
      check.entityName &&
      check.entityName.trim().toLocaleLowerCase("et") !==
        String(check.providerProfile?.organizationName || "").trim().toLocaleLowerCase("et")
  );
  const repeatedFailures = checks.filter((check) => (check.consecutiveFailureCount || 0) >= 3);

  const positives = await prisma.serviceLicenceAssessment.findMany({
    where: { publicStatus: { in: POSITIVE_STATUSES } },
    take: limit,
    select: {
      providerServiceId: true,
      publicStatus: true,
      publicStatusValidUntil: true,
      providerService: { select: { name: true, providerProfileId: true } }
    }
  });
  const staleClaims = positives.filter((row) => !publicClaimIsCurrent(row, now));

  return { schemaDrift, identityUnresolved, nameMismatch, repeatedFailures, staleClaims };
}
