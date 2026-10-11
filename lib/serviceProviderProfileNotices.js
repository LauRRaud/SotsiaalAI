/**
 * TEENUSEPROFIILI TEATED — kes saab teada, kui profiili kinnitus või avaldamine muutub.
 *
 * Enne seda moodulit ei saanud keegi midagi teada: profiili salvestamisel ja avaldamisel nägi
 * osutaja ainult lehel „salvestatud", halduri kinnitus ja selle tagasivõtmine ei jõudnud ei
 * konto omaniku ega asutuseni. Asutuse nimel võis profiil avalduda nii, et asutus sellest ei
 * kuulnud (omanik 11.10.2026: teade on vajalik, kontole ja asutusele).
 *
 * NELI SÜNDMUST:
 *   kinnituslink saadeti        konto omanikule: kinnitus ootab asutuse postkastis;
 *   asutus kinnitati            konto omanikule; asutusele, kui kinnitas haldur (lingiga kinnitades
 *                               osales asutuse postkast ise);
 *   kinnitus võeti tagasi       konto omanikule ja asutusele;
 *   profiil avaldati            konto omanikule ja asutusele.
 *
 * KONTO OMANIK saab teate platvormi sisse ja e-kirja (teavituste süsteem, `TRANSACTIONAL`).
 * Teavitus kannab ainult profiili ID-d.
 *
 * ASUTUS saab e-kirja AINULT siis, kui profiili kontakt-e-post on äriregistris selle
 * registrikoodi kontakt (`checkRegisterContact`). Registri aadresse meil ei ole (failis on ainult
 * räsid), seega mujale saata ei saa: muu aadress võib olla profiili tegija enda oma ja teade
 * sinna ei kaitseks asutust. Registrikoodita profiili puhul asutusele kirja ei lähe.
 *
 * Kõik on parima püüdluse järgi: teate ebaõnnestumine ei lükka kinnitust ega salvestust tagasi.
 */
import { checkRegisterContact, normalizeContactEmail } from "@/lib/businessRegisterContacts";
import { NOTIFICATION_EVENT_TYPES, createNotificationEvent } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { OrganizationNoticeKind, sendOrganizationNoticeEmail } from "@/lib/serviceProviderProfileNoticeMail";

export const NoticeOutcome = Object.freeze({
  CREATED: "created",
  EXISTS: "exists",
  SENT: "sent",
  FAILED: "failed",
  NO_PROFILE: "skipped_no_profile",
  NO_OWNER: "skipped_no_owner",
  NO_ADDRESS: "skipped_no_address",
  NOT_REGISTER_CONTACT: "skipped_not_register_contact",
  REGISTER_UNAVAILABLE: "skipped_register_unavailable",
  NOT_NEEDED: "skipped_not_needed",
  RECENT: "skipped_recent"
});

/* Avaldamise teade asutusele ja e-kiri omanikule kõige rohkem kord ööpäevas profiili kohta:
   avaldatud ja avaldamata vahel lülitamine ei tohi postkasti täita. */
export const PUBLISHED_QUIET_MS = 24 * 60 * 60 * 1000;

const NOTICE_SELECT = Object.freeze({
  id: true,
  ownerId: true,
  ownershipMode: true,
  organizationName: true,
  registryCode: true,
  email: true,
  status: true,
  updatedAt: true
});

function clean(value) {
  return String(value ?? "").trim();
}

function stamp(value, fallback) {
  const date = value instanceof Date ? value : new Date(value ?? NaN);
  return (Number.isFinite(date.getTime()) ? date : fallback).toISOString();
}

async function findProfile(db, { profileId, ownerId }) {
  const id = clean(profileId);
  const owner = clean(ownerId);
  /* Tühi väärtus ei tohi päringusse jõuda: Prisma jätaks tingimuse vahele. */
  if (!id && !owner) return null;
  return db.serviceProviderProfile.findFirst({
    where: id ? { id } : { ownerId: owner, ownershipMode: "SOLO" },
    select: NOTICE_SELECT
  });
}

async function notifyOwner(profile, type, at, { db, now, notify, emailPolicy = "TRANSACTIONAL" }) {
  /* ORGANIZATION-profiilil ei ole isiklikku adressaati: `ownerId` on seal ainult päritolu. */
  if (profile.ownershipMode !== "SOLO" || !clean(profile.ownerId)) return NoticeOutcome.NO_OWNER;
  try {
    const result = await notify(
      {
        type,
        userId: profile.ownerId,
        sourceId: profile.id,
        targetId: profile.id,
        dedupeSuffix: `at:${stamp(at, now)}`,
        emailPolicy
      },
      { db, now }
    );
    return result?.created ? NoticeOutcome.CREATED : NoticeOutcome.EXISTS;
  } catch (error) {
    console.error("[service-profile-notice] owner notice failed", { type, error: safeError(error) });
    return NoticeOutcome.FAILED;
  }
}

async function notifyOrganization(profile, kind, locale, { checkContact, sendMail }) {
  const registryCode = clean(profile.registryCode);
  const address = normalizeContactEmail(profile.email);
  if (!registryCode || !address) return NoticeOutcome.NO_ADDRESS;
  try {
    const contact = await checkContact(registryCode, address);
    if (contact === "unavailable") return NoticeOutcome.REGISTER_UNAVAILABLE;
    if (contact !== "match") return NoticeOutcome.NOT_REGISTER_CONTACT;
    await sendMail({ to: address, kind, organizationName: profile.organizationName, registryCode, locale });
    return NoticeOutcome.SENT;
  } catch (error) {
    /* Aadressi logisse ei kirjutata. */
    console.error("[service-profile-notice] organisation notice failed", { kind, error: safeError(error) });
    return NoticeOutcome.FAILED;
  }
}

