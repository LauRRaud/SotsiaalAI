// SK-V1 E2 — laudade register. Siin on lüliti teine pool: seadistus.
//
// Üks reegel kannab kogu faili ja teda ei tohi mugavuse pärast lõdvendada:
//
//   **Tingimuse muutmine tühistab kinnituse.**
//
// Kui KOV muudab lugemisaega, tööaega, hinda või seda, kes tohib pöörduda, ei
// kata vana kinnitus enam uut teksti — `lastVerifiedAt` nullitakse ja laud
// sulgub, kuni partner kinnitab uuesti. Sama muster, mis COLLAB-P4-s: kliendi
// kinnituse alt ei saa teksti välja vahetada.
//
// Ilma selleta oleks „viimati kinnitatud" kuupäev dekoratsioon: keegi kinnitaks
// korra tingimused ja kirjutaks siis lubaduse ümber.

import { adminDeskProjection, deskReadiness, lockDeskRow } from "@/lib/urgent/desk";

export class UrgentDeskError extends Error {
  constructor(code) {
    super(code);
    this.name = "UrgentDeskError";
    this.code = code;
  }
}

function fail(code) {
  throw new UrgentDeskError(code);
}

function cleanText(value, { max = 500 } = {}) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

const RECIPIENT_TYPES = new Set(["KOV_CONTACT", "SERVICE_PROVIDER"]);

/**
 * Väljad, mille muutmine tühistab kinnituse. Need on täpselt need, mida inimene
 * enne saatmist näeb, pluss lubadus ise.
 *
 * `ownerUserId` ja `serviceEntryId` EI ole siin: partneri sisemine korraldus ei
 * muuda seda, mida inimesele öeldakse.
 */
export const VERIFIED_CONDITION_FIELDS = Object.freeze([
  "publicName",
  "openingHours",
  "whoMayContact",
  "preAssessmentRequired",
  "costToPerson",
  "readingTimePromise",
  "contactChannel",
  "emergencyBoundary",
  "directContactAllowed",
  "requestLifetimeHours"
]);

const REQUIRED_TEXT_FIELDS = Object.freeze([
  ["publicName", "urgent_desk.public_name_required", 200],
  ["openingHours", "urgent_desk.opening_hours_required", 300],
  ["whoMayContact", "urgent_desk.who_may_contact_required", 600],
  ["costToPerson", "urgent_desk.cost_required", 300],
  ["readingTimePromise", "urgent_desk.reading_time_required", 300],
  ["contactChannel", "urgent_desk.contact_channel_required", 300],
  ["emergencyBoundary", "urgent_desk.emergency_boundary_required", 600]
]);

function normalizeConditions(input, base = {}) {
  const merged = { ...base };
  for (const [field, code, max] of REQUIRED_TEXT_FIELDS) {
    const value = input[field] === undefined ? base[field] : input[field];
    const text = cleanText(value, { max });
    if (!text) fail(code);
    merged[field] = text;
  }

  merged.preAssessmentRequired =
    input.preAssessmentRequired === undefined
      ? base.preAssessmentRequired === true
      : input.preAssessmentRequired === true;
  merged.directContactAllowed =
    input.directContactAllowed === undefined
      ? base.directContactAllowed === true
      : input.directContactAllowed === true;

  const rawLifetime = input.requestLifetimeHours === undefined
    ? base.requestLifetimeHours
    : input.requestLifetimeHours;
  const lifetime = Number(rawLifetime ?? 24);
  if (!Number.isInteger(lifetime) || lifetime < 1 || lifetime > 168) {
    fail("urgent_desk.lifetime_invalid");
  }
  merged.requestLifetimeHours = lifetime;

  return merged;
}

/** Kas mõni kinnitust kandev tingimus muutus? */
export function conditionsChanged(before, after) {
  return VERIFIED_CONDITION_FIELDS.some((field) => {
    const a = before?.[field];
    const b = after?.[field];
    if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) !== Boolean(b);
    if (typeof a === "number" || typeof b === "number") return Number(a) !== Number(b);
    return String(a ?? "") !== String(b ?? "");
  });
}

/**
 * Uus laud. Ta sünnib ALATI kinni: `isActive` on false ja `lastVerifiedAt`
 * tühi. Laua loomine ei ava piirkonda — selleks on eraldi kaks sammu
 * (kinnitamine + sisselülitamine), sest kogemata avatud öine kanal on täpselt
 * see, mida see funktsioon ei tohi teha.
 */
