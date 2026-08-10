import crypto from "node:crypto"
import fsPromises from "node:fs/promises"

import { resolveAbsoluteDocumentPath } from "@/lib/documents/server"

/**
 * FAILI AVALDAMINE ALLES PÄRAST ANDMEBAASI (SOL-DOC-04).
 *
 * MIS OLI VALESTI. Transkripti muutmine kirjutas uue teksti VANA faili peale ja alles seejärel
 * uuendas andmebaasi. DB-vea korral ei taastanud keegi eelmist faili: allalaadimine luges juba
 * uut sisu, aga API ja AI-kokkuvõte lugesid andmebaasist vana teksti. Kasutaja sai 500 ja kaks
 * tõde samast dokumendist. Uue transkripti rada kirjutas samamoodi faili enne rea loomist, ja
 * catch ei teadnud loodud teed — tundlik tekst jäi kettale ilma omaniku- ja retention-reata.
 *
 * REEGEL. Ketas ei tohi muutuda enne andmebaasi. Uus sisu läheb esmalt AJUTISSE faili samas
 * kaustas; alles siis, kui DB-kirjutus on õnnestunud, tehakse `rename` — sama failisüsteemi
 * sees on see atomaarne, seega lugeja näeb kas vana või uut faili, mitte pooleliolevat.
 *
 * ÜLEKIRJUTUSEL HOITAKSE VANA ALLES. `publish()` viib olemasoleva faili kõrvale varukoopiaks ja
 * `rollback()` toob ta tagasi. Ilma selleta oleks „vea korral peab säilima vana fail" ainult
 * lubadus: rename on kiire, aga tema JÄREL võib tehing ikka veel kukkuda.
 *
 * KOLM TOIMINGUT, mis kokku annavad ainult kaks lõppseisu:
 *   `publish()`  — ajutine saab päris failiks (vana läheb varukoopiaks);
 *   `rollback()` — vana tuleb tagasi ja ajutine kaob;
 *   `cleanup()`  — koristab varukoopia ja ajutise, mis iganes neist üle jäi.
 * `rollback()` ja `cleanup()` on mõlemad idempotentsed ja ENOENT-kindlad, sest neid kutsutakse
 * just siis, kui midagi on juba katki.
 */

function tempSiblingPath(storagePath, suffix) {
  const base = String(storagePath || "")
  return `${base}.${suffix}-${crypto.randomUUID()}`
}

async function unlinkQuietly(fs, absolutePath) {
  try {
    await fs.unlink(absolutePath)
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }
}

async function exists(fs, absolutePath) {
  try {
    await fs.stat(absolutePath)
    return true
  } catch (error) {
    if (error?.code === "ENOENT") return false
    throw error
  }
}

/**
 * Kirjutab sisu ajutisse faili ja annab tagasi selle mõõdud koos avaldamise juhtnööridega.
 *
 * @param content sisu (sõne).
 * @param storagePath lõplik hoidlatee, mille peale see sisu kunagi avaldatakse.
 * @param fs        süstitav `fs/promises` (testis ajutine kaust).
 * @param resolvePath süstitav teeteisendus (vaikimisi hoidla oma, mis hoiab tee kaustas).
 */
export async function stageStoredText(
  content,
  storagePath,
  { fs = fsPromises, resolvePath = resolveAbsoluteDocumentPath } = {}
) {
  return stageStoredBuffer(Buffer.from(String(content ?? ""), "utf8"), storagePath, { fs, resolvePath })
}

/** Sama leping baitide jaoks: üleslaaditud fail läheb samuti esmalt ajutisse faili. */
export async function stageStoredBuffer(
  input,
  storagePath,
  { fs = fsPromises, resolvePath = resolveAbsoluteDocumentPath } = {}
) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input || [])
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex")

  const targetAbsolute = resolvePath(storagePath)
  const tempPath = tempSiblingPath(storagePath, "staged")
  const backupPath = tempSiblingPath(storagePath, "prev")
  const tempAbsolute = resolvePath(tempPath)
  const backupAbsolute = resolvePath(backupPath)

  await fs.writeFile(tempAbsolute, buffer)

  let published = false
  let backedUp = false

  return {
    size: buffer.byteLength,
    sha256,
    tempPath,
    backupPath,
    get published() {
      return published
    },

    /** Ajutine → päris. Olemasolev fail läheb enne kõrvale, et `rollback()` saaks ta tagasi tuua. */
    async publish() {
      if (published) return
      if (await exists(fs, targetAbsolute)) {
        await fs.rename(targetAbsolute, backupAbsolute)
        backedUp = true
      }
      await fs.rename(tempAbsolute, targetAbsolute)
      published = true
    },

    /** Vana sisu tagasi, ajutine ja varukoopia kaovad. Ohutu kutsuda ka siis, kui ei avaldatud. */
    async rollback() {
      if (published && backedUp) {
        await unlinkQuietly(fs, targetAbsolute)
        await fs.rename(backupAbsolute, targetAbsolute)
        published = false
        backedUp = false
      } else if (published) {
        // Faili ei olnud enne olemas: „vana seis" tähendab siin, et teda ei ole.
        await unlinkQuietly(fs, targetAbsolute)
        published = false
      }
      await unlinkQuietly(fs, tempAbsolute)
      await unlinkQuietly(fs, backupAbsolute)
    },

    /** Õnnestumise järel: ei jää ajutist ega varukoopiat. */
    async cleanup() {
      await unlinkQuietly(fs, tempAbsolute)
      if (published) {
        await unlinkQuietly(fs, backupAbsolute)
        backedUp = false
      }
    }
  }
}
