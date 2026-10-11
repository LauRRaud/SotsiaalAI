/**
 * KODUTEENUS K1-g — uksesilt.
 *
 * Kliendi ukse kõrval (seespool) on silt QR-koodiga. Hooldaja skannib selle
 * telefoni kaameraga ja jõuab otse õige kliendi lehele: otsida ei ole vaja ja
 * samanimelise kliendi lehte kogemata ei ava. Sama aadressi saab kirjutada ka
 * NFC-kleebisele.
 *
 * SILT EI ANNA LIGIPÄÄSU. Aadressis on juhuslik tunnus, millest ei saa välja
 * lugeda ei asutust, klienti ega nime. Tunnus ütleb ainult, millise kliendi
 * lehte küsitakse; lehe avab ikka ainult sisse logitud töötaja, kes klienti
 * näeb (meeskond, hooldusjuht, põhjusega asendaja). Võõras, kes sildi
 * pildistab, jõuab sisselogimiseni ja sealt edasi mitte kuhugi.
 *
 * ÜKS KEHTIV SILT KLIENDI KOHTA. Uue sildi tegemine tühistab eelmise (kadunud
 * või kopeeritud silt lakkab töötamast). Sildi teeb ja tühistab hooldusjuht.
 * Auditisse läheb ainult sildi ID, mitte tunnus.
 */

import { randomBytes } from "node:crypto";

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { notFound } from "../org/errors.js";
import { getPublicSiteUrl } from "../siteUrl.js";

import { assertHomeCareContext, requireClientAccess, requireClientCoordinator } from "./access.js";
import { encodeQr, qrSvgPath } from "./qr.js";
import { normalizeId } from "./validation.js";

const ACCESS_REASON_REQUIRED = "home_care.errors.access_reason_required";
/** 16 juhuslikku baiti base64url kujul on 22 märki. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export function newDoorTagToken() {
  return randomBytes(16).toString("base64url");
}

export function isDoorTagToken(value) {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/** Sildi aadress: avalik sait ja juhuslik tunnus; asutust ega klienti aadressis ei ole. */
export function doorTagPath(token) {
  return `/org/koduteenus/uks/${token}`;
}

export function doorTagUrl(token, { siteUrl = getPublicSiteUrl() } = {}) {
  return `${String(siteUrl).replace(/\/+$/, "")}${doorTagPath(token)}`;
}

function serializeTag(row, options) {
  if (!row) return null;
  const url = doorTagUrl(row.token, options);
  const qr = qrSvgPath(encodeQr(url).modules);
  return {
    id: row.id,
    createdAt: new Date(row.createdAt).toISOString(),
    url,
    qr
  };
}

async function findActiveTag(tx, context, clientId) {
  return tx.careClientDoorTag.findFirst({
    where: { clientId, organizationId: context.organization.id, revokedAt: null },
    select: { id: true, token: true, createdAt: true }
  });
}

/** Kliendi kehtiv silt (või `null`) koos aadressi ja QR-koodiga. Ainult hooldusjuht. */
export async function getDoorTag(context, clientId, { db = prisma, now = new Date(), env = process.env, siteUrl } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  return db.$transaction(async (tx) => {
    const access = await requireClientCoordinator(tx, context, id, { now });
    return {
      client: { id: access.client.id, displayName: access.client.displayName },
      tag: serializeTag(await findActiveTag(tx, context, id), siteUrl ? { siteUrl } : undefined)
    };
  });
}

/** Teeb uue sildi; eelmine kehtiv silt tühistatakse samas tehingus. */
export async function issueDoorTag(context, clientId, { db = prisma, now = new Date(), env = process.env, siteUrl } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id;
  if (!membershipId) throw notFound("home_care.errors.client_not_found");

  return db.$transaction(async (tx) => {
    /* Kliendi rea lukk: kaks samaaegset „tee uus silt" ei jäta kaht kehtivat silti. */
    await requireClientCoordinator(tx, context, id, { now, lock: true });
    await tx.careClientDoorTag.updateMany({
      where: { clientId: id, organizationId, revokedAt: null },
      data: { revokedAt: now, revokedByMembershipId: membershipId }
    });
    const created = await tx.careClientDoorTag.create({
      data: { organizationId, clientId: id, token: newDoorTagToken(), createdByMembershipId: membershipId, createdAt: now },
      select: { id: true, token: true, createdAt: true }
    });
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_DOOR_TAG_ISSUED,
      resourceType: OrgAuditResource.CARE_DOOR_TAG,
      resourceId: created.id,
      meta: { organizationId, clientId: id, tagId: created.id }
    });
    return { tag: serializeTag(created, siteUrl ? { siteUrl } : undefined) };
  });
}

/** Tühistab kehtiva sildi: selle aadress lakkab töötamast. */
export async function revokeDoorTag(context, clientId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id;
  if (!membershipId) throw notFound("home_care.errors.client_not_found");

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { now, lock: true });
    const active = await findActiveTag(tx, context, id);
    if (!active) return { revoked: false };
    await tx.careClientDoorTag.updateMany({
      where: { id: active.id, revokedAt: null },
      data: { revokedAt: now, revokedByMembershipId: membershipId }
    });
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_DOOR_TAG_REVOKED,
      resourceType: OrgAuditResource.CARE_DOOR_TAG,
      resourceId: active.id,
      meta: { organizationId, clientId: id, tagId: active.id }
    });
    return { revoked: true };
  });
}

/**
 * Sildi tunnuse järgi asutus: suunaja loeb siit, millise asutuse kontekst
 * küsida. Sisse logimata või võõrale ei öelda siin midagi; kutsuja kontrollib
 * liikmesust ja kutsub seejärel `locateDoorTagForViewer`.
 */
export async function findDoorTagOrganization(token, { db = prisma } = {}) {
  if (!isDoorTagToken(token)) return null;
  const tag = await db.careClientDoorTag.findFirst({
    where: { token, revokedAt: null },
    select: { organizationId: true }
  });
  return tag?.organizationId || null;
}

/**
 * Kuhu silt selle vaataja viib. Tagastab kliendi ID siis, kui vaataja klienti
 * näeb VÕI võib selle põhjusega avada (teise kliendi hooldaja: kliendi leht
 * küsib temalt põhjust). Kõigile teistele on silt olematu (404), nagu
 * tühistatud või võõra asutuse silt.
 */
export async function locateDoorTagForViewer(context, token, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  if (!isDoorTagToken(token)) throw notFound("home_care.errors.client_not_found");

  return db.$transaction(async (tx) => {
    const tag = await tx.careClientDoorTag.findFirst({
      where: { token, organizationId: context.organization.id, revokedAt: null },
      select: { clientId: true }
    });
    if (!tag) throw notFound("home_care.errors.client_not_found");
    try {
      await requireClientAccess(tx, context, tag.clientId, { now });
    } catch (error) {
      if (error?.messageKey !== ACCESS_REASON_REQUIRED) throw notFound("home_care.errors.client_not_found");
    }
    return { clientId: tag.clientId };
  });
}
