/**
 * TEENUSPÄEVIK-V1 E2 — TULETAMISREEGLID.
 *
 * Lepingu ptk 0 kaitsereegel (c): **kui süsteem juba teab, ei küsita.** Ja
 * ptk „Vaated": osutaja mõtleb „käisin Mardi juures 2 tundi", mitte „osutasin
 * teenust X" — seepärast on voog KLIENT-ENNE ja teenus tuletatakse.
 *
 * Kõik siinsed funktsioonid on puhtad: sisse andmed, välja otsus. Ilma DB-ta
 * testitavad, sest sisestuse kiirus (DoD punkt 1: alla 30 sekundi) sõltub
 * täpselt nendest reeglitest ja neid peab saama tõendada ilma UI-ta.
 */

import {
  DURATION_DERIVABLE_UNITS,
  MAX_QUANTITY,
  QUANTITY_DECIMALS,
  SERVICE_UNIT,
  VISIT_STAMP_ORDER
} from "./constants.js";

/**
 * Mitu KÜSIMUST tuleb kasutajale esitada, et kirje valmis saaks.
 *
 * Tagastab `askService: false` alati, kui vastus on tuletatav — see ongi see
 * koht, kus „alla 30 sekundi" võidetakse või kaotatakse.
 *
 * Järjekord on tähtsuselt kahanev:
 *   1. üks aktiivne suunamine kliendile  → teenus JA maht tulevad sealt;
 *   2. osutajal on kataloogis üks teenus → küsimust ei ole olemaski;
 *   3. kliendi viimati kasutatud teenus  → eeltäidetakse, kasutaja võib muuta;
 *   4. muidu küsitakse.
 *
 * NB reegel 2 on tugevam kui 3: kui valida ei ole millegi vahel, ei tohi
 * küsimust näidata isegi siis, kui ajalugu ütleks midagi muud.
 */
