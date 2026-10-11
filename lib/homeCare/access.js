/**
 * KODUTEENUS K1 — kes tohib klienti näha.
 *
 * ÜKS KOHT, KUS OTSUS TEHAKSE. Iga teenusfunktsioon kutsub `requireClientAccess`
 * ja iga päring filtreerib `organizationId: context.organization.id` järgi.
 * Nähtavust EI TULETATA inimese kaudu („minu üksuse töötajate kliendid"): kahes
 * asutuses töötava inimese puhul lekitas selline skoop teise maja kliendinimed
 * (SOL-SLOG-17). Kliendikirje kannab oma organisatsiooni ise.
 *
 * KOLM ALUST:
 *   COORDINATOR — hooldusjuht (`HOME_CARE_COORDINATOR`) kliendi üksuse skoobis;
 *   TEAM        — aktiivne meeskonnarida selle liikmesuse kohta;
 *   REASON      — sama asutuse hooldaja, kes on täna põhjuse andnud.
 *
 * VASTUSE KOOD (reegel `lib/org/errors.js`):
 *   404 — klient ei ole selles asutuses VÕI inimene ei ole hooldaja, kes tohiks
 *         asutuse klientide olemasolust teada;
 *   403 `home_care.errors.access_reason_required` — hooldaja, kes võib klienti
 *         nime järgi leida, aga ei ole meeskonnas ega ole põhjust andnud.
 */

import { hasActiveModule, hasCapability } from "../org/accessContext.js";
import { forbidden, notFound } from "../org/errors.js";
import { unitScopeCovers } from "../org/units.js";
import { estonianDayBounds } from "../time/estonianDay.js";

import {
  CareAccessBasis,
  CareClientStatus,
  HOME_CARE_COORDINATOR,
  HOME_CARE_LIMITS,
  HOME_CARE_MODULE
} from "./constants.js";
import { assertHomeCareEnabled } from "./flags.js";

/**
 * Asutuse ajavöönd. Väli salvestub valideerimata, seega kontrollime siin:
 * vigane väärtus (`Intl` ei tunne) annab Eesti aja, mitte RangeError-i keset
 * päringut.
 */
export function organizationTimeZone(context) {
  const zone = context?.organization?.timezone;
  if (typeof zone !== "string" || !zone) return undefined;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return zone;
  } catch {
    return undefined;
  }
}

/** Lipp + aktiivne moodul. Mõlema puudumine on 404, mitte 403. */
export function assertHomeCareContext(context, { env = process.env } = {}) {
  assertHomeCareEnabled(env);
  if (!hasActiveModule(context, HOME_CARE_MODULE)) throw notFound("org.errors.not_found");
  return true;
}

/**
 * Hooldusjuhi skoop: kogu asutus või üksuste alampuud. Tagastab `null`, kui
 * inimene ei ole üheski skoobis hooldusjuht.
 */
export function coordinatorScope(context) {
  const grants = (context?.capabilities || []).filter((grant) => grant.capability === HOME_CARE_COORDINATOR);
  if (!grants.length) return null;
  if (grants.some((grant) => grant.scopeType === "ORGANIZATION")) return { wholeOrg: true, unitIds: [] };

  const tree = context._unitTree || [];
  const unitIds = new Set();
  for (const grant of grants) {
    if (!grant.scopeUnitId) continue;
    for (const unit of tree) {
      if (unitScopeCovers(grant.scopeUnitId, unit.id, tree)) unitIds.add(unit.id);
    }
  }
  return unitIds.size ? { wholeOrg: false, unitIds: [...unitIds] } : null;
}

export function isCoordinatorAnywhere(context) {
  return Boolean(coordinatorScope(context));
}

export function isCoordinatorFor(context, unitId) {
  return hasCapability(context, HOME_CARE_COORDINATOR, { unitId: unitId || null });
}

/**
 * Loendi skoop: hooldusjuhi kliendid tema skoobis + kliendid, kelle meeskonnas
 * inimene on. Tagastab `null`, kui kumbagi ei ole (kutsuja annab tühja loendi,
 * mitte 403).
 */
export function visibleClientsWhere(context) {
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id;
  const scope = coordinatorScope(context);
  if (scope?.wholeOrg) return { organizationId };

  const clauses = [];
  if (scope?.unitIds.length) clauses.push({ unitId: { in: scope.unitIds } });
  if (membershipId) clauses.push({ team: { some: { membershipId, endedAt: null } } });
  if (!clauses.length) return null;
  return { organizationId, OR: clauses };
}

/**
 * Kas inimene on selles asutuses hooldaja? Hooldusjuht või vähemalt ühe kliendi
 * meeskonna liige. Ainult hooldaja tohib kliente nime järgi otsida ja lehte
 * põhjusega avada: asutuse muu töötaja (nt raamatupidaja) ei pea teadma, kes on
 * koduteenuse kliendid.
 */
export async function isCareWorker(tx, context) {
  if (isCoordinatorAnywhere(context)) return true;
  const membershipId = context.membership?.id;
  if (!membershipId) return false;
  const row = await tx.careClientTeamMember.findFirst({
    where: { membershipId, endedAt: null, client: { organizationId: context.organization.id } },
    select: { id: true }
  });
  return Boolean(row);
}

