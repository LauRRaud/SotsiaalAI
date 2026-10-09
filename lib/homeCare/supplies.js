/**
 * KODUTEENUS K4-e — varud kliendi kodus (kava II.6.11).
 *
 * Maal elava kliendi juures on küsimus sageli lihtne: kas küttepuid, joogivett ja toitu
 * jätkub järgmise käiguni. Hooldusjuht lülitab kliendi juures sisse varud, mida
 * jälgitakse, ja kirjutab, kes varu täiendamise eest vastutab (lähedane, hooldaja, vald).
 * Igaüks, kes tohib kliendi lehte avada, märgib varu seisu ühe puudutusega: piisav,
 * hakkab lõppema või otsas, soovi korral märkusega („jätkub umbes kolmeks päevaks").
 *
 * Lõppev ja otsas varu on hooldusjuhi tähtaegade lehel koos vastutajaga, otsas varu ees.
 * Märkimine ise kellelegi teadet ei saada ega ülesannet ei loo.
 *
 * Ravimivaru siin EI OLE: ravimitega seotud märked ootavad omaniku otsust.
 *
 * Jälgitava varu rida ei kustutata (jälgimine lõpetatakse); iga seisu märkimine jätab
 * muutmatu rea, nii et on näha, kes ja millal varu üle vaatas.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { conflict, notFound } from "../org/errors.js";

import { assertHomeCareContext, membershipDisplayName, requireClientAccess, requireClientCoordinator } from "./access.js";
import { CARE_SUPPLY_KINDS, CARE_SUPPLY_STATES, CareSupplyState, HOME_CARE_LIMITS } from "./constants.js";
import { asObject, normalizeEnum, normalizeId, normalizeLine } from "./validation.js";

const SUPPLY_SELECT = Object.freeze({
  id: true,
  kind: true,
  responsible: true,
  state: true,
  stateNote: true,
  checkedAt: true,
  checkedByName: true
});

function serializeSupply(row) {
  return {
    id: row.id,
    kind: row.kind,
    responsible: row.responsible,
    /* `null`: varu jälgitakse, aga seisu ei ole veel keegi märkinud. */
    state: row.state || null,
    stateNote: row.stateNote || null,
    checkedAt: row.checkedAt ? row.checkedAt.toISOString() : null,
    checkedByName: row.checkedByName || null
  };
}

async function writeSupplyAudit(tx, context, clientId, supplyId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_SUPPLY_CHANGED,
    resourceType: OrgAuditResource.CARE_CLIENT_SUPPLY,
    resourceId: supplyId,
    meta: { organizationId: context.organization.id, clientId, supplyId, change }
  });
}

/** Kliendi jälgitavad varud sõnastiku järjekorras. */
export async function loadSuppliesWithin(tx, clientId) {
  const rows = await tx.careClientSupply.findMany({ where: { clientId, endedAt: null }, select: SUPPLY_SELECT });
  return rows.sort((a, b) => CARE_SUPPLY_KINDS.indexOf(a.kind) - CARE_SUPPLY_KINDS.indexOf(b.kind)).map(serializeSupply);
}

/** Otsas varu enne, siis lõppev; sama seisu sees varem märgitud enne. Puhas funktsioon tähtaegade lehe jaoks. */
export function sortOpenSupplies(items) {
  const rank = (item) => (item.state === CareSupplyState.OUT ? 0 : 1);
  return [...items].sort(
    (a, b) => rank(a) - rank(b) || (a.checkedAt < b.checkedAt ? -1 : a.checkedAt > b.checkedAt ? 1 : 0) || a.client.displayName.localeCompare(b.client.displayName, "et")
  );
}

/** Hooldusjuhi tähtaegade lehele: varud, mis hakkavad lõppema või on otsas. `clientWhere` on hooldusjuhi skoop. */
export async function loadOpenSupplies(db, organizationId, clientWhere) {
  const rows = await db.careClientSupply.findMany({
    where: { organizationId, endedAt: null, state: { in: [CareSupplyState.LOW, CareSupplyState.OUT] }, client: clientWhere },
    select: { ...SUPPLY_SELECT, client: { select: { id: true, displayName: true, status: true } } },
    take: HOME_CARE_LIMITS.SUPPLIES_LIST_MAX
  });
  return sortOpenSupplies(rows.map((row) => ({ ...serializeSupply(row), client: { id: row.client.id, displayName: row.client.displayName, status: row.client.status } })));
}