function dependencies(options = {}) {
  return {
    db: options.db || prisma,
    now: options.now instanceof Date ? options.now : new Date(),
    notify: options.notify || createNotificationEvent,
    checkContact: options.checkContact || checkRegisterContact,
    sendMail: options.sendMail || sendOrganizationNoticeEmail
  };
}

async function announce(label, run) {
  try {
    return await run();
  } catch (error) {
    console.error(`[service-profile-notice] ${label} failed`, safeError(error));
    return { owner: NoticeOutcome.FAILED, organization: NoticeOutcome.FAILED };
  }
}

/** Kinnituslink läks asutuse postkasti: konto omanik saab teada, et kinnitus ootab seal. */
export function announceRepresentationLinkSent({ ownerId, sentAt }, options = {}) {
  const deps = dependencies(options);
  return announce("link sent", async () => {
    const profile = await findProfile(deps.db, { ownerId });
    if (!profile) return { owner: NoticeOutcome.NO_PROFILE, organization: NoticeOutcome.NOT_NEEDED };
    return {
      owner: await notifyOwner(profile, NOTIFICATION_EVENT_TYPES.SERVICE_REPRESENTATION_LINK_SENT, sentAt, deps),
      /* Asutuse postkast sai just kinnituslingi kirja. */
      organization: NoticeOutcome.NOT_NEEDED
    };
  });
}

/**
 * Asutus on kinnitatud. `method` on `ADMIN` või `EMAIL_LINK`: halduri kinnitusest ei tea asutus
 * midagi ja saab kirja; lingiga kinnitades osales asutuse postkast ise.
 */
export function announceRepresentationConfirmed({ profileId, ownerId, method, confirmedAt, locale }, options = {}) {
  const deps = dependencies(options);
  return announce("confirmed", async () => {
    const profile = await findProfile(deps.db, { profileId, ownerId });
    if (!profile) return { owner: NoticeOutcome.NO_PROFILE, organization: NoticeOutcome.NO_PROFILE };
    return {
      owner: await notifyOwner(profile, NOTIFICATION_EVENT_TYPES.SERVICE_REPRESENTATION_CONFIRMED, confirmedAt, deps),
      organization: method === "ADMIN"
        ? await notifyOrganization(profile, OrganizationNoticeKind.CONFIRMED_BY_ADMIN, locale, deps)
        : NoticeOutcome.NOT_NEEDED
    };
  });
}

/**
 * Haldur võttis kinnituse tagasi. Profiili registrikood on alles (tagasi võetakse kinnitus, mitte
 * kood), seega saab asutuse aadressi endiselt registri vastu kontrollida.
 */
export function announceRepresentationRevoked({ profileId, revokedAt, locale }, options = {}) {
  const deps = dependencies(options);
  return announce("revoked", async () => {
    const profile = await findProfile(deps.db, { profileId });
    if (!profile) return { owner: NoticeOutcome.NO_PROFILE, organization: NoticeOutcome.NO_PROFILE };
    return {
      owner: await notifyOwner(profile, NOTIFICATION_EVENT_TYPES.SERVICE_REPRESENTATION_REVOKED, revokedAt, deps),
      organization: await notifyOrganization(profile, OrganizationNoticeKind.REVOKED, locale, deps)
    };
  });
}

/** Profiili olek enne salvestust: avaldamise teade läheb ainult siis, kui olek muutub avaldatuks. */
export async function readPublicationStatus(ownerId, { db = prisma } = {}) {
  try {
    const profile = await findProfile(db, { ownerId });
    return profile ? String(profile.status || "").toUpperCase() : null;
  } catch (error) {
    console.error("[service-profile-notice] status read failed", safeError(error));
    /* Teadmata eelmine olek ei tohi teadet tekitada: muidu saadaks iga salvestus kirja. */
    return "PUBLISHED";
  }
}

/**
 * Profiil salvestati. Teade läheb ainult üleminekul avaldatuks (`previousStatus` ei olnud
 * avaldatud); avaldatud profiili tavaline salvestus ei teavita kedagi.
 */
export function announceProfilePublished({ previousStatus, profile, locale }, options = {}) {
  const deps = dependencies(options);
  return announce("published", async () => {
    const published = String(profile?.status || "").toUpperCase() === "PUBLISHED";
    const wasPublished = String(previousStatus || "").toUpperCase() === "PUBLISHED";
    if (!profile?.id || !published || wasPublished) {
      return { owner: NoticeOutcome.NOT_NEEDED, organization: NoticeOutcome.NOT_NEEDED };
    }
    const type = NOTIFICATION_EVENT_TYPES.SERVICE_PROFILE_PUBLISHED;
    const recent = await deps.db.notificationEvent.findFirst({
      where: { type, sourceId: profile.id, createdAt: { gt: new Date(deps.now.getTime() - PUBLISHED_QUIET_MS) } },
      select: { id: true }
    });
    return {
      owner: await notifyOwner(profile, type, profile.updatedAt, { ...deps, emailPolicy: recent ? "NONE" : "TRANSACTIONAL" }),
      organization: recent
        ? NoticeOutcome.RECENT
        : await notifyOrganization(profile, OrganizationNoticeKind.PUBLISHED, locale, deps)
    };
  });
}
