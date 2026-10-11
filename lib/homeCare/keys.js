/**
 * KODUTEENUS K4-b — võtmeraamat (kava II.6.11).
 *
 * Kliendi kodu võtmel on numbriripats ILMA nime ja aadressita: kadunud võti ei ütle
 * leidjale, kelle ukse see avab. Seos kliendiga on ainult siin. Kirjas on, mis võtmed
 * asutuse käes on, kelle käes iga võti praegu on ja kes selle kellele üle andis.
 *
 * MILLEKS. Hooldaja näeb, mis võtmed tema käes on ja kelle käes on tänase käigu võti.
 * Hooldusjuht näeb päevaplaanis, kui käigu tegijal selle kliendi võtit ei ole (asenduse
 * määramisel on see tavaline põhjus, miks käik ära jääb), ja võtmeraamatus kõiki
 * võtmeid, sealhulgas lõppenud teenusega klientide tagastamata võtmeid.
 *
 * KES. Võtme lisab ja lõpetab (tagastatud kliendile või kadunud) hooldusjuht, kelle
 * skoobis klient on. Üle annab hooldusjuht või see, kelle käes võti parajasti on; saaja
 * on asutuse hooldaja või asutus ise (võti on kontoris). Võtit ei kustutata.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { OrganizationMembershipStatus } from "../org/constants.js";
import { badRequest, conflict, forbidden, notFound } from "../org/errors.js";

import { loadCareWorkerIds } from "./absences.js";
import { assertHomeCareContext, coordinatorScope, isCoordinatorFor, membershipDisplayName, requireClientCoordinator } from "./access.js";
import { CARE_KEY_OUTCOMES, CareClientStatus, HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { asObject, normalizeEnum, normalizeId, normalizeLine, normalizeOptionalId } from "./validation.js";

const KEY_SELECT = Object.freeze({
  id: true,
  clientId: true,
  tag: true,
  label: true,
  holderMembershipId: true,
  holderName: true,
  heldSince: true
});

function serializeKey(row) {
  return {
    id: row.id,
    tag: row.tag,
    label: row.label || null,
    /* `null` tähendab, et võti on asutuses (kontoris), mitte kellegi käes. */
    holder: row.holderMembershipId ? { membershipId: row.holderMembershipId, name: row.holderName || "" } : null,
    heldSince: row.heldSince.toISOString()
  };
}

async function writeKeyAudit(tx, context, clientId, keyId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_KEY_CHANGED,
    resourceType: OrgAuditResource.CARE_KEY,
    resourceId: keyId,
    meta: { organizationId: context.organization.id, clientId, keyId, change }
  });
}

/** Kliendi võtmed, mis on asutuse käes, ripatsi numbri järjekorras. */
export async function loadClientKeysWithin(tx, clientId) {
  const rows = await tx.careKey.findMany({ where: { clientId, closedAt: null }, select: KEY_SELECT, orderBy: [{ tag: "asc" }, { id: "asc" }] });
  return rows.map(serializeKey);
}

/**
 * Kelle käes on klientide võtmed: kliendi ID → `{ holders: Set(liikmesuse ID), names: [nimed], office: kas mõni on kontoris }`.
 * Päevaplaani ja hooldaja päeva jaoks; kliendid, kellel võtmeid ei ole, kaardis puuduvad.
 */
export async function loadKeyHoldersByClient(db, organizationId, clientIds) {
  const ids = [...new Set(clientIds)];
  if (!ids.length) return new Map();
  const rows = await db.careKey.findMany({
    where: { organizationId, clientId: { in: ids }, closedAt: null },
    select: { clientId: true, holderMembershipId: true, holderName: true }
  });
  const byClient = new Map();
  for (const row of rows) {
    if (!byClient.has(row.clientId)) byClient.set(row.clientId, { holders: new Set(), names: [], office: false });
    const entry = byClient.get(row.clientId);
    if (!row.holderMembershipId) entry.office = true;
    else if (!entry.holders.has(row.holderMembershipId)) {
      entry.holders.add(row.holderMembershipId);
      entry.names.push(row.holderName || "");
    }
  }
  return byClient;
}

/**
 * Kas käigu tegijal on selle kliendi võti. `null`: kliendil ei ole võtmeid. Muidu
 * `{ held, holders, office }`: kui tegijal võtit ei ole (või käigul ei ole tegijat),
 * siis kelle käes võtmed on ja kas mõni on kontoris.
 */
export function keyNoteFor(keyHolders, clientId, workerMembershipId) {
  const entry = keyHolders.get(clientId);
  if (!entry) return null;
  if (workerMembershipId && entry.holders.has(workerMembershipId)) return { held: true, holders: [], office: false };
  return { held: false, holders: entry.names.filter(Boolean), office: entry.office };
}

