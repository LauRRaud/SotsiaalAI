import { prisma } from "@/lib/prisma"
import { createArtifactError } from "@/lib/documents/artifacts"

/**
 * REFINEMENT'I KOHA RESERVEERIMINE (SOL-DOC-05).
 *
 * MIS OLI VALESTI. Lubatud kolme paranduse piir oli LOENDUS: marsruut luges varasemad
 * `ARTIFACT_REFINE` auditiread kokku ja võrdles kolmega — enne AI-kutset. Auditirida lisandus
 * aga alles PÄRAST genereerimist. Kaks või enam samaaegset päringut lugesid seega kõik sama
 * arvu, kõik nägid ruumi ja kõik lõpetasid edukalt. Kiire topeltklõps, mitu vahekaarti või
 * otse-API päring kasvatas AI-kulu ja tegi UI-le tagastatava `used/limit` lepingu valeks.
 *
 * MIS SIIN ON. Koht **reserveeritakse enne AI-kutset** ja reservatsioon ise on püsiv rida.
 * Kontroll ja kirjutus on ühes tehingus ning tehingut serialiseerib artefaktipõhine
 * nõuandelukk, seega „loe arv → otsusta → kirjuta" ei saa enam kahe päringu vahel läbi põimuda.
 *
 * MIKS NÕUANDELUKK JA MITTE UNIKAALNE INDEKS. Slot ei ole eraldi tabel — ta ON auditirida, ja
 * „mitmes see rida on" ei ole väärtus, mille peale saaks unikaalsust panna, ilma et tekiks uus
 * veerg ja migratsioon. Lukk annab sama garantii ilma skeemimuutuseta: korraga otsustab ühe
 * artefakti kohta täpselt üks tehing.
 *
 * NB: `pg_advisory_xact_lock` AINULT `$executeRaw` kaudu — `$queryRaw` kukub void-tüübi
 * deserialiseerimisel (sama õppetund mis sisselogimise rajal).
 *
 * KOLM SEISU. Reserveeritud rida kannab `pending: true`. Õnnestumisel ta kinnitatakse
 * (`confirmRefinementSlot`) ja muutub päris auditijäljeks; ebaõnnestumisel ta vabastatakse
 * (`releaseRefinementSlot`) ja kaob — kustutada saab AINULT veel kinnitamata rida, seega
 * päris auditijälge see tee kunagi ei puuduta.
 */

export const ARTIFACT_REFINEMENT_LIMIT = 3

export async function claimRefinementSlot(
  { artifactId, ownerId, limit = ARTIFACT_REFINEMENT_LIMIT },
  { db = prisma } = {}
) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${artifactId})::bigint)`

    const used = await tx.documentAudit.count({
      where: { ownerId, artifactId, action: "ARTIFACT_REFINE" }
    })

    if (used >= limit) {
      const error = createArtifactError("api.common.rate_limited", 429)
      error.usedRefinements = used
      error.refinementLimit = limit
      throw error
    }

    const row = await tx.documentAudit.create({
      data: {
        ownerId,
        artifactId,
        action: "ARTIFACT_REFINE",
        meta: { event: "artifact.refined", pending: true }
      }
    })

    return { auditId: row.id, used: used + 1, limit }
  })
}

/** Vabastab veel kinnitamata koha. Kinnitatud auditirida jääb alati puutumata. */
export async function releaseRefinementSlot(auditId, { db = prisma } = {}) {
  if (!auditId) return 0
  const { count } = await db.documentAudit.deleteMany({
    where: { id: auditId, meta: { path: ["pending"], equals: true } }
  })
  return count
}

/** Teeb reserveeritud kohast päris auditijälje. Kutsutakse kutsuja tehingus. */
export async function confirmRefinementSlot({ auditId, meta = {} }, { db = prisma } = {}) {
  if (!auditId) return null
  return db.documentAudit.update({
    where: { id: auditId },
    data: { meta: { event: "artifact.refined", ...meta } }
  })
}
