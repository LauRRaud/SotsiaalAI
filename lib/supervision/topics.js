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
 * Autor on kas protsessi superviisor või kehtiva kontraktikinnitusega osaleja.
 * Skeem hoiab need eraldi väljadena; superviisorile ei looda võltsosalust.
 * OS† (kinnitamata aktiivne versioon) EI saa jagada (Q2.3). LAHK/KUT → 403.
 */

const AUDIENCES = new Set(["SUPERVISOR_ONLY", "PROCESS"]);

async function requireTopicAuthor(db, processId, userId) {
  const { process, viewer } = await loadProcessForViewer(db, processId, userId);
  if (viewer.role === VIEWER_ROLES.OS_STALE) {
    throw conflict("supervision.errors.contract_not_accepted", "CONTRACT_NOT_ACCEPTED");
  }
  if (![VIEWER_ROLES.SV, VIEWER_ROLES.OS].includes(viewer.role)) {
    throw forbidden("supervision.errors.role_forbidden", "TOPIC_AUTHOR_MUST_BE_PARTICIPANT");
  }
  return { process, viewer };
}

export async function shareTopic({ processId, session, input }, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["title", "body", "audience", "sourcePrivateItemId"]);
  const { process } = await requireTopicAuthor(db, processId, userId);

  const audience = String(input?.audience || "").trim().toUpperCase();
  if (!AUDIENCES.has(audience)) throw invalid("INVALID_AUDIENCE");

  const sourcePrivateItemId = input?.sourcePrivateItemId ? String(input.sourcePrivateItemId).trim() : null;
  const topic = await withSupervisionProcessLock(db, process.id, async (tx) => {
    const { process: freshProcess, viewer: freshViewer } = await requireTopicAuthor(tx, process.id, userId);
    if (freshProcess.status === "CLOSED") {
      throw conflict("supervision.errors.already_closed", "ALREADY_CLOSED");
    }
    let freshSourceItem = null;
    if (sourcePrivateItemId) {
      freshSourceItem = await tx.supervisionPrivateItem.findFirst({
        where: { id: sourcePrivateItemId, ownerUserId: userId, processId: process.id }
      });
      if (!freshSourceItem) throw notFound();
      if (freshSourceItem.sharedTopicId) throw conflict("supervision.errors.conflict", "ALREADY_SHARED");
    }
    const freshTitle = normalizeText(input?.title ?? freshSourceItem?.title, {
      required: true, max: 200, field: "title"
    });
    const freshBody = normalizeText(input?.body ?? freshSourceItem?.body, {
      required: true, max: 50000, field: "body"
    });
    const freshSourceKind = freshSourceItem?.sourceKind === "WELLBEING_HANDOFF" ? "WELLBEING_HANDOFF" : "MANUAL";
    const created = await tx.supervisionSharedTopic.create({
      data: {
        processId: process.id,
        authorParticipationId: freshViewer.role === VIEWER_ROLES.OS ? freshViewer.participation.id : null,
        authorSupervisorUserId: freshViewer.role === VIEWER_ROLES.SV ? userId : null,
        title: freshTitle, body: freshBody, audience, sourceKind: freshSourceKind, status: "SHARED", version: 0
      }
    });
    if (freshSourceItem) {
      await tx.supervisionPrivateItem.update({
        where: { id: freshSourceItem.id }, data: { sharedTopicId: created.id }
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

  // Ainult autor võtab tagasi (Q2.3): osaleja-ID või superviisori kasutaja-ID.
  const { process, viewer } = await loadProcessForViewer(db, topic.processId, userId);
  const isAuthor = (viewer.participation?.id && viewer.participation.id === topic.authorParticipationId)
    || (viewer.role === VIEWER_ROLES.SV && topic.authorSupervisorUserId === userId);
  if (!isAuthor) throw notFound();
  const expectedVersion = requireExpectedVersion(input?.expectedVersion);

  const result = await withSupervisionProcessLock(db, process.id, async (tx) => {
    const { process: freshProcess, viewer: freshViewer } = await loadProcessForViewer(tx, process.id, userId);
    const fresh = await tx.supervisionSharedTopic.findUnique({ where: { id } });
    if (!fresh) throw notFound();
    const isFreshAuthor = (freshViewer.participation?.id && freshViewer.participation.id === fresh.authorParticipationId)
      || (freshViewer.role === VIEWER_ROLES.SV && fresh.authorSupervisorUserId === userId);
    if (!isFreshAuthor) throw notFound();
    if (freshProcess.status === "CLOSED") throw conflict("supervision.errors.already_closed", "ALREADY_CLOSED");
    if (fresh.status === "WITHDRAWN") return fresh; // idempotentne
    if (fresh.version !== expectedVersion) throw staleVersion();
    const updated = await tx.supervisionSharedTopic.update({
      where: { id }, data: { status: "WITHDRAWN", withdrawnAt: now, version: { increment: 1 } }
    });
    await recordSupervisionAudit(tx, {
      action: ACTIONS.TOPIC_WITHDRAWN, actorUserId: userId, processId: process.id,
      targetKind: "shared_topic", targetId: id
    });
    await tx.supervisionProcess.update({ where: { id: process.id }, data: { lastActivityAt: now } });
    return updated;
  });
  return { ok: true, topic: serializeTopic(result) };
}
