"use client"

/**
 * Koostamisruumi heli rada: helifailid, transkript ja kokkuvõte.
 *
 * MIKS OMA FAIL. Heli rada on oma jada (helifail, transkript, ülevaatus,
 * kokkuvõte) oma andmete ja päringutega. Olek elab siiski lehe küljes (leht
 * kutsub seda konksu), mitte heli raja vaadete küljes: nii jäävad valitud
 * helifail ja transkripti parandused alles, kui inimene käib vahepeal
 * koostamise jadas.
 *
 * TASULISED PÄRINGUD on siin kaks ja kumbki käivitub ainult oma nupust
 * (`AudioPath.jsx`, lehe `runPaid` kaudu):
 *    transkript  POST /api/documents/<helifaili id>/transcribe
 *    kokkuvõte   POST /api/documents/<transkripti id>/summary
 *                (enne seda salvestatakse transkripti salvestamata parandused)
 * Päringute aadress, keha ja kavatsuse võti on samad mis enne lehe ümbertegemist.
 *
 * TRANSKRIPTI TERVE TEKST. Helifailide loend kannab iga transkripti kohta ainult
 * teksti algust. Toimetisse ja kokkuvõttesse läheb ainult eraldi avatud terve
 * tekst (`audioTranscriptDocument`); kui avamine ei õnnestu, jääb toimeti
 * tühjaks, mitte ei näita lühikest juppi, mille salvestamine kirjutaks terve
 * transkripti üle.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { buildIntentSignature, resolveIntentKey } from "@/lib/usage/intentKey"

import { audioFileProblem, serverMessage, transcriptEdited } from "./draftingModel"

export default function useAudioPath({ isClientRole = false, locale, t, language, busy = {}, onSummary, onPicked }) {
  const { starting = false, refiningResult = false, savingResult = false, approvingResult = false } = busy
  // Ühe kavatsuse võti elab kuni serveri kindla vastuseni: sama sisendiga kordus kannab sama
  // võtit (server ei võta teist tasu ega loo teist mustandit), õnnestumise järel ta kustub,
  // seega tahtlik uus jooks on aus uus töö. Vt lib/usage/intentKey.js.
  const summaryIntentRef = useRef(null)
  /* Viimane transkripti avamine: aeglasem vastus ei tohi uuemat valikut üle kirjutada. */
  const transcriptLoadRef = useRef(0)
  /* Peidetud failivalija: selle avab helifaili vaate nupp. */
  const uploadInputRef = useRef(null)
  const [audioSourceMode, setAudioSourceMode] = useState("choose_existing")
  const [audioSources, setAudioSources] = useState([])
  const [audioSourcesLoading, setAudioSourcesLoading] = useState(false)
  const [audioSourcesError, setAudioSourcesError] = useState("")
  const [selectedAudioDocumentId, setSelectedAudioDocumentId] = useState("")
  const [audioUploading, setAudioUploading] = useState(false)
  const [audioWorkflowError, setAudioWorkflowError] = useState("")
  const [audioWorkflowFeedback, setAudioWorkflowFeedback] = useState("")
  const [transcribingAudio, setTranscribingAudio] = useState(false)
  const [audioTranscriptDocument, setAudioTranscriptDocument] = useState(null)
  const [audioTranscriptDraft, setAudioTranscriptDraft] = useState("")
  const [audioTranscriptLoading, setAudioTranscriptLoading] = useState(false)
  const [savingAudioTranscript, setSavingAudioTranscript] = useState(false)
  const [summarizingAudio, setSummarizingAudio] = useState(false)
  const [audioSummaryArtifact, setAudioSummaryArtifact] = useState(null)

  const refreshAudioSources = useCallback(async ({ signal } = {}) => {
    if (isClientRole) {
      setAudioSources([])
      setAudioSourcesError("")
      setAudioSourcesLoading(false)
      return []
    }

    setAudioSourcesLoading(true)
    setAudioSourcesError("")
    try {
      const response = await fetch("/api/documents/audio-sources", {
        cache: "no-store",
        headers: { "x-ui-locale": locale },
        signal
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.audio_sources_load_failed"))
      const nextSources = Array.isArray(payload?.audioSources) ? payload.audioSources : []
      setAudioSources(nextSources)
      return nextSources
    } catch (error) {
      if (signal?.aborted) return []
      setAudioSources([])
      setAudioSourcesError(error?.message || t("documents.errors.audio_sources_load_failed"))
      return []
    } finally {
      if (!signal?.aborted) setAudioSourcesLoading(false)
    }
  }, [isClientRole, locale, t])

  useEffect(() => {
    const controller = new AbortController()
    void refreshAudioSources({ signal: controller.signal })
    return () => controller.abort()
  }, [refreshAudioSources])

  /* Transkribeerimine ja kokkuvõte kestavad kaua ja inimene võib vahepeal valida
     teise helifaili (salvestise järgmise osa). Valmis töö tulemus kuulub sellele
     failile, millest see tehti: toimetisse läheb see ainult siis, kui sama fail on
     endiselt valitud. Värske valik loetakse viitest, sest pooleli päringu sulund
     näeb valikut sellisena, nagu see oli päringu alguses. */
  const selectedIdRef = useRef("")
  selectedIdRef.current = selectedAudioDocumentId

  const selectedAudioSource = useMemo(
    () => audioSources.find((source) => source.id === selectedAudioDocumentId) || null,
    [audioSources, selectedAudioDocumentId]
  )
  const activeTranscriptDocument = audioTranscriptDocument || selectedAudioSource?.transcript || null
  /* Transkripti terve tekst on avatud (vt faili päist). */
  const transcriptLoaded = Boolean(audioTranscriptDocument?.id)
  const canTranscribeAudio = Boolean(selectedAudioSource?.id) && !transcribingAudio && !audioUploading
  const canSaveAudioTranscript = transcriptLoaded && transcriptEdited(audioTranscriptDocument, audioTranscriptDraft)
  const canCreateAudioSummary =
    transcriptLoaded &&
    Boolean(audioTranscriptDraft.trim()) &&
    !starting &&
    !summarizingAudio &&
    !savingAudioTranscript &&
    !refiningResult &&
    !savingResult &&
    !approvingResult

  /* Uus valik: eelmise helifaili transkript ja kokkuvõte ei käi selle kohta. */
  function resetTranscript() {
    transcriptLoadRef.current += 1
    setAudioTranscriptLoading(false)
    setAudioTranscriptDocument(null)
    setAudioTranscriptDraft("")
    setAudioSummaryArtifact(null)
  }

  async function openTranscript(transcript = activeTranscriptDocument) {
    const transcriptId = String(transcript?.id || "").trim()
    if (!transcriptId) return
    const token = ++transcriptLoadRef.current
    setAudioWorkflowError("")
    setAudioTranscriptLoading(true)
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(transcriptId)}`, {
        cache: "no-store",
        headers: { "x-ui-locale": locale }
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.document?.id) throw new Error(serverMessage(payload, t, "documents.errors.read_failed"))
      if (token !== transcriptLoadRef.current) return
      setAudioTranscriptDocument(payload.document)
      setAudioTranscriptDraft(String(payload.document.content || "").trim())
    } catch (error) {
      if (token !== transcriptLoadRef.current) return
      setAudioWorkflowError(error?.message || t("documents.errors.read_failed"))
    } finally {
      if (token === transcriptLoadRef.current) setAudioTranscriptLoading(false)
    }
  }

  async function handleSelectAudioSource(documentId) {
    const nextId = String(documentId || "").trim()
    const nextSource = audioSources.find((source) => source.id === nextId) || null
    resetTranscript()
    setSelectedAudioDocumentId(nextId)
    setAudioWorkflowError("")
    setAudioWorkflowFeedback(nextSource?.title ? t("documents.drafting.audio.selected", { title: nextSource.title }) : "")
    if (nextId) {
      void fetch(`/api/documents/${encodeURIComponent(nextId)}/audio-select`, {
        method: "POST",
        headers: { "x-ui-locale": locale }
      }).catch(() => {})
    }
    /* Vajutatud „Vali" asendus märgiga „Valitud": leht viib fookuse edasi. */
    onPicked?.()
    if (nextSource?.transcript?.id) await openTranscript(nextSource.transcript)
  }

  async function handleAudioUpload(file) {
    if (!file || audioUploading) return

    const problem = audioFileProblem(file)
    if (problem) {
      setAudioWorkflowFeedback("")
      setAudioWorkflowError(t(problem))
      return
    }

    setAudioUploading(true)
    setAudioWorkflowError("")
    setAudioWorkflowFeedback("")
    resetTranscript()

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("title", file.name || t("documents.drafting.audio.upload"))
      const response = await fetch("/api/documents/audio-sources", {
        method: "POST",
        headers: { "x-ui-locale": locale },
        body: formData
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.audio_upload_failed"))
      const audioSource = payload?.audioSource || null
      const nextSources = audioSource
        ? [audioSource, ...audioSources.filter((source) => source.id !== audioSource.id)]
        : await refreshAudioSources()
      setAudioSources(nextSources)
      if (audioSource?.id) {
        setAudioSourceMode("upload_file")
        setSelectedAudioDocumentId(audioSource.id)
      }
      setAudioWorkflowFeedback(t("documents.drafting.audio.upload_done"))
    } catch (error) {
      setAudioWorkflowFeedback("")
      setAudioWorkflowError(error?.message || t("documents.errors.audio_upload_failed"))
    } finally {
      setAudioUploading(false)
    }
  }

  // A part of a meeting recorded here is an audio source like an uploaded file; the newest part is the selected one.
  function handleRecordedPart(audioSource) {
    if (!audioSource?.id) return
    setAudioSources((sources) => [audioSource, ...sources.filter((source) => source.id !== audioSource.id)])
    /* Salvestis jaguneb osadeks ja uus osa jõuab siia iga kümne minuti järel.
       Kui eelmise osa transkripti parajasti parandatakse või töödeldakse, ei
       võta uus osa seda eest ära: see jääb loendisse ootama. */
    if (canSaveAudioTranscript || transcribingAudio || savingAudioTranscript || summarizingAudio) {
      setAudioWorkflowFeedback(t("documents.drafting.audio.record_part_waiting"))
      return
    }
    resetTranscript()
    setSelectedAudioDocumentId(audioSource.id)
    setAudioWorkflowError("")
    setAudioWorkflowFeedback(t("documents.drafting.audio.record_done"))
  }

  async function handleTranscribeAudio() {
    if (!selectedAudioSource?.id || transcribingAudio) return
    const sourceId = selectedAudioSource.id
    const sourceTitle = selectedAudioSource.title || selectedAudioSource.originalName || ""

    setTranscribingAudio(true)
    setAudioWorkflowError("")
    setAudioWorkflowFeedback("")
    setAudioSummaryArtifact(null)

    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(selectedAudioSource.id)}/transcribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ui-locale": locale
        },
        // Ühe helifaili transkriptsioon ON kavatsus: sama allika teist transkripti ei ole
        // olemas (marsruut tagastab olemasoleva), seega on allika id ise stabiilne võti.
        body: JSON.stringify({ language, idempotencyKey: selectedAudioSource.id })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.transcription_failed"))
      const transcript = payload?.transcriptDocument || null
      if (!transcript?.id) throw new Error(t("documents.errors.transcription_failed"))
      /* Loendi rida saab transkripti alati; toimetis ainult siis, kui see fail on veel valitud. */
      setAudioSources((current) =>
        current.map((source) =>
          source.id === sourceId
            ? { ...source, transcript: { ...transcript, preview: String(transcript.content || "").slice(0, 1200) } }
            : source
        )
      )
      if (selectedIdRef.current !== sourceId) {
        setAudioWorkflowFeedback(t("documents.drafting.transcribe.done_other", { title: sourceTitle }))
        return
      }
      transcriptLoadRef.current += 1
      setAudioTranscriptLoading(false)
      setAudioTranscriptDocument(transcript)
      setAudioTranscriptDraft(String(transcript.content || transcript.preview || "").trim())
      setAudioWorkflowFeedback(t("documents.drafting.transcribe.done"))
    } catch (error) {
      setAudioWorkflowFeedback("")
      setAudioWorkflowError(error?.message || t("documents.errors.transcription_failed"))
    } finally {
      setTranscribingAudio(false)
    }
  }

  async function saveAudioTranscriptIfNeeded() {
    const transcript = activeTranscriptDocument
    if (!transcript?.id || !audioTranscriptDraft.trim()) return transcript
    if (!canSaveAudioTranscript) return transcript
    setSavingAudioTranscript(true)
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(transcript.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-ui-locale": locale
        },
        body: JSON.stringify({
          content: audioTranscriptDraft,
          expectedUpdatedAt: transcript.updatedAt
        })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 409 && payload?.document?.id) {
          setAudioTranscriptDocument(payload.document)
        }
        throw new Error(payload?.message || t("documents.errors.update_failed"))
      }
      const updated = payload?.document || transcript
      setAudioTranscriptDocument(updated)
      setAudioTranscriptDraft(String(updated.content || "").trim())
      setAudioWorkflowFeedback(t("documents.drafting.review.saved"))
      return updated
    } finally {
      setSavingAudioTranscript(false)
    }
  }

  async function handleSaveAudioTranscript() {
    if (!canSaveAudioTranscript || savingAudioTranscript) return
    setAudioWorkflowError("")
    setAudioWorkflowFeedback("")
    try {
      await saveAudioTranscriptIfNeeded()
    } catch (error) {
      setAudioWorkflowError(error?.message || t("documents.errors.update_failed"))
    }
  }

  /** @returns {Promise<boolean>} kas kokkuvõte sai valmis */
  async function handleCreateAudioSummary() {
    if (!canCreateAudioSummary || !activeTranscriptDocument?.id) return false
    const sourceId = selectedIdRef.current
    setSummarizingAudio(true)
    setAudioWorkflowError("")
    setAudioWorkflowFeedback("")
    try {
      const transcript = await saveAudioTranscriptIfNeeded()
      const transcriptDocument = {
        id: transcript.id,
        title: transcript.title,
        originalName: transcript.originalName || transcript.title,
        kind: transcript.kind || "AUDIO_TRANSCRIPT",
        agentAllowed: true,
        mime: transcript.mime || "text/plain",
        size: transcript.size || String(transcript.content || audioTranscriptDraft || "").length,
        sourceDocumentId: transcript.sourceDocumentId || selectedAudioSource?.id || null,
        content: transcript.content || audioTranscriptDraft || "",
        createdAt: transcript.createdAt,
        updatedAt: transcript.updatedAt
      }
      // Sama transkripti võib pärast muutmist ausalt uuesti kokku võtta, seega ei ole võti
      // siin transkripti id, vaid kavatsuse allkiri: kordus sama sisuga kannab sama võtit.
      const summaryPayload = {
        language,
        content: transcriptDocument.content
      }
      summaryIntentRef.current = resolveIntentKey(
        summaryIntentRef.current,
        buildIntentSignature({ ...summaryPayload, transcriptId: transcript.id })
      )
      const response = await fetch(`/api/documents/${encodeURIComponent(transcript.id)}/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ui-locale": locale
        },
        body: JSON.stringify({
          ...summaryPayload,
          idempotencyKey: summaryIntentRef.current.key
        })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.summary_failed"))
      summaryIntentRef.current = null
      const summary = payload?.summaryArtifact || null
      if (!summary?.id) throw new Error(t("documents.errors.summary_failed"))
      /* Kokkuvõte saab tööruumi tulemuseks ja transkript selle lähtefailiks: seda teeb leht. */
      onSummary?.({ summary, transcriptDocument })
      /* Heli raja „kokkuvõte on valmis" käib valitud faili kohta: kui vahepeal
         valiti teine fail, seda siin ei näidata (tulemus on ruumis olemas). */
      if (selectedIdRef.current !== sourceId) return false
      setAudioSummaryArtifact(summary)
      setAudioWorkflowFeedback(t("documents.drafting.summary_view.ready"))
      return true
    } catch (error) {
      setAudioWorkflowError(error?.message || t("documents.errors.summary_failed"))
      return false
    } finally {
      setSummarizingAudio(false)
    }
  }

  return {
    uploadInputRef,
    audioSourceMode,
    audioSources,
    audioSourcesLoading,
    audioSourcesError,
    selectedAudioDocumentId,
    selectedAudioSource,
    audioUploading,
    audioWorkflowError,
    audioWorkflowFeedback,
    transcribingAudio,
    audioTranscriptDocument,
    audioTranscriptDraft,
    audioTranscriptLoading,
    activeTranscriptDocument,
    transcriptLoaded,
    savingAudioTranscript,
    summarizingAudio,
    audioSummaryArtifact,
    canTranscribeAudio,
    canSaveAudioTranscript,
    canCreateAudioSummary,
    setAudioSourceMode,
    setAudioWorkflowError,
    setAudioWorkflowFeedback,
    setAudioTranscriptDraft,
    openTranscript,
    handleSelectAudioSource,
    handleAudioUpload,
    handleRecordedPart,
    handleTranscribeAudio,
    handleSaveAudioTranscript,
    handleCreateAudioSummary
  }
}
