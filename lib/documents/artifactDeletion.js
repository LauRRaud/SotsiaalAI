import { prisma } from "@/lib/prisma"
import { writeDocumentAudit } from "@/lib/documents/audit"

function notFound() {
  const error = new Error("documents.artifacts.errors.not_found")
  error.status = 404
  return error
}

/** Pöördumatu kustutus ja tema kohustuslik audit on üks DB-tehing. */
export async function deleteOwnedArtifactWithAudit(
  { artifact, ownerId },
  { db = prisma } = {}
) {
  return db.$transaction(async (tx) => {
    /* Audit enne DELETE-i: DocumentAudit.artifactId on FK ja ei saa viidata
       juba kustutatud reale. DELETE teeb FK veeru SetNull-iks, seepärast jääb
       stabiilne ID lisaks metaossa. Mõlemad sammud on ikka samas tehingus. */
    await writeDocumentAudit(
      "artifact.deleted",
      {
        userId: ownerId,
        artifactId: artifact.id,
        deletedArtifactId: artifact.id,
        title: artifact.title,
        status: artifact.status
      },
      { db: tx }
    )
    const deleted = await tx.agentArtifact.deleteMany({
      where: { id: artifact.id, ownerId }
    })
    if (deleted.count !== 1) throw notFound()
    return { id: artifact.id }
  })
}
