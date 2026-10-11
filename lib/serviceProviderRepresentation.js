/**
 * TEENUSEPROFIIL — kinnitus, et profiili tegija esindab seda asutust.
 *
 * Auk, mida see sulgeb: teenuseosutaja kontoga inimene sai kirjutada profiili võõra asutuse nime
 * ja registrikoodi, profiili avaldada ja saada ka märgise „tegevusluba kontrollitud". Märgis ise
 * oli tõene (register kinnitab selle asutuse loa), vale oli see, kes profiili taga seisab.
 *
 * REEGEL: registrikoodiga profiili ei saa avaldada enne, kui on kinnitatud, et konto esindab selle
 * registrikoodiga asutust. Et tegevusloa märgis on näha ainult avaldatud profiilil, katab üks
 * värav mõlemad: võõra nime all ei saa avaldada ega märgist saada.
 *
 * Kinnitus käib ÜHE REGISTRIKOODI kohta. Kui profiili kood muutub, ei kehti kinnitus enam ja
 * avaldatud profiili ei saa uue koodiga salvestada enne uut kinnitust.
 *
 * Registrikoodita profiil (näiteks eraisik) avaldatakse nagu varem: tal ei ole koodi, mille järgi
 * tegevusluba kontrollida, ja seega ei saa ta ka märgist.
 *
 * Viisid: ADMIN (platvormi haldur kinnitab käsitsi ja kirjutab aluse) ja EMAIL_LINK (kinnituslink
 * asutuse registris olevale e-postile). Teist teed siin veel ei ole: see vajab äriregistri
 * kontaktandmete allikat ja omaniku luba e-kirja saata.
 */
import { prisma } from "@/lib/prisma";

export const RepresentationMethod = Object.freeze({ ADMIN: "ADMIN", EMAIL_LINK: "EMAIL_LINK" });
export const REPRESENTATION_BASIS_MIN = 5;
export const REPRESENTATION_BASIS_MAX = 300;
export const REPRESENTATION_REQUIRED_KEY = "service_provider_profile.errors.publish_representation_required";

function cleanCode(value) {
  return String(value || "").trim();
}

function representationError(message, status, details) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
}

/**
 * Profiili kinnituse seis. `required` — kas avaldamine nõuab kinnitust (profiilil on registrikood);
 * `confirmed` — kas kehtiv kinnitus on olemas SELLE koodi kohta.
 */
export function representationState(profile = {}) {
  const registryCode = cleanCode(profile?.registryCode);
  const confirmedCode = cleanCode(profile?.representationRegistryCode);
  const confirmedAt = profile?.representationConfirmedAt || null;
  const required = Boolean(registryCode);
  const confirmed = Boolean(required && confirmedAt && confirmedCode === registryCode);
  return {
    required,
    confirmed,
    confirmedAt: confirmed ? confirmedAt : null,
    method: confirmed ? profile?.representationMethod || null : null,
    /* Kinnitus on olemas, aga teise koodi kohta: profiili registrikoodi on pärast muudetud. */
    stale: Boolean(required && confirmedAt && confirmedCode && confirmedCode !== registryCode)
  };
}

/**
 * Avaldamise värav. `next` on salvestatav profiil (uus registrikood ja seis), `existing` on rida
 * andmebaasis (kinnituse väljad) või `null`, kui profiili veel ei ole.
 */
export function assertRepresentationForPublication(next = {}, existing = null) {
  if (String(next?.status || "DRAFT").toUpperCase() !== "PUBLISHED") return;
  const state = representationState({
    registryCode: next?.registryCode,
    representationConfirmedAt: existing?.representationConfirmedAt,
    representationRegistryCode: existing?.representationRegistryCode,
    representationMethod: existing?.representationMethod
  });
  if (!state.required || state.confirmed) return;
  throw representationError(REPRESENTATION_REQUIRED_KEY, 400, { field: "registryCode" });
}

function adminRow(profile) {
  const state = representationState(profile);
  return {
    id: profile.id,
    organizationName: profile.organizationName,
    registryCode: profile.registryCode,
    status: profile.status,
    ownerEmail: profile.owner?.email || null,
    updatedAt: profile.updatedAt,
    confirmed: state.confirmed,
    stale: state.stale,
    confirmedAt: state.confirmedAt,
    method: state.method,
    confirmedRegistryCode: profile.representationRegistryCode || null,
    basis: profile.representationBasis || null
  };
}

const ADMIN_SELECT = Object.freeze({
  id: true,
  organizationName: true,
  registryCode: true,
  status: true,
  updatedAt: true,
  representationConfirmedAt: true,
  representationRegistryCode: true,
  representationMethod: true,
  representationBasis: true,
  owner: { select: { email: true } }
});

/** Halduri loend: registrikoodiga ühe inimese profiilid, kinnitamata ees. */
export async function listRepresentationAdminRows({ db = prisma, take = 200 } = {}) {
  const profiles = await db.serviceProviderProfile.findMany({
    where: { ownershipMode: "SOLO", registryCode: { not: null } },
    select: ADMIN_SELECT,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take
  });
  return profiles
    .filter((profile) => cleanCode(profile.registryCode))
    .map(adminRow)
    .sort((left, right) => Number(left.confirmed) - Number(right.confirmed));
}

