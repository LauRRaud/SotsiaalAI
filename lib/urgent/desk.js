// SK-V1 — vastuvõtulaua valmidusreegel. See fail ON funktsiooni lüliti.
//
// Leping 3.6: eraldi funktsioonilippu ei tehta. Server keeldub SK-pöördumist
// vastu võtmast, kui valitud piirkonna jaoks ei ole seadistatud saajat KOOS
// lugemisajaga. Tagajärg: nuppu ei saa tekkida ilma lauata, mis teda vastu
// võtab — lekkinud lipp, vana vahemälu, otse-URL ega rolli väärseadistus ei
// suuda toota rada, mis ei vii kuhugi.
//
// Kõik reeglid on siin ÜHES kohas ja tagastavad põhjuste loendi, mitte
// tõeväärtuse. Põhjus on vajalik kahes suunas: admin peab nägema, MIS on
// puudu, ja auditeerija peab nägema, MIKS piirkond oli kinni.
//
// Fail-closed tähendab siin sõna-sõnalt: puuduv sisend annab „ei ole valmis".
// Kahtluse korral on laud kinni.

/**
 * Kui vana tohib partneri kinnitus olla. Vana lubadus ei ole lubadus — KOV,
 * kes kinnitas oma valveaja poolteist aastat tagasi, ei ole lubanud midagi
 * tänase öö kohta.
 */
export const DESK_VERIFICATION_MAX_AGE_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;

export const DeskBlockReason = Object.freeze({
  MISSING: "urgent_desk.missing",
  INACTIVE: "urgent_desk.inactive",
  UNSTAFFED: "urgent_desk.unstaffed",
  DIRECT_CONTACT_NOT_ALLOWED: "urgent_desk.direct_contact_not_allowed",
  READING_TIME_MISSING: "urgent_desk.reading_time_missing",
  EMERGENCY_BOUNDARY_MISSING: "urgent_desk.emergency_boundary_missing",
  PUBLIC_NAME_MISSING: "urgent_desk.public_name_missing",
  OPENING_HOURS_MISSING: "urgent_desk.opening_hours_missing",
  WHO_MAY_CONTACT_MISSING: "urgent_desk.who_may_contact_missing",
  COST_MISSING: "urgent_desk.cost_missing",
  CONTACT_CHANNEL_MISSING: "urgent_desk.contact_channel_missing",
  NEVER_VERIFIED: "urgent_desk.never_verified",
  VERIFICATION_STALE: "urgent_desk.verification_stale",
  LIFETIME_INVALID: "urgent_desk.lifetime_invalid"
});

function filled(value) {
  return String(value == null ? "" : value).trim().length > 0;
}

function resolveActiveMemberCount(desk, explicit) {
  if (Number.isInteger(explicit)) return explicit;
  if (Number.isInteger(desk?.activeMemberCount)) return desk.activeMemberCount;
  if (Number.isInteger(desk?._count?.members)) return desk._count.members;
  if (Array.isArray(desk?.members)) {
    return desk.members.filter((member) => member?.isActive !== false).length;
  }
  // Teadmatus = kinni. Mitte „eeldame, et keegi on".
  return 0;
}

/**
 * Kas see laud tohib inimesele piirkonna avada?
 *
 * @returns {{ready: boolean, reasons: string[]}} — `reasons` on TÜHI ainult
 *   siis, kui kõik tingimused on täidetud.
 */
