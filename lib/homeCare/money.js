/**
 * KODUTEENUS K4-c — kliendi sularaha hooldaja käes (kava II.6.11).
 *
 * Klient annab hooldajale sularaha poeskäiguks või arve maksmiseks. Hooldaja paneb
 * kirja, kui palju sai, kui palju kulutas ja kui palju tagastas. Jääk kliendi kaupa on
 * alati näha ja üle nädala lahtine jääk jõuab hooldusjuhi ette. Kirje kaitseb hooldajat,
 * kui hiljem tekib küsimus, kuhu raha jäi.
 *
 * SEE ON ARVESTUS, MITTE MAKSE. Platvorm raha ei liiguta, pangakaardi andmeid ega
 * PIN-koodi ei küsi ega hoia. Summa on sentides täisarvuna, et ümardamist ei tekiks.
 *
 * KES. Rea paneb kirja inimene, kelle käes raha on (hooldaja, kes tohib kliendi lehte
 * avada): tema ise on rea hoidja. Kulutada ja tagastada ei saa rohkem, kui tema käes
 * selle kliendi raha on. Rida ei kustutata: ekslik rida tühistatakse. Tühistab rea
 * autor samal päeval või hooldusjuht; tühistamine ei tohi jääki negatiivseks viia.
 *
 * Oma jääki näeb hooldaja; kõigi hoidjate jääke selle kliendi juures näeb hooldusjuht.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, forbidden, notFound } from "../org/errors.js";

import { assertHomeCareContext, membershipDisplayName, organizationTimeZone, requireClientAccess } from "./access.js";
import { CARE_MONEY_KINDS, CareMoneyKind, HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { daysBetween, todayText } from "./decisions.js";
import { shiftDay } from "./slots.js";
import { asObject, normalizeEnum, normalizeId, normalizeIsoDay, normalizeLine } from "./validation.js";

const MONEY_SELECT = Object.freeze({
  id: true,
  holderMembershipId: true,
  holderName: true,
  kind: true,
  amountCents: true,
  note: true,
  occurredOn: true,
  createdAt: true
});

function pad(value) {
  return String(value).padStart(2, "0");
}

/**
 * Eurod sentideks. Lubab koma või punkti ja kuni kaks kohta pärast seda („12", „12,5",
 * „12.50"). Tagastab positiivse täisarvu või viskab vea; ujukomaarvutust ei kasuta.
 */
export function parseEuroCents(value) {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim().replace(/\s/g, "") : "";
  const match = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(text);
  if (!match) throw badRequest("home_care.errors.money_amount_invalid");
  const cents = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  if (cents < 1 || cents > HOME_CARE_LIMITS.MONEY_AMOUNT_MAX_CENTS) throw badRequest("home_care.errors.money_amount_invalid");
  return cents;
}

/** Jääk sentides: saadud miinus kulutatud ja tagastatud. Tühistatud ridu ei anta kaasa. */
export function balanceOf(rows) {
  return rows.reduce((sum, row) => sum + (row.kind === CareMoneyKind.RECEIVED ? row.amountCents : -row.amountCents), 0);
}

function serializeEntry(row, canRetract) {
  return {
    id: row.id,
    kind: row.kind,
    amountCents: row.amountCents,
    note: row.note || null,
    occurredOn: row.occurredOn,
    holderName: row.holderName || null,
    /* Autor saab oma rea tühistada samal päeval, hooldusjuht igal ajal. */
    canRetract
  };
}

async function writeMoneyAudit(tx, context, clientId, moneyEntryId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_MONEY_CHANGED,
    resourceType: OrgAuditResource.CARE_MONEY_ENTRY,
    resourceId: moneyEntryId,
    meta: { organizationId: context.organization.id, clientId, moneyEntryId, change }
  });
}

