/* A4 — tegevusloa seis assistendi soovitustes.

   OMANIKU OTSUS 05.08: jah, seis tohib jõuda assistendini — aga **piiratud
   usaldussignaalina**, mitte sobivuse põhitunnuse ega õigusliku filtrina.

   ARHITEKTUURIVALIK, mis kannab kogu faili: värske seis **liidetakse
   soovituse ajal andmebaasist**, mitte ei usaldata RAG-indeksisse salvestatud
   koopiat. Põhjus on ajaline: „Tegevusluba on kontrollitud" on väide, mis
   AEGUB, ja indeksisse kirjutatud tekst ei aegu kunagi iseenesest. Kui see
   lause jääks dokumenti, väidaks assistent kontrollitust ka kuu aega pärast
   seda, kui märgis kaardil on juba kustunud.

   MIS SIIT EI VÄLJU (ja miks):
     - kontrolliajalugu, veakoodid, registripäringu tehnilised detailid,
       korduskatsete loendurid — need on siseinfo ja nende põhjal ei tohi
       mudel õiguslikke järeldusi teha;
     - `SERVICE_MAPPING_REQUIRED` — see seis EI OLE avalik ja tähendab, et
       platvorm ise ei tea, mida kontrollida. Assistent ei tohi seda
       kasutajale loaseisuna vahendada.

   KUIDAS SEISUSID TOHIB KASUTADA (omaniku sõnastus, `usage` väljal):
     VERIFIED           tohib nimetada kontrollitud tegevusloaks
     ACTIVITY_VERIFIED  ainult ÜLDINE tegevusala; alaliiki ei tohi kinnitada
     NO_SHS_...         EI OLE halvem kui kontrollitud luba
     UNCONFIRMED /      teadmata, MITTE negatiivne hinnang; ei tohi väita,
     NOT_CHECKED        et luba puudub
     NOT_FOUND          ei ole õiguslik järeldus ega automaatne välistus */

import { prisma as defaultPrisma } from "../prisma.js";

import { LICENCE_PUBLIC_STATUS, publicClaimIsCurrent } from "./assessment.js";
import { findServiceByKey } from "./licensedServices.js";

export const LICENCE_SIGNAL_USAGE = Object.freeze({
  VERIFIED: "MAY_STATE_VERIFIED",
  ACTIVITY_VERIFIED: "MAY_STATE_ACTIVITY_ONLY",
  NO_SHS_LICENCE_REQUIRED: "MAY_STATE_NOT_REQUIRED",
  NOT_FOUND: "MAY_STATE_NOT_FOUND_NOT_A_VERDICT",
  UNKNOWN: "MUST_NOT_CLAIM_EITHER_WAY"
});

/* Seisud, mida assistendini üldse ei lasta. */
const WITHHELD = new Set([LICENCE_PUBLIC_STATUS.SERVICE_MAPPING_REQUIRED]);

/* PUUDUVA SIGNAALI LEPING. Varem jäi teenus, millel hinnangut ei ole või mille
   seis on kinni hoitud, kaardilt lihtsalt välja — ja siis EI KÄINUD
   kasutusreegel signaaliga kaasas, mis on selle faili põhieesmärgiga vastuolus.
   Nüüd saab iga küsitud teenus vastuse: sisemist seisu ei avaldata, aga käsk
   on sõnaselge. */
export const UNKNOWN_LICENCE_SIGNAL = Object.freeze({
  licence_public_status: null,
  licence_requirement: null,
  licence_coverage: null,
  licence_verified_at: null,
  licence_claim_valid_until: null,
  licence_activity: null,
  licence_usage: LICENCE_SIGNAL_USAGE.UNKNOWN,
  licence_other_verification: null
});

function usageFor(status) {
  switch (status) {
    case LICENCE_PUBLIC_STATUS.VERIFIED:
      return LICENCE_SIGNAL_USAGE.VERIFIED;
    case LICENCE_PUBLIC_STATUS.ACTIVITY_VERIFIED:
      return LICENCE_SIGNAL_USAGE.ACTIVITY_VERIFIED;
    case LICENCE_PUBLIC_STATUS.NO_SHS_LICENCE_REQUIRED:
      return LICENCE_SIGNAL_USAGE.NO_SHS_LICENCE_REQUIRED;
    case LICENCE_PUBLIC_STATUS.NOT_FOUND:
      return LICENCE_SIGNAL_USAGE.NOT_FOUND;
    default:
      return LICENCE_SIGNAL_USAGE.UNKNOWN;
  }
}