export async function createUrgentDesk({ prisma, municipalityId, recipientType = "KOV_CONTACT", data = {}, now = () => new Date() }) {
  const region = cleanText(municipalityId, { max: 60 });
  if (!region) fail("urgent_desk.municipality_required");
  const kind = cleanText(recipientType, { max: 40 }).toUpperCase();
  if (!RECIPIENT_TYPES.has(kind)) fail("urgent_desk.recipient_type_invalid");

  const municipality = await prisma.municipality.findFirst({ where: { id: region } });
  if (!municipality) fail("urgent_desk.municipality_not_found");

  const existing = await prisma.urgentDesk.findFirst({
    where: { municipalityId: region, recipientType: kind }
  });
  if (existing) fail("urgent_desk.already_exists");

  const conditions = normalizeConditions(data);
  const at = now();
  return prisma.urgentDesk.create({
    data: {
      municipalityId: region,
      recipientType: kind,
      ...conditions,
      ownerUserId: cleanText(data.ownerUserId, { max: 60 }) || null,
      serviceEntryId: cleanText(data.serviceEntryId, { max: 60 }) || null,
      isActive: false,
      lastVerifiedAt: null,
      createdAt: at,
      updatedAt: at
    }
  });
}

/**
 * Tingimuste muutmine.
 *
 * Iga muudatus kinnitust kandvas väljas nullib `lastVerifiedAt` JA lülitab laua
 * välja. Kaks sammu koos, sest ainult kinnituse nullimine jätaks laua
 * „aktiivseks, aga kinnitamata" — see on segane seis, mida keegi ei märka.
 */
export async function updateUrgentDesk({ prisma, deskId, data = {}, now = () => new Date() }) {
  /* SOL-URG-09: valmidust muutev adminitoiming võtab SAMA luku, mille all
     pöördumise loomine valmidust hindab. Ainult ühel pool lukustamine ei ole
     lukk — teine pool sõidaks lihtsalt mööda ja tingimuse muutmine mahuks
     endiselt kontrolli ja kirjutuse vahele. */
  return prisma.$transaction(async (tx) => {
    const found = await tx.urgentDesk.findFirst({ where: { id: String(deskId || "") } });
    if (!found) fail("urgent_desk.not_found");
    await lockDeskRow(tx, found.id);
    const desk = await tx.urgentDesk.findFirst({ where: { id: found.id } });

    const conditions = normalizeConditions(data, desk);
    const changed = conditionsChanged(desk, conditions);
    const at = now();

    return tx.urgentDesk.update({
      where: { id: desk.id },
      data: {
        ...conditions,
        ownerUserId:
          data.ownerUserId === undefined ? desk.ownerUserId : cleanText(data.ownerUserId, { max: 60 }) || null,
        serviceEntryId:
          data.serviceEntryId === undefined ? desk.serviceEntryId : cleanText(data.serviceEntryId, { max: 60 }) || null,
        ...(changed ? { lastVerifiedAt: null, isActive: false } : {}),
        updatedAt: at
      }
    });
  });
}

/**
 * Partner kinnitab, et tingimused kehtivad täna.
 *
 * Kinnitus on ajatempel, mitte linnuke: ta aegub
 * (`DESK_VERIFICATION_MAX_AGE_DAYS`) ja peab olema uuendatav ilma teksti
 * muutmata.
 */
export async function verifyUrgentDesk({ prisma, deskId, now = () => new Date() }) {
  const desk = await prisma.urgentDesk.findFirst({ where: { id: String(deskId || "") } });
  if (!desk) fail("urgent_desk.not_found");
  const at = now();
  return prisma.urgentDesk.update({
    where: { id: desk.id },
    data: { lastVerifiedAt: at, updatedAt: at }
  });
}

/**
 * Sisse- ja väljalülitamine.
 *
 * Sisselülitamine EI OLE lihtsalt lipu tõstmine: ta keeldub, kui laud ei ole
 * muidu valmis. Muidu saaks tekkida aktiivne laud, mis inimesele kunagi ei
 * avane — ja admin arvaks, et piirkond on lahti.
 *
 * Väljalülitamine ei kontrolli midagi: sulgemine peab alati õnnestuma.
 */
