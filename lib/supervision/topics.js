import {
  SUPERVISION_ACTIONS as ACTIONS,
  assertAllowedKeys,
  conflict,
  forbidden,
  invalid,
  normalizeText,
  notFound,
  recordSupervisionAudit,
  requireExpectedVersion,
  requireSupervisionUser,
  resolveDb,
  staleVersion,
  withSupervisionProcessLock
} from "./shared.js";
import { loadProcessForViewer } from "./service.js";
import { VIEWER_ROLES, serializeTopic } from "./serializers.js";

/**
 * M7 teadlik jagamine (Q2.2 M7, Q2.4 read 16–17). Jagamine = KÜLMUTATUD KOOPIA
 * jagamishetkel (manifest ON kirje ise); hilisem M6 muudatus EI levi. Audience
 * SUPERVISOR_ONLY / PROCESS. TOPIC_SHARED audit kannab AINULT topicId + audience,
 * MITTE sisu (test #8/#15).
 *
 * AUTOREERIMISPIIRANG (skeem): M7.authorParticipationId on NOT NULL FK osalusele,
 * seega V0-s autoreerivad teemasid AINULT osalejad (OS kehtiva kontraktikinnitusega).
 * Superviisor on M7 puhul alati LUGEJA (Q2.2 M7 „autor + superviisor alati"
 * eristab autori ja superviisori). OS† (kinnitamata aktiivne versioon) EI saa
 * jagada (Q2.3). SV/LAHK → 403.
 */

const AUDIENCES = new Set(["SUPERVISOR_ONLY", "PROCESS"]);

async function requireTopicAuthor(db, processId, userId) {
  const { process, viewer } = await loadProcessForViewer(db, processId, userId);
  if (viewer.role === VIEWER_ROLES.OS_STALE) {
    throw conflict("supervision.errors.contract_not_accepted", "CONTRACT_NOT_ACCEPTED");
  }
  if (viewer.role !== VIEWER_ROLES.OS) {
    throw forbidden("supervision.errors.role_forbidden", "TOPIC_AUTHOR_MUST_BE_PARTICIPANT");
  }
  return { process, viewer };
}

export async function shareTopic({ processId, session, input }, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["title", "body", "audience", "sourcePrivateItemId"]);
  const { process, viewer } = await requireTopicAuthor(db, processId, userId);

  const audience = String(input?.audience || "").trim().toUpperCase();
  if (!AUDIENCES.has(audience)) throw invalid("INVALID_AUDIENCE");

  const sourcePrivateItemId = input?.sourcePrivateItemId ? String(input.sourcePrivateItemId).trim() : null;
  let sourceItem = null;
  if (sourcePrivateItemId) {
    // Ainult OMA eeskambri kirje, samas protsessis (ühetaoline 404).
    sourceItem = await db.supervisionPrivateItem.findFirst({
      where: { id: sourcePrivateItemId, ownerUserId: userId, processId: process.id }
    });
    if (!sourceItem) throw notFound();
    if (sourceItem.sharedTopicId) throw conflict("supervision.errors.conflict", "ALREADY_SHARED");
  }

  // Külmutatud koopia: väärtused kopeeritakse NÜÜD; M6 hilisem muudatus ei levi.
  const title = normalizeText(input?.title ?? sourceItem?.title, { required: true, max: 200, field: "title" });
  const body = normalizeText(input?.body ?? sourceItem?.body, { required: true, max: 50000, field: "body" });
  const sourceKind = sourceItem?.sourceKind === "WELLBEING_HANDOFF" ? "WELLBEING_HANDOFF" : "MANUAL";

  const topic = await withSupervisionProcessLock(db, process.id, async (tx) => {
    const created = await tx.supervisionSharedTopic.create({
      data: {
        processId: process.id,
        authorParticipationId: viewer.participation.id,
        title, body, audience, sourceKind, status: "SHARED", version: 0
      }
    });
    if (sourceItem) {
      await tx.supervisionPrivateItem.update({
        where: { id: sourceItem.id }, data: { sharedTopicId: created.id }
      });
    }
    await recordSupervisionAudit(tx, {
      action: ACTIONS.TOPIC_SHARED, actorUserId: userId, processId: process.id,
      targetKind: "shared_topic", targetId: created.id, metadata: { audience }
    });
    await tx.supervisionProcess.update({ where: { id: process.id }, data: { lastActivityAt: now } });
    return created;
  });
  return { ok: true, topic: serializeTopic(topic) };
}

export async function withdrawTopic({ topicId, session, input }, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["expectedVersion"]);
  const id = String(topicId || "").trim();
  if (!id) throw notFound();
  const topic = await db.supervisionSharedTopic.findUnique({ where: { id } });
  if (!topic) throw notFound();

  // Ainult autor võtab tagasi (Q2.3): kontrolli, et vaataja osalus == autor.
  const { process, viewer } = await loadProcessForViewer(db, topic.processId, userId);
  if (!viewer.participation || viewer.participation.id !== topic.authorParticipationId) throw notFound();
  const expectedVersion = requireExpectedVersion(input?.expectedVersion);

  const result = await withSupervisionProcessLock(db, process.id, async (tx) => {
    const fresh = await tx.supervisionSharedTopic.findUnique({ where: { id } });
    if (!fresh) throw notFound();
    if (fresh.status === "WITHDRAWN") return fresh; // idempotentne
    if (fresh.version !== expectedVersion) throw staleVersion();
    const updated = await tx.supervisionSharedTopic.update({
      where: { id }, data: { status: "WITHDRAWN", withdrawnAt: now, version: { increment: 1 } }
    });
    await recordSupervisionAudit(tx, {
      action: ACTIONS.TOPIC_WITHDRAWN, actorUserId: userId, processId: process.id,
      targetKind: "shared_topic", targetId: id
    });
    return updated;
  });
  return { ok: true, topic: serializeTopic(result) };
}
