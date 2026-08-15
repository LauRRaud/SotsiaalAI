import { prisma } from "@/lib/prisma"
import {
  AUDIO_SOURCE_KINDS,
  buildTranscriptFileName,
  buildTranscriptTitle,
  getTranscriptionConfig,
  transcriptKindForAudioSource,
  TRANSCRIPT_DOCUMENT_KINDS,
  serializeAudioSourceDocument
} from "@/lib/documents/audioWorkflow"
import { logDocumentsAudit } from "@/lib/documents/audit"
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import {
  ensureDocumentsStorage,
  errorJson,
  getStoredDocumentPath,
  json,
  localeFromRequest,
  publicErrorMessageKey,
  publicErrorStatus,
  readStoredDocument,
  requireDocumentUser,
  usageErrorJson
} from "@/lib/documents/server"
import { createDocumentWithStagedText } from "@/lib/documents/transcriptContent"
import { claimTranscription } from "@/lib/documents/transcriptionClaim"
import { readAudioDurationSecondsFromBuffer } from "@/lib/audio/duration"
import { runPaidResult } from "@/lib/usage/paidResult"
import { resolveSttCommittedSeconds, resolveSttReservationSeconds } from "@/lib/usage/sttDuration"
import {
  commitUsageForRequest,
  releaseUsageForRequest,
  reserveUsageForRequest
} from "@/lib/usage/routeAdapter"
import {
  completeTranscriptionJob,
  failTranscriptionJob,
  transcribeAudioFile
} from "@/lib/transcription/provider"
import { safeError } from "@/lib/privacy/safeError"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const DOCUMENTS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.DOCUMENTS_RATE_LIMIT_WINDOW_MS, 60_000, 1000)
const TRANSCRIPTION_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.DOCUMENTS_TRANSCRIPTION_RATE_LIMIT_MAX, 6)

async function resolveRouteId(paramsLike) {
  const params = await paramsLike
  return String(params?.id || "").trim()
}

function isAudioDocument(document) {
  if (!AUDIO_SOURCE_KINDS.includes(String(document?.kind || ""))) return false
  const mime = String(document?.mime || "").toLowerCase()
  return mime.startsWith("audio/") || mime === "video/webm" || mime === "video/mp4" || mime === "application/ogg"
}

function serializeTranscriptDocument(document) {
  return {
    id: document.id,
    title: document.title,
    originalName: document.originalName,
    kind: document.kind,
    mime: document.mime,
    size: document.size,
    sourceDocumentId: document.sourceDocumentId || null,
    content: document.content || "",
    metadata: document.metadata || null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  }
}

