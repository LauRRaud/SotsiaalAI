"use client"

/**
 * Heli raja vaadete sidumine olekuga.
 *
 * Leht (`../AgentModePage.jsx`) joonistab lava ja annab iga sammu kohta siia
 * vaate võtme; siin pannakse kokku, mida vaade näitab ja mida selle nupud
 * teevad. Olek ja päringud on konksus ./useAudioPath.js (leht kutsub seda, et
 * olek jääks alles ka koostamise jadas käies), vaated failis ./AudioViews.jsx,
 * reeglid failis ./draftingModel.js.
 *
 * KAKS TASULIST NUPPU on siin: „Koosta transkript" ja „Koosta kokkuvõte".
 * Kumbki käib lehe tasulise töö värava kaudu (`press.runPaid`); kokkuvõte küsib
 * lisaks teist vajutust, kui tööruumis on salvestamata tekst, sest valmis
 * kokkuvõte tuleb selle asemele.
 *
 * SALVESTI on lehel ainult valiku „Salvesta siin" all ja selle nõusoleku samm
 * jääb puutumata. Lahkumine (teine tee, tagasi koostamise juurde) lõpetaks
 * pooleli salvestamise, seepärast küsib see salvestamise ajal teist vajutust.
 */

import SessionRecorder from "@/components/documents/SessionRecorder"
import Button from "@/components/ui/Button"

import { AudioSourceView, ReviewView, SummaryView, TranscribeView } from "./AudioViews"
import { footNote } from "./DraftingBits"
import { AUDIO_SOURCE_LIST_LIMIT, audioSourceRows, audioWayOptions, summaryBlocker, transcribeBlocker } from "./draftingModel"
import styles from "./drafting.module.css"

/* Salvesti komponent jääb muutmata; siit saab see ainult oma kujunduse klassid. */
const RECORDER_CLASSES = Object.freeze({
  root: styles.recorder,
  consent: styles.recConsent,
  actions: styles.recActions,
  button: styles.recButton,
  status: styles.recStatus,
  hint: styles.recHint,
  error: styles.recError
})

/**
 * @param {object} props
 * @param {string} props.viewKey      heli raja vaade: audio, transcribe, review või summary
 * @param {boolean} props.active      kas see vaade on ees (teated ja teise vajutuse selgitus on ainult seal)
 * @param {boolean} props.glow        põhinupu läige (ainult ees oleval vaatel)
 * @param {object} props.audio        `useAudioPath` olek ja päringud
 * @param {object} props.press        lehe vajutuste väravad ja teise vajutuse sõnad
 * @param {object} props.language     `{ value, options, onChange }`: salvestise ja kokkuvõtte keel
 * @param {boolean} props.unsavedText kas tööruumi toimetis on salvestamata tekst
 * @param {Function} props.recorderBusy kas salvesti parajasti salvestab
 * @param {Function} props.onView     ava heli raja teine vaade
 * @param {Function} props.onClose    tagasi koostamise jadasse
 * @param {Function} props.onOpenResult ava valmis kokkuvõte tekstivaates
 */
