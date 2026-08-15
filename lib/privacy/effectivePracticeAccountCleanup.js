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
    const anonymized = tx.preInquiry?.updateMany
      ? await tx.preInquiry.updateMany({
          where: { authorId: userId, sentAt: { not: null } },
          data: {
            authorId: null,
            authorErasedAt: new Date(),
            topic: null,
            situation: "",
            assessmentState: Prisma.DbNull,
            generatedDraft: null,
            userEditedDraft: null
          }
        })
      : { count: 0 }
    /* SOL-PRE-01 — SAATMATA MUSTANDID KUSTUTATAKSE, MITTE EI PUHASTATA.
     *
     * Ülalolev `updateMany` puudutab ainult ridu tingimusega `sentAt != null`.
     * Saatmata `DRAFT`/`READY` read jäid puutumata — ja kuna `PreInquiry.authorId`
     * on `SetNull`, ei kustutanud neid ka kaskaad. Inimese olukorrakirjeldus,
     * eelkaardistus ja võimalik KOLMANDA ISIKU info jäid andmebaasi autorita
     * orvuks määramata ajaks.
     *
     * Vahe saadetud reaga on sisuline, mitte tehniline: saadetud eelpöördumine on
     * jõudnud teise inimeseni ja tema töö kohta jääb vastutusjälg. Saatmata mustand
     * ei ole kellegi teise juures olnud — tema kohta ei ole midagi, mille eest
     * vastutada. Seepärast: saadetu puhastatakse, saatmata kustutatakse.
     *
     * Ka see kutse on TINGIMUSETA (vt SOL-URG-02 põhjendust allpool).
     */
    const draftsDeleted = await tx.preInquiry.deleteMany({
      where: { authorId: userId, sentAt: null }
    })

    const receiverNotesCleared = tx.preInquiry?.updateMany
      ? await tx.preInquiry.updateMany({
          where: { recipientOwnerId: userId },
          data: { receiverNote: null, receiverChecklist: null, nextContactOn: null }
        })
      : { count: 0 }

    /* SOL-URG-02 — KIIRE ABI PÖÖRDUMISED JÄID SIIT VÄLJA.
     *
     * `UrgentRequest.authorId` on `SetNull`, seega konto kustutamisel kadus
     * ainult VIIDE. Alles jäid `situationVerbatim` (inimese enda sõnad kõige
     * haavatavamal hetkel), `contactName` ja `contactPhone` — otseselt tuvastav
     * nimi ja telefon. Kustutus vastas sellegipoolest `ok: true`. Skeemis oli
     * `authorErasedAt` juba olemas ja seda rada ei kirjutanud KEEGI: väli ilma
     * mehhanismita on lubadus ilma katteta.
     *
     * MIKS RIDA JÄÄB, AGA SISU KAOB. Vastuvõtulaud kannab lugemisaja lubadust ja
     * selle täitmine on KOV-i vastutus — „kas see pöördumine loeti läbi lubatud
     * aja jooksul" peab jääma vastatavaks ka pärast seda, kui inimene oma konto
     * kustutab. Rea skelett (laud, seisud, kellaajad, sündmuslogi) on see
     * vastutusjälg. Sisu ja kontaktid ei ole vastutusjälg — nemad kaovad.
     *
     * `""` mitte `null`, sest need veerud on skeemis NOT NULL. Sama muster nagu
     * `PreInquiry.situation` ülalpool: tühi väärtus + `...ErasedAt` ajatempel,
     * mis eristab „ei olnud kunagi" ja „kustutati".
     */
    /* TINGIMUSETA kutse, teadlikult. `tx.urgentRequest?.updateMany ? … : { count: 0 }`
       oleks siin fail-open: puuduv mudel muutuks vaikseks nulliks ja kustutus
       vastaks endiselt `ok: true`. Just see — edu kinnitamine ilma tehtud tööta —
       ongi leid. Kui see kutse ei õnnestu, kukub kogu tehing tagasi ja kustutustöö
       läheb `failed` seisu, kus teda korratakse. */
    const urgentAnonymized = await tx.urgentRequest.updateMany({
      where: { authorId: userId },
      data: {
        authorId: null,
        authorErasedAt: new Date(),
        situationVerbatim: "",
        assistantStructured: null,
        contactName: "",
        contactPhone: ""
      }
    })

    /* SOL-SPROF-01 — SOLO-TEENUSEPROFIIL JÄI AVALIKUKS JA RAG-i.
     *
     * `ServiceProviderProfile.ownerId` on `SetNull` ja migratsiooni CHECK lubab
     * SOLO-profiili teadlikult ilma omanikuta. Konto kustutamine nullis seega
     * ainult VIIDE: nimi, kontaktid, teenused ja asukohad jäid avalikule
     * kaardile ning assistendi teadmuskihti — ja neid ei saanud enam ükski
     * omanik peita, sest omanikku ei olnud.
     *
     * KOLM SAMMU, kõik ENNE `user.delete`-i ja SAMAS lukustatud tehingus:
     *   1. profiil `HIDDEN` — avalik päring filtreerib staatuse järgi;
     *   2. tema kaardikirjed samuti `HIDDEN` — kaart loeb neid, mitte profiili;
     *   3. RAG-koopiale püsiv kustutustöö.
     *
     * RAG-i kustutust ei PROOVITA siin: võrgukutse tehingu sees hoiaks rea
     * lukku võõra teenuse vastuse ajaks ja tema tõrge keeraks tagasi kogu
     * kustutuse, mis muidu õnnestus. Töö läheb järjekorda, mida retry-worker
     * ajab taga ja mida deploy-värav loeb — sama rada, mis mujal. */
    const soloProfiles = await tx.serviceProviderProfile.findMany({
      where: { ownerId: userId, ownershipMode: "SOLO" },
      select: { id: true, ragSourceId: true }
    })
    let profilesHidden = 0
    let mapEntriesHidden = 0
    let ragJobsQueued = 0
    for (const profile of soloProfiles) {
      const hidden = await tx.serviceProviderProfile.updateMany({
        where: { id: profile.id, status: { not: "HIDDEN" } },
        data: { status: "HIDDEN" }
      })
      profilesHidden += Number(hidden?.count || 0)
      const entries = await tx.serviceMapEntry.updateMany({
        where: { providerProfileId: profile.id, status: { not: "HIDDEN" } },
        data: { status: "HIDDEN" }
      })
      mapEntriesHidden += Number(entries?.count || 0)
      if (profile.ragSourceId) {
        const job = await queueServiceProfileRagDeletionWithin(tx, {
          profileId: profile.id,
          ragSourceId: profile.ragSourceId,
          reason: "owner_account_deleted",
          targetUserId: userId
        })
        if (job) ragJobsQueued += 1
      }
    }

    /* SOL-PAY-09: maksekirjed külmutatakse ENNE `user.delete`-i ja SAMAS
       tehingus — pärast kustutust ei ole enam kedagi, kelle ridu üles leida,
       ja `SetNull` on siis juba jooksnud. Sama järjekorra argument mis
       SPROF-01 juures ülal. Ilma selleta võttis üks kaskaad tagasi lubaduse,
       mille privaatsustingimuste p 7.9 kasutajale annab. */
    const paymentsArchived = await archiveUserPaymentsWithin(tx, { userId })

    /* SOL-ORG-18: organisatsiooniliikmesus ei tohi User-kaskaadis kaduda.
       Sama tehing lõpetab aktiivsed seosed või peatub viimase omaniku/elava töö
       juures enne identiteedi tombstone'imist. */
    const organizationOffboarding = await offboardOrganizationMembershipsForAccountDeletion(userId, {
      db: tx,
      now: new Date()
    })

    /* SOL-SLOG-J-06: identiteedid ja User-rida peavad muutuma ühe tervikuna.
       Iga tõrge rollbackib nii tombstone'id kui konto kustutuse. */
    const serviceLogErased = await eraseServiceLogUserReferencesWithinTransaction(userId, {
      db: tx,
      now: new Date()
    })

    /* SOL-SUP-09: identiteediviited tombstone'itakse enne User-rida;
       jagatud tõend säilib, M6/M12 kustuvad oma olemasoleva CASCADE kaudu. */
    const supervisionErased = await tombstoneSupervisionForAccountDeletion(userId, {
      db: tx,
      now: new Date()
    })

    const covisionErased = await tombstoneCovisionParticipationForAccountDeletion(userId, {
      db: tx,
      now: new Date()
    })

    const user = await tx.user.delete({ where: { id: userId } })
    return {
      ...user,
      privacyCounts: {
        anonymizedSentPreInquiries: Number(anonymized?.count || 0),
        deletedUnsentPreInquiries: Number(draftsDeleted?.count || 0),
        receiverNotesCleared: Number(receiverNotesCleared?.count || 0),
        anonymizedUrgentRequests: Number(urgentAnonymized?.count || 0),
        archivedPayments: Number(paymentsArchived?.archived || 0),
        organizationMembershipsEnded: Number(organizationOffboarding?.membershipsEnded || 0),
        organizationMembershipsErased: Number(organizationOffboarding?.membershipsErased || 0),
        hiddenServiceProfiles: profilesHidden,
        hiddenServiceMapEntries: mapEntriesHidden,
        queuedServiceProfileRagDeletions: ragJobsQueued,
        serviceLogReferences: Number(serviceLogErased?.erased || 0),
        serviceLog: serviceLogErased?.counts || {},
        supervisionProcessesTombstoned: supervisionErased.supervisedProcessesTombstoned,
        supervisionParticipationsTombstoned: supervisionErased.participationsTombstoned,
        supervisionTopicsTombstoned: supervisionErased.supervisorTopicsTombstoned,
        covisionParticipationsTombstoned: covisionErased.participationsTombstoned
      }
    }
  })
}
import { Prisma } from "../../generated/prisma/client.ts"
import { queueServiceProfileRagDeletionWithin } from "./serviceProfileRagRemoval.js"
import { archiveUserPaymentsWithin } from "./paymentArchive.js"
import { eraseServiceLogUserReferencesWithinTransaction } from "../serviceLog/privacyLifecycle.js"
import { offboardOrganizationMembershipsForAccountDeletion } from "../org/accountDeletion.js"
import { tombstoneSupervisionForAccountDeletion } from "../supervision/accountDeletion.js"
import { tombstoneCovisionParticipationForAccountDeletion } from "../covision/accountDeletion.js"