export async function POST(request, { params }) {
  const locale = localeFromRequest(request)
  const auth = await requireDocumentUser()
  if (!auth?.ok) {
    return errorJson(auth?.message || "api.common.unauthorized", auth?.status || 401, locale, {
      redirect: auth?.redirect,
      requireSubscription: auth?.requireSubscription
    })
  }

  const rateLimitResponse = enforceDocumentsRateLimit(request, {
    scope: "documents_transcription",
    userId: auth.userId,
    limit: TRANSCRIPTION_RATE_LIMIT_MAX,
    windowMs: DOCUMENTS_RATE_LIMIT_WINDOW_MS
  })
  if (rateLimitResponse) return rateLimitResponse

  const id = await resolveRouteId(params)
  if (!id) return errorJson("documents.errors.missing_id", 400, locale)

  let body = {}
  let transcriptionJob = null

  try {
    body = await request.json()
  } catch {}

  const config = getTranscriptionConfig(process.env)
  if (!config.enabled || config.provider === "disabled") {
    return errorJson("documents.errors.transcription_not_configured", 503, locale)
  }

  try {
    const source = await prisma.userDocument.findFirst({
      where: { id, ownerId: auth.userId, fieldVisitAttachments: { none: { storageStatus: { not: "ACTIVE" } } } },
      select: {
        id: true,
        ownerId: true,
        title: true,
        originalName: true,
        kind: true,
        mime: true,
        size: true,
        storagePath: true,
        derivedDocuments: {
          where: { kind: { in: TRANSCRIPT_DOCUMENT_KINDS } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            title: true,
            originalName: true,
            kind: true,
            mime: true,
            size: true,
            sourceDocumentId: true,
            content: true,
            metadata: true,
            createdAt: true,
            updatedAt: true
          }
        },
        callRecordingFiles: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            callSessionId: true,
            recordingRequestId: true,
            durationSeconds: true,
            retentionUntil: true,
            recordingRequest: {
              select: {
                purpose: true,
                purposeText: true,
                callSession: { select: { startedAt: true, endedAt: true } }
              }
            }
          }
        }
      }
    })

    if (!source) return errorJson("documents.errors.not_found", 404, locale)
    if (!isAudioDocument(source)) return errorJson("documents.errors.audio_source_required", 400, locale)

    const existingTranscript = source.derivedDocuments?.[0] || null
    if (existingTranscript) {
      await logDocumentsAudit("document.transcription_reused", {
        userId: auth.userId,
        documentId: existingTranscript.id,
        sourceDocumentId: source.id,
        provider: existingTranscript.metadata?.transcriptionProvider || null,
        model: existingTranscript.metadata?.model || null
      })
      return json({
        ok: true,
        reused: true,
        transcriptDocument: serializeTranscriptDocument(existingTranscript),
        audioSource: serializeAudioSourceDocument(source)
      })
    }

    if (Number(source.size || 0) > config.maxFileSizeBytes) {
      return errorJson("documents.errors.audio_file_too_large", 413, locale, {
        maxFileSizeMb: config.maxFileSizeMb
      })
    }

    const transcriptKind = transcriptKindForAudioSource(source.kind)

    // Maht tuleb reserveerida ENNE teenusepakkuja kutset, seega enne, kui vastus on olemas.
    // Puhver loetakse siin ka kestuse mõõtmiseks: kõnesalvestisel on kestus andmebaasis,
    // muidu loetakse ta failist, ja kui kumbagi ei saa, tuleb baitidest tuletatud ülempiir.
    const buffer = await readStoredDocument(source.storagePath)
    const knownSeconds = Number(source.callRecordingFiles?.[0]?.durationSeconds) || null
    const measuredSeconds = knownSeconds ? null : await readAudioDurationSecondsFromBuffer(buffer, source.mime)
    const reservationSeconds = resolveSttReservationSeconds({
      knownSeconds,
      measuredSeconds,
      sizeBytes: source.size
    })

    // Otsus „kas ma tohin transkribeerida" ja selle jälg tehakse ühes lukustatud tehingus.
    // Varem nägid kaks paralleelset esmakutset MÕLEMAD tühja lauda, kutsusid mõlemad
    // teenusepakkujat ja lõid mõlemad eri transkripti.
    const claim = await claimTranscription({
      sourceDocumentId: source.id,
      ownerId: auth.userId,
      provider: config.provider,
      model: config.model,
      language: body?.language || config.language
    })

    if (claim.outcome === "reused") {
      await logDocumentsAudit("document.transcription_reused", {
        userId: auth.userId,
        documentId: claim.transcript.id,
        sourceDocumentId: source.id,
        provider: claim.transcript.metadata?.transcriptionProvider || null,
        model: claim.transcript.metadata?.model || null
      })
      return json({
        ok: true,
        reused: true,
        transcriptDocument: serializeTranscriptDocument(claim.transcript),
        audioSource: serializeAudioSourceDocument({ ...source, derivedDocuments: [claim.transcript] })
      })
    }

    if (claim.outcome === "busy") {
      return errorJson("documents.errors.transcription_in_progress", 409, locale, {
        jobId: claim.job.id
      })
    }

    transcriptionJob = claim.job

    let usageHandle = null
    try {
      usageHandle = await reserveUsageForRequest({
        request,
        userId: auth.userId,
        metric: "STT_SECONDS",
        amount: reservationSeconds,
        scope: "documents.transcribe",
        idempotencyKey: body?.idempotencyKey,
        metadata: {
          sourceDocumentId: source.id,
          sizeBytes: source.size,
          mimeType: source.mime || null,
          durationSource: knownSeconds ? "call_recording" : measuredSeconds ? "file" : "size_upper_bound"
        }
      })
    } catch (error) {
      return usageErrorJson(error, "documents.transcribe", locale)
    }

    // The claim above makes one audio source idempotent. The usage key is client
    // controlled, though, so reusing a key from another source must not turn an
    // already committed reservation into a free provider call.
    if (usageHandle.reused) {
      const conflict = new Error("api.common.invalid_request")
      conflict.status = 409
      throw conflict
    }

    let transcriptionResult = null

    const { persisted: transcriptDocument } = await runPaidResult({
      reserve: () => usageHandle,
      produce: async () => {
        await logDocumentsAudit("document.transcription_started", {
          userId: auth.userId,
          documentId: source.id,
          jobId: transcriptionJob.id,
          provider: config.provider,
          model: config.model,
          language: body?.language || config.language,
          size: source.size,
          mime: source.mime,
          reservedSeconds: reservationSeconds
        })

        transcriptionResult = await transcribeAudioFile({
          buffer,
          fileName: source.originalName,
          mime: source.mime,
          language: body?.language || config.language,
          env: process.env
        })
        return transcriptionResult
      },
      persist: async (result) => {
        const now = new Date()
        const transcriptFileName = buildTranscriptFileName(now)
        const storagePath = getStoredDocumentPath(transcriptFileName)
        await ensureDocumentsStorage()

        // Fail avaldatakse alles pärast rea loomist. Varem kirjutati ta ENNE `create`-t ja catch
        // ei teadnud loodud teed — DB-vea korral jäi tundlik tekst kettale ilma omaniku- ja
        // retention-reata.
        const created = await createDocumentWithStagedText({
          storagePath,
          content: result.text,
          data: {
            ownerId: auth.userId,
            title: buildTranscriptTitle(now, locale),
            originalName: transcriptFileName,
            kind: transcriptKind,
            agentAllowed: true,
            mime: "text/plain",
            sourceDocumentId: source.id,
            metadata: {
              transcriptionProvider: result.provider,
              model: result.model,
              language: result.language,
              sourceAudioDocumentId: source.id,
              generatedAt: now.toISOString(),
              sourceAudioKind: source.kind,
              sourceAudioMime: source.mime
            }
          },
          select: {
            id: true,
            title: true,
            originalName: true,
            kind: true,
            mime: true,
            size: true,
            sourceDocumentId: true,
            content: true,
            metadata: true,
            createdAt: true,
            updatedAt: true
          }
        })

        await logDocumentsAudit("document.transcription_completed", {
          userId: auth.userId,
          documentId: created.id,
          sourceDocumentId: source.id,
          jobId: transcriptionJob.id,
          provider: result.provider,
          model: result.model,
          language: result.language,
          size: created.size
        })

        await completeTranscriptionJob({
          jobId: transcriptionJob.id,
          transcriptDocumentId: created.id
        })

        return created
      },
      // Reserveeritud oli ülempiir; arvestatakse tegelik kestus, mille teenusepakkuja mõõtis.
      commit: (handle) =>
        commitUsageForRequest(handle, {
          actualAmount: resolveSttCommittedSeconds({
            providerUsage: transcriptionResult?.usage || null,
            knownSeconds,
            measuredSeconds,
            reservedSeconds: reservationSeconds
          })
        }),
      release: (handle, reason) => releaseUsageForRequest(handle, { reason }),
      onReleaseError: (releaseError) =>
        console.error("[documents transcription] usage release failed", safeError(releaseError))
    })

    const refreshedSource = {
      ...source,
      derivedDocuments: [transcriptDocument]
    }

    return json({
      ok: true,
      transcriptDocument: serializeTranscriptDocument(transcriptDocument),
      audioSource: serializeAudioSourceDocument(refreshedSource)
    }, 201)
  } catch (error) {
    const status = publicErrorStatus(error, 502)
    const messageKey = publicErrorMessageKey(error, "documents.errors.transcription_failed")
    if (status >= 500) console.error("[documents transcription] failed", safeError(error))
    if (transcriptionJob?.id) {
      await failTranscriptionJob({
        jobId: transcriptionJob.id,
        error: messageKey
      }).catch(() => {})
    }
    await logDocumentsAudit("document.transcription_failed", {
      userId: auth.userId,
      documentId: id,
      jobId: transcriptionJob?.id || null,
      provider: config.provider,
      model: config.model,
      status
    })
    return errorJson(messageKey, status, locale)
  }
}
