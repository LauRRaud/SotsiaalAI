/**
 * KODUTEENUS K1-f — imporditud ajalugu: kliendi senine päevik teisest kohast.
 *
 * Asutus, kes võtab päeviku kasutusele, on seni pidanud kliendi kohta dokumenti
 * (näiteks Drive'is). See tuuakse üle ÜHE tekstina kliendi ajaloo algusesse,
 * märkega „imporditud ajalugu, autorid ja ajad kontrollimata". Tekstist ei
 * tuletata fakte: ei kirjeid, ei kuupäevi, ei autoreid. Otsing leiab selle.
 *
 * MIKS MITTE PÄEVIKU KIRJETENA. Kirjel on autor, sündmuse aeg, liik, nähtavus,
 * lugemismärk ja parandusjälg; imporditud tekstil ei ole neist ühtegi
 * kontrollitud kujul. Kirjetena ujutaks see üle hooldusjuhi „uued kirjed" vaate
 * ja satuks kronoloogiasse, nagu oleks tegu kontrollitud sissekandega. Seepärast
 * on see eraldi tabelis ja eraldi jaotises.
 *
 * ÕIGUSED. Üle toob ja eemaldab hooldusjuht, kelle skoobis klient on. Loeb
 * igaüks, kes klienti parajasti näeb (meeskond, hooldusjuht, põhjusega avaja):
 * see on sama päevik, mida nad seni teises kohas lugesid.
 *
 * SAMA TEKST TEIST KORDA ei lähe: sisu räsi on kliendi piires kordumatu.
 * Auditisse läheb ainult ID.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, notFound } from "../org/errors.js";

import {
  assertHomeCareContext,
  membershipDisplayName,
  recordClientOpen,
  requireClientAccess,
  requireClientCoordinator
} from "./access.js";
import {
  HISTORY_MAX_CHARS,
  HISTORY_TITLE_MAX,
  historyContentHash,
  splitHistoryText
} from "./historyBlocks.js";
import { entrySearchText, entrySearchWhere } from "./search.js";
import { asObject, normalizeId, normalizeLine } from "./validation.js";

const BLOCKS_PAGE = 20;
const SEARCH_RESULTS = 20;
const INSERT_CHUNK = 200;
/* Kuni paar tuhat lõiku ühes tehingus: vaikimisi 5 sekundit jääks napiks. */
const IMPORT_TRANSACTION = Object.freeze({ maxWait: 5_000, timeout: 60_000 });

const HISTORY_SELECT = Object.freeze({
  id: true,
  clientId: true,
  title: true,
  charCount: true,
  blockCount: true,
  importedByName: true,
  createdAt: true
});

function serializeHistory(row) {
  return {
    id: row.id,
    clientId: row.clientId,
    title: row.title,
    charCount: row.charCount,
    blockCount: row.blockCount,
    importedByName: row.importedByName,
    createdAt: new Date(row.createdAt).toISOString()
  };
}

/** Kliendi imporditud ajalood (ainult andmed dokumendi kohta). Kutsuja on ligipääsu juba kontrollinud. */
export async function listHistoriesWithin(tx, context, clientId) {
  const rows = await tx.careImportedHistory.findMany({
    where: { clientId, organizationId: context.organization.id },
    select: HISTORY_SELECT,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 50
  });
  return rows.map(serializeHistory);
}

/**
 * Toob teksti kliendi varasemaks ajalooks. Otsinguabi tehakse sõnade ja
 * tüvedega (ilma morfoloogiata): pika dokumendi iga lõigu algvormide küsimine
 * teeks ületoomise minutite pikkuseks, ja tüved leiavad enamiku vormidest.
 */
