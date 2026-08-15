export async function runUserDeletionCleanup({
  targets = { documents: [], retainedDocuments: [], materialSubmissions: [], artifacts: [], preInquirySourceIds: [] },
  user,
  targetUserId,
  deleteRagReference,
  deleteDocumentFile,
  deleteMaterialFile,
  deleteMaterial = null,
  recordArtifact,
  deleteVerificationTokens,
  deleteVerificationLinkDispatches = async () => {},
  deleteChatLogs,
  deletePrivatePracticeCandidates = async () => {},
  /* JUHTUM-V1 (L17). `CaseWorkAssist.clientUserId` on FK `onDelete: SetNull`,
     seega viide nulliks ka ilma selle sammuta — AGA `clientErasedAt` jääks
     määramata ja kirjesse ei jääks mingit jälge, et seal kunagi kliendiviide
     oli. FK-le lootmine tähendaks vaikset kustutust ilma auditita. */
  eraseCaseWorkClientReferences = async () => ({ erased: 0 }),
  deletePersonalDomainEvents = async () => ({ count: 0 }),
  purgeMeetingSummarySnapshots = async () => ({ ok: true, failures: [] }),
  archiveRetainedDocuments = async () => ({ archived: 0 }),
  deleteUser
} = {}) {
  const counts = {
    documents: targets.documents.length,
    materialSubmissions: targets.materialSubmissions.length,
    artifacts: targets.artifacts.length,
    retainedDocuments: targets.retainedDocuments?.length || 0,
    personalDomainEvents: 0
  }
  if (!user) return { ok: true, alreadyDeleted: true, counts }

  const failures = []
  for (const document of targets.documents) {
    const ragResult = await deleteRagReference(document)
    if (!ragResult?.ok) {
      failures.push({ stage: "rag", resourceType: "UserDocument", resourceId: document.id })
    }
    const fileResult = await deleteDocumentFile(document)
    if (!fileResult?.ok) {
      failures.push({ stage: "file", resourceType: "UserDocument", resourceId: document.id })
    }
  }

  for (const submission of targets.materialSubmissions) {
    const result = deleteMaterial
      ? await deleteMaterial(submission)
      : await deleteMaterialFile(submission)
    if (!result?.ok) {
      failures.push({ stage: result?.stage || "file", resourceType: "MaterialSubmission", resourceId: submission.id })
    }
  }

  for (const artifact of targets.artifacts) await recordArtifact(artifact)

  // Meeting-summary <jobId>.json snapshots carry generated summary text; a failed purge keeps the
  // whole account deletion pending (fail-closed) rather than erasing the user with content left behind.
  const snapshotPurge = await purgeMeetingSummarySnapshots(targetUserId)
  if (!snapshotPurge?.ok) {
    failures.push({ stage: "snapshot", resourceType: "MeetingSummaryJob", resourceId: targetUserId })
  }

  if (failures.length) return { ok: false, failures, counts }

  try {
    const email = String(user.email || "").trim().toLowerCase()
    if (email) await deleteVerificationTokens(email)
    if (email) await deleteVerificationLinkDispatches(email)
    await deleteChatLogs(targetUserId)
    await deletePrivatePracticeCandidates(targetUserId)
    /* ENNE `deleteUser`-it: pärast kasutaja kustutamist ei ole enam mille järgi
       otsida, sest FK on siis juba nullitud. */
    const erasedCaseWork = await eraseCaseWorkClientReferences(targetUserId)
    counts.caseWorkClientReferences = Number(erasedCaseWork?.erased || 0)
    const deletedEvents = await deletePersonalDomainEvents(targets.preInquirySourceIds || [])
    counts.personalDomainEvents = Number(deletedEvents?.count || 0)
    const retained = await archiveRetainedDocuments(targetUserId, targets.retainedDocuments || [])
    counts.retainedDocumentsArchived = Number(retained?.archived || 0)
    const deletedUser = await deleteUser(targetUserId)
    if (deletedUser?.privacyCounts) Object.assign(counts, deletedUser.privacyCounts)
  } catch (error) {
    failures.push({
      stage: "database",
      resourceType: "User",
      resourceId: targetUserId,
      reason: error?.messageKey || error?.code || "database_error"
    })
    return { ok: false, failures, error, counts }
  }

  return { ok: true, counts }
}