export function deriveServiceSelection({
  activeReferrals = [],
  providerServices = [],
  lastUsedServiceId = null,
  lastUsedUnit = null
} = {}) {
  const referrals = activeReferrals.filter(Boolean);
  /* ÜHIKUT EI TOHI KUNAGI VAIKIMISI HOUR-iks kirjutada.
     Varem tegid „üks teenus" ja „viimati kasutatud" harud just seda: kui
     osutaja teenus on `SESSION` (kord/külastus), tuli vaikeväärtuseks `HOUR`
     ja kogus arvutati kestusest — täpselt see arveldusviga, mida ühikute
     eristamine pidi vältima. `null` tähendab „ei tea", ja seda küsitakse. */
  const fallbackUnit = lastUsedUnit || null;

  if (referrals.length === 1) {
    const [referral] = referrals;
    return {
      serviceId: referral.serviceId || lastUsedServiceId || null,
      referralId: referral.id,
      // Suunamise ühik on siduv: tema järgi arveldab KOV.
      unit: referral.unit || fallbackUnit,
      askService: false,
      askReferral: false,
      askUnit: !(referral.unit || fallbackUnit),
      source: "referral"
    };
  }

  if (referrals.length > 1) {
    /* AINUS koht, kus küsitakse. Mitu aktiivset suunamist tähendab, et sama
       klient saab mitut teenust ja masin ei tohi tema eest valida — vale
       suunamine tähendab valele KOV-ile esitatud mahtu. */
    return {
      serviceId: null,
      referralId: null,
      unit: null,
      askService: true,
      askReferral: true,
      askUnit: true,
      source: "ambiguous"
    };
  }

  if (providerServices.length === 1) {
    const [service] = providerServices;
    return {
      serviceId: service.id,
      referralId: null,
      // Teenuse oma vaikeühik, siis viimati kasutatud; kõvakodeeritud HOUR-it
      // siin EI OLE. Kui kumbagi ei ole, jääb ühik küsimuseks.
      unit: service.defaultUnit || fallbackUnit,
      askService: false,
      askReferral: false,
      askUnit: !(service.defaultUnit || fallbackUnit),
      source: "only_service"
    };
  }

  if (lastUsedServiceId && providerServices.some((service) => service.id === lastUsedServiceId)) {
    const service = providerServices.find((item) => item.id === lastUsedServiceId);
    /* Viimati kasutatud teenuse juurde kuulub ka viimati kasutatud ÜHIK.
       Ilma selleta muutuks korra-põhine teenus vaikselt tunnipõhiseks. */
    const unit = fallbackUnit || service?.defaultUnit || null;
    return {
      serviceId: lastUsedServiceId,
      referralId: null,
      unit,
      askService: false,
      askReferral: false,
      askUnit: !unit,
      source: "last_used"
    };
  }

  return {
    serviceId: null,
    referralId: null,
    unit: fallbackUnit,
    askService: providerServices.length > 1,
    askReferral: false,
    askUnit: !fallbackUnit,
    source: providerServices.length ? "ask" : "no_service"
  };
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function roundQuantity(value) {
  const factor = 10 ** QUANTITY_DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * KOHAL → LAHKUSIN annab teenuse kestuse. Kogus tuletatakse ISE, kasutaja ei
 * arvuta midagi (kaitsereegel c).
 *
 * Ainult `HOUR` on tuletatav. `SESSION` on loendatav kord — üks külastus on
 * üks kord, olgu ta 20 minutit või kolm tundi; kestuse põhjal koguse
 * arvutamine annaks arvel vale numbri. `DAY`/`MONTH` on perioodid.
 */
export function deriveQuantityFromStamps({ arrivedAt, leftAt, unit = SERVICE_UNIT.HOUR } = {}) {
  if (!DURATION_DERIVABLE_UNITS.includes(unit)) return null;
  const start = toDate(arrivedAt);
  const end = toDate(leftAt);
  if (!start || !end) return null;
  const minutes = (end.getTime() - start.getTime()) / 60000;
  if (minutes <= 0) return null;
  return roundQuantity(minutes / 60);
}

/**
 * Sõiduaeg = LÄKSIN→KOHAL pluss LAHKUSIN→TAGASI. Aeg JAH, kilomeetrid EI:
 * distantsi ei arvutata ka templitest, sest sõidupäevik on sõidukidomeen.
 *
 * Järjestikuste klientide puhul ei ole TAGASI kohustuslik — järgmine KOHAL
 * lõpetab eelmise sõidulõigu. Seepärast tagastame teise lõigu ainult siis, kui
 * `returnedAt` on päriselt olemas, ega oota teda.
 */
export function deriveTravelMinutes({ departedForVisitAt, arrivedAt, leftAt, returnedAt } = {}) {
  const segments = [
    [toDate(departedForVisitAt), toDate(arrivedAt)],
    [toDate(leftAt), toDate(returnedAt)]
  ];
  let total = 0;
  let counted = 0;
  for (const [start, end] of segments) {
    if (!start || !end) continue;
    const minutes = (end.getTime() - start.getTime()) / 60000;
    if (minutes <= 0) continue;
    total += minutes;
    counted += 1;
  }
  return counted ? Math.round(total) : null;
}

/**
 * Templid peavad kasvama. Tagasiliikuv tempel ei ole tavaline näpuviga: temast
 * sünnib negatiivne kestus, mis jõuab arve alusdokumenti.
 *
 * Puuduv vahepealne tempel on LUBATUD — kasutaja võib vajutada ainult KOHAL ja
 * LAHKUSIN (ilma sõidulõiguta) või lisada templid tagantjärele. Kontrollime
 * ainult neid paare, mis MÕLEMAD olemas on.
 */
export function validateStampOrder(stamps = {}) {
  const present = VISIT_STAMP_ORDER
    .map((key) => ({ key, at: toDate(stamps[key]) }))
    .filter((entry) => entry.at);

  for (let i = 1; i < present.length; i += 1) {
    if (present[i].at.getTime() < present[i - 1].at.getTime()) {
      return {
        ok: false,
        messageKey: "service_log.errors.stamp_order",
        detail: `${present[i - 1].key} > ${present[i].key}`
      };
    }
  }
  return { ok: true };
}

/**
 * Kogus on kas antud või tuletatud. Tuletatud võidab TÜHJA, mitte kasutaja
 * sisestatud väärtust: kui inimene parandab kestust käsitsi (kohtumine algas
 * varem, kui nupp vajutati), on tema number õigem kui kellaaeg.
 */
export function resolveQuantity({ quantity, arrivedAt, leftAt, unit = SERVICE_UNIT.HOUR } = {}) {
  if (quantity !== undefined && quantity !== null && quantity !== "") {
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { ok: false, messageKey: "service_log.errors.quantity_invalid" };
    }
    if (parsed > MAX_QUANTITY) {
      return { ok: false, messageKey: "service_log.errors.quantity_too_large" };
    }
    return { ok: true, quantity: roundQuantity(parsed), derived: false };
  }

  const derived = deriveQuantityFromStamps({ arrivedAt, leftAt, unit });
  if (derived === null) {
    return { ok: false, messageKey: "service_log.errors.quantity_required" };
  }
  return { ok: true, quantity: derived, derived: true };
}

/**
 * Välitöö kesta sild (leping E2, integratsioon 8.4): lõpetatud külastusest saab
 * teenuskirje EELTÄIDIS — mitte kirje ise.
 *
 * SEIS: `NOT_INTEGRATED`. See funktsioon on olemas ja testitud, aga tal EI OLE
 * veel kutsujat: välitöö kest ei paku „loo teenuskirje" tegevust ega ole
 * API-rada, mis eeltäidise UI-le annaks. Ta ei eeltäida ka klienti, sest
 * `FieldVisit`-il ei ole kliendivälja, mida usaldusväärselt üle kanda —
 * kliendi seob inimene ise. Kuni kutsuja puudub, on aus nimetada seda
 * ettevalmistuseks, mitte integratsiooniks.
 *
 * `FieldVisit` EI LOO teenuskirjet automaatselt. Kaks põhjust: külastus ei ole
 * alati arveldatav teenus, ja automaatne kirje tähendaks, et arve alusdokument
 * tekib ilma inimese kinnituseta. Kasutaja kinnitab.
 */
export function buildEntryDraftFromFieldVisit(visit, { unit = SERVICE_UNIT.HOUR } = {}) {
  if (!visit) return null;
  const arrivedAt = toDate(visit.arrivedConfirmedAt);
  const leftAt = toDate(visit.departedConfirmedAt);
  const date = arrivedAt || toDate(visit.plannedStartAt) || toDate(visit.closedAt) || null;

  return {
    sourceFieldVisitId: visit.id,
    date,
    arrivedAt,
    leftAt,
    unit,
    quantity: deriveQuantityFromStamps({ arrivedAt, leftAt, unit }),
    /* Külastuse märkmeid EI tõsteta kirjesse: nad on eri tundlikkusega ja eri
       säilitusega. Kirje märge kirjutatakse eraldi, teadlikult lühidalt. */
    note: null
  };
}
