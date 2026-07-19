import {
  assertAllowedKeys,
  invalid,
  normalizeText,
  notFound,
  requireExpectedVersion,
  requireSupervisionUser,
  resolveDb,
  staleVersion,
  withSupervisionProcessLock
} from "./shared.js";
import { loadProcessForViewer } from "./service.js";
import { VIEWER_ROLES } from "./serializers.js";
import { serializePrivateItem } from "./serializersPrivate.js";

/**
 * M6 eeskamber (Q2.2 M6, Q2.4 read 14–15). AINULT omanik: superviisor EI näe
 * osaleja oma, ADMIN EI näe kellegi oma (404, EI möödu). Eraldi privaat-
 * serializer (serializersPrivate.js); ükski jagatud vaade EI impordi seda.
 * M6 toimingud EI kirjuta M13 auditit (privaatsisu; sisuvaba invariant kaaluks
 * üles) ega saada teavitust.
 */

const PRIVATE_ITEM_KINDS = new Set(["PREP_TOPIC", "PRIVATE_NOTE", "CLOSING_REFLECTION"]);
// Liikmerollid, kel on eeskamber. LAHK = read-only (OMA vanad); KUT/VÕÕR → 404.
const WRITE_ROLES = new Set([VIEWER_ROLES.SV, VIEWER_ROLES.OS, VIEWER_ROLES.OS_STALE]);

async function requireEeskamberProcess(db, processId, userId, { write }) {
  const { process, viewer } = await loadProcessForViewer(db, processId, userId);
  const canWrite = WRITE_ROLES.has(viewer.role);
  const canRead = canWrite || viewer.role === VIEWER_ROLES.LAHK;
  if (write ? !canWrite : !canRead) throw notFound();
  return { process, viewer };
}

/**
 * Laeb OMA eeskambri kirje ühetaolise 404 all: võõra omaniku või olematu id
 * annab sama 404 (skoobitud päring ownerUserId järgi). Kasutavad update/delete.
 */
async function loadOwnItem(db, itemId, userId) {
  const id = String(itemId || "").trim();
  if (!id) throw notFound();
  const item = await db.supervisionPrivateItem.findFirst({ where: { id, ownerUserId: userId } });
  if (!item) throw notFound();
  return item;
}

export async function listPrivateItems({ processId, session }, options = {}) {
  const db = resolveDb(options);
  const { userId } = requireSupervisionUser(session);
  const { process } = await requireEeskamberProcess(db, processId, userId, { write: false });
  const items = await db.supervisionPrivateItem.findMany({
    where: { processId: process.id, ownerUserId: userId },
    orderBy: [{ updatedAt: "desc" }]
  });
  return { ok: true, items: items.map(serializePrivateItem) };
}

export async function createPrivateItem({ processId, session, input }, options = {}) {
  const db = resolveDb(options);
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["kind", "title", "body"]);
  const { process } = await requireEeskamberProcess(db, processId, userId, { write: true });

  const kind = String(input?.kind || "").trim().toUpperCase();
  if (!PRIVATE_ITEM_KINDS.has(kind)) throw invalid("INVALID_KIND");
  const title = normalizeText(input?.title, { max: 200, field: "title" });
  const body = normalizeText(input?.body, { required: true, max: 50000, field: "body" });

  const item = await db.supervisionPrivateItem.create({
    data: { processId: process.id, ownerUserId: userId, kind, title, body, sourceKind: "MANUAL", version: 0 }
  });
  return { ok: true, item: serializePrivateItem(item) };
}

export async function updatePrivateItem({ itemId, session, input }, options = {}) {
  const db = resolveDb(options);
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["title", "body", "expectedVersion"]);
  const item = await loadOwnItem(db, itemId, userId);
  const expectedVersion = requireExpectedVersion(input?.expectedVersion);

  const data = {};
  if (input.title !== undefined) data.title = normalizeText(input.title, { max: 200, field: "title" });
  if (input.body !== undefined) data.body = normalizeText(input.body, { required: true, max: 50000, field: "body" });
  if (Object.keys(data).length === 0) throw invalid("EMPTY_PATCH");

  const updated = await withSupervisionProcessLock(db, item.processId, async (tx) => {
    const fresh = await tx.supervisionPrivateItem.findFirst({ where: { id: item.id, ownerUserId: userId } });
    if (!fresh) throw notFound();
    if (fresh.version !== expectedVersion) throw staleVersion();
    return tx.supervisionPrivateItem.update({
      where: { id: item.id }, data: { ...data, version: { increment: 1 } }
    });
  });
  return { ok: true, item: serializePrivateItem(updated) };
}

export async function deletePrivateItem({ itemId, session }, options = {}) {
  const db = resolveDb(options);
  const { userId } = requireSupervisionUser(session);
  const item = await loadOwnItem(db, itemId, userId);
  await withSupervisionProcessLock(db, item.processId, async (tx) => {
    const fresh = await tx.supervisionPrivateItem.findFirst({ where: { id: item.id, ownerUserId: userId } });
    if (!fresh) throw notFound();
    await tx.supervisionPrivateItem.delete({ where: { id: item.id } });
  });
  return { ok: true, deleted: true };
}
