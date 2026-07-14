export async function runUserDeletionCleanup({
  targets = { documents: [], materialSubmissions: [], artifacts: [] },
  user,
  targetUserId,
  deleteRagReference,
  deleteDocumentFile,
  deleteMaterialFile,
  recordArtifact,
  deleteVerificationTokens,
  deleteChatLogs,
  deletePrivatePracticeCandidates = async () => {},
  deleteUser
} = {}) {
  const counts = {
    documents: targets.documents.length,
    materialSubmissions: targets.materialSubmissions.length,
    artifacts: targets.artifacts.length
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
    const fileResult = await deleteMaterialFile(submission)
    if (!fileResult?.ok) {
      failures.push({ stage: "file", resourceType: "MaterialSubmission", resourceId: submission.id })
    }
  }

  for (const artifact of targets.artifacts) await recordArtifact(artifact)

  if (failures.length) return { ok: false, failures, counts }

  try {
    const email = String(user.email || "").trim().toLowerCase()
    if (email) await deleteVerificationTokens(email)
    await deleteChatLogs(targetUserId)
    await deletePrivatePracticeCandidates(targetUserId)
    await deleteUser(targetUserId)
  } catch (error) {
    failures.push({ stage: "database", resourceType: "User", resourceId: targetUserId })
    return { ok: false, failures, error, counts }
  }

  return { ok: true, counts }
}
