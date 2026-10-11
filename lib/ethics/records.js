import { createHash } from 'node:crypto';
import { prisma } from '../prisma.js';
import { ETHICS_FIELDS, EthicsError, normalizeEthicsContent, checkedEthicsSnapshot, ethicsAssistantQuestion } from './shared.js';
import { COVISION_STAGE_PHASES } from '../covisionSessionShared.js';

const actor = id => { if (typeof id !== 'string' || !id) throw new EthicsError('unauthorized', 401); return id; };
const version = value => { if (!Number.isSafeInteger(value) || value < 1) throw new EthicsError('conflict', 409); return value; };
const project = row => row && ({ id: row.id, version: row.version, content: row.content, covisionCaseId: row.covisionCaseId,
  sharedText: row.sharedText, sharedAt: row.sharedAt, createdAt: row.createdAt, updatedAt: row.updatedAt });
export async function listEthics(userId, { db = prisma, cursor } = {}) {
  const rows = await db.ethicsReflection.findMany({ where: { ownerUserId: actor(userId), ...(cursor ? { id: { lt: cursor } } : {}) },
    orderBy: { id: 'desc' }, take: 31, select: { id: true, content: true, version: true, updatedAt: true } });
  return { items: rows.slice(0, 30).map(row => ({ id: row.id, title: row.content.title || row.content.question.slice(0, 100), version: row.version, updatedAt: row.updatedAt })),
    nextCursor: rows.length > 30 ? rows[29].id : null };
}
export async function readEthics(userId, id, { db = prisma } = {}) {
  const row = await db.ethicsReflection.findFirst({ where: { id, ownerUserId: actor(userId) } });
  if (!row) throw new EthicsError('missing', 404);
  return project(row);
}
export async function createEthics(userId, input, { db = prisma } = {}) {
  actor(userId);
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(input?.creationKey || '')) throw new EthicsError('invalid');
  const content = normalizeEthicsContent(input.content);
  const creationHash = createHash('sha256').update(JSON.stringify(content)).digest('hex');
  let row;
  try { row = await db.ethicsReflection.create({ data: { ownerUserId: userId, content, creationKey: input.creationKey, creationHash } }); }
  catch (error) {
    if (error.code !== 'P2002') throw error;
    row = await db.ethicsReflection.findFirst({ where: { ownerUserId: userId, creationKey: input.creationKey } });
    if (!row || row.creationHash !== creationHash) throw new EthicsError('conflict', 409);
  }
  return project(row);
}
async function locked(db, userId, id, operation) {
  actor(userId);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "EthicsReflection" WHERE "id" = ${id} AND "ownerUserId" = ${userId} FOR UPDATE`;
    const row = await tx.ethicsReflection.findFirst({ where: { id, ownerUserId: userId } });
    if (!row) throw new EthicsError('missing', 404);
    return operation(tx, row);
  });
}
export async function updateEthics(userId, id, input, { db = prisma } = {}) {
  const expectedVersion = version(input?.expectedVersion), content = normalizeEthicsContent(input.content);
  return locked(db, userId, id, async (tx, row) => {
    if (row.version !== expectedVersion) throw new EthicsError('conflict', 409);
    await tx.ethicsReflection.updateMany({ where: { id, ownerUserId: userId, version: expectedVersion }, data: { content, version: { increment: 1 } } });
    return readEthics(userId, id, { db: tx });
  });
}
export async function deleteEthics(userId, id, expectedVersion, { db = prisma } = {}) {
  version(expectedVersion);
  return locked(db, userId, id, async (tx, row) => {
    if (row.version !== expectedVersion) throw new EthicsError('conflict', 409);
    await tx.ethicsReflection.deleteMany({ where: { id, ownerUserId: userId } });
    return { deleted: true };
  });
}
export async function prepareEthicsAssistant(userId, id, input, { db = prisma } = {}) {
  const row = await readEthics(userId, id, { db });
  if (row.version !== version(input?.expectedVersion)) throw new EthicsError('conflict', 409);
  const text = checkedEthicsSnapshot(row.content.shareDraft, input.confirmed);
  return { question: ethicsAssistantQuestion(text, input.locale), language: ['et', 'en', 'ru'].includes(input.locale) ? input.locale : 'et' };
}
// A frozen copy becomes the owner's PRIVATE stage-2 prefill. Invitations and
// publication remain explicit actions inside the existing Covision workflow.
export async function handoffEthics(userId, id, input, { db = prisma } = {}) {
  const expectedVersion = version(input?.expectedVersion);
  if (input.confirmed !== true) throw new EthicsError('confirmation');
  return locked(db, userId, id, async (tx, row) => {
    if (row.covisionCaseId) return { covisionCaseId: row.covisionCaseId, created: false };
    if (row.version !== expectedVersion) throw new EthicsError('conflict', 409);
    const text = checkedEthicsSnapshot(row.content.shareDraft, input.confirmed), now = new Date();
    const item = await tx.covisionCase.create({ data: { ownerId: userId, title: 'Kovisioon', summary: null,
      anonymizedDescription: null, centralQuestion: null, expectedHelpTypes: ['perspectives'], topics: ['ethics'], tags: ['ethics'],
      status: 'ACTIVE', visibility: 'PRIVATE', anonymityConfirmedAt: now, lastActivityAt: now } });
    const participant = await tx.covisionParticipant.create({ data: { covisionCaseId: item.id, userId, role: 'OWNER', inviteStatus: 'ACCEPTED' } });
    const session = await tx.covisionSessionState.create({ data: { covisionCaseId: item.id, stage: 1, phase: COVISION_STAGE_PHASES[1][0], version: 0 } });
    await tx.covisionParticipantState.create({ data: { sessionId: session.id, participantId: participant.id } });
    await tx.covisionPrivateState.create({ data: { sessionId: session.id, userId, stage: 2, kind: 'case_anchor', content: { text }, version: 0 } });
    await tx.ethicsReflection.updateMany({ where: { id, ownerUserId: userId }, data: { covisionCaseId: item.id, sharedText: text, sharedAt: now, version: { increment: 1 } } });
    return { covisionCaseId: item.id, created: true };
  });
}
export function ethicsExport(row) {
  return { id: row.id, version: row.version, content: Object.fromEntries(['title', ...ETHICS_FIELDS, 'shareDraft'].map(key => [key, row.content?.[key] || ''])),
    sharedText: row.sharedText, sharedAt: row.sharedAt, covisionCaseId: row.covisionCaseId, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
