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
 * NIMI TULEB REGISTRIST (lib/businessRegisterNames.js). Kinnitus üksi ei öelnud midagi nime kohta:
 * registrikoodi sai kinnitada profiilil, mille nimi oli hoopis teine. Seepärast ei saa
 * registrikoodiga profiili kinnitada ega avaldada nimega, mis ei ole äriregistris selle koodi nimi.
 *
 * Registrikoodita profiil (näiteks eraisik) avaldatakse nagu varem: tal ei ole koodi, mille järgi
 * tegevusluba kontrollida, ja seega ei saa ta ka märgist. Erand: kui kirjutatud nimi on
 * registrisse kantud asutuse nimi, ei saa profiili ilma registrikoodita (ja seega ilma
 * kinnituseta) avaldada.
 *
 * Kui registrifaili ei saa lugeda, on vastus „ei tea" ja see ei ole „sobib": kinnitada ega
 * avaldada siis ei saa.
 *
 * Viisid:
 *   ADMIN       platvormi haldur kinnitab käsitsi ja kirjutab aluse;
 *   EMAIL_LINK  teenuseosutaja kirjutab asutuse e-posti, platvorm kontrollib, et see on
 *               äriregistris selle registrikoodi kontaktina kirjas
 *               (lib/businessRegisterContacts.js), ja saadab sinna ühekordse lingi. Lingi peab
 *               avama sama konto, mis profiili tegi: nii tõendab kinnitus korraga kaht asja —
 *               inimene pääseb asutuse postkasti ja ta on selle profiili omanik.
 *
 * E-posti aadressi ei salvestata: reale jääb ainult lingi räsi, kood ja kaks aega.
 */
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/auth/pin-login";
import { checkRegisterContact, normalizeContactEmail } from "@/lib/businessRegisterContacts";
import { RegisterNameResult, checkRegisterName, loadRegisterNamesOrNull, registerNameCheck } from "@/lib/businessRegisterNames";
import { prisma } from "@/lib/prisma";

export const RepresentationMethod = Object.freeze({ ADMIN: "ADMIN", EMAIL_LINK: "EMAIL_LINK" });
export const REPRESENTATION_BASIS_MIN = 5;
export const REPRESENTATION_BASIS_MAX = 300;
export const REPRESENTATION_REQUIRED_KEY = "service_provider_profile.errors.publish_representation_required";
export const REPRESENTATION_LINK_DAYS = 7;

/* Avaldamise keeld nime pärast: iga nimekontrolli vastus oma lausega (kataloogis kolmes keeles). */
export const RegisterNamePublicationError = Object.freeze({
  NAME_MISMATCH: "service_provider_profile.errors.publish_register_name_mismatch",
  CODE_NOT_LISTED: "service_provider_profile.errors.publish_registry_code_not_listed",
  CODE_REQUIRED: "service_provider_profile.errors.publish_registry_code_required",
  REGISTER_UNAVAILABLE: "service_provider_profile.errors.publish_register_unavailable"
});

/* Halduri kinnituse keeld nime pärast. */
export const AdminRepresentationNameError = Object.freeze({
  NAME_MISMATCH: "admin.service_representation.errors.name_mismatch",
  CODE_NOT_LISTED: "admin.service_representation.errors.code_not_listed",
  REGISTER_UNAVAILABLE: "admin.service_representation.errors.register_unavailable"
});

/* Vead, mis jõuavad teenuseosutajani oma lausega (kataloogis kolmes keeles). */
export const RepresentationLinkError = Object.freeze({
  PROFILE_REQUIRED: "service_provider_profile.errors.representation_profile_required",
  ALREADY_CONFIRMED: "service_provider_profile.errors.representation_already_confirmed",
  EMAIL_INVALID: "service_provider_profile.errors.representation_email_invalid",
  EMAIL_NOT_IN_REGISTER: "service_provider_profile.errors.representation_email_not_in_register",
  REGISTER_UNAVAILABLE: "service_provider_profile.errors.representation_register_unavailable",
  NAME_MISMATCH: "service_provider_profile.errors.representation_name_mismatch",
  CODE_NOT_LISTED: "service_provider_profile.errors.representation_code_not_listed",
  MAIL_FAILED: "service_provider_profile.errors.representation_mail_failed",
  LINK_INVALID: "service_provider_profile.errors.representation_link_invalid"
});

const CLEARED_REQUEST = Object.freeze({
  representationRequestHash: null,
  representationRequestCode: null,
  representationRequestExpiresAt: null,
  representationRequestSentAt: null
});

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

/**
 * Nimevärav avaldamisel. `nameCheck` on `checkRegisterName` vastus SELLE salvestatava nime ja
 * koodi kohta. Läbi lasevad ainult kaks vastust: registrikoodiga profiilil „nimi on registri nimi"
 * ja registrikoodita profiilil „sellist asutuse nime registris ei ole". Puuduv või tundmatu vastus
 * tähendab „ei tea" ja avaldada ei saa.
 */