export async function importHistory(
  context,
  clientId,
  rawInput = {},
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const body = asObject(rawInput);
  const title = normalizeLine(body.title, HISTORY_TITLE_MAX, {
    required: true,
    errorKey: "home_care.errors.history_title_required"
  });
  const raw = typeof body.text === "string" ? body.text : "";
  if (raw.length > HISTORY_MAX_CHARS) throw badRequest("home_care.errors.history_too_large");
  const blocks = splitHistoryText(raw);
  if (blocks.length === 0) throw badRequest("home_care.errors.history_text_required");
  const contentSha256 = historyContentHash(blocks);
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id;
  if (!membershipId) throw notFound("home_care.errors.client_not_found");

  /* Otsinguabi ENNE tehingut. */
  const searchRows = [];
  for (const text of blocks) searchRows.push(await entrySearchText([text], { analyzer: null }));

  try {
    return await db.$transaction(async (tx) => {
      await requireClientCoordinator(tx, context, id, { now });
      const repeat = await tx.careImportedHistory.findFirst({
        where: { clientId: id, organizationId, contentSha256 },
        select: { id: true }
      });
      if (repeat) throw conflict("home_care.errors.history_already_imported");

      const history = await tx.careImportedHistory.create({
        data: {
          organizationId,
          clientId: id,
          title,
          charCount: blocks.reduce((sum, text) => sum + text.length, 0),
          blockCount: blocks.length,
          contentSha256,
          importedByMembershipId: membershipId,
          importedByName: await membershipDisplayName(tx, context),
          createdAt: now
        },
        select: HISTORY_SELECT
      });
      for (let start = 0; start < blocks.length; start += INSERT_CHUNK) {
        await tx.careImportedHistoryBlock.createMany({
          data: blocks.slice(start, start + INSERT_CHUNK).map((text, offset) => ({
            historyId: history.id,
            organizationId,
            clientId: id,
            position: start + offset + 1,
            text,
            searchText: searchRows[start + offset].searchText,
            searchVersion: searchRows[start + offset].searchVersion
          }))
        });
      }
      await writeOrgAudit(tx, {
        actorUserId: context.userId,
        action: OrgAuditAction.HOME_CARE_HISTORY_IMPORTED,
        resourceType: OrgAuditResource.CARE_IMPORTED_HISTORY,
        resourceId: history.id,
        meta: { organizationId, clientId: id, historyId: history.id }
      });
      return { history: serializeHistory(history) };
    }, IMPORT_TRANSACTION);
  } catch (error) {
    /* Kaks samaaegset sama teksti ületoomist: teine saab sama vastuse mis hilisem kordus. */
    if (error?.code === "P2002") throw conflict("home_care.errors.history_already_imported");
    throw error;
  }
}

/** Ühe imporditud ajaloo lõigud lehekülgede kaupa, teksti järjekorras. */
export async function readHistory(
  context,
  clientId,
  historyId,
  rawQuery = {},
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const historyKey = normalizeId(historyId, "home_care.errors.history_not_found");
  const after = Number.parseInt(asObject(rawQuery).after ?? "0", 10);
  const afterPosition = Number.isInteger(after) && after > 0 ? after : 0;

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    await recordClientOpen(tx, context, access, { now });
    const history = await tx.careImportedHistory.findFirst({
      where: { id: historyKey, clientId: id, organizationId: context.organization.id },
      select: HISTORY_SELECT
    });
    if (!history) throw notFound("home_care.errors.history_not_found");
    const rows = await tx.careImportedHistoryBlock.findMany({
      where: { historyId: history.id, position: { gt: afterPosition } },
      select: { position: true, text: true },
      orderBy: { position: "asc" },
      take: BLOCKS_PAGE + 1
    });
    const items = rows.slice(0, BLOCKS_PAGE);
    return {
      history: serializeHistory(history),
      blocks: items,
      hasMore: rows.length > BLOCKS_PAGE,
      nextAfter: items.length ? items[items.length - 1].position : afterPosition
    };
  });
}

/** Otsing kliendi imporditud ajaloost: samad sõnareeglid mis päeviku otsingul. */
export async function searchHistory(
  context,
  clientId,
  rawInput = {},
  { db = prisma, now = new Date(), env = process.env, analyzer } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const searchAnd = await entrySearchWhere(asObject(rawInput).q, { analyzer });

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    await recordClientOpen(tx, context, access, { now });
    const rows = await tx.careImportedHistoryBlock.findMany({
      where: { clientId: id, organizationId: context.organization.id, AND: searchAnd },
      select: { historyId: true, position: true, text: true, history: { select: { title: true } } },
      orderBy: [{ historyId: "asc" }, { position: "asc" }],
      take: SEARCH_RESULTS + 1
    });
    return {
      items: rows.slice(0, SEARCH_RESULTS).map((row) => ({
        historyId: row.historyId,
        title: row.history.title,
        position: row.position,
        text: row.text
      })),
      hasMore: rows.length > SEARCH_RESULTS
    };
  });
}

/**
 * Eemaldab imporditud ajaloo (vale klient, vale fail). Tekst on koopia; algne
 * dokument on seal, kust see toodi. Ainult hooldusjuht.
 */
export async function removeHistory(
  context,
  clientId,
  historyId,
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const historyKey = normalizeId(historyId, "home_care.errors.history_not_found");
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { now });
    const history = await tx.careImportedHistory.findFirst({
      where: { id: historyKey, clientId: id, organizationId },
      select: { id: true }
    });
    if (!history) throw notFound("home_care.errors.history_not_found");
    await tx.careImportedHistory.delete({ where: { id: history.id } });
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_HISTORY_REMOVED,
      resourceType: OrgAuditResource.CARE_IMPORTED_HISTORY,
      resourceId: history.id,
      meta: { organizationId, clientId: id, historyId: history.id }
    });
    return { removed: true };
  });
}