/** Ühe hinnangu piiratud usaldussignaal. `null` = signaali ei anta. */
export function licenceSignalFrom(assessment, { now = new Date() } = {}) {
  if (!assessment?.publicStatus) return null;
  if (WITHHELD.has(assessment.publicStatus)) return null;

  /* Aegunud positiivne väide EI tohi assistendini jõuda positiivsena — sama
     reegel, mis avalikul sildil, sest see ongi sama väide teises kohas. */
  const positive =
    assessment.publicStatus === LICENCE_PUBLIC_STATUS.VERIFIED ||
    assessment.publicStatus === LICENCE_PUBLIC_STATUS.ACTIVITY_VERIFIED;
  const status = positive && !publicClaimIsCurrent(assessment, now)
    ? LICENCE_PUBLIC_STATUS.UNCONFIRMED
    : assessment.publicStatus;

  return {
    licence_public_status: status,
    licence_requirement: assessment.requirementAtAssessment || null,
    licence_coverage: positive && status === assessment.publicStatus ? assessment.coverage || null : null,
    licence_verified_at: status === assessment.publicStatus ? assessment.statusSource?.verifiedAt || null : null,
    licence_claim_valid_until: status === assessment.publicStatus ? assessment.publicStatusValidUntil || null : null,
    licence_activity: assessment.activityExpected || null,
    /* Kasutusreegel käib signaaliga KAASAS, et soovituskiht ei peaks seda
       mälu järgi teadma. */
    licence_usage: usageFor(status),
    /* Hoolduspere erisus ei tohi kaduda: „luba pole nõutud" EI OLE sama mis
       „riiklikku kontrolli pole". Väärtus tuleb KATALOOGIST, mitte hinnangu
       tabelist — ta on teenuse omadus, mitte kontrolli tulemus. */
    licence_other_verification: findServiceByKey(assessment.serviceKey)?.otherVerification || null
  };
}

/**
 * Värske loaseis teenuse ID-de kaupa, OTSE andmebaasist.
 *
 * Seda kutsub soovituskiht pärast seda, kui RAG on sisuliselt sobivad teenused
 * leidnud. Nii ei sõltu avalik usaldusväide otsinguindeksi värskusest.
 *
 * KUTSUJA LEPING: siia tohib anda ainult ID-sid, mis on juba avalikust
 * tulemusest tulnud. Funktsioon ei kontrolli, kas teenus on avaldatud, kaardil
 * nähtav või avaldatud profiili all — kui teda kunagi kutsutakse mujalt kui
 * avaliku otsingu järelt, tuleb need filtrid päringusse lisada, muidu võiks
 * signaal jõuda ka mustandteenuse kohta.
 */
export async function licenceSignalsForServices(serviceIds = [], { prisma = defaultPrisma, now = new Date() } = {}) {
  const ids = [...new Set((serviceIds || []).filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  /* IGA küsitud ID saab vastuse. Puuduv kirje ei tähenda „ei ole seisu", vaid
     „ära väida kummaski suunas" — ja see käsk peab tulema kaardilt, mitte
     kutsuja mälust. */
  const signals = new Map(ids.map((id) => [id, UNKNOWN_LICENCE_SIGNAL]));

  const rows = await prisma.serviceLicenceAssessment.findMany({
    where: { providerServiceId: { in: ids } },
    select: {
      providerServiceId: true,
      publicStatus: true,
      coverage: true,
      requirementAtAssessment: true,
      activityExpected: true,
      publicStatusValidUntil: true,
      serviceKey: true,
      statusSource: { select: { verifiedAt: true } }
    }
  });

  for (const row of rows) {
    const signal = licenceSignalFrom(row, { now });
    if (signal) signals.set(row.providerServiceId, signal);
  }
  return signals;
}