export function assertRegisterNameForPublication(next = {}, nameCheck = null) {
  if (String(next?.status || "DRAFT").toUpperCase() !== "PUBLISHED") return;
  const result = nameCheck?.result;
  if (result === (cleanCode(next?.registryCode) ? RegisterNameResult.MATCH : RegisterNameResult.FREE)) return;
  if (result === RegisterNameResult.MISMATCH) {
    throw representationError(RegisterNamePublicationError.NAME_MISMATCH, 400, {
      field: "organizationName",
      registerName: nameCheck.registerName || null
    });
  }
  if (result === RegisterNameResult.CODE_NOT_LISTED) {
    throw representationError(RegisterNamePublicationError.CODE_NOT_LISTED, 400, { field: "registryCode" });
  }
  if (result === RegisterNameResult.CODE_REQUIRED) {
    throw representationError(RegisterNamePublicationError.CODE_REQUIRED, 400, { field: "registryCode" });
  }
  throw representationError(RegisterNamePublicationError.REGISTER_UNAVAILABLE, 503);
}

const nameInput = (profile) => ({ registryCode: profile.registryCode, organizationName: profile.organizationName });

/* Kinnituse eeltingimus: profiili nimi on äriregistris selle registrikoodi nimi (`check` on
   nimekontrolli vastus). `keys` annab kutsuja vealaused: teenuseosutaja ja halduri omad on eri
   nimeruumis. */
function assertRegisterNameForConfirmation(check, keys) {
  if (check?.result === RegisterNameResult.MATCH) return;
  if (check?.result === RegisterNameResult.MISMATCH) {
    throw representationError(keys.NAME_MISMATCH, 409, { field: "organizationName", registerName: check.registerName || null });
  }
  if (check?.result === RegisterNameResult.CODE_NOT_LISTED) {
    throw representationError(keys.CODE_NOT_LISTED, 409, { field: "registryCode" });
  }
  throw representationError(keys.REGISTER_UNAVAILABLE, 503);
}

function adminRow(profile, nameCheck = null) {
  const state = representationState(profile);
  return {
    id: profile.id,
    organizationName: profile.organizationName,
    /* Nimekontroll: haldur näeb registri nime profiili nime kõrval enne, kui kinnitab. */
    nameCheck: nameCheck?.result || RegisterNameResult.UNAVAILABLE,
    registerName: nameCheck?.registerName || null,
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
export async function listRepresentationAdminRows({ db = prisma, take = 200, loadNames = loadRegisterNamesOrNull } = {}) {
  const profiles = await db.serviceProviderProfile.findMany({
    where: { ownershipMode: "SOLO", registryCode: { not: null } },
    select: ADMIN_SELECT,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take
  });
  const names = await loadNames();
  return profiles
    .filter((profile) => cleanCode(profile.registryCode))
    .map((profile) => adminRow(profile, registerNameCheck(names, profile)))
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
  { db = prisma, now = new Date(), checkName = checkRegisterName } = {}
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
    /* Ka haldur ei kinnita koodi nime all, mis ei ole registris selle koodi nimi. */
    const nameCheck = await checkName(nameInput(profile));
    assertRegisterNameForConfirmation(nameCheck, AdminRepresentationNameError);
    /* Kood ja nimi on tingimuses, et vahepealne muutus kinnitust ei saaks. Rea `updatedAt` jääb
       puutumata: teenuseosutaja avatud vorm ei tohi halduri kinnituse pärast konflikti anda. */
    const written = await tx.serviceProviderProfile.updateMany({
      where: { id, ownershipMode: "SOLO", registryCode: profile.registryCode, organizationName: profile.organizationName },
      data: {
        representationConfirmedAt: now,
        representationRegistryCode: currentCode,
        representationMethod: RepresentationMethod.ADMIN,
        representationConfirmedById: actor,
        representationBasis: note,
        ...CLEARED_REQUEST,
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
    }, nameCheck);
  });
}

/**
 * Haldur võtab kinnituse tagasi. Avaldatud profiil läheb samas tehingus peitu (profiil ja kaardi
 * kirje), sest registrikoodiga profiil ei tohi olla avalik ilma kinnituseta.
 */
export async function revokeRepresentationAsAdmin(
  { profileId, adminUserId },
  { db = prisma, now = new Date(), checkName = checkRegisterName } = {}
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
        /* Ootel link ei tohi tagasi võetud kinnitust uuesti anda. */
        ...CLEARED_REQUEST,
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
    }, await checkName(nameInput(profile)));
  });
}

