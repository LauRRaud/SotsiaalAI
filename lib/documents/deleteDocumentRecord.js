/**
 * Dokumendi kustutamine: KÕIGEPEALT fail, SIIS rida (audit F-ERR-03).
 *
 * Varem kustutati rida enne ja fail pärast. Faili kustutus käib jälgitava töö
 * kaudu (`deleteTrackedStorageFile`); kui töö rida ei õnnestunud luua, jäi fail
 * puutumata, aga rida oli juba kustutatud ja vastus ütles „kustutatud". Fail jäi
 * kettale ilma ühegi kirjeta, mille järgi seda hiljem leida.
 *
 * Nüüd blokeerib faili kustutuse ebaõnnestumine rea kustutuse: rida jääb alles,
 * inimene saab ausa vea ja võib uuesti proovida. Sama järjekorda kasutavad
 * säilitusaja pühkijad (`lib/retention.js`, `lib/field/retentionSweep.js`) ja sama
 * põhimõtet koosoleku kokkuvõtte hetktõmmise kustutus samas marsruudis.
 *
 * Vastupidine poolik seis (fail läinud, rea kustutus ebaõnnestub) on nähtav ja
 * parandatav: rida on loendis, faili kustutus on korduskindel ja kordus viib rea ära.
 *
 * @param {object} steps
 * @param {() => Promise<{ ok: boolean, skipped?: boolean, error?: unknown }>} steps.deleteFile
 * @param {() => Promise<object>} steps.deleteRecord
 */
export async function deleteDocumentFileAndRecord({ deleteFile, deleteRecord }) {
  const fileResult = await deleteFile()
  if (fileResult?.ok !== true) {
    const error = new Error("documents.errors.delete_failed")
    error.status = 503
    error.cause = fileResult?.error || null
    throw error
  }
  return deleteRecord()
}
