import { prisma } from "@/lib/prisma"
import { TRANSCRIPT_DOCUMENT_KINDS } from "@/lib/documents/audioWorkflow"

/**
 * ÜHE ALLIKA TRANSKRIPTSIOON ON ÜKS TÖÖ (SOL-DOC-06).
 *
 * MIS OLI VALESTI. Marsruut kontrollis esmalt, kas allikal on juba transkript; kui ei olnud, lõi
 * uue job'i, kutsus teenusepakkujat ja lõi seejärel uue dokumendirea. Skeemis ei olnud
 * unikaalsust ei aktiivsele job'ile ega paarile (allikas, transkripti liik). Kahel paralleelsel
 * esmakutsel nägid seega MÕLEMAD „transkripti ei ole", mõlemad kasutasid teenusepakkujat ja
 * mõlemad lõid eri transkripti. Üks kasutajategevus = mitu välist kulu, mitu eri sisuga versiooni
 * ja mitu job'i; liides näitas neist lihtsalt kõige uuemat.
 *
 * MIS SIIN ON. Otsus „kas ma tohin transkribeerida" ja selle otsuse JÄLG (aktiivne job) tehakse
 * ühes tehingus, mille serialiseerib allikapõhine nõuandelukk. Teine päring näeb kas valmis
 * transkripti (ja saab ta tagasi ilma ühegi kutseta) või aktiivset tööd (ja saab 409) — mitte
 * kunagi tühja lauda.
 *
 * NB: `pg_advisory_xact_lock` AINULT `$executeRaw` kaudu.
 *
 * AEGUNUD TÖÖ EI TOHI ALLIKAT IGAVESEKS LUKUSTADA. Protsessi surm jätab `PROCESSING` rea alles;
 * ilma vananemisaknata ei saaks seda faili enam kunagi transkribeerida. Aken on seetõttu osa
 * lepingust, mitte varjatud detail: temast vanem töö loetakse hüljatuks ja uus katse võtab üle.
 */

const ACTIVE_STATUSES = ["QUEUED", "PROCESSING"]

export const TRANSCRIPTION_CLAIM_STALE_MS = 15 * 60 * 1000

const transcriptSelect = {
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

/**
 * @returns `{ outcome: "reused", transcript }` — valmis transkript on olemas;
 *          `{ outcome: "busy", job }` — teine päring töötab juba sama allikaga;
 *          `{ outcome: "claimed", job }` — see päring tohib teenusepakkujat kutsuda.
 */
export async function claimTranscription(
  { sourceDocumentId, ownerId, provider, model, language, staleMs = TRANSCRIPTION_CLAIM_STALE_MS },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceDocumentId})::bigint)`

    const transcript = await tx.userDocument.findFirst({
      where: {
        sourceDocumentId,
        ownerId,
        kind: { in: TRANSCRIPT_DOCUMENT_KINDS }
      },
      orderBy: { createdAt: "desc" },
      select: transcriptSelect
    })
    if (transcript) {
      return { outcome: "reused", transcript }
    }

    const activeSince = new Date(now.getTime() - Math.max(0, staleMs))
    const active = await tx.transcriptionJob.findFirst({
      where: {
        sourceDocumentId,
        status: { in: ACTIVE_STATUSES },
        updatedAt: { gte: activeSince }
      },
      orderBy: { createdAt: "desc" }
    })
    if (active) {
      return { outcome: "busy", job: active }
    }

    // Hüljatud tööd (protsess suri) märgitakse enne ülevõtmist ausalt ebaõnnestunuks, et nad ei
    // jääks igaveseks „aktiivseks" ja et ajaloost oleks näha, mis nendega juhtus.
    await tx.transcriptionJob.updateMany({
      where: {
        sourceDocumentId,
        status: { in: ACTIVE_STATUSES },
        updatedAt: { lt: activeSince }
      },
      data: {
        status: "FAILED",
        error: "documents.errors.transcription_abandoned",
        completedAt: now
      }
    })

    const job = await tx.transcriptionJob.create({
      data: {
        sourceDocumentId,
        requestedByUserId: ownerId,
        provider: provider || "disabled",
        model: model || null,
        language: language || null,
        status: "PROCESSING",
        startedAt: now
      }
    })

    return { outcome: "claimed", job }
  })
}
