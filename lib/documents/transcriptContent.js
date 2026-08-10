import { prisma } from "@/lib/prisma"
import { stageStoredText } from "@/lib/documents/storageStaging"

/**
 * TEKSTIDOKUMENDI KIRJUTUS: ANDMEBAAS ENNE, KETAS PÄRAST (SOL-DOC-04).
 *
 * Mõlemad rajad — olemasoleva transkripti muutmine ja uue transkripti loomine — kirjutasid
 * varem faili ESIMESENA. Kui DB-samm siis kukkus, jäid alles kaks eri tõde: allalaadimine luges
 * faili, API ja AI-kokkuvõte lugesid `content` välja andmebaasist. Uue transkripti puhul jäi
 * tundlik tekst lisaks kettale ilma ühegi omaniku- ja retention-reata.
 *
 * Siin on see järjekord ümber pööratud ja LUKUS: rida kirjutatakse tehingus, fail avaldatakse
 * tehingu sees viimase sammuna. Vea korral tuleb vana fail tagasi ja ajutine kaob — orbfaili ei
 * teki ka siis, kui viga tabab loomist.
 *
 * `db` ja `stage` on süstitavad, sest just veasüst on see, mida siin tõendada on vaja:
 * `npm run doc:staging:probe` katkestab DB-sammu PÄRAST failikirjutust ja mõõdab ketast.
 */

export async function updateDocumentWithStagedText(
  { where, storagePath, content, data = {}, select },
  { db = prisma, stage = stageStoredText, stageOptions } = {}
) {
  const staged = await stage(content, storagePath, stageOptions)
  try {
    const row = await db.$transaction(async (tx) => {
      const updated = await tx.userDocument.update({
        where,
        data: {
          ...data,
          content,
          size: staged.size,
          sha256: staged.sha256
        },
        select
      })
      // Viimane samm tehingu sees: kui rename kukub, ei jää ka rida kehtima.
      await staged.publish()
      return updated
    })
    await staged.cleanup()
    return row
  } catch (error) {
    await staged.rollback()
    throw error
  }
}

export async function createDocumentWithStagedText(
  { storagePath, content, data, select },
  { db = prisma, stage = stageStoredText, stageOptions } = {}
) {
  const staged = await stage(content, storagePath, stageOptions)
  try {
    const row = await db.$transaction(async (tx) => {
      const created = await tx.userDocument.create({
        data: {
          ...data,
          storagePath,
          content,
          size: staged.size,
          sha256: staged.sha256
        },
        select
      })
      await staged.publish()
      return created
    })
    await staged.cleanup()
    return row
  } catch (error) {
    await staged.rollback()
    throw error
  }
}