export default function AudioPath({ viewKey, active, glow, t, locale, audio, summaryOpen = false, press, language, unsavedText, recorderBusy, viewTitle, viewShort, onView, onClose, onOpenResult }) {
  const { guarded, runPaid, labelFor, armedNote } = press
  const notice = active
    ? {
        ok: audio.audioWorkflowFeedback,
        onClose: () => audio.setAudioWorkflowFeedback(""),
        error: audio.audioWorkflowError || audio.audioSourcesError
      }
    : null
  /* Tee tagasi koostamise juurde on iga vaate jalareal. */
  const note = (text = "", go = null) =>
    footNote({
      back: { text: t("documents.drafting.audio.back"), label: t("documents.drafting.audio.back_label"), onClick: onClose },
      text: (active && armedNote) || text,
      go: active && armedNote ? null : go
    })
  const title = viewTitle(viewKey)
  const hasTranscript = Boolean(audio.activeTranscriptDocument?.id)
  const rows = audioSourceRows(audio.audioSources, { selectedId: audio.selectedAudioDocumentId, t, locale })
  const selectedRow = rows.find((row) => row.selected) || null

  if (viewKey === "audio") {
    const way = audio.audioSourceMode
    return (
      <AudioSourceView
        t={t}
        title={title}
        notice={notice}
        glow={glow}
        ways={{
          label: t("documents.drafting.audio.ways_label"),
          options: audioWayOptions(t),
          value: way,
          onChange: (nextValue) => {
            if (nextValue === way) return
            /* Salvesti on lehel ainult oma valiku all: teise tee valimine
               lõpetaks salvestamise, seepärast küsib see teist vajutust. */
            guarded(`way:${nextValue}`, way === "record_now" && recorderBusy(), () => {
              audio.setAudioSourceMode(nextValue)
              audio.setAudioWorkflowError("")
              audio.setAudioWorkflowFeedback("")
            })
          }
        }}
        record={
          way === "record_now"
            ? {
                help: t("documents.drafting.audio.record_help"),
                node: (
                  <SessionRecorder
                    ButtonComponent={Button}
                    buttonProps={{ size: "sm", glow }}
                    classNames={RECORDER_CLASSES}
                    onPartSaved={audio.handleRecordedPart}
                  />
                )
              }
            : null
        }
        upload={
          way === "upload_file"
            ? {
                inputRef: audio.uploadInputRef,
                accept: "audio/*,.ogg,.oga,.opus,.webm,.mp3,.m4a,.wav,.flac,.aac",
                label: audio.audioUploading ? t("documents.drafting.audio.uploading") : labelFor("upload", t("documents.drafting.audio.upload")),
                disabled: audio.audioUploading,
                help: t("documents.drafting.audio.upload_help"),
                /* Uus helifail võtab transkripti toimeti eest ära. */
                onPick: () => guarded("upload", audio.canSaveAudioTranscript, () => audio.uploadInputRef.current?.click()),
                onFile: (file) => void audio.handleAudioUpload(file)
              }
            : null
        }
        existing={
          way === "choose_existing"
            ? {
                help: t("documents.drafting.audio.existing_help", { count: AUDIO_SOURCE_LIST_LIMIT }),
                loading: audio.audioSourcesLoading,
                rows: rows.map((row) => ({
                  ...row,
                  chooseLabel: labelFor(`audio:${row.key}`, t("documents.drafting.audio.choose")),
                  onChoose: () => guarded(`audio:${row.key}`, audio.canSaveAudioTranscript, () => void audio.handleSelectAudioSource(row.key))
                }))
              }
            : null
        }
        selected={selectedRow ? t("documents.drafting.audio.selected", { title: selectedRow.title }) : ""}
        note={note(t("documents.drafting.audio.manual_note"))}
      />
    )
  }

  if (viewKey === "transcribe") {
    const blocker = transcribeBlocker({
      sourceId: audio.selectedAudioSource?.id,
      hasTranscript,
      busy: !audio.canTranscribeAudio || audio.summarizingAudio
    })
    const blockText = audio.transcribingAudio
      ? t("documents.drafting.transcribe.working")
      : !audio.selectedAudioSource
        ? t("documents.drafting.transcribe.needs_audio")
        : hasTranscript
          ? t("documents.drafting.transcribe.exists_note")
          : ""
    return (
      <TranscribeView
        t={t}
        title={title}
        lead={audio.selectedAudioSource && !hasTranscript ? t("documents.drafting.transcribe.lead") : undefined}
        notice={notice}
        glow={glow}
        source={selectedRow ? { title: selectedRow.title, origin: selectedRow.origin, meta: selectedRow.meta } : null}
        done={hasTranscript ? t("documents.drafting.transcribe.exists") : ""}
        language={audio.selectedAudioSource ? { label: t("documents.drafting.transcribe.language"), ...language } : null}
        transcribe={
          hasTranscript
            ? null
            : {
                label: t("documents.drafting.transcribe.action"),
                disabled: Boolean(blocker),
                /* Tasuline töö: ainult sellest nupust ja ainult siis, kui miski ei takista. */
                onPress: () => (blocker ? undefined : runPaid(() => audio.handleTranscribeAudio()))
              }
        }
        note={note(blockText, audio.selectedAudioSource ? null : { label: viewShort("audio"), onClick: () => onView("audio") })}
      />
    )
  }

  if (viewKey === "review") {
    const state = audio.transcriptLoaded ? "ready" : audio.audioTranscriptLoading ? "loading" : hasTranscript ? "failed" : "none"
    return (
      <ReviewView
        t={t}
        title={title}
        lead={t("documents.drafting.review.lead")}
        notice={notice}
        glow={glow}
        state={state}
        emptyText={t(state === "failed" ? "documents.errors.read_failed" : "documents.drafting.review.empty")}
        editor={{
          label: t("documents.drafting.review.label"),
          value: audio.audioTranscriptDraft,
          onChange: audio.setAudioTranscriptDraft
        }}
        retry={{ label: t("documents.drafting.review.retry"), onClick: () => void audio.openTranscript() }}
        actions={
          audio.transcriptLoaded
            ? [
                {
                  key: "download",
                  label: t("documents.drafting.review.download"),
                  href: `/api/documents/${encodeURIComponent(audio.audioTranscriptDocument.id)}/download`
                },
                {
                  key: "save",
                  label: audio.savingAudioTranscript ? t("documents.actions.saving") : t("documents.drafting.review.save"),
                  variant: "primary",
                  disabled: !audio.canSaveAudioTranscript || audio.savingAudioTranscript,
                  onClick: () => void audio.handleSaveAudioTranscript()
                }
              ]
            : []
        }
        note={note(
          audio.canSaveAudioTranscript ? t("documents.drafting.review.unsaved") : "",
          state === "none" ? { label: viewShort("transcribe"), onClick: () => onView("transcribe") } : null
        )}
      />
    )
  }

  if (viewKey === "summary") {
    const hasText = Boolean(audio.audioTranscriptDraft.trim())
    const blocker = summaryBlocker({
      transcriptId: audio.activeTranscriptDocument?.id,
      loaded: audio.transcriptLoaded,
      draft: audio.audioTranscriptDraft,
      /* Transkript on olemas ja tekst ka: siis takistab ainult pooleli töö. */
      busy: (audio.transcriptLoaded && hasText && !audio.canCreateAudioSummary) || audio.transcribingAudio
    })
    const blockText = audio.summarizingAudio
      ? t("documents.drafting.summary_view.working")
      : blocker === "transcript"
        ? t("documents.drafting.summary_view.needs_transcript")
        : blocker === "empty_text"
          ? t("documents.drafting.summary_view.needs_text")
          : ""
    return (
      <SummaryView
        t={t}
        title={title}
        lead={t("documents.drafting.summary_view.lead")}
        notice={notice}
        glow={glow}
        done={
          summaryOpen
            ? { text: t("documents.drafting.summary_view.ready"), openLabel: t("documents.drafting.summary_view.open"), onOpen: onOpenResult }
            : null
        }
        summarize={{
          label: labelFor("summary", t("documents.drafting.summary_view.action")),
          disabled: Boolean(blocker),
          /* Tasuline töö: ainult sellest nupust. Kokkuvõte tuleb tööruumis oleva
             tulemuse asemele, seepärast küsib salvestamata tekst teist vajutust. */
          onPress: () =>
            blocker
              ? undefined
              : guarded("summary", unsavedText, () =>
                  runPaid(async () => {
                    const ready = await audio.handleCreateAudioSummary()
                    /* Valmis kokkuvõte avaneb tekstivaates. Kui salvestamine veel
                       käib, jääb heli rada ette (jada vahetus lõpetaks salvestamise)
                       ja mustandi juurde viib vaate nupp. */
                    if (ready && !recorderBusy()) onOpenResult()
                  })
                )
        }}
        note={note(blockText, blocker === "transcript" ? { label: viewShort("review"), onClick: () => onView("review") } : null)}
      />
    )
  }

  return null
}
