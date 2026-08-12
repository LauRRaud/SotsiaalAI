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

import { createHash } from "node:crypto";

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

/**
 * SOL-URG-12 — adminitoimingu JÄLG.
 *
 * `app/api/admin/urgent-desks/**` ei kirjutanud platvormi auditilogisse midagi.
 * Hiljem ei olnud seetõttu tuvastatav, kes avas või sulges kiire abi kanali, kes
 * muutis lubadust ja kes eemaldas viimase mehitaja — need on täpselt need
 * toimingud, mis otsustavad, kas öine abipalve jõuab kellenigi.
 *
 * Jälg käib PÕHIMUUDATUSEGA SAMAS tehingus. Eraldi kirjutus oleks sama viga, mis
 * SOL-URG-05 juures: seis muutub, jälg kaob, ja logi ütleb, et midagi ei
 * juhtunud.
 */
export const UrgentDeskAuditAction = Object.freeze({
  CREATED: "urgent_desk.created",
  CONDITIONS_UPDATED: "urgent_desk.conditions_updated",
  VERIFIED: "urgent_desk.verified",
  ACTIVATED: "urgent_desk.activated",
  DEACTIVATED: "urgent_desk.deactivated",
  MEMBER_ADDED: "urgent_desk.member_added",
  MEMBER_REMOVED: "urgent_desk.member_removed"
});

/**
 * Tegija on KOHUSTUSLIK. Vaikimisi `null` tähendaks „keegi tegi" ja just see
 * seis oli enne: marsruut teadis admini, aga ei andnud teda edasi.
 */
function requireActor(actorUserId) {
  const actor = cleanText(actorUserId, { max: 60 });
  if (!actor) fail("urgent_desk.actor_required");
  return actor;
}

async function recordDeskAudit(tx, { action, deskId, actorUserId, meta = {} }) {
  return tx.dataAuditLog.create({
    data: {
      actorUserId,
      action,
      resourceType: "UrgentDesk",
      resourceId: deskId,
      // Sisu siia EI kirjutata: rida ütleb, kes mida millal tegi.
      meta
    }
  });
}

/**
 * MILLIST teksti kinnitati. Kanooniline ja stabiilne: väljad järjestatud,
 * väärtused normaliseeritud, seega sama tekst annab alati sama räsi.
 */
export function conditionsHash(desk) {
  const canonical = {};
  for (const field of [...VERIFIED_CONDITION_FIELDS].sort()) {
    const value = desk?.[field];
    canonical[field] = typeof value === "boolean" || typeof value === "number"
      ? value
      : String(value ?? "");
  }
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
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
export async function createUrgentDesk({ prisma, municipalityId, recipientType = "KOV_CONTACT", data = {}, actorUserId, now = () => new Date() }) {
  const actor = requireActor(actorUserId);
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
  return prisma.$transaction(async (tx) => {
    const desk = await tx.urgentDesk.create({
      data: {
        municipalityId: region,
        recipientType: kind,
        ...conditions,
        ownerUserId: cleanText(data.ownerUserId, { max: 60 }) || null,
        serviceEntryId: cleanText(data.serviceEntryId, { max: 60 }) || null,
        isActive: false,
        lastVerifiedAt: null,
        lastVerifiedByUserId: null,
        verifiedConditionsHash: null,
        createdAt: at,
        updatedAt: at
      }
    });
    await recordDeskAudit(tx, {
      action: UrgentDeskAuditAction.CREATED,
      deskId: desk.id,
      actorUserId: actor,
      meta: { municipalityId: region, recipientType: kind }
    });
    return desk;
  });
}

/**
 * Tingimuste muutmine.
 *
 * Iga muudatus kinnitust kandvas väljas nullib `lastVerifiedAt` JA lülitab laua
 * välja. Kaks sammu koos, sest ainult kinnituse nullimine jätaks laua
 * „aktiivseks, aga kinnitamata" — see on segane seis, mida keegi ei märka.
 */
export async function updateUrgentDesk({ prisma, deskId, data = {}, actorUserId, now = () => new Date() }) {
  const actor = requireActor(actorUserId);
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

    const updated = await tx.urgentDesk.update({
      where: { id: desk.id },
      data: {
        ...conditions,
        ownerUserId:
          data.ownerUserId === undefined ? desk.ownerUserId : cleanText(data.ownerUserId, { max: 60 }) || null,
        serviceEntryId:
          data.serviceEntryId === undefined ? desk.serviceEntryId : cleanText(data.serviceEntryId, { max: 60 }) || null,
        /* Tingimuse muutmine tühistab kinnituse — ja koos ajaga kaob ka
           KINNITAJA. Vana kinnitaja ei seisa uue teksti taga. */
        ...(changed
          ? { lastVerifiedAt: null, lastVerifiedByUserId: null, verifiedConditionsHash: null, isActive: false }
          : {}),
        updatedAt: at
      }
    });
    await recordDeskAudit(tx, {
      action: UrgentDeskAuditAction.CONDITIONS_UPDATED,
      deskId: desk.id,
      actorUserId: actor,
      // Väljanimed, mitte väärtused: jälg ütleb MIS muutus, mitte mida seal seisis.
      meta: {
        verificationRevoked: changed,
        changedFields: VERIFIED_CONDITION_FIELDS.filter(
          (field) => String(desk?.[field] ?? "") !== String(conditions?.[field] ?? "")
        )
      }
    });
    return updated;
  });
}