/** Hooldusjuht lülitab kliendi juures sisse varu jälgimise ja kirjutab, kes varu täiendab. */
export async function trackSupply(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const body = asObject(input);
  const kind = normalizeEnum(body.kind, CARE_SUPPLY_KINDS, "home_care.errors.supply_kind_required");
  const responsible = normalizeLine(body.responsible, HOME_CARE_LIMITS.SUPPLY_RESPONSIBLE_MAX, {
    required: true,
    errorKey: "home_care.errors.supply_responsible_required"
  });

  try {
    return await db.$transaction(async (tx) => {
      await requireClientCoordinator(tx, context, id, { lock: true, now });
      const created = await tx.careClientSupply.create({
        data: {
          organizationId: context.organization.id,
          clientId: id,
          kind,
          responsible,
          createdByMembershipId: context.membership?.id || null,
          createdByName: await membershipDisplayName(tx, context),
          createdAt: now
        },
        select: { id: true }
      });
      await writeSupplyAudit(tx, context, id, created.id, "tracked");
      return { supplyId: created.id, supplies: await loadSuppliesWithin(tx, id) };
    });
  } catch (error) {
    /* Seda varu selle kliendi juures juba jälgitakse. */
    if (error?.code === "P2002") throw conflict("home_care.errors.supply_already_tracked");
    throw error;
  }
}

async function findActiveSupply(tx, clientId, supplyId) {
  const row = await tx.careClientSupply.findFirst({ where: { id: supplyId, clientId }, select: { id: true, endedAt: true } });
  if (!row) throw notFound("home_care.errors.supply_not_found");
  if (row.endedAt) throw conflict("home_care.errors.supply_ended");
  return row;
}

/** Hooldusjuht lõpetab varu jälgimise. Rida ja seisude ajalugu jäävad alles. */
export async function untrackSupply(context, clientId, supplyId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const targetId = normalizeId(supplyId, "home_care.errors.supply_not_found");

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    await findActiveSupply(tx, id, targetId);
    await tx.careClientSupply.updateMany({
      where: { id: targetId, endedAt: null },
      data: { endedAt: now, endedByMembershipId: context.membership?.id || null, endedByName: await membershipDisplayName(tx, context) }
    });
    await writeSupplyAudit(tx, context, id, targetId, "untracked");
    return { supplies: await loadSuppliesWithin(tx, id) };
  });
}

/**
 * Varu seisu märkimine: piisav, hakkab lõppema või otsas, soovi korral märkusega. Märgib
 * igaüks, kes tohib kliendi lehte avada (meeskond, põhjusega asendaja, hooldusjuht).
 */
export async function markSupply(context, clientId, supplyId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const targetId = normalizeId(supplyId, "home_care.errors.supply_not_found");
  const body = asObject(input);
  const state = normalizeEnum(body.state, CARE_SUPPLY_STATES, "home_care.errors.supply_state_required");
  const note = normalizeLine(body.note, HOME_CARE_LIMITS.SUPPLY_NOTE_MAX);

  return db.$transaction(async (tx) => {
    await requireClientAccess(tx, context, id, { lock: true, now });
    await findActiveSupply(tx, id, targetId);
    const checkedByMembershipId = context.membership?.id || null;
    const checkedByName = await membershipDisplayName(tx, context);
    await tx.careClientSupply.updateMany({
      where: { id: targetId, endedAt: null },
      data: { state, stateNote: note, checkedAt: now, checkedByMembershipId, checkedByName }
    });
    await tx.careSupplyCheck.create({
      data: { organizationId: context.organization.id, supplyId: targetId, clientId: id, state, note, checkedByMembershipId, checkedByName, createdAt: now }
    });
    await writeSupplyAudit(tx, context, id, targetId, "marked");
    return { supplies: await loadSuppliesWithin(tx, id) };
  });
}
