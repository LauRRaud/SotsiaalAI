import { prisma } from "@/lib/prisma"
import { getUtf8ByteLength } from "@/lib/storageGuardrails"

export async function getUserStorageUsageBytes(userId) {
  if (!userId) {
    return {
      documentBytes: 0,
      materialBytes: 0,
      artifactBytes: 0,
      totalBytes: 0
    }
  }

  const [documentAgg, materialAgg, artifacts] = await Promise.all([
    prisma.userDocument.aggregate({
      where: {
        ownerId: userId
      },
      _sum: {
        size: true
      }
    }),
    prisma.materialSubmission.aggregate({
      where: {
        submittedByUserId: userId
      },
      _sum: {
        size: true
      }
    }),
    prisma.agentArtifact.findMany({
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
  const artifactBytes = artifacts.reduce((total, artifact) => total + getUtf8ByteLength(artifact?.content), 0)

  return {
    documentBytes,
    materialBytes,
    artifactBytes,
    totalBytes: documentBytes + materialBytes + artifactBytes
  }
}

export async function getUserDailyUploadBytes(userId, since) {
  if (!userId) return 0

  const start = since instanceof Date ? since : new Date(since || Date.now())

  const [documentAgg, materialAgg] = await Promise.all([
    prisma.userDocument.aggregate({
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
    prisma.materialSubmission.aggregate({
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
