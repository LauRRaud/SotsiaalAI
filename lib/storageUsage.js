import { prisma } from "./prisma.js"
import { getUtf8ByteLength } from "./storageGuardrails.js"

/* SOL-CALL-10 — `db` on süstitav, sest kõneteenus saab oma Prisma-kliendi
   parameetrina. Ilma selleta oleks kvoodilugeja lugenud GLOBAALSEST singletonist
   ja teenus kirjutanud oma kliendiga: kaks erinevat andmebaasi ühes otsuses.
   Vaikeväärtus on endine singleton, seega ükski olemasolev kutsuja ei muutu. */
export async function getUserStorageUsageBytes(userId, { db = prisma } = {}) {
  if (!userId) {
    return {
      documentBytes: 0,
      materialBytes: 0,
      artifactBytes: 0,
      artifactSnapshotBytes: 0,
      totalBytes: 0
    }
  }

  /* SOL-DOC-08 — salvestatud analüüsid kuuluvad SIIA. Nad võivad olla kuni 200 000 baiti tükk ja
     `createSavedAnalysis()` kontrollis nende vastu kasutaja üldist mahtu — aga see summa neid ei
     lugenud, seega ei muutnud ükski salvestatud analüüs järgmise kontrolli sisendit. Kasutaja sai
     järjest salvestada piiramatult, ilma 413-ta, ja kasutusülevaade alahindas tegelikku mahtu. */
  const [documentAgg, materialAgg, snapshotAgg, artifacts, analyses] = await Promise.all([
    db.userDocument.aggregate({
      where: {
        ownerId: userId
      },
      _sum: {
        size: true
      }
    }),
    db.materialSubmission.aggregate({
      where: {
        submittedByUserId: userId
      },
      _sum: {
        size: true
      }
    }),
    db.agentArtifactFinalSnapshot.aggregate({
      where: { artifact: { ownerId: userId } },
      _sum: { totalBytes: true }
    }),
    db.agentArtifact.findMany({
      where: {
        ownerId: userId
      },
      select: {
        content: true
      }
    }),
    db.savedAnalysis.findMany({
      where: {
        ownerId: userId
      },
      select: {
        content: true
      }
    })
  ])

  const documentBytes = Number(documentAgg?._sum?.size || 0)
  const materialBytes = Number(materialAgg?._sum?.size || 0)
  const artifactSnapshotBytes = Number(snapshotAgg?._sum?.totalBytes || 0)
  const artifactBytes = artifacts.reduce((total, artifact) => total + getUtf8ByteLength(artifact?.content), 0)
  const analysisBytes = analyses.reduce((total, analysis) => total + getUtf8ByteLength(analysis?.content), 0)

  return {
    documentBytes,
    materialBytes,
    artifactBytes,
    artifactSnapshotBytes,
    analysisBytes,
    totalBytes: documentBytes + materialBytes + artifactBytes + artifactSnapshotBytes + analysisBytes
  }
}

export async function getUserDailyUploadBytes(userId, since, { db = prisma } = {}) {
  if (!userId) return 0

  const start = since instanceof Date ? since : new Date(since || Date.now())

  const [documentAgg, materialAgg] = await Promise.all([
    db.userDocument.aggregate({
      where: {
        ownerId: userId,
        createdAt: {
          gte: start
        }
      },
      _sum: {
        size: true
      }
    }),
    db.materialSubmission.aggregate({
      where: {
        submittedByUserId: userId,
        createdAt: {
          gte: start
        }
      },
      _sum: {
        size: true
      }
    })
  ])

  return Number(documentAgg?._sum?.size || 0) + Number(materialAgg?._sum?.size || 0)
}