async function writeAudit(tx, { type, adminUserId, profile, now, meta }) {
  await tx.domainEvent.create({
    data: {
      type,
      occurredAt: now,
      actorKind: "USER",
      actorUserId: adminUserId,
      sourceFeature: "service_profile",
      sourceType: "ServiceProviderProfile",
      sourceId: profile.id,
      audienceRule: "OWNER_ONLY",
      visibilityClass: "private",
      actionKind: "STATE_CHANGE",
      actionTarget: "representation",
      idempotencyKey: `sprof-representation:${profile.id}:${now.toISOString()}:${type}`,
      retentionClass: "audit",
      meta: { profileId: profile.id, registryCode: profile.registryCode, ...meta }
    }
  });
}

/**
 * Haldur kinnitab, et konto esindab asutust. `registryCode` on kood, mida haldur ekraanil nägi:
 * kui teenuseosutaja on koodi vahepeal muutnud, kinnitust ei anta. `basis` on kohustuslik alus
 * (näiteks „juhatuse liikme digiallkirjaga volitus 11.10.2026").
 */
export async function confirmRepresentationAsAdmin(
  { profileId, adminUserId, registryCode, basis },
  { db = prisma, now = new Date() } = {}
) {
  const id = cleanCode(profileId);
  const actor = cleanCode(adminUserId);
  const seenCode = cleanCode(registryCode);
  const note = String(basis || "").replace(/\s+/g, " ").trim();
  /* Tühi väärtus ei tohi päringusse jõuda: Prisma jätaks tingimuse vahele. */
  if (!id || !actor) throw representationError("api.common.not_found", 404);
  if (note.length < REPRESENTATION_BASIS_MIN || note.length > REPRESENTATION_BASIS_MAX) {
    throw representationError("admin.service_representation.errors.basis_required", 400, {
      min: REPRESENTATION_BASIS_MIN,
      max: REPRESENTATION_BASIS_MAX
    });
  }

  return db.$transaction(async (tx) => {
    const profile = await tx.serviceProviderProfile.findFirst({
      where: { id, ownershipMode: "SOLO" },
      select: ADMIN_SELECT
    });
    if (!profile) throw representationError("api.common.not_found", 404);
    const currentCode = cleanCode(profile.registryCode);
    if (!currentCode || currentCode !== seenCode) {
      throw representationError("admin.service_representation.errors.registry_code_changed", 409);
    }
    /* Kood on tingimuses, et vahepealne koodimuutus kinnitust ei saaks. Rea `updatedAt` jääb
       puutumata: teenuseosutaja avatud vorm ei tohi halduri kinnituse pärast konflikti anda. */
    const written = await tx.serviceProviderProfile.updateMany({
      where: { id, ownershipMode: "SOLO", registryCode: profile.registryCode },
      data: {
        representationConfirmedAt: now,
        representationRegistryCode: currentCode,
        representationMethod: RepresentationMethod.ADMIN,
        representationConfirmedById: actor,
        representationBasis: note,
        updatedAt: profile.updatedAt
      }
    });
    if (written.count !== 1) {
      throw representationError("admin.service_representation.errors.registry_code_changed", 409);
    }
    await writeAudit(tx, {
      type: "SERVICE_PROVIDER_REPRESENTATION_CONFIRMED",
      adminUserId: actor,
      profile,
      now,
      meta: { method: RepresentationMethod.ADMIN }
    });
    return adminRow({
      ...profile,
      representationConfirmedAt: now,
      representationRegistryCode: currentCode,
      representationMethod: RepresentationMethod.ADMIN,
      representationBasis: note
    });
  });
}

/**
 * Haldur võtab kinnituse tagasi. Avaldatud profiil läheb samas tehingus peitu (profiil ja kaardi
 * kirje), sest registrikoodiga profiil ei tohi olla avalik ilma kinnituseta.
 */
export async function revokeRepresentationAsAdmin(
  { profileId, adminUserId },
  { db = prisma, now = new Date() } = {}
) {
  const id = cleanCode(profileId);
  const actor = cleanCode(adminUserId);
  if (!id || !actor) throw representationError("api.common.not_found", 404);

  return db.$transaction(async (tx) => {
    const profile = await tx.serviceProviderProfile.findFirst({
      where: { id, ownershipMode: "SOLO" },
      select: ADMIN_SELECT
    });
    if (!profile) throw representationError("api.common.not_found", 404);
    const wasPublished = String(profile.status || "").toUpperCase() === "PUBLISHED";
    /* Avaldatud profiili peitmine PEAB liigutama `updatedAt`-i: teenuseosutaja avatud vorm saab
       siis salvestamisel konflikti ega avalda profiili vana seisu pealt uuesti. */
    await tx.serviceProviderProfile.update({
      where: { id },
      data: {
        representationConfirmedAt: null,
        representationRegistryCode: null,
        representationMethod: null,
        representationConfirmedById: null,
        representationBasis: null,
        ...(wasPublished ? { status: "HIDDEN", hiddenAt: now, updatedAt: now } : { updatedAt: profile.updatedAt })
      }
    });
    if (wasPublished) {
      await tx.serviceMapEntry.updateMany({
        where: { providerProfileId: id },
        data: { status: "HIDDEN" }
      });
    }
    await writeAudit(tx, {
      type: "SERVICE_PROVIDER_REPRESENTATION_REVOKED",
      adminUserId: actor,
      profile,
      now,
      meta: { hidden: wasPublished }
    });
    return adminRow({
      ...profile,
      status: wasPublished ? "HIDDEN" : profile.status,
      representationConfirmedAt: null,
      representationRegistryCode: null,
      representationMethod: null,
      representationBasis: null
    });
  });
}