/** Võtmed, mis on selle töötaja käes: ripatsi number, mille võti ja kelle oma. */
export async function loadMyKeys(db, organizationId, membershipId) {
  if (!membershipId) return [];
  const rows = await db.careKey.findMany({
    where: { organizationId, holderMembershipId: membershipId, closedAt: null },
    select: { id: true, tag: true, label: true, heldSince: true, client: { select: { id: true, displayName: true, status: true } } },
    orderBy: [{ tag: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.KEYS_LIST_MAX
  });
  return rows.map((row) => ({
    id: row.id,
    tag: row.tag,
    label: row.label || null,
    heldSince: row.heldSince.toISOString(),
    client: { id: row.client.id, displayName: row.client.displayName },
    /* Teenus on lõppenud: võti tuleb tagastada. */
    clientEnded: row.client.status === CareClientStatus.ENDED
  }));
}

/** Kellele saab võtme anda: asutuse hooldajad. Kontor on valikus eraldi (tühi väärtus). */
export async function loadKeyReceivers(tx, organizationId) {
  return loadCareWorkerIds(tx, organizationId);
}

async function resolveReceiver(tx, organizationId, membershipId) {
  if (!membershipId) return { membershipId: null, name: null };
  const worker = (await loadCareWorkerIds(tx, organizationId)).find((row) => row.membershipId === membershipId);
  if (!worker) throw badRequest("home_care.errors.key_holder_invalid");
  return worker;
}

/** Hooldusjuht võtab võtme arvele: ripatsi number, mille võti ja kelle käes (tühi = kontoris). */
export async function addKey(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const body = asObject(input);
  const tag = normalizeLine(body.tag, HOME_CARE_LIMITS.KEY_TAG_MAX, { required: true, errorKey: "home_care.errors.key_tag_required" });
  const label = normalizeLine(body.label, HOME_CARE_LIMITS.KEY_LABEL_MAX);
  const holderId = normalizeOptionalId(body.holderMembershipId, "home_care.errors.key_holder_invalid");
  const organizationId = context.organization.id;

  try {
    return await db.$transaction(async (tx) => {
      await requireClientCoordinator(tx, context, id, { lock: true, now });
      const open = await tx.careKey.count({ where: { clientId: id, closedAt: null } });
      if (open >= HOME_CARE_LIMITS.KEYS_PER_CLIENT_MAX) throw badRequest("home_care.errors.key_too_many", { limit: HOME_CARE_LIMITS.KEYS_PER_CLIENT_MAX });
      const holder = await resolveReceiver(tx, organizationId, holderId);
      const actorName = await membershipDisplayName(tx, context);
      const created = await tx.careKey.create({
        data: {
          organizationId,
          clientId: id,
          tag,
          label,
          holderMembershipId: holder.membershipId,
          holderName: holder.name,
          heldSince: now,
          createdByMembershipId: context.membership?.id || null,
          createdByName: actorName,
          createdAt: now
        },
        select: { id: true }
      });
      await tx.careKeyHandover.create({
        data: {
          organizationId,
          keyId: created.id,
          fromMembershipId: null,
          fromName: null,
          toMembershipId: holder.membershipId,
          toName: holder.name,
          recordedByMembershipId: context.membership?.id || null,
          recordedByName: actorName,
          createdAt: now
        }
      });
      await writeKeyAudit(tx, context, id, created.id, "added");
      return { keyId: created.id, keys: await loadClientKeysWithin(tx, id) };
    });
  } catch (error) {
    /* Sama numbriga ripats on asutuses juba arvel. */
    if (error?.code === "P2002") throw conflict("home_care.errors.key_tag_taken");
    throw error;
  }
}

async function findOpenKey(tx, organizationId, clientId, keyId) {
  const key = await tx.careKey.findFirst({
    where: { id: keyId, clientId, organizationId },
    select: { id: true, closedAt: true, holderMembershipId: true, holderName: true, client: { select: { unitId: true } } }
  });
  if (!key) throw notFound("home_care.errors.key_not_found");
  if (key.closedAt) throw conflict("home_care.errors.key_closed");
  return key;
}

/**
 * Võtme üleandmine teisele hooldajale või kontorisse (`toMembershipId` tühi). Teeb
 * hooldusjuht, kelle skoobis klient on, või see, kelle käes võti parajasti on.
 */
export async function handOverKey(context, clientId, keyId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const targetId = normalizeId(keyId, "home_care.errors.key_not_found");
  const toId = normalizeOptionalId(asObject(input).toMembershipId, "home_care.errors.key_holder_invalid");
  const organizationId = context.organization.id;
  const actorId = context.membership?.id || null;

  return db.$transaction(async (tx) => {
    const key = await findOpenKey(tx, organizationId, id, targetId);
    const isHolder = Boolean(actorId) && key.holderMembershipId === actorId;
    if (!isHolder && !isCoordinatorFor(context, key.client.unitId)) {
      throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
    }
    if ((toId || null) === (key.holderMembershipId || null)) throw badRequest("home_care.errors.key_same_holder");
    const receiver = await resolveReceiver(tx, organizationId, toId);
    const result = await tx.careKey.updateMany({
      where: { id: targetId, closedAt: null, holderMembershipId: key.holderMembershipId },
      data: { holderMembershipId: receiver.membershipId, holderName: receiver.name, heldSince: now }
    });
    /* Keegi teine andis võtme samal hetkel edasi. */
    if (result.count !== 1) throw conflict("home_care.errors.key_changed");
    await tx.careKeyHandover.create({
      data: {
        organizationId,
        keyId: targetId,
        fromMembershipId: key.holderMembershipId,
        fromName: key.holderName,
        toMembershipId: receiver.membershipId,
        toName: receiver.name,
        recordedByMembershipId: actorId,
        recordedByName: await membershipDisplayName(tx, context),
        createdAt: now
      }
    });
    await writeKeyAudit(tx, context, id, targetId, "handed_over");
    return { keys: await loadClientKeysWithin(tx, id) };
  });
}

/** Hooldusjuht lõpetab võtme: tagastatud kliendile (`RETURNED`) või kadunud (`LOST`). */
export async function closeKey(context, clientId, keyId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const targetId = normalizeId(keyId, "home_care.errors.key_not_found");
  const outcome = normalizeEnum(asObject(input).outcome, CARE_KEY_OUTCOMES, "home_care.errors.key_outcome_invalid");

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    await findOpenKey(tx, context.organization.id, id, targetId);
    await tx.careKey.updateMany({
      where: { id: targetId, closedAt: null },
      data: { closedAt: now, outcome, closedByMembershipId: context.membership?.id || null, closedByName: await membershipDisplayName(tx, context) }
    });
    await writeKeyAudit(tx, context, id, targetId, outcome === "LOST" ? "lost" : "returned");
    return { keys: await loadClientKeysWithin(tx, id) };
  });
}