async function liveRows(tx, where) {
  return tx.careMoneyEntry.findMany({ where: { ...where, retractedAt: null }, select: MONEY_SELECT, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
}

/**
 * Kliendi lehe vaade: vaataja enda jääk ja viimased read selle kliendi juures.
 * Hooldusjuht näeb kõigi hoidjate viimaseid ridu ja jääke (nullist erinevaid).
 */
export async function loadMoneyWithin(tx, context, access, clientId, today) {
  const membershipId = context.membership?.id || null;
  const timeZone = organizationTimeZone(context);
  const rows = await liveRows(tx, access.isCoordinator ? { clientId } : { clientId, holderMembershipId: membershipId || "" });
  const mine = rows.filter((row) => row.holderMembershipId === membershipId);
  const shown = access.isCoordinator ? rows : mine;
  const holders = new Map();
  if (access.isCoordinator) {
    for (const row of rows) {
      if (!holders.has(row.holderMembershipId)) holders.set(row.holderMembershipId, { membershipId: row.holderMembershipId, name: row.holderName || "", rows: [] });
      holders.get(row.holderMembershipId).rows.push(row);
    }
  }
  return {
    today,
    balanceCents: balanceOf(mine),
    entries: shown
      .slice(-HOME_CARE_LIMITS.MONEY_RECENT_MAX)
      .reverse()
      .map((row) => serializeEntry(row, access.isCoordinator || todayText(row.createdAt, timeZone) === today)),
    holders: [...holders.values()]
      .map((holder) => ({ membershipId: holder.membershipId, name: holder.name, balanceCents: balanceOf(holder.rows), lastOn: holder.rows.at(-1).occurredOn }))
      .filter((holder) => holder.balanceCents !== 0)
      .sort((a, b) => a.name.localeCompare(b.name, "et"))
  };
}

/** Hooldaja avalehele: kliendid, kelle raha on tema käes (jääk üle nulli). */
export async function loadMyMoney(db, organizationId, membershipId) {
  if (!membershipId) return [];
  const rows = await db.careMoneyEntry.findMany({
    where: { organizationId, holderMembershipId: membershipId, retractedAt: null },
    select: { clientId: true, kind: true, amountCents: true, client: { select: { displayName: true } } },
    take: HOME_CARE_LIMITS.MONEY_ROWS_MAX
  });
  const byClient = new Map();
  for (const row of rows) {
    if (!byClient.has(row.clientId)) byClient.set(row.clientId, { client: { id: row.clientId, displayName: row.client.displayName }, rows: [] });
    byClient.get(row.clientId).rows.push(row);
  }
  return [...byClient.values()]
    .map((item) => ({ client: item.client, balanceCents: balanceOf(item.rows) }))
    .filter((item) => item.balanceCents > 0)
    .sort((a, b) => a.client.displayName.localeCompare(b.client.displayName, "et"));
}

/**
 * Hooldusjuhi tähtaegade lehele: jäägid, mis on töötaja käes olnud üle nädala (viimasest
 * reast on möödas rohkem kui `MONEY_OPEN_DAYS` päeva). `clientWhere` on hooldusjuhi skoop.
 */
export async function loadOpenBalances(db, organizationId, clientWhere, today) {
  const rows = await db.careMoneyEntry.findMany({
    where: { organizationId, retractedAt: null, client: clientWhere },
    select: { clientId: true, holderMembershipId: true, holderName: true, kind: true, amountCents: true, occurredOn: true, client: { select: { displayName: true, status: true } } },
    orderBy: [{ occurredOn: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.MONEY_ROWS_MAX
  });
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.clientId}:${row.holderMembershipId}`;
    if (!groups.has(key)) {
      groups.set(key, { client: { id: row.clientId, displayName: row.client.displayName, status: row.client.status }, holderName: row.holderName || "", rows: [] });
    }
    groups.get(key).rows.push(row);
  }
  return [...groups.entries()]
    .map(([key, group]) => {
      const lastOn = group.rows.reduce((latest, row) => (row.occurredOn > latest ? row.occurredOn : latest), "");
      return { key, client: group.client, holderName: group.holderName, balanceCents: balanceOf(group.rows), lastOn, days: daysBetween(lastOn, today) };
    })
    .filter((item) => item.balanceCents > 0 && item.days > HOME_CARE_LIMITS.MONEY_OPEN_DAYS)
    .sort((a, b) => b.days - a.days || a.client.displayName.localeCompare(b.client.displayName, "et"));
}

/**
 * Hooldaja paneb kirja raha, mille klient talle andis (`RECEIVED`), mille ta kliendi
 * heaks kulutas (`SPENT`) või kliendile tagastas (`RETURNED`). Hoidja on kirjutaja ise.
 */
export async function addMoneyEntry(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const body = asObject(input);
  const kind = normalizeEnum(body.kind, CARE_MONEY_KINDS, "home_care.errors.money_kind_required");
  const amountCents = parseEuroCents(body.amount);
  const note = normalizeLine(body.note, HOME_CARE_LIMITS.MONEY_NOTE_MAX);
  /* Kulutuse juures peab olema kirjas, mille peale raha läks. */
  if (kind === CareMoneyKind.SPENT && !note) throw badRequest("home_care.errors.money_note_required");
  const today = todayText(now, organizationTimeZone(context));
  const parts = normalizeIsoDay(body.occurredOn);
  const occurredOn = parts ? `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` : today;
  if (occurredOn > today || occurredOn < shiftDay(today, -HOME_CARE_LIMITS.MONEY_BACK_DAYS)) throw badRequest("home_care.errors.money_day_invalid");
  const membershipId = context.membership?.id || null;

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { lock: true, now });
    if (!membershipId) throw forbidden("home_care.errors.money_holder_required");
    if (kind !== CareMoneyKind.RECEIVED) {
      const held = balanceOf(await liveRows(tx, { clientId: id, holderMembershipId: membershipId }));
      if (amountCents > held) throw badRequest("home_care.errors.money_exceeds_balance", { held: (held / 100).toFixed(2) });
    }
    const created = await tx.careMoneyEntry.create({
      data: {
        organizationId: context.organization.id,
        clientId: id,
        holderMembershipId: membershipId,
        holderName: await membershipDisplayName(tx, context),
        kind,
        amountCents,
        note,
        occurredOn,
        createdAt: now
      },
      select: { id: true }
    });
    await writeMoneyAudit(tx, context, id, created.id, "added");
    return { moneyEntryId: created.id, money: await loadMoneyWithin(tx, context, access, id, today) };
  });
}

/**
 * Tühistab eksliku rea. Autor saab tühistada oma rea samal päeval; hooldusjuht, kelle
 * skoobis klient on, igal ajal. Tühistamine ei tohi hoidja jääki negatiivseks viia.
 */
export async function retractMoneyEntry(context, clientId, moneyEntryId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const targetId = normalizeId(moneyEntryId, "home_care.errors.money_not_found");
  const today = todayText(now, organizationTimeZone(context));
  const timeZone = organizationTimeZone(context);
  const membershipId = context.membership?.id || null;

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { lock: true, now });
    const row = await tx.careMoneyEntry.findFirst({
      where: { id: targetId, clientId: id },
      select: { id: true, holderMembershipId: true, kind: true, amountCents: true, createdAt: true, retractedAt: true }
    });
    /* Võõrast rida hooldaja ei näe: sama vastus mis olematu rea puhul. */
    if (!row || (!access.isCoordinator && row.holderMembershipId !== membershipId)) throw notFound("home_care.errors.money_not_found");
    if (row.retractedAt) throw conflict("home_care.errors.money_retracted");
    if (!access.isCoordinator && todayText(row.createdAt, timeZone) !== today) {
      throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
    }
    if (row.kind === CareMoneyKind.RECEIVED) {
      const held = balanceOf(await liveRows(tx, { clientId: id, holderMembershipId: row.holderMembershipId }));
      if (held - row.amountCents < 0) throw conflict("home_care.errors.money_retract_negative");
    }
    await tx.careMoneyEntry.updateMany({
      where: { id: targetId, retractedAt: null },
      data: { retractedAt: now, retractedByMembershipId: membershipId, retractedByName: await membershipDisplayName(tx, context) }
    });
    await writeMoneyAudit(tx, context, id, targetId, "retracted");
    return { money: await loadMoneyWithin(tx, context, access, id, today) };
  });
}
