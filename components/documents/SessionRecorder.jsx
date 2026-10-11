"use client"

/**
 * Recorder for a meeting in person (documents page, case work meeting).
 *
 * WHY IT EXISTS. The platform made an audio file itself only in a room call and on the field visit screen. A meeting
 * at the office had to be recorded with the phone's own recorder and uploaded, and no consent was put on record.
 *
 * PARTS. The transcription model takes at most 25 minutes of audio in one request, so the recording is cut into parts
 * of 10 minutes. The next part starts BEFORE the open one stops, so no words fall between two parts. Every part is
 * saved as soon as it closes: a closed browser loses at most the open part.
 *
 * CONSENT. The microphone does not open before the worker attests that those present agree; the server refuses a
 * recording without the attestation (lib/documents/sessionRecording.js).
 *
 * A PART THAT COULD NOT BE SAVED STAYS IN THIS WINDOW with a retry button. Dropping it silently would lose a part of
 * the meeting without a trace.
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { useI18n } from "@/components/i18n/I18nProvider"
import {
  SESSION_RECORDING_MAX_PARTS,
  SESSION_RECORDING_PART_MS,
  nextRecordingChunk,
  pickRecordingMime,
  recordingBitsPerSecond,
  recordingFileName,
  recordingSeconds
} from "@/lib/documents/sessionRecording"

// The title's time is written without a colon: the document title keeps dots, a colon is replaced by a space.
function stamp(time) {
  const date = new Date(time)
  const two = (value) => String(value).padStart(2, "0")
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} ${two(date.getHours())}.${two(date.getMinutes())}`
}

function clock(seconds) {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

export default function SessionRecorder({
  onPartSaved,
  disabled = false,
  ButtonComponent = "button",
  buttonProps = {},
  classNames = {}
}) {
  const { t, locale } = useI18n()
  const [consent, setConsent] = useState(false)
  const [phase, setPhase] = useState("idle") // idle | starting | recording | closing
  const [seconds, setSeconds] = useState(0)
  const [part, setPart] = useState(0)
  const [savedParts, setSavedParts] = useState(0)
  const [savingParts, setSavingParts] = useState(0)
  const [failedParts, setFailedParts] = useState([])
  const [noticeKey, setNoticeKey] = useState("")
  const [errorKey, setErrorKey] = useState("")

  const mountedRef = useRef(false)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const sessionRef = useRef(null)
  const tickRef = useRef(null)
  const wakeLockRef = useRef(null)
  const saveChainRef = useRef(Promise.resolve())
  const onPartSavedRef = useRef(onPartSaved)
  const beginPartRef = useRef(null)

  useEffect(() => {
    onPartSavedRef.current = onPartSaved
  }, [onPartSaved])

  const savePart = useCallback(
    async (info) => {
      if (mountedRef.current) setSavingParts((count) => count + 1)
      let audioSource = null
      try {
        const formData = new FormData()
        formData.append("file", new File([info.blob], recordingFileName(info.mime, info.part), { type: info.mime || "audio/webm" }))
        formData.append("title", info.title)
        formData.append("origin", "recorded")
        formData.append("consent", "1")
        formData.append("sessionId", info.sessionId)
        formData.append("part", String(info.part))
        const response = await fetch("/api/documents/audio-sources", {
          method: "POST",
          headers: { "x-ui-locale": locale || "et" },
          body: formData
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.audioSource?.id) throw new Error("save_failed")
        audioSource = payload.audioSource
        if (mountedRef.current) {
          setSavedParts((count) => count + 1)
          setFailedParts((list) => list.filter((item) => item !== info))
        }
      } catch {
        if (mountedRef.current) {
          setFailedParts((list) => (list.includes(info) ? list : [...list, info]))
          setErrorKey("documents.recorder.save_failed")
        }
      } finally {
        if (mountedRef.current) setSavingParts((count) => Math.max(0, count - 1))
      }
      // The part is stored whatever the page does with it next; the page's own failure is the page's to show.
      if (audioSource) {
        try {
          await onPartSavedRef.current?.(audioSource, { part: info.part, sessionId: info.sessionId })
        } catch {
          /* handled by the caller */
        }
      }
    },
    [locale]
  )

  const queuePart = useCallback(
    (info) => {
      saveChainRef.current = saveChainRef.current.then(() => savePart(info))
    },
    [savePart]
  )

  const finish = useCallback(() => {
    const session = sessionRef.current
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    sessionRef.current = null
    if (tickRef.current) window.clearInterval(tickRef.current)
    tickRef.current = null
    wakeLockRef.current?.release?.().catch(() => {})
    wakeLockRef.current = null
    if (!mountedRef.current) return
    setPhase("idle")
    setPart(0)
    setSeconds(0)
    if (session?.failed) setErrorKey("documents.recorder.microphone_lost")
    else if (session?.limitReached) setNoticeKey("documents.recorder.limit_reached")
    else setNoticeKey("documents.recorder.finished")
  }, [])

  const beginPart = useCallback(() => {
    const session = sessionRef.current
    const stream = streamRef.current
    if (!session || !stream) return
    session.part += 1
    const partNumber = session.part
    const mimeType = pickRecordingMime((candidate) => window.MediaRecorder.isTypeSupported(candidate))
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: recordingBitsPerSecond(mimeType)
    })
    const chunks = []
    let bytes = 0
    let closing = false
    let partTimer = null

    const closePart = () => {
      if (closing || recorder.state === "inactive") return
      closing = true
      if (!session.stopping && partNumber < SESSION_RECORDING_MAX_PARTS) {
        // The next part starts before this one stops: nothing said falls between the two.
        beginPartRef.current?.()
      } else if (!session.stopping) {
        session.stopping = true
        session.limitReached = true
      }
      recorder.stop()
    }

    recorder.ondataavailable = (event) => {
      if (!event.data?.size) return
      const next = nextRecordingChunk(bytes, event.data.size)
      if (next.accept) {
        chunks.push(event.data)
        bytes = next.totalBytes
      }
      if (next.limitReached) closePart()
    }
    recorder.onstop = () => {
      if (partTimer) window.clearTimeout(partTimer)
      const mime = recorder.mimeType || mimeType || "audio/webm"
      const blob = new Blob(chunks, { type: mime })
      if (blob.size) {
        queuePart({
          blob,
          mime,
          sessionId: session.id,
          part: partNumber,
          title: t("documents.recorder.part_title", { date: session.label, part: partNumber })
        })
      }
      // No newer part took over: the recording has ended.
      if (recorderRef.current === recorder) finish()
    }
    recorder.onerror = () => {
      session.stopping = true
      session.failed = true
      if (recorder.state !== "inactive") recorder.stop()
    }

    recorderRef.current = recorder
    recorder.start(1000)
    partTimer = window.setTimeout(closePart, SESSION_RECORDING_PART_MS)
    if (mountedRef.current) setPart(partNumber)
  }, [finish, queuePart, t])

  useEffect(() => {
    beginPartRef.current = beginPart
  }, [beginPart])

  const stop = useCallback(() => {
    const session = sessionRef.current
    if (!session) return
    session.stopping = true
    if (mountedRef.current) setPhase("closing")
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop()
      else finish()
    } catch {
      finish()
    }
  }, [finish])

  const start = useCallback(async () => {
    if (phase !== "idle" || disabled) return
    setNoticeKey("")
    if (!consent) {
      setErrorKey("documents.recorder.consent_first")
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === "undefined") {
      setErrorKey("documents.recorder.unsupported")
      return
    }
    setErrorKey("")
    setPhase("starting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const startedAt = Date.now()
      streamRef.current = stream
      sessionRef.current = {
        id: window.crypto.randomUUID(),
        startedAt,
        label: stamp(startedAt),
        part: 0,
        stopping: false,
        limitReached: false,
        failed: false
      }
      // The microphone can be taken away (device unplugged, permission withdrawn): what was recorded is kept.
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (!sessionRef.current || sessionRef.current.stopping) return
          sessionRef.current.failed = true
          stop()
        }
      })
      setSavedParts(0)
      beginPart()
      setPhase("recording")
      tickRef.current = window.setInterval(() => {
        if (mountedRef.current) setSeconds(recordingSeconds(Date.now() - startedAt))
      }, 1000)
      // A locked phone screen stops the microphone; keep the screen awake where the browser can.
      navigator.wakeLock?.request?.("screen").then(
        (lock) => {
          if (sessionRef.current) wakeLockRef.current = lock
          else lock.release?.().catch(() => {})
        },
        () => {}
      )
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      sessionRef.current = null
      if (mountedRef.current) {
        setErrorKey("documents.recorder.microphone_failed")
        setPhase("idle")
      }
    }
  }, [phase, disabled, consent, beginPart, stop])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // Leaving the view ends the recording; the open part is still saved.
      if (sessionRef.current) sessionRef.current.stopping = true
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop()
      } catch {
        streamRef.current?.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const busy = phase !== "idle" || savingParts > 0 || failedParts.length > 0
  useEffect(() => {
    if (!busy) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [busy])

  const recording = phase === "recording" || phase === "closing"
  const startLabel = phase === "starting" ? t("documents.recorder.starting") : t("documents.recorder.start")

  return (
    <div className={classNames.root} data-recorder-phase={phase} data-recorder-busy={busy ? "1" : "0"}>
      <label className={classNames.consent}>
        <input
          type="checkbox"
          checked={consent}
          disabled={disabled || phase !== "idle"}
          onChange={(event) => {
            setConsent(event.target.checked)
            if (event.target.checked) setErrorKey((key) => (key === "documents.recorder.consent_first" ? "" : key))
          }}
        />{" "}
        {t("documents.recorder.consent_label")}
      </label>

      <div className={classNames.actions}>
        {recording ? (
          <ButtonComponent type="button" {...buttonProps} className={classNames.button} onClick={stop} disabled={phase === "closing"}>
            {phase === "closing" ? t("documents.recorder.closing") : t("documents.recorder.stop")}
          </ButtonComponent>
        ) : (
          <ButtonComponent
            type="button"
            {...buttonProps}
            className={classNames.button}
            onClick={() => void start()}
            disabled={disabled || phase === "starting"}
          >
            {startLabel}
          </ButtonComponent>
        )}
      </div>

      {recording ? (
        <p className={classNames.status} role="status" aria-live="polite">
          {t("documents.recorder.recording_status", { time: clock(seconds), part })}
        </p>
      ) : null}
      {savingParts > 0 ? <p className={classNames.hint}>{t("documents.recorder.saving")}</p> : null}
      {savedParts > 0 ? <p className={classNames.hint}>{t("documents.recorder.saved_count", { count: savedParts })}</p> : null}
      {noticeKey && !recording ? <p className={classNames.hint}>{t(noticeKey)}</p> : null}

      {errorKey ? (
        <p className={classNames.error} role="alert">
          {t(errorKey)}
        </p>
      ) : null}
      {failedParts.length && savingParts === 0 ? (
        <div className={classNames.actions}>
          <ButtonComponent
            type="button"
            {...buttonProps}
            className={classNames.button}
            onClick={() => {
              setErrorKey("")
              failedParts.forEach((info) => queuePart(info))
            }}
          >
            {t("documents.recorder.retry", { count: failedParts.length })}
          </ButtonComponent>
        </div>
      ) : null}

      <p className={classNames.hint}>{t("documents.recorder.limit_help")}</p>
    </div>
  )
}