const OWNER_SELECT = Object.freeze({
  id: true,
  organizationName: true,
  registryCode: true,
  status: true,
  updatedAt: true,
  representationConfirmedAt: true,
  representationRegistryCode: true,
  representationMethod: true,
  representationRequestHash: true,
  representationRequestCode: true,
  representationRequestExpiresAt: true,
  representationRequestSentAt: true
});

function pendingLink(profile, now) {
  const expiresAt = profile?.representationRequestExpiresAt || null;
  const live = Boolean(
    profile?.representationRequestHash
    && expiresAt
    && new Date(expiresAt).getTime() > now.getTime()
    && cleanCode(profile.representationRequestCode) === cleanCode(profile.registryCode)
  );
  return live ? { sentAt: profile.representationRequestSentAt || null, expiresAt } : null;
}

/** Teenuseosutaja enda vaade: profiili nimi ja kood, nimekontroll, kinnituse seis ja ootel link. */
export async function describeRepresentationForOwner(ownerId, { db = prisma, now = new Date(), checkName = checkRegisterName } = {}) {
  const owner = cleanCode(ownerId);
  if (!owner) return { hasProfile: false };
  const profile = await db.serviceProviderProfile.findFirst({
    where: { ownerId: owner, ownershipMode: "SOLO" },
    select: OWNER_SELECT
  });
  if (!profile) return { hasProfile: false };
  const state = representationState(profile);
  /* Registrikoodita profiili kohta siin nime ei kontrollita: kinnitada ei ole midagi. */
  const nameCheck = state.required ? await checkName(nameInput(profile)) : null;
  return {
    hasProfile: true,
    organizationName: profile.organizationName,
    registryCode: cleanCode(profile.registryCode) || null,
    nameCheck: nameCheck?.result || null,
    registerName: nameCheck?.registerName || null,
    required: state.required,
    confirmed: state.confirmed,
    confirmedAt: state.confirmedAt,
    method: state.method,
    pendingLink: state.confirmed ? null : pendingLink(profile, now)
  };
}

function defaultPrepareToken() {
  const token = generateOpaqueToken(32);
  return { token, tokenHash: hashOpaqueToken(token) };
}

/**
 * Saadab kinnituslingi asutuse e-postile.
 *
 * Järjekord on: kontroll, lingi tegemine, KIRI ja alles siis rea kirjutamine. Kui kiri teele ei
 * läinud, jääb varasem ootel link kehtima; ülekirjutamine enne saatmist jätaks inimese ilma
 * mõlemast.
 *
 * `sendMail({ to, organizationName, registryCode, token, locale, expiresAt })` viskab, kui kiri
 * teele ei läinud.
 */
export async function requestRepresentationLink(
  { ownerId, email, locale },
  {
    db = prisma,
    now = new Date(),
    checkContact = checkRegisterContact,
    checkName = checkRegisterName,
    sendMail,
    prepareToken = defaultPrepareToken
  } = {}
) {
  const owner = cleanCode(ownerId);
  /* Tühi väärtus ei tohi päringusse jõuda: Prisma jätaks tingimuse vahele. */
  if (!owner) throw representationError("api.common.unauthorized", 401);
  if (typeof sendMail !== "function") throw new Error("REPRESENTATION_MAILER_REQUIRED");
  const address = normalizeContactEmail(email);
  if (!address) throw representationError(RepresentationLinkError.EMAIL_INVALID, 400, { field: "email" });

  const profile = await db.serviceProviderProfile.findFirst({
    where: { ownerId: owner, ownershipMode: "SOLO" },
    select: OWNER_SELECT
  });
  const state = representationState(profile || {});
  if (!profile || !state.required) throw representationError(RepresentationLinkError.PROFILE_REQUIRED, 409);
  if (state.confirmed) throw representationError(RepresentationLinkError.ALREADY_CONFIRMED, 409);

  const registryCode = cleanCode(profile.registryCode);
  /* Enne kirja: asutuse postkasti ei lähe link profiili kohta, mille nimi ei ole selle asutuse nimi. */
  assertRegisterNameForConfirmation(await checkName(nameInput(profile)), RepresentationLinkError);
  const contact = await checkContact(registryCode, address);
  if (contact === "unavailable") throw representationError(RepresentationLinkError.REGISTER_UNAVAILABLE, 503);
  /* Sama vastus, kui koodi registris ei ole ja kui aadress ei ole selle koodi oma: vastus ei
     ütle, kumb pool valesti oli. */
  if (contact !== "match") {
    throw representationError(RepresentationLinkError.EMAIL_NOT_IN_REGISTER, 400, { field: "email" });
  }

  const { token, tokenHash } = prepareToken();
  const expiresAt = new Date(now.getTime() + REPRESENTATION_LINK_DAYS * 24 * 60 * 60 * 1000);
  try {
    await sendMail({
      to: address,
      organizationName: profile.organizationName,
      registryCode,
      token,
      locale,
      expiresAt
    });
  } catch {
    throw representationError(RepresentationLinkError.MAIL_FAILED, 502);
  }

  await db.$transaction(async (tx) => {
    /* Kood on tingimuses: kui teenuseosutaja muutis koodi kirja saatmise ajal, linki ei teki. */
    const written = await tx.serviceProviderProfile.updateMany({
      where: { id: profile.id, ownerId: owner, ownershipMode: "SOLO", registryCode: profile.registryCode },
      data: {
        representationRequestHash: tokenHash,
        representationRequestCode: registryCode,
        representationRequestExpiresAt: expiresAt,
        representationRequestSentAt: now,
        updatedAt: profile.updatedAt
      }
    });
    if (written.count !== 1) throw representationError(RepresentationLinkError.PROFILE_REQUIRED, 409);
    await writeAudit(tx, {
      type: "SERVICE_PROVIDER_REPRESENTATION_LINK_SENT",
      adminUserId: owner,
      profile,
      now,
      /* Aadressi auditisse ei kirjutata. */
      meta: { method: RepresentationMethod.EMAIL_LINK }
    });
  });
  return { delivery: "sent", sentAt: now, expiresAt };
}

