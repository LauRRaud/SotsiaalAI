/**
 * SOL-COV-01: reusable email addresses must never inherit an old participant.
 * The row remains as content-free participation evidence, but every access
 * carrier is made terminal in the same transaction as User deletion.
 */
export async function tombstoneCovisionParticipationForAccountDeletion(
  userId,
  { db, now = new Date() } = {}
) {
  const uid = String(userId || "").trim();
  if (!uid || !db) throw new TypeError("userId and database are required");
  const erasedAt = now;
  const user = db.user?.findUnique
    ? await db.user.findUnique({ where: { id: uid }, select: { role: true } })
    : null;
  const ownerSnapshot = String(user?.role || "ERASED_USER").slice(0, 80);
  const cases = db.covisionCase?.updateMany
    ? await db.covisionCase.updateMany({
        where: { ownerId: uid },
        data: { ownerRoleSnapshot: ownerSnapshot, ownerErasedAt: erasedAt }
      })
    : { count: 0 };
  const closures = db.covisionClosure?.updateMany
    ? await db.covisionClosure.updateMany({
        where: { ownerId: uid },
        data: { ownerRoleSnapshot: ownerSnapshot, ownerErasedAt: erasedAt }
      })
    : { count: 0 };
  const result = await db.covisionParticipant.updateMany({
    where: { userId: uid },
    data: {
      userId: null,
      email: null,
      inviteStatus: "EXPIRED",
      inviteExpiresAt: now,
      decisionAt: now,
      identityErasedAt: now
    }
  });
  return {
    participationsTombstoned: Number(result?.count || 0),
    ownedCasesRetained: Number(cases?.count || 0),
    ownedClosuresRetained: Number(closures?.count || 0)
  };
}
