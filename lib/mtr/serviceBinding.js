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
      kandidaate, aga kinnitab inimene (omanik 05.08).
   5. **Teenuseosutaja kinnitab oma teenuse liigi ise** (omanik 10.10.2026:
      „alguses inimene ise kinnitab või paneb kontrolli tööle"), aga AINULT
      loakohustuslike liikide seast: selle väite kontrollib register. Liiki, mis
      luba ei vaja, ei kontrolli keegi; see avalik rahustus jääb admini siduda. */

import { prisma as defaultPrisma } from "../prisma.js";

import { LICENCE_PUBLIC_STATUS } from "./assessment.js";
import { CHECK_TRIGGER, runLicenceCheck } from "./licenceCheckService.js";
import {
  LICENCE_REQUIREMENT,
  LICENSED_SERVICES,
  LICENSED_SERVICE_CATALOGUE_VERSION,
  detectServiceCandidates,
  findServiceByKey
} from "./licensedServices.js";

export const BINDING_AUDIT_ACTION = "mtr.service_licence_binding";

/* Kes sidus: jälg peab eristama osutaja enda kinnitust admini omast. */
export const BINDING_ACTOR = Object.freeze({ ADMIN: "ADMIN", PROVIDER: "PROVIDER" });

export const BINDING_ERROR = Object.freeze({
  SERVICE_NOT_FOUND: "SERVICE_NOT_FOUND",
  UNKNOWN_SERVICE_KEY: "UNKNOWN_SERVICE_KEY",
  /* Liik on kataloogis, aga osutaja ise seda valida ei tohi (5. reegel). */
  KEY_NOT_SELECTABLE: "KEY_NOT_SELECTABLE",
  /* Sidumine ONNESTUS, aga kohene kontroll ei saanud toimuda. EI OLE
     sidumise viga -- kutsuja peab seda eristama. */
  IMMEDIATE_CHECK_FAILED: "IMMEDIATE_CHECK_FAILED"
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

/** Liigid, mille osutaja tohib ise kinnitada: loakohustuslikud ja registrist kontrollitavad. */
export function providerSelectableKinds() {
  return LICENSED_SERVICES.filter((row) => row.activity && !row.needsVerification).map((row) => ({
    serviceKey: row.key,
    label: row.label,
    legalBasis: row.legalBasis
  }));
}

function providerMaySelect(serviceKey) {
  return providerSelectableKinds().some((row) => row.serviceKey === serviceKey);
}

/**
 * Osutaja enda vaade: mis liik on igal tema teenusel kinnitatud ja mida tuvastaja
 * nime järgi pakub. Pakkumine on ETTEPANEK; valiku teeb ja kinnitab inimene.
 */
export async function ownBindingOverview({ providerProfileId, prisma = defaultPrisma } = {}) {
  const profile = await prisma.serviceProviderProfile.findUnique({
    where: { id: providerProfileId },
    select: {
      registryCode: true,
      serviceItems: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, description: true, category: true, categories: true, serviceKey: true }
      }
    }
  });
  if (!profile) return { ok: false, error: BINDING_ERROR.SERVICE_NOT_FOUND };

  return {
    ok: true,
    /* Ilma registrikoodita ei ole, mille järgi registrist küsida. */
    hasRegistryCode: Boolean(String(profile.registryCode || "").trim()),
    kinds: providerSelectableKinds(),
    services: (profile.serviceItems || []).map((service) => {
      const haystack = [service.name, service.category, ...(service.categories || []), service.description]
        .filter(Boolean)
        .join(" ");
      const current = service.serviceKey ? findServiceByKey(service.serviceKey) : null;
      return {
        serviceId: service.id,
        serviceKey: service.serviceKey || null,
        /* Admini seotud loakohustuseta liik ei ole osutaja valikute seas; vaade
           peab seda siiski nimetama, muidu paistab teenus sidumata. */
        currentLabel: current?.label || null,
        currentSelectable: service.serviceKey ? providerMaySelect(service.serviceKey) : true,
        suggestions: [
          ...new Set(
            detectServiceCandidates(haystack)
              .filter((candidate) => providerMaySelect(candidate.key))
              .map((candidate) => candidate.key)
          )
        ]
      };
    })
  };
}

/**
 * Osutaja kinnitab OMA teenuse liigi (või `null` = võtab kinnituse tagasi).
 *
 * Kaks piiri enne ühist sidumist: teenus peab kuuluma kutsuja profiilile ja
 * liik peab olema osutajale lubatud (5. reegel). Võõra teenuse ja olematu
 * teenuse vastus on SAMA, et teenuse ID olemasolu ei lekiks.
 */
export async function bindOwnServiceKey({
  providerProfileId,
  providerServiceId,
  serviceKey = null,
  actorUserId = null,
  prisma = defaultPrisma,
  now = new Date(),
  checkNow = true,
  runCheck = runLicenceCheck
} = {}) {
  const nextKey = serviceKey ? String(serviceKey).trim() : null;
  if (nextKey && !findServiceByKey(nextKey)) return { ok: false, error: BINDING_ERROR.UNKNOWN_SERVICE_KEY };
  if (nextKey && !providerMaySelect(nextKey)) return { ok: false, error: BINDING_ERROR.KEY_NOT_SELECTABLE };

  const own = providerProfileId
    ? await prisma.serviceProviderService.findFirst({
        where: { id: String(providerServiceId || ""), providerProfileId },
        select: { id: true }
      })
    : null;
  if (!own) return { ok: false, error: BINDING_ERROR.SERVICE_NOT_FOUND };

  return bindServiceKey({
    providerServiceId: own.id,
    serviceKey: nextKey,
    actorUserId,
    actorKind: BINDING_ACTOR.PROVIDER,
    prisma,
    now,
    checkNow,
    runCheck
  });
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
  actorKind = BINDING_ACTOR.ADMIN,
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

  const mapped = nextKey ? findServiceByKey(nextKey) : null;
  /* Loakohustuseta rea otsus on juba E2 kataloogis — teda ei tohi siduda
     registri kättesaadavusega ega jätta ajutiselt vale `NOT_CHECKED` seisu. */
  const noLicenceRequired = mapped?.requirement === LICENCE_REQUIREMENT.NO_SHS_LICENCE_REQUIRED;

  const outcome = await prisma.$transaction(async (tx) => {
    /* Teenus loetakse TEHINGU SEES: kahe admini samaaegsel sidumisel jääks
       enne tehingut loetud „eelmine võti" auditisse aegunult. */
    const service = await tx.serviceProviderService.findUnique({
      where: { id: providerServiceId },
      select: { id: true, name: true, serviceKey: true, providerProfileId: true }
    });
    if (!service) return { ok: false, error: BINDING_ERROR.SERVICE_NOT_FOUND };

    const previousKey = service.serviceKey || null;
    if (previousKey === nextKey) {
      return { ok: true, changed: false, service, previousKey };
    }

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
        /* Loakohustuseta teenus saab OMA seisu kohe: kataloog on siin ainus
           vajalik allikas ja MTR-i vastust ei ole vaja oodata. */
        publicStatus: noLicenceRequired
          ? LICENCE_PUBLIC_STATUS.NO_SHS_LICENCE_REQUIRED
          : LICENCE_PUBLIC_STATUS.NOT_CHECKED,
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
          actorKind,
          serviceName: service.name,
          previousServiceKey: previousKey,
          nextServiceKey: nextKey,
          catalogueVersion: LICENSED_SERVICE_CATALOGUE_VERSION
        }
      }
    });

    return { ok: true, changed: true, service, previousKey };
  });

  if (!outcome.ok) return outcome;
  if (!outcome.changed) {
    return { ok: true, changed: false, providerServiceId: outcome.service.id, serviceKey: nextKey };
  }

  /* KOHENE KONTROLL käib tehingust väljas ja tema tõrge EI TÜHISTA sidumist.
     Muidu tekiks olukord, kus võti on juba muudetud, vana tõend kustutatud ja
     audit kirjutatud, aga kutsuja saab 500 ja arvab, et midagi ei salvestunud —
     ning kordamine annaks `changed: false` ega prooviks kontrolli uuesti.
     Loakohustuseta rida ei vaja päringut üldse: tema seis tuli kataloogist. */
  let check = null;
  let checkError = null;
  if (checkNow && nextKey && !noLicenceRequired) {
    try {
      check = await runCheck({
        providerProfileId: outcome.service.providerProfileId,
        /* AUTO, mitte MANUAL: see ei ole kasutaja nupuvajutus, vaid süsteemi
           järelkäik sidumisele — jahtumisaeg ei tohi seda ära jätta ja jätta
           vastseotud teenust seisu `NOT_CHECKED` kuni järgmise korjeni. */
        trigger: CHECK_TRIGGER.AUTO,
        prisma,
        now
      });
    } catch {
      checkError = BINDING_ERROR.IMMEDIATE_CHECK_FAILED;
    }
  }

  return {
    ok: true,
    changed: true,
    providerServiceId: outcome.service.id,
    previousServiceKey: outcome.previousKey,
    serviceKey: nextKey,
    check,
    checkError
  };
}
