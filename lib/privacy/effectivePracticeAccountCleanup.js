function safeSnapshotList(value) {
  return Array.isArray(value) ? value.map(item => String(item || "").trim()).filter(Boolean) : []
}

function practiceScrubData(practice, snapshot) {
  const staysPublished = practice.status === "PUBLISHED"
  return {
    authorId: null,
    title: String(snapshot.title || "Avaldatud praktika").slice(0, 180),
    summary: snapshot.summary || null,
    background: null,
    mainChallenge: null,
    whatHelped: null,
    networkOrServiceRole: null,
    outcome: snapshot.expectedOutcome || null,
    learningPoints: snapshot.learningPoints || null,
    limitations: snapshot.limitations || null,
    sources: snapshot.sources || null,
    suitableContext: snapshot.suitableContext || null,
    conditions: safeSnapshotList(snapshot.conditions),
    steps: safeSnapshotList(snapshot.steps),
    practiceType: snapshot.practiceType || null,
    targetGroups: safeSnapshotList(snapshot.targetGroups),
    environments: safeSnapshotList(snapshot.environments),
    maturityLevel: snapshot.maturityLevel || "confirmed",
    riskLevel: snapshot.riskLevel === "HIGH" ? "HIGH" : "LOW",
    topics: safeSnapshotList(snapshot.topics),
    tags: safeSnapshotList(snapshot.tags),
    sourceClosureId: null,
    sourceCovisionCaseId: null,
    status: staysPublished ? "PUBLISHED" : "ARCHIVED",
    version: { increment: 1 },
    contentVersion: { increment: 1 },
    ownerConfirmedNoIdentifiersAt: null,
    ownerConfirmedNoIdentifiersVersion: null,
    anonymityCheckedAt: null,
    anonymityCheckedVersion: null,
    ...(!staysPublished ? {
      professionalReviewedAt: null,
      reviewedAt: null,
      publishedAt: null,
      nextReviewAt: null,
      ragMetadata: {
        syncStatus: "removal_pending",
        reason: "author_account_deleted",
        checkedAt: new Date().toISOString()
      }
    } : {})
  }
}

async function scrubOrDeleteEffectivePracticesTx(userId, tx) {
  const targets = await tx.effectivePractice.findMany({
    where: { authorId: userId },
    select: { id: true }
  })
  for (const target of targets) {
    let settled = false
    for (let attempt = 0; attempt < 3 && !settled; attempt += 1) {
      const practice = await tx.effectivePractice.findUnique({
        where: { id: target.id },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } }
      })
      if (!practice || practice.authorId !== userId) {
        settled = true
        break
      }
      const cas = {
        id: practice.id,
        authorId: userId,
        version: practice.version,
        status: practice.status,
        publishedVersion: practice.publishedVersion
      }
      const snapshot = practice.versions?.[0]?.publicSnapshot
      if (!practice.publishedVersion || !snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
        const deleted = await tx.effectivePractice.deleteMany({ where: cas })
        settled = deleted?.count === 1
        continue
      }
      if (practice.status !== "PUBLISHED") {
        const refs = new Set([
          practice.ragSourceId,
          `effective-practice::${practice.publicId}::v${practice.publishedVersion}`
        ].filter(Boolean))
        for (const externalRef of refs) {
          const pending = await tx.dataDeletionJob.findFirst({
            where: {
              action: "RAG_DELETE",
              resourceType: "EffectivePractice",
              resourceId: practice.id,
              externalRef,
              status: { in: ["pending", "failed"] }
            },
            select: { id: true }
          })
          if (!pending) {
            await tx.dataDeletionJob.create({
              data: {
                action: "RAG_DELETE",
                resourceType: "EffectivePractice",
                resourceId: practice.id,
                externalRef,
                storagePath: "author_account_deleted",
                status: "pending"
              }
            })
          }
        }
      }
      const updated = await tx.effectivePractice.updateMany({
        where: cas,
        data: practiceScrubData(practice, snapshot)
      })
      settled = updated?.count === 1
      if (settled) {
        await tx.effectivePracticeReview.updateMany({
          where: { practiceId: practice.id },
          data: { authorFeedback: null, privateNotes: null, conflictNote: null }
        })
        await tx.effectivePracticeAuditEvent.updateMany({
          where: {
            practiceId: practice.id,
            action: "REVIEW_JUSTIFICATION",
            justification: { not: null }
          },
          data: { justification: null }
        })
      }
    }
    if (!settled) {
      const error = new Error("effective_practice_cleanup_conflict")
      error.code = "EFFECTIVE_PRACTICE_CLEANUP_CONFLICT"
      throw error
    }
  }
}

export async function scrubOrDeleteEffectivePractices(userId, db) {
  if (!db?.$transaction) throw new TypeError("database is required")
  await db.$transaction(tx => scrubOrDeleteEffectivePracticesTx(userId, tx))
}

export async function deleteUserAfterFinalPracticeSweep(userId, db) {
  if (!db?.$transaction) throw new TypeError("database is required")
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
    await scrubOrDeleteEffectivePracticesTx(userId, tx)
    return tx.user.delete({ where: { id: userId } })
  })
}