/**
 * Partner kinnitab, et tingimused kehtivad täna.
 *
 * Kinnitus on ajatempel, mitte linnuke: ta aegub
 * (`DESK_VERIFICATION_MAX_AGE_DAYS`) ja peab olema uuendatav ilma teksti
 * muutmata.
 */
export async function verifyUrgentDesk({ prisma, deskId, actorUserId, now = () => new Date() }) {
  const actor = requireActor(actorUserId);
  return prisma.$transaction(async (tx) => {
    const found = await tx.urgentDesk.findFirst({ where: { id: String(deskId || "") } });
    if (!found) fail("urgent_desk.not_found");
    await lockDeskRow(tx, found.id);
    const desk = await tx.urgentDesk.findFirst({ where: { id: found.id } });
    const at = now();
    const hash = conditionsHash(desk);

    /* SOL-URG-12: kinnitus on nüüd kolm asja, mitte üks ajatempel — MILLAL, KES
       ja MILLIST teksti. Kaks esimest ütlevad, kes lubaduse taga seisab; kolmas
       vastab tagantjärele ka siis, kui „tingimuse muutmine tühistab kinnituse"
       reegel oleks kunagi katki. */
    const updated = await tx.urgentDesk.update({
      where: { id: desk.id },
      data: {
        lastVerifiedAt: at,
        lastVerifiedByUserId: actor,
        verifiedConditionsHash: hash,
        updatedAt: at
      }
    });
    await recordDeskAudit(tx, {
      action: UrgentDeskAuditAction.VERIFIED,
      deskId: desk.id,
      actorUserId: actor,
      meta: { conditionsHash: hash }
    });
    return updated;
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
export async function setUrgentDeskActive({ prisma, deskId, isActive, actorUserId, now = () => new Date() }) {
  const actor = requireActor(actorUserId);
  return prisma.$transaction(async (tx) => {
    const found = await tx.urgentDesk.findFirst({ where: { id: String(deskId || "") } });
    if (!found) fail("urgent_desk.not_found");
    // SOL-URG-09: sulgemine ja avamine on mõlemad valmidust muutvad toimingud.
    await lockDeskRow(tx, found.id);
    const desk = await tx.urgentDesk.findFirst({ where: { id: found.id } });
    const at = now();

    if (isActive !== true) {
      const closed = await tx.urgentDesk.update({
        where: { id: desk.id },
        data: { isActive: false, updatedAt: at }
      });
      await recordDeskAudit(tx, {
        action: UrgentDeskAuditAction.DEACTIVATED,
        deskId: desk.id,
        actorUserId: actor
      });
      return closed;
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

    const opened = await tx.urgentDesk.update({
      where: { id: desk.id },
      data: { isActive: true, updatedAt: at }
    });
    await recordDeskAudit(tx, {
      action: UrgentDeskAuditAction.ACTIVATED,
      deskId: desk.id,
      actorUserId: actor,
      meta: { activeMemberCount }
    });
    return opened;
  });
}

/** Mehitaja lisamine. Ilma mehitajata laud ei avane (vt `deskReadiness`). */
export async function addUrgentDeskMember({ prisma, deskId, userId, actorUserId }) {
  const actor = requireActor(actorUserId);
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
    const row = existing
      ? await tx.urgentDeskMember.update({ where: { id: existing.id }, data: { isActive: true } })
      : await tx.urgentDeskMember.create({ data: { deskId: desk.id, userId: member, isActive: true } });
    await recordDeskAudit(tx, {
      action: UrgentDeskAuditAction.MEMBER_ADDED,
      deskId: desk.id,
      actorUserId: actor,
      meta: { memberUserId: member, restored: Boolean(existing) }
    });
    return row;
  });
}

/**
 * Mehitaja eemaldamine.
 *
 * Kirje jääb alles (`isActive: false`), sest vastutusjälg viitab inimesele, kes
 * kunagi laua taga istus — ja see jälg peab jääma loetavaks ka pärast seda, kui
 * ta enam ei istu.
 */
export async function removeUrgentDeskMember({ prisma, deskId, userId, actorUserId }) {
  const actor = requireActor(actorUserId);
  return prisma.$transaction(async (tx) => {
    /* SOL-URG-09: VIIMASE mehitaja eemaldamine on see toiming, mis vana koodi
       juures kõige vaiksemalt tappis laua valmiduse keset kellegi saatmist. */
    await lockDeskRow(tx, String(deskId || ""));
    const existing = await tx.urgentDeskMember.findFirst({
      where: { deskId: String(deskId || ""), userId: String(userId || "") }
    });
    if (!existing) fail("urgent_desk.member_not_found");
    const removed = await tx.urgentDeskMember.update({
      where: { id: existing.id },
      data: { isActive: false }
    });
    const remaining = await tx.urgentDeskMember.count({
      where: { deskId: String(deskId || ""), isActive: true }
    });
    await recordDeskAudit(tx, {
      action: UrgentDeskAuditAction.MEMBER_REMOVED,
      deskId: String(deskId || ""),
      actorUserId: actor,
      /* `remaining: 0` on see rida, mille pärast kogu jälg olemas on: viimase
         mehitaja eemaldamine sulgeb piirkonna vaikselt. */
      meta: { memberUserId: String(userId || ""), remainingActiveMembers: remaining }
    });
    return removed;
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