/** Töötaja nimi kirje ja avamise juurde. Profiilita kontol ametinimetus. */
export async function membershipDisplayName(tx, context) {
  const membershipId = context.membership?.id;
  if (!membershipId) return "";
  const row = await tx.organizationMembership.findFirst({
    where: { id: membershipId, organizationId: context.organization.id },
    select: { jobTitle: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } }
  });
  return personName(row);
}

export function personName(membershipRow) {
  const full = [membershipRow?.user?.profile?.firstName, membershipRow?.user?.profile?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return (full || membershipRow?.jobTitle || "").slice(0, 200);
}

async function lockClientRow(tx, clientId) {
  /* Fake-kliendil testis `$queryRaw`-d ei ole; päris baasil lukustab see rea
     enne lugemist, et kaks kirjutajat ei otsustaks sama seisu pealt. */
  if (typeof tx.$queryRaw !== "function") return;
  await tx.$queryRaw`SELECT "id" FROM "CareClient" WHERE "id" = ${clientId} FOR UPDATE`;
}

const ACCESS_CLIENT_SELECT = Object.freeze({
  id: true,
  organizationId: true,
  unitId: true,
  displayName: true,
  status: true,
  version: true,
  clientErasedAt: true
});

/**
 * Leiab kliendi ja otsustab, mille alusel see inimene teda näeb.
 *
 * @returns {{ client, basis, isCoordinator, isTeam }}
 */
export async function requireClientAccess(tx, context, clientId, { now = new Date(), lock = false } = {}) {
  if (lock) await lockClientRow(tx, clientId);

  const organizationId = context.organization.id;
  const membershipId = context.membership?.id;

  const client = await tx.careClient.findFirst({
    where: { id: clientId, organizationId },
    select: ACCESS_CLIENT_SELECT
  });
  if (!client) throw notFound("home_care.errors.client_not_found");

  if (isCoordinatorFor(context, client.unitId)) {
    return { client, basis: CareAccessBasis.COORDINATOR, isCoordinator: true, isTeam: false };
  }
  if (!membershipId) throw notFound("home_care.errors.client_not_found");

  const teamRow = await tx.careClientTeamMember.findFirst({
    where: { clientId, membershipId, endedAt: null },
    select: { id: true }
  });
  if (teamRow) return { client, basis: CareAccessBasis.TEAM, isCoordinator: false, isTeam: true };

  /* Lõpetatud teenuse päevik jääb meeskonnale ja hooldusjuhile. Asendajal ei
     ole lõpetatud kliendi juurde käiku, seega ei ole ka põhjusega avamist. */
  if (client.status === CareClientStatus.ENDED) throw notFound("home_care.errors.client_not_found");

  /* Põhjusega luba kehtib ainult HOOLDAJALE. Kui inimene eemaldati vahepeal
     oma viimasest meeskonnast, ei ole ta enam hooldaja ja ka tänane luba ei
     kehti: luba ennast tagasi võtta ei saa (rida on muutmatu), seega otsustab
     tema praegune seis. */
  if (!(await isCareWorker(tx, context))) throw notFound("home_care.errors.client_not_found");

  const grant = await tx.careClientAccess.findFirst({
    where: { clientId, membershipId, basis: CareAccessBasis.REASON, validUntil: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: { id: true, reasonCode: true }
  });
  if (grant) {
    return { client, basis: CareAccessBasis.REASON, isCoordinator: false, isTeam: false, reasonCode: grant.reasonCode };
  }
  throw forbidden("home_care.errors.access_reason_required");
}

/** Hooldusjuhi toiming sellel kliendil. Muu = 404/403 nagu `requireClientAccess`. */
export async function requireClientCoordinator(tx, context, clientId, options) {
  const access = await requireClientAccess(tx, context, clientId, options);
  if (!access.isCoordinator) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
  return access;
}

/**
 * Lehe avamise jälg. Sama töötaja sama alusega avamist ei logita vaikse akna
 * jooksul uuesti: muidu täidab lehe värskendamine „viimati avasid" loendi ühe
 * nimega ja peidab teised.
 */
export async function recordClientOpen(tx, context, access, { now = new Date() } = {}) {
  const membershipId = context.membership?.id;
  if (!membershipId) return null;

  const recent = await tx.careClientAccess.findFirst({
    where: {
      clientId: access.client.id,
      membershipId,
      basis: access.basis,
      validUntil: null,
      createdAt: { gt: new Date(now.getTime() - HOME_CARE_LIMITS.ACCESS_LOG_QUIET_MS) }
    },
    select: { id: true }
  });
  if (recent) return null;

  return tx.careClientAccess.create({
    data: {
      organizationId: context.organization.id,
      clientId: access.client.id,
      membershipId,
      actorName: await membershipDisplayName(tx, context),
      basis: access.basis,
      reasonCode: access.basis === CareAccessBasis.REASON ? access.reasonCode || "OTHER" : null,
      createdAt: now
    },
    select: { id: true }
  });
}

/** Põhjusega avamise luba kehtib asutuse kalendripäeva lõpuni. */
export function reasonAccessValidUntil(context, now = new Date()) {
  return estonianDayBounds(now, organizationTimeZone(context)).end;
}
