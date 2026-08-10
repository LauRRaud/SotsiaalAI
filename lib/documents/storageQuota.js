import { prisma } from "@/lib/prisma"
import { getDailyUploadQuotaBytes, getStorageQuotaBytes, getUtcDayStart } from "@/lib/storageGuardrails"
import { getUserDailyUploadBytes, getUserStorageUsageBytes } from "@/lib/storageUsage"

/**
 * SALVESTUSKVOOT ON PIIR ALLES SIIS, KUI TA ON ATOMAARNE (SOL-DOC-07).
 *
 * MIS OLI VALESTI. Kõik neli rada — tavaline üleslaadimine, helifaili üleslaadimine, artefakti
 * loomine ja artefakti muutmine — lugesid kasutaja senise mahu agregaatpäringuga ja lõid rea
 * ALLES HILJEM, ilma ühegi kasutajapõhise luku või mahureservatsioonita. Kaks päringut mahtusid
 * seega mõlemad VANA summa järgi ära ja ületasid koos limiidi. Kasutaja sai rohkem püsisalvestust
 * kui pakett lubab ning järgnev tavakasutus lukustus ootamatult „üle kvoodi" seisu.
 *
 * MIS SIIN ON. Mõõtmine ja kirjutus käivad ühes tehingus, mille serialiseerib **kasutajapõhine**
 * nõuandelukk. Teine päring ootab luku taga ja mõõdab siis juba uut summat — „loe → otsusta →
 * kirjuta" ei põimu enam läbi.
 *
 * MIKS LUKK, MITTE LOENDURIVEERG. Kanooniline maht on tuletatav summa mitmest tabelist
 * (dokumendid, materjalid, artefaktid) ja tema ainus tõde on nendes tabelites endis. Eraldi
 * loendur oleks neljas koht, mida tuleks iga kustutuse ja iga muutuse peale sünkroonis hoida —
 * ja tema lahknemine oleks nähtamatu. Lukk annab sama garantii ilma teist tõde loomata.
 *
 * NB: `pg_advisory_xact_lock` AINULT `$executeRaw` kaudu.
 *
 * KIRJUTUS KÄIB SEES, MITTE PÄRAST. `write(tx)` jookseb sama luku ja sama tehingu sees — see ongi
 * kogu mõte. Kui ta jookseks väljaspool, oleks tulemus täpselt vana kood.
 */

function quotaError(messageKey, status, quota) {
  const error = new Error(messageKey)
  error.status = status
  error.quota = quota
  return error
}

/**
 * @param addBytes     kui palju maht KASVAB (uus fail, uus sisu).
 * @param releaseBytes kui palju maht sama toiminguga vabaneb (asendatava sisu senine maht).
 * @param dailyAddBytes kui ei ole null, kontrollitakse ka päevast üleslaadimispiiri.
 * @param write        `async (tx, context) => result` — kirjutus SAMAS tehingus.
 */
export async function withStorageQuota(
  {
    userId,
    role,
    addBytes = 0,
    releaseBytes = 0,
    dailyAddBytes = null,
    dayStart = null,
    quotaBytes = null,
    dailyQuotaBytes = null
  },
  { db = prisma } = {},
  write
) {
  if (typeof write !== "function") throw new TypeError("write is required")

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId})::bigint)`

    const limit = quotaBytes ?? getStorageQuotaBytes(role)
    const usage = await getUserStorageUsageBytes(userId, { db: tx })
    const projected = usage.totalBytes - Math.max(0, releaseBytes) + Math.max(0, addBytes)

    if (projected > limit) {
      throw quotaError("documents.errors.storage_quota_exceeded", 413, {
        scope: "storage_quota",
        limit,
        used: usage.totalBytes
      })
    }

    if (dailyAddBytes != null) {
      const dailyLimit = dailyQuotaBytes ?? getDailyUploadQuotaBytes()
      const dailyUsed = await getUserDailyUploadBytes(userId, dayStart || getUtcDayStart(), { db: tx })
      if (dailyUsed + Math.max(0, dailyAddBytes) > dailyLimit) {
        throw quotaError("documents.errors.daily_upload_quota_exceeded", 429, {
          scope: "daily_upload",
          limit: dailyLimit,
          used: dailyUsed
        })
      }
    }

    return write(tx, { usage, limit, projected })
  })
}