/**
 * Võtmeraamat hooldusjuhile tema skoobis: kõik asutuse käes olevad võtmed kliendi
 * kaupa. Lõppenud teenusega kliendi võti on märgitud tagastamata võtmeks; võti, mille
 * hoidja liikmesus ei ole enam kehtiv, on samuti märgitud.
 */
export async function getKeyRegister(context, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const scope = coordinatorScope(context);
  if (!scope) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
  const organizationId = context.organization.id;

  const rows = await db.careKey.findMany({
    where: { organizationId, closedAt: null, ...(scope.wholeOrg ? {} : { client: { unitId: { in: scope.unitIds } } }) },
    select: { ...KEY_SELECT, client: { select: { id: true, displayName: true, status: true } } },
    orderBy: [{ tag: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.KEYS_LIST_MAX + 1
  });
  const holderIds = [...new Set(rows.map((row) => row.holderMembershipId).filter(Boolean))];
  const active = holderIds.length
    ? new Set(
        (
          await db.organizationMembership.findMany({
            where: { id: { in: holderIds }, organizationId, status: OrganizationMembershipStatus.ACTIVE },
            select: { id: true }
          })
        ).map((row) => row.id)
      )
    : new Set();

  const keys = rows.slice(0, HOME_CARE_LIMITS.KEYS_LIST_MAX).map((row) => ({
    ...serializeKey(row),
    client: { id: row.client.id, displayName: row.client.displayName, status: row.client.status },
    clientEnded: row.client.status === CareClientStatus.ENDED,
    holderInactive: Boolean(row.holderMembershipId) && !active.has(row.holderMembershipId)
  }));
  const byClientName = (a, b) => a.client.displayName.localeCompare(b.client.displayName, "et") || a.tag.localeCompare(b.tag, "et");
  return {
    total: keys.length,
    truncated: rows.length > HOME_CARE_LIMITS.KEYS_LIST_MAX,
    /* Tagastamata võtmed: teenus on lõppenud, võti on veel asutuse käes. */
    unreturned: keys.filter((key) => key.clientEnded).sort(byClientName),
    keys: keys.filter((key) => !key.clientEnded).sort(byClientName)
  };
}