export function deskReadiness(desk, { now = new Date(), activeMemberCount = null } = {}) {
  const reasons = [];
  if (!desk) return { ready: false, reasons: [DeskBlockReason.MISSING] };

  // 1. Mehitatud ja avatud.
  if (desk.isActive !== true) reasons.push(DeskBlockReason.INACTIVE);
  if (resolveActiveMemberCount(desk, activeMemberCount) < 1) reasons.push(DeskBlockReason.UNSTAFFED);

  // 2. Estkeeri õppetund nr 1: öisel teenusel oli päevane värav. Kui pöördumine
  //    peab käima päevase sotsiaaltöötaja kaudu, ei ole see SK-rada.
  if (desk.directContactAllowed !== true) reasons.push(DeskBlockReason.DIRECT_CONTACT_NOT_ALLOWED);

  // 3. Lugemisaeg ja 112 piir — kaks lubadust, milleta laud ei ole laud.
  if (!filled(desk.readingTimePromise)) reasons.push(DeskBlockReason.READING_TIME_MISSING);
  if (!filled(desk.emergencyBoundary)) reasons.push(DeskBlockReason.EMERGENCY_BOUNDARY_MISSING);

  // 4. Ülejäänud tingimused, mida inimene peab ENNE saatmist nägema. Estkeeri
  //    õppetund nr 5: sama nime all oli ühes vallas tasuline ja teises tasuta
  //    teenus, ja inimene ei saanud teada, kas tal on õigus pöörduda.
  if (!filled(desk.publicName)) reasons.push(DeskBlockReason.PUBLIC_NAME_MISSING);
  if (!filled(desk.openingHours)) reasons.push(DeskBlockReason.OPENING_HOURS_MISSING);
  if (!filled(desk.whoMayContact)) reasons.push(DeskBlockReason.WHO_MAY_CONTACT_MISSING);
  if (!filled(desk.costToPerson)) reasons.push(DeskBlockReason.COST_MISSING);
  if (!filled(desk.contactChannel)) reasons.push(DeskBlockReason.CONTACT_CHANNEL_MISSING);

  // 5. Aegumisaken peab olema mõistlik — 0 tunniga laud aegutaks pöördumise
  //    enne, kui keegi jõuab teda avada.
  const lifetime = Number(desk.requestLifetimeHours);
  if (!Number.isFinite(lifetime) || lifetime < 1 || lifetime > 168) {
    reasons.push(DeskBlockReason.LIFETIME_INVALID);
  }

  // 6. Kinnituse värskus.
  const verifiedAt = desk.lastVerifiedAt ? new Date(desk.lastVerifiedAt) : null;
  if (!verifiedAt || Number.isNaN(verifiedAt.getTime())) {
    reasons.push(DeskBlockReason.NEVER_VERIFIED);
  } else {
    const ageMs = new Date(now).getTime() - verifiedAt.getTime();
    if (ageMs > DESK_VERIFICATION_MAX_AGE_DAYS * DAY_MS) {
      reasons.push(DeskBlockReason.VERIFICATION_STALE);
    }
  }

  return { ready: reasons.length === 0, reasons };
}

export function isDeskReady(desk, options = {}) {
  return deskReadiness(desk, options).ready;
}

/**
 * Mida inimene laua kohta ENNE saatmist näeb.
 *
 * Valge nimekiri, mitte kustutamine: uus veerg mudelis ei leki siia iseenesest.
 * `ownerUserId`, `lastVerifiedAt` ja mehitajad EI ole siin — need on partneri
 * sisemine korraldus, mitte pöörduja asi.
 */
export function publicDeskProjection(desk) {
  if (!desk) return null;
  return {
    id: desk.id,
    municipalityId: desk.municipalityId,
    recipientType: desk.recipientType,
    publicName: desk.publicName,
    openingHours: desk.openingHours,
    whoMayContact: desk.whoMayContact,
    preAssessmentRequired: desk.preAssessmentRequired === true,
    costToPerson: desk.costToPerson,
    readingTimePromise: desk.readingTimePromise,
    contactChannel: desk.contactChannel,
    emergencyBoundary: desk.emergencyBoundary
  };
}

export const PUBLIC_DESK_FIELDS = Object.freeze([
  "id",
  "municipalityId",
  "recipientType",
  "publicName",
  "openingHours",
  "whoMayContact",
  "preAssessmentRequired",
  "costToPerson",
  "readingTimePromise",
  "contactChannel",
  "emergencyBoundary"
]);

/**
 * Admini vaade: sama laud koos valmiduse põhjustega. Siin TOHIB olla see, mida
 * avalik projektsioon ei kanna — sest siin istub inimene, kes laua eest
 * vastutab.
 */
export function adminDeskProjection(desk, { now = new Date(), activeMemberCount = null } = {}) {
  if (!desk) return null;
  const readiness = deskReadiness(desk, { now, activeMemberCount });
  return {
    ...publicDeskProjection(desk),
    ownerUserId: desk.ownerUserId || null,
    serviceEntryId: desk.serviceEntryId || null,
    directContactAllowed: desk.directContactAllowed === true,
    requestLifetimeHours: Number(desk.requestLifetimeHours) || null,
    isActive: desk.isActive === true,
    lastVerifiedAt: desk.lastVerifiedAt || null,
    activeMemberCount: resolveActiveMemberCount(desk, activeMemberCount),
    ready: readiness.ready,
    blockReasons: readiness.reasons
  };
}