function tokenHashOf(token, hashToken) {
  const raw = String(token || "").trim();
  return /^[a-f0-9]{32,128}$/u.test(raw) ? hashToken(raw) : "";
}

/** Kas see link kuulub sellele kontole ja kehtib. Lehe vahevaate jaoks; midagi ei muuda. */
export async function describeRepresentationLink(
  { ownerId, token },
  { db = prisma, now = new Date(), hashToken = hashOpaqueToken } = {}
) {
  const owner = cleanCode(ownerId);
  const tokenHash = tokenHashOf(token, hashToken);
  if (!owner || !tokenHash) return { valid: false };
  const profile = await db.serviceProviderProfile.findFirst({
    where: { ownerId: owner, ownershipMode: "SOLO", representationRequestHash: tokenHash },
    select: OWNER_SELECT
  });
  if (!profile || !pendingLink(profile, now)) return { valid: false };
  return { valid: true, organizationName: profile.organizationName, registryCode: cleanCode(profile.registryCode) };
}

/**
 * Kinnitab lingiga. Link kehtib ainult profiili omaniku kontol, enne tähtaega ja sama
 * registrikoodi kohta, millele see anti. Iga muu juhtum annab sama vastuse „link ei kehti".
 */
export async function confirmRepresentationByLink(
  { ownerId, token },
  { db = prisma, now = new Date(), hashToken = hashOpaqueToken, checkName = checkRegisterName } = {}
) {
  const owner = cleanCode(ownerId);
  const tokenHash = tokenHashOf(token, hashToken);
  if (!owner) throw representationError("api.common.unauthorized", 401);
  if (!tokenHash) throw representationError(RepresentationLinkError.LINK_INVALID, 400);

  return db.$transaction(async (tx) => {
    const profile = await tx.serviceProviderProfile.findFirst({
      where: { ownerId: owner, ownershipMode: "SOLO", representationRequestHash: tokenHash },
      select: OWNER_SELECT
    });
    if (!profile || !pendingLink(profile, now)) {
      throw representationError(RepresentationLinkError.LINK_INVALID, 400);
    }
    const registryCode = cleanCode(profile.registryCode);
    /* Nime võis pärast lingi saatmist muuta: kinnitus antakse ainult registri nime all. */
    assertRegisterNameForConfirmation(await checkName(nameInput(profile)), RepresentationLinkError);
    /* Kirjutus on kohtunik: räsi, kood ja nimi on tingimuses, nii et sama linki ei saa kaks korda
       kasutada ja vahepeal muudetud kood või nimi kinnitust ei saa. */
    const written = await tx.serviceProviderProfile.updateMany({
      where: {
        id: profile.id,
        ownerId: owner,
        ownershipMode: "SOLO",
        registryCode: profile.registryCode,
        organizationName: profile.organizationName,
        representationRequestHash: tokenHash
      },
      data: {
        representationConfirmedAt: now,
        representationRegistryCode: registryCode,
        representationMethod: RepresentationMethod.EMAIL_LINK,
        representationConfirmedById: owner,
        representationBasis: null,
        ...CLEARED_REQUEST,
        updatedAt: profile.updatedAt
      }
    });
    if (written.count !== 1) throw representationError(RepresentationLinkError.LINK_INVALID, 400);
    await writeAudit(tx, {
      type: "SERVICE_PROVIDER_REPRESENTATION_CONFIRMED",
      adminUserId: owner,
      profile,
      now,
      meta: { method: RepresentationMethod.EMAIL_LINK }
    });
    return {
      confirmed: true,
      confirmedAt: now,
      method: RepresentationMethod.EMAIL_LINK,
      organizationName: profile.organizationName,
      registryCode
    };
  });
}
