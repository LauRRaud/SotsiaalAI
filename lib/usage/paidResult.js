/**
 * TASULISE TULEMUSE ARVELDUSJÄRJEKORD (SOL-DOC-01).
 *
 * MIS OLI VALESTI. Kolm dokumendirada arvestasid AI-kasutuse maha kohe pärast
 * mudelikutset — ENNE seda, kui tulemusest sai midagi püsivat. Mustandi loomise
 * viga, üle kvoodi jäänud sisu (413) või kohustusliku auditirea kirjutamise viga
 * tuli seejärel juba arvestatud kasutuse otsa: kasutaja nädalalimiit kahanes ilma
 * leitava mustandi või isegi vastuses saadud tekstita. Vabastust ei tulnud, sest
 * „genereerimine õnnestus" oli märgitud tõeseks juba enne püsivat tulemust.
 *
 * REEGEL, mida see moodul kannab: **tasu võetakse ainult püsiva tulemuse järel.**
 * Järjekord on alati `reserve → produce → persist → commit` ja tema kaks piiri on:
 *
 *  1. iga viga ENNE commit'i vabastab reservatsiooni — kasutamata tööst ei jää
 *     kunagi arvestatud ühikut;
 *  2. commit'i enda viga EI vabasta midagi. Püsiv tulemus on juba olemas ja
 *     kuulub omanikule; reservatsioon jääb RESERVED-iks, mille sama võtmega
 *     korduskatse parandab (`persist` on idempotentne) või mille aegumise
 *     korral reaper hiljem tagastab. Vabastamine annaks siin tasulise tulemuse
 *     tasuta ja teeks arvelduse tulemusest lahknevaks.
 *
 * MIKS OMA MOODUL. Järjekord on marsruudi kõige kergemini katkev omadus: ta
 * elab ainult ridade järjestuses ja iga hilisem lisandus võib ta märkamatult
 * ümber tõsta. Siin on kõik neli sammu süstitavad, seega saab veasüst panna
 * täpselt ühte sammu ja mõõta, mis reservatsiooniga juhtus — ilma HTTP-, DB- ega
 * mudelikutseta.
 *
 * MÄRKUS `persist`-i kohta. Kui tasuline tulemus ei ole ise püsiv (refine annab
 * teksti vastuses tagasi), siis on `persist` see samm, mis paneb kohustusliku
 * kirje ja commit'i ÜHTE tehingusse — seesama reegel kehtib ka siis, ainult et
 * „püsiv tulemus" ja „tasu" langevad ühte atomaarsesse sammu ning `commit`
 * jäetakse andmata.
 */

export const PAID_RESULT_STAGES = Object.freeze({
  PRODUCE: "produce",
  PERSIST: "persist",
  COMMIT: "commit"
})

const RELEASE_REASONS = Object.freeze({
  [PAID_RESULT_STAGES.PRODUCE]: "paid_work_failed",
  [PAID_RESULT_STAGES.PERSIST]: "paid_result_not_durable"
})

function markStage(error, stage) {
  if (error && typeof error === "object" && !error.paidResultStage) {
    try {
      error.paidResultStage = stage
    } catch {}
  }
  return error
}

/**
 * @param reserve  `async () => handle` — kvoodi reservatsioon (võib visata).
 * @param produce  `async (handle) => produced` — tasuline töö (mudelikutse).
 * @param persist  `async (produced, handle) => persisted` — püsiv tulemus.
 * @param commit   `async (handle, persisted) => void` — kasutuse lõplik arvestus.
 *                 Jäta andmata, kui `persist` juba arveldas ise ühes tehingus.
 * @param release  `async (handle, reason) => void` — reservatsiooni vabastus.
 * @param onReleaseError `(error, reason) => void` — vabastuse enda viga ei tohi
 *                 algset viga varjata, aga ei tohi ka vaikselt kaduda.
 *
 * @returns `{ handle, produced, persisted }`
 */
export async function runPaidResult({
  reserve,
  produce,
  persist,
  commit = null,
  release = null,
  onReleaseError = null
}) {
  if (typeof reserve !== "function") throw new TypeError("reserve is required")
  if (typeof produce !== "function") throw new TypeError("produce is required")
  if (typeof persist !== "function") throw new TypeError("persist is required")

  const handle = await reserve()

  async function failBeforeCommit(error, stage) {
    const reason = RELEASE_REASONS[stage] || "technical_error"
    if (handle && typeof release === "function") {
      try {
        await release(handle, reason)
      } catch (releaseError) {
        onReleaseError?.(releaseError, reason)
      }
    }
    throw markStage(error, stage)
  }

  let produced
  try {
    produced = await produce(handle)
  } catch (error) {
    await failBeforeCommit(error, PAID_RESULT_STAGES.PRODUCE)
  }

  let persisted
  try {
    persisted = await persist(produced, handle)
  } catch (error) {
    await failBeforeCommit(error, PAID_RESULT_STAGES.PERSIST)
  }

  if (typeof commit === "function") {
    try {
      await commit(handle, persisted)
    } catch (error) {
      // Teadlikult ilma vabastuseta — vt teine piir mooduli päises.
      throw markStage(error, PAID_RESULT_STAGES.COMMIT)
    }
  }

  return { handle, produced, persisted }
}
