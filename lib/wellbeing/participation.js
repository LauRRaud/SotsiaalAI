/**
 * TÖÖHEAOLU — KIRJE OSALUSPROJEKTSIOON (SOL-WB-01, SOL-WB-02).
 *
 * ÜKS INVARIANT, ÜKS FAIL. Sama lause peab kehtima üheksas loojas, paranduses
 * ja koondi WHERE-is. Viisteist koopiat lahkneksid; siin on üks lause, mille
 * kõik sisse kutsuvad:
 *
 *   **Kirje osaleb selle organisatsiooni ja rollirühma valimis, kelle tööna ta
 *   SÜNDIS — ja kui see ei ole tõendatav, ei osale ta üheski piloodis.**
 *
 * MIKS PAYLOAD'I `roleGroup` EI KÕLBA. Ta tuleb kliendilt. Liides saadab täna
 * fikseeritud `SOCIAL_WORKER`, aga otsekutse saab saata mida iganes — ja see
 * string otsustas seni, MILLISE piloodi koondisse kirje loetakse. Nii sai iga
 * tööheaolu õigusega konto kasvatada võõra asutuse signaale ja aidata valimil
 * privaatsuskünnist ületada. Väli ise JÄÄB kirje peal alles (kasutaja enda
 * kirjeldus omaenda kirje juures), aga koond teda ei küsi.
 *
 * MIKS ERALDI TABEL. §D8: lähtekirje ei muutu organisatsiooni varaks. Kirje ei
 * saa organisatsiooni võtit; osalus elab tuletisena kõrval
 * (`WellbeingParticipation`) ja teda loeb ainult koond.
 *
 * RIDA PUUDU EI OLE „KÕIGILE", VAID „MITTE KELLELEGI". Kirje, mida ei saa
 * ühemõtteliselt ühe organisatsiooni külge siduda, jääb kasutaja enda
 * ülevaatesse ega ilmu ühessegi piloodikoondisse. Vastupidine vaikeväärtus
 * oleks täpselt see vale omistamine, mida parandame. Sama piir on juba
 * külastuse päritolul (`lib/serviceLog/visitOrigin.js`).
 */

import { prisma as defaultPrisma } from "../prisma.js";
import { OrganizationMembershipStatus } from "../org/constants.js";

/**
 * Kirje osalus kirje sünni hetkel.
 *
 * ÜHEMÕTTELISUS ON TINGIMUS, MITTE MUGAVUS. Ühe aktiivse liikmesuse korral on
 * vastus tõendatav ilma oletamiseta: muud organisatsiooni ei ole olemas. Kahe
 * korral ei ole platvormil ühtegi allikat, mis ütleks, KUMMA maja tööst see
 * konkreetne koormus tekkis — ja vale vastus siin tähendaks inimese
 * riskimarkerit vale juhi raportis. Seepärast on kahe puhul vastus `null`,
 * mitte esimene leitu.
 *
 * KOV tuleb organisatsiooni pealt SAMAL HETKEL ja jääb kirje külge kinni: kui
 * asutus hiljem KOV-i vahetab, ei tohi eelmise aasta koormus tagantjärele uude
 * omavalitsusse kolida.
 *
 * @returns `{ organizationId, municipalityId, roleGroup }` või `null`, kui
 *          osalus ei ole tõendatav.
 */
export async function resolveWellbeingParticipation(userId, options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const ownerUserId = String(userId || "").trim();
  if (!ownerUserId) return null;
  if (!prisma?.organizationMembership?.findMany) return null;

  const memberships = await prisma.organizationMembership.findMany({
    where: { userId: ownerUserId, status: OrganizationMembershipStatus.ACTIVE },
    select: {
      organizationId: true,
      seatRole: true,
      organization: { select: { municipalityId: true } }
    },
    /* Kaks piisab otsuseks: kolmas rida ei muuda vastust, aga maksab. */
    take: 2
  });

  if (memberships.length !== 1) return null;

  const [membership] = memberships;
  const organizationId = String(membership?.organizationId || "").trim();
  const roleGroup = String(membership?.seatRole || "").trim();
  /* Pooleldi tõendatud osalust ei ole: ilma organisatsiooni või istmerollita
     ei ole rida täielik ja siis teda ei sünni. */
  if (!organizationId || !roleGroup) return null;

  return {
    organizationId,
    municipalityId: String(membership?.organization?.municipalityId || "").trim() || null,
    roleGroup
  };
}

/**
 * Olemasoleva kirje osalus parandusele kaasa.
 *
 * Parandus kirjeldab SAMA hetke, seega ta pärib osaluse originaalilt, mitte ei
 * tuleta seda uuesti: vahepealne töökohavahetus ei tohi vana koormust uue
 * tööandja raportisse kolida. Sama põhjus, mille pärast periood ja kontrollpunkt
 * juba päritakse.
 */
export function inheritWellbeingParticipation(participation) {
  if (!participation?.organizationId || !participation?.roleGroup) return null;
  return {
    organizationId: participation.organizationId,
    municipalityId: participation.municipalityId ?? null,
    roleGroup: participation.roleGroup
  };
}

/** Prisma pesastatud `create` osalusele, või `undefined`, kui osalust ei ole. */
export function participationCreateInput(participation) {
  if (!participation) return undefined;
  return {
    create: {
      organizationId: participation.organizationId,
      municipalityId: participation.municipalityId ?? null,
      roleGroup: participation.roleGroup
    }
  };
}

/**
 * Koondi WHERE-fragment.
 *
 * Tõendamata kirjetel ei ole osalusrida, seega `{ participation: { is: … } }`
 * jätab nad välja iseenesest — piir on PÄRINGUS, mitte mälus tehtud
 * järelfiltris. Ilma ühegi piirita ei lisata seost üldse: admini
 * platvormiülene vaade peab nägema ka neid, kelle osalus ei ole tõendatud.
 */
export function wellbeingParticipationWhere({
  organizationId = null,
  municipalityId = null,
  roleGroup = null
} = {}) {
  const organization = String(organizationId || "").trim();
  const municipality = String(municipalityId || "").trim();
  const role = String(roleGroup || "").trim();
  const is = {
    ...(organization ? { organizationId: organization } : {}),
    ...(municipality ? { municipalityId: municipality } : {}),
    ...(role ? { roleGroup: role } : {})
  };
  return Object.keys(is).length > 0 ? { participation: { is } } : {};
}
