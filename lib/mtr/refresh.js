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

const ALARM_CHECK_SELECT = Object.freeze({
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
});

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
export async function dueProfiles({ prisma = defaultPrisma, now = new Date(), limit = DEFAULT_BATCH, pageSize = 200 } = {}) {
  const current = now instanceof Date ? now.getTime() : Date.now();
  const due = [];
  let cursor = null;

  /* KURSORIGA LÄBI KÕIGI kandidaatide, mitte „võtame igaks juhuks neli korda
     rohkem". Küpsus selgub alles viimase kontrolli järgi, mida Prisma päringus
     filtreerida ei saa; eelpiirang tähendaks, et kui esimesed N profiili ei ole
     küpsed, ei jõua järgmised MITTE KUNAGI kontrollini. */
  for (;;) {
    const page = await prisma.serviceProviderProfile.findMany({
      where: {
        registryCode: { not: null },
        serviceItems: { some: { serviceKey: { not: null } } }
      },
      select: {
        id: true,
        organizationName: true,
        licenceChecks: { orderBy: { attemptedAt: "desc" }, take: 1, select: { nextCheckAt: true } }
      },
      orderBy: { id: "asc" },
      take: pageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });
    if (!page.length) break;

    for (const profile of page) {
      const next = profile.licenceChecks?.[0]?.nextCheckAt;
      /* Kontrollimata profiil on alati küps. */
      if (!next || new Date(next).getTime() <= current) due.push(profile);
      if (due.length >= limit) return due;
    }

    if (page.length < pageSize) break;
    cursor = page[page.length - 1].id;
  }

  return due;
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
        /* SAMA aeg, millega küpsust hinnati — muidu arvutatakse `nextCheckAt`
           teise kella järgi ja testid ning sünteetilised kontrollid muutuvad
           ebatäpseks. */
        now: now instanceof Date ? new Date(now.getTime()) : new Date()
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
  /* IGA PROFIILI VIIMANE kontroll, mitte „viimased 100 rida". Reapõhine valik
     laseks ühel sageli kontrollitud profiilil kogu akna enda alla võtta,
     hoiaks juba lahendatud vana viga alarmis ja jätaks teiste profiilide
     aktiivsed probleemid piirist välja. */
  const profiles = await prisma.serviceProviderProfile.findMany({
    where: { licenceChecks: { some: {} } },
    select: { id: true },
    take: limit
  });
  const checks = (
    await Promise.all(
      profiles.map((profile) =>
        prisma.licenceCheck.findFirst({
          where: { providerProfileId: profile.id },
          orderBy: { attemptedAt: "desc" },
          select: ALARM_CHECK_SELECT
        })
      )
    )
  ).filter(Boolean);

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

  /* Aegumine filtreeritakse ANDMEBAASIS, mitte mälus: mälupool tähendaks, et
     100 värske hinnangu taga peituv aegunud väide jääks leidmata. */
  const staleCandidates = await prisma.serviceLicenceAssessment.findMany({
    where: {
      publicStatus: { in: POSITIVE_STATUSES },
      OR: [{ publicStatusValidUntil: null }, { publicStatusValidUntil: { lte: now } }]
    },
    orderBy: { publicStatusValidUntil: "asc" },
    take: limit,
    select: {
      providerServiceId: true,
      publicStatus: true,
      publicStatusValidUntil: true,
      providerService: { select: { name: true, providerProfileId: true } }
    }
  });
  /* Teine sõel jääb alles, sest `publicClaimIsCurrent` on üks tõe allikas —
     kui ta reegel kunagi täieneb, ei tohi see päring temast lahku minna. */
  const staleClaims = staleCandidates.filter((row) => !publicClaimIsCurrent(row, now));

  return { schemaDrift, identityUnresolved, nameMismatch, repeatedFailures, staleClaims };
}
