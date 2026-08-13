/**
 * SOL-SUP-09: konto kustutus eraldab identiteedi jagatud supervisioonitõendist.
 * Jagatud read säilivad; M6 privaatkirjed ja M12 isiklikud pakid jäävad
 * teadlikult User-CASCADE alla ning kustuvad koos kontoga.
 */
export async function tombstoneSupervisionForAccountDeletion(userId, { db, now = new Date() } = {}) {
  const uid = String(userId || "").trim();
  if (!uid || !db) throw new TypeError("userId and database are required");

  // Keep transaction-client writes ordered. Prisma transaction clients share
  // one connection, so parallel writes add no throughput and make failures
  // harder to attribute.
  const supervised = await db.supervisionProcess.updateMany({
    where: { supervisorId: uid },
    data: { supervisorId: null, supervisorErasedAt: now }
  });
  const participations = await db.supervisionParticipation.updateMany({
    where: { userId: uid },
    data: { userId: null, userErasedAt: now }
  });
  const supervisorTopics = await db.supervisionSharedTopic.updateMany({
    where: { authorSupervisorUserId: uid },
    data: { authorSupervisorUserId: null, authorErasedAt: now }
  });

  return {
    supervisedProcessesTombstoned: Number(supervised?.count || 0),
    participationsTombstoned: Number(participations?.count || 0),
    supervisorTopicsTombstoned: Number(supervisorTopics?.count || 0)
  };
}
