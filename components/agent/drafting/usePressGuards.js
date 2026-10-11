"use client"

/**
 * Koostamisruumi vajutuste väravad: teine vajutus ja tasulise töö värav.
 *
 * MIKS OMA FAIL. Samad kaks reeglit kehtivad nii koostamise jadas kui ka heli
 * rajal ja neid ei tohi kummaski eraldi ümber kirjutada:
 *
 *  1. TEINE VAJUTUS. Tegevus, mis viiks midagi kaasa (salvestamata tekst,
 *     pooleli salvestamine) või on pöördumatu (kustutamine, kinnitamine), ei
 *     juhtu esimesest vajutusest: esimene küsib, teine teeb. Topeltklõpsu teine
 *     pool jäetakse vahele ja küsimus kustub ise, kui teist vajutust ei tule.
 *
 *  2. TASULINE TÖÖ käib ühe värava kaudu: korraga üks ja mitte kaks korda samast
 *     liigutusest. Lehe olekulipud (`starting` jt) uuenevad alles järgmisel
 *     joonistusel; viide kehtib kohe.
 *
 * Reeglid ise on puhtad funktsioonid failis ./draftingModel.js (`confirmPress`,
 * `pressAllowed`); siin on ainult nende olek.
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { CONFIRM_MS, confirmPress, pressAllowed } from "./draftingModel"

export default function usePressGuards() {
  /* Teist vajutust ootav tegevus: `liik` või `liik:täpsustus` (vt CONFIRM_KINDS). */
  const [confirming, setConfirming] = useState("")
  const confirmTimer = useRef(0)
  const armedAt = useRef(0)
  const paidBusyRef = useRef(false)
  const paidPressAt = useRef(0)

  const arm = useCallback((key) => {
    window.clearTimeout(confirmTimer.current)
    armedAt.current = Date.now()
    setConfirming(key)
    confirmTimer.current = window.setTimeout(() => setConfirming(""), CONFIRM_MS)
  }, [])
  const disarm = useCallback(() => {
    window.clearTimeout(confirmTimer.current)
    setConfirming("")
  }, [])
  useEffect(() => () => window.clearTimeout(confirmTimer.current), [])

  /**
   * Üks vajutus teist vajutust küsival tegevusel. Tagastab, mis juhtus: `arm`
   * (esimene vajutus, küsimus on nüüd ees), `wait` (teine tuli liiga ruttu ja
   * jäi vahele) või `run` (teine vajutus: tee ära).
   */
  function press(key) {
    const step = confirmPress({ armedKey: confirming, armedAt: armedAt.current, key, now: Date.now() })
    if (step === "arm") arm(key)
    else if (step === "run") disarm()
    return step
  }

  /**
   * Tegevus, mis küsib teist vajutust ainult siis, kui see midagi kaasa viiks
   * (`needsConfirm`). Muidu tehakse see kohe.
   */
  function guarded(key, needsConfirm, run) {
    if (!needsConfirm) {
      if (confirming) disarm()
      return run()
    }
    return press(key) === "run" ? run() : undefined
  }

  /** Tasuline töö: jääb vahele, kui eelmine veel käib või vajutus on topeltklõpsu teine pool. */
  async function runPaid(work) {
    const now = Date.now()
    if (paidBusyRef.current || !pressAllowed(paidPressAt.current, now)) return undefined
    paidPressAt.current = now
    paidBusyRef.current = true
    try {
      return await work()
    } finally {
      paidBusyRef.current = false
    }
  }

  return { confirming, disarm, press, guarded, runPaid }
}