export async function setUrgentDeskActive({ prisma, deskId, isActive, now = () => new Date() }) {
  return prisma.$transaction(async (tx) => {
    const found = await tx.urgentDesk.findFirst({ where: { id: String(deskId || "") } });
    if (!found) fail("urgent_desk.not_found");
    // SOL-URG-09: sulgemine ja avamine on mõlemad valmidust muutvad toimingud.
    await lockDeskRow(tx, found.id);
    const desk = await tx.urgentDesk.findFirst({ where: { id: found.id } });
    const at = now();

    if (isActive !== true) {
      return tx.urgentDesk.update({
        where: { id: desk.id },
        data: { isActive: false, updatedAt: at }
      });
    }

    const activeMemberCount = await tx.urgentDeskMember.count({
      where: { deskId: desk.id, isActive: true }
    });
    // Kontrollime valmidust nii, nagu laud OLEKS juba aktiivne — muidu takistaks
    // `INACTIVE` iseennast ja lauda ei saaks kunagi sisse lülitada.
    const readiness = deskReadiness({ ...desk, isActive: true }, { now: at, activeMemberCount });
    if (!readiness.ready) {
      const error = new UrgentDeskError("urgent_desk.not_ready");
      error.reasons = readiness.reasons;
      throw error;
    }

    return tx.urgentDesk.update({
      where: { id: desk.id },
      data: { isActive: true, updatedAt: at }
    });
  });
}

/** Mehitaja lisamine. Ilma mehitajata laud ei avane (vt `deskReadiness`). */
export async function addUrgentDeskMember({ prisma, deskId, userId }) {
  return prisma.$transaction(async (tx) => {
    const desk = await tx.urgentDesk.findFirst({ where: { id: String(deskId || "") } });
    if (!desk) fail("urgent_desk.not_found");
    // SOL-URG-09: mehitajate arv ON valmiduse osa, seega ta liigub sama luku all.
    await lockDeskRow(tx, desk.id);
    const member = cleanText(userId, { max: 60 });
    if (!member) fail("urgent_desk.member_required");

    const user = await tx.user.findFirst({ where: { id: member } });
    if (!user) fail("urgent_desk.member_not_a_user");

    const existing = await tx.urgentDeskMember.findFirst({ where: { deskId: desk.id, userId: member } });
    if (existing) {
      return tx.urgentDeskMember.update({ where: { id: existing.id }, data: { isActive: true } });
    }
    return tx.urgentDeskMember.create({ data: { deskId: desk.id, userId: member, isActive: true } });
  });
}

/**
 * Mehitaja eemaldamine.
 *
 * Kirje jääb alles (`isActive: false`), sest vastutusjälg viitab inimesele, kes
 * kunagi laua taga istus — ja see jälg peab jääma loetavaks ka pärast seda, kui
 * ta enam ei istu.
 */
export async function removeUrgentDeskMember({ prisma, deskId, userId }) {
  return prisma.$transaction(async (tx) => {
    /* SOL-URG-09: VIIMASE mehitaja eemaldamine on see toiming, mis vana koodi
       juures kõige vaiksemalt tappis laua valmiduse keset kellegi saatmist. */
    await lockDeskRow(tx, String(deskId || ""));
    const existing = await tx.urgentDeskMember.findFirst({
      where: { deskId: String(deskId || ""), userId: String(userId || "") }
    });
    if (!existing) fail("urgent_desk.member_not_found");
    return tx.urgentDeskMember.update({ where: { id: existing.id }, data: { isActive: false } });
  });
}

/**
 * Admini nimekiri: iga laud koos valmiduse ja põhjustega.
 *
 * Siin on nähtav ka see, mida avalik pool ei näe — sest siin istub inimene, kes
 * laua eest vastutab, ja tema peab nägema TÄPSELT, mis on puudu.
 */
export async function listUrgentDesks({ prisma, now = () => new Date() }) {
  const desks = await prisma.urgentDesk.findMany({ orderBy: { createdAt: "asc" }, take: 500 });
  const at = now();
  const rows = [];
  for (const desk of desks) {
    const activeMemberCount = await prisma.urgentDeskMember.count({
      where: { deskId: desk.id, isActive: true }
    });
    const municipality = await prisma.municipality.findFirst({ where: { id: desk.municipalityId } });
    rows.push({
      ...adminDeskProjection(desk, { now: at, activeMemberCount }),
      municipalityName: municipality?.displayName || null
    });
  }
  return rows;
}
