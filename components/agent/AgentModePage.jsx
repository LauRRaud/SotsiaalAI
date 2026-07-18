"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAccessibility } from "@/components/accessibility/AccessibilityProvider"
import { useEffectiveRole } from "@/components/auth/useEffectiveRole"
import { useI18n } from "@/components/i18n/I18nProvider"
import AdminRoleViewCycleButton from "@/components/workspace/AdminRoleViewCycleButton"
import ChatComposer from "@/components/alalehed/chat/ChatComposer"
import ChatMessageItem from "@/components/alalehed/chat/ChatMessageItem"
import ConversationView from "@/components/alalehed/chat/ConversationView"
import { detectMobileViewport } from "@/components/alalehed/chat/chatLayoutVars"
import DocumentsDropdown from "@/components/documents/DocumentsDropdown"
import Button from "@/components/ui/Button"
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot"
import { SubpageHeader } from "@/components/ui/SubpageHeader"
import Input from "@/components/ui/Input"
import Panel from "@/components/ui/Panel"
import OptionCard from "@/components/ui/OptionCard"
import Textarea from "@/components/ui/Textarea"
import { AGENT_ARTIFACT_TYPE_VALUES } from "@/lib/documents/constants"
import { clientTaskInstruction } from "@/lib/documents/agentTasks"
import {
  artifactStatusLabel,
  artifactTypeLabel,
  formatDate,
  formatFileSize,
  kindLabel,
  templateForLabel
} from "@/lib/documents/presentation"
import { localizePath } from "@/lib/localizePath"
import { pushWithTransition } from "@/lib/routeTransition"

const CHAT_WORKSPACE_RESTORE_STORAGE_KEY = "__SOTSIAALAI_CHAT_WORKSPACE_RESTORE__"
const WORKSPACE_VERSION_LIMIT = 8
const CLIENT_MAX_DOCUMENTS = 2
const CLIENT_AGENT_TASK_OPTIONS = [
  { value: "LETTER_REQUEST", artifactType: "LETTER_DRAFT", labelKey: "documents.agent_workspace.client_tasks.letter_request" },
  { value: "LETTER_REPLY", artifactType: "LETTER_DRAFT", labelKey: "documents.agent_workspace.client_tasks.letter_reply" },
  { value: "FILL_FORM", artifactType: "OTHER", labelKey: "documents.agent_workspace.client_tasks.fill_form" }
]

function markChatWorkspaceRestore() {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(
      CHAT_WORKSPACE_RESTORE_STORAGE_KEY,
      JSON.stringify({ ts: Date.now() })
    )
  } catch {}
}

function createWorkspaceMessage({ role, text, attachments = [] }) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text: String(text || ""),
    attachments: Array.isArray(attachments) ? attachments : []
  }
}

function isTemplateCompatible(template, artifactType) {
  const templateType = String(template?.templateFor || "").trim().toUpperCase()
  const targetType = String(artifactType || "").trim().toUpperCase()
  return !templateType || templateType === "OTHER" || templateType === targetType
}

function templateOptionLabel(template, t) {
  const title = String(template?.title || template?.originalName || "").trim()
  const target = template?.templateFor ? templateForLabel(template.templateFor, t) : ""
  return target ? `${title} - ${target}` : title
}

const audioInputSourceOptions = [
  { value: "upload_file", labelKey: "documents.agent_workspace.audio_input.sources.upload_file" },
  { value: "choose_existing", labelKey: "documents.agent_workspace.audio_input.sources.choose_existing" }
]

function formatArtifactMessage(artifact, t) {
  if (!artifact) return ""
  const title = String(artifact?.title || "").trim()
  const content = String(artifact?.content || "").trim()
  if (title && content) return `${title}\n\n${content}`
  if (content) return content
  return title || t("documents.agent_workspace.result_empty")
}

function buildSourceAttachments(sources, t) {
  return Array.isArray(sources)
    ? sources
        .filter((source) => source?.id)
        .map((source) => ({
          label: source?.title || source?.originalName || t("documents.actions.download"),
          url: `/api/documents/${encodeURIComponent(source.id)}/download`,
          fileName: source?.originalName || undefined
        }))
    : []
}

export default function AgentModePage({ initialDocumentIds = [], initialArtifactId = "", embedded = false, onBack = null, hideHeader = false }) {
  const router = useRouter()
  const { t, locale } = useI18n()
  const { prefs } = useAccessibility()
  const { effectiveRole, isAdmin, refresh: refreshEffectiveRole } = useEffectiveRole()
  const isClientRole = effectiveRole === "CLIENT"
  /* Paneeli ainus ⓘ (PanelFrame, × kõrval). Manustatuna on ⓘ omanik Töölaud. */
  usePanelInfoSlot({
    infoId: "document_drafting",
    title: t("chat.tools.agent_mode"),
    active: !embedded
  })
  const documentsHref = localizePath("/documents", locale)
  const chatHref = localizePath("/vestlus", locale)
  const backHref = chatHref
  const isLightTheme = prefs?.theme === "light"
  const roleScope = effectiveRole === "CLIENT" ? "client" : "worker"
  const defaultAudience = effectiveRole === "CLIENT" ? "client" : "worker"
  const initialDocumentIdsSignature = Array.isArray(initialDocumentIds)
    ? initialDocumentIds.map((value) => String(value || "").trim()).filter(Boolean).join("\u001f")
    : String(initialDocumentIds || "").trim()
  const initialSelectedDocumentIds = useMemo(
    () => Array.from(new Set(initialDocumentIdsSignature.split("\u001f").map((value) => value.trim()).filter(Boolean))),
    [initialDocumentIdsSignature]
  )
  const chatWindowRef = useRef(null)
  const inputBarRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const clientUploadInputRef = useRef(null)
  const audioUploadInputRef = useRef(null)
  const composerDraftApiRef = useRef(null)
  const activeRequestAbortRef = useRef(null)
  const [selectedDocumentIds, setSelectedDocumentIds] = useState(initialSelectedDocumentIds)
  const [documents, setDocuments] = useState([])
  const [templates, setTemplates] = useState([])
  const [missingDocumentIds, setMissingDocumentIds] = useState([])
  const [documentsLoading, setDocumentsLoading] = useState(selectedDocumentIds.length > 0)
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [documentsError, setDocumentsError] = useState("")
  const [templatesError, setTemplatesError] = useState("")
  const [clientUploadError, setClientUploadError] = useState("")
  const [clientUploading, setClientUploading] = useState(false)
  const [recentArtifacts, setRecentArtifacts] = useState([])
  const [recentArtifactsLoading, setRecentArtifactsLoading] = useState(isClientRole)
  const [recentArtifactsError, setRecentArtifactsError] = useState("")

  const [outputType, setOutputType] = useState("REPORT_DRAFT")
  const [audience, setAudience] = useState(defaultAudience)
  const [audienceTouched, setAudienceTouched] = useState(false)
  const [tone, setTone] = useState("professional")
  const [language, setLanguage] = useState(locale || "et")
  const [length, setLength] = useState("standard")
  const [instruction, setInstruction] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [clientTask, setClientTask] = useState("LETTER_REQUEST")
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
  const [savingAudioTranscript, setSavingAudioTranscript] = useState(false)
  const [summarizingAudio, setSummarizingAudio] = useState(false)
  const [audioSummaryArtifact, setAudioSummaryArtifact] = useState(null)

  const [persistedArtifactId, setPersistedArtifactId] = useState(String(initialArtifactId || "").trim())
  const [workspaceResult, setWorkspaceResult] = useState(null)
  const [resultTitle, setResultTitle] = useState("")
  const [resultContent, setResultContent] = useState("")
  const [refineInstruction, setRefineInstruction] = useState("")
  const [artifactLoading, setArtifactLoading] = useState(Boolean(initialArtifactId))
  const [artifactError, setArtifactError] = useState("")

  const [starting, setStarting] = useState(false)
  const [refiningResult, setRefiningResult] = useState(false)
  const [savingResult, setSavingResult] = useState(false)
  const [approvingResult, setApprovingResult] = useState(false)
  const [runError, setRunError] = useState("")
  const [runFeedback, setRunFeedback] = useState(null)
  const [approvalNotice, setApprovalNotice] = useState(null)
  const [workspaceVersions, setWorkspaceVersions] = useState([])
  const [conversationMessages, setConversationMessages] = useState([])
  const [inputFocused, setInputFocused] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  function createWorkspaceVersion({ kind, title, content, type, templateId = selectedTemplateId }) {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind,
      title: String(title || ""),
      content: String(content || ""),
      type: String(type || outputType || "REPORT_DRAFT"),
      templateId: String(templateId || ""),
      createdAt: new Date().toISOString()
    }
  }

  function resetWorkspaceVersionsFromResult(nextResult, kind = "generated") {
    const nextContent = String(nextResult?.content || "")
    if (!nextContent.trim()) {
      setWorkspaceVersions([])
      return
    }

    setWorkspaceVersions([
      createWorkspaceVersion({
        kind,
        title: nextResult?.title,
        content: nextContent,
        type: nextResult?.type,
        templateId: nextResult?.templateId
      })
    ])
  }

  function appendWorkspaceVersion({ kind, title, content, type, templateId = selectedTemplateId }) {
    const nextContent = String(content || "")
    if (!nextContent.trim()) return

    setWorkspaceVersions((current) => {
      const nextVersion = createWorkspaceVersion({ kind, title, content: nextContent, type, templateId })
      return [...current.slice(-(WORKSPACE_VERSION_LIMIT - 1)), nextVersion]
    })
  }

  function applyWorkspaceResult(nextResult) {
    setWorkspaceResult(nextResult)
    setResultTitle(String(nextResult?.title || ""))
    setResultContent(String(nextResult?.content || ""))
    setRefineInstruction("")
    if (nextResult?.type) setOutputType(String(nextResult.type))
    setSelectedTemplateId(String(nextResult?.templateId || ""))
  }

  function clearWorkspaceResult() {
    setWorkspaceResult(null)
    setResultTitle("")
    setResultContent("")
    setRefineInstruction("")
    setInstruction("")
    setPersistedArtifactId("")
    setArtifactError("")
    setWorkspaceVersions([])
    setConversationMessages([])
  }

  function buildWorkspaceHref(nextArtifactId = "") {
    const basePath = localizePath("/dokreziim", locale)
    const params = new URLSearchParams()
    if (selectedDocumentIds.length) params.set("documents", selectedDocumentIds.join(","))
    if (nextArtifactId) params.set("artifact", nextArtifactId)
    const query = params.toString()
    return query ? `${basePath}?${query}` : basePath
  }

  const clearResultMessages = useCallback(() => {
    if (runError) setRunError("")
    if (runFeedback) setRunFeedback(null)
    if (artifactError) setArtifactError("")
    if (approvalNotice) setApprovalNotice(null)
  }, [approvalNotice, artifactError, runError, runFeedback])

  useEffect(() => {
    if (!approvalNotice) return undefined
    const timer = window.setTimeout(() => setApprovalNotice(null), 8000)
    return () => window.clearTimeout(timer)
  }, [approvalNotice])

  useEffect(() => {
    if (typeof window === "undefined") return undefined
    const updateMobileState = () => setIsMobile(detectMobileViewport())
    updateMobileState()
    const mobileQuery = window.matchMedia("(max-width: 768px)")
    mobileQuery.addEventListener?.("change", updateMobileState)
    window.addEventListener("resize", updateMobileState)
    return () => {
      mobileQuery.removeEventListener?.("change", updateMobileState)
      window.removeEventListener("resize", updateMobileState)
    }
  }, [])

  useEffect(() => () => {
    activeRequestAbortRef.current?.abort?.()
  }, [])

  useEffect(() => {
    if (!audienceTouched) {
      setAudience(defaultAudience)
    }
  }, [audienceTouched, defaultAudience])

  useEffect(() => {
    setSelectedDocumentIds((current) => {
      if (
        current.length === initialSelectedDocumentIds.length &&
        current.every((id, index) => id === initialSelectedDocumentIds[index])
      ) {
        return current
      }
      return initialSelectedDocumentIds
    })
  }, [initialSelectedDocumentIds])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadDocuments() {
      if (!selectedDocumentIds.length) {
        setDocuments([])
        setMissingDocumentIds([])
        setDocumentsError("")
        setDocumentsLoading(false)
        return
      }

      setDocumentsLoading(true)
      setDocumentsError("")

      try {
        const results = await Promise.all(selectedDocumentIds.map(async (id) => {
          try {
            const response = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
              cache: "no-store",
              signal: controller.signal
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) {
              return {
                id,
                error: payload?.message || t("documents.errors.load_documents"),
                status: response.status
              }
            }
            return { id, document: payload?.document || null }
          } catch (error) {
            if (controller.signal.aborted) return { id, aborted: true }
            return {
              id,
              error: error?.message || t("documents.errors.load_documents")
            }
          }
        }))

        if (cancelled) return

        const nextDocuments = []
        const nextMissingIds = []
        let nextError = ""

        for (const result of results) {
          if (result?.document) {
            nextDocuments.push(result.document)
            continue
          }
          if (result?.aborted) continue
          nextMissingIds.push(result.id)
          if (!nextError && result?.status && ![403, 404].includes(result.status)) {
            nextError = result.error || t("documents.errors.load_documents")
          }
        }

        setDocuments(nextDocuments)
        setMissingDocumentIds(nextMissingIds)
        setDocumentsError(nextError)
      } finally {
        if (!cancelled) setDocumentsLoading(false)
      }
    }

    void loadDocuments()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedDocumentIds, t])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadTemplates() {
      if (isClientRole) {
        setTemplates([])
        setTemplatesError("")
        setTemplatesLoading(false)
        return
      }

      setTemplatesLoading(true)
      setTemplatesError("")

      try {
        const params = new URLSearchParams({
          kind: "TEMPLATE",
          limit: "50"
        })
        const response = await fetch(`/api/documents?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.message || t("documents.errors.load_documents"))
        if (cancelled) return
        setTemplates(Array.isArray(payload?.documents) ? payload.documents : [])
      } catch (error) {
        if (controller.signal.aborted || cancelled) return
        setTemplates([])
        setTemplatesError(error?.message || t("documents.errors.load_documents"))
      } finally {
        if (!cancelled) setTemplatesLoading(false)
      }
    }

    void loadTemplates()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [isClientRole, t])

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

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadRecentArtifacts() {
      if (!isClientRole) {
        setRecentArtifacts([])
        setRecentArtifactsError("")
        setRecentArtifactsLoading(false)
        return
      }

      setRecentArtifactsLoading(true)
      setRecentArtifactsError("")

      try {
        const response = await fetch("/api/documents/artifacts?limit=10", {
          cache: "no-store",
          signal: controller.signal
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.message || t("documents.artifacts.errors.list_failed"))
        if (cancelled) return
        setRecentArtifacts(Array.isArray(payload?.artifacts) ? payload.artifacts : [])
      } catch (error) {
        if (controller.signal.aborted || cancelled) return
        setRecentArtifacts([])
        setRecentArtifactsError(error?.message || t("documents.artifacts.errors.list_failed"))
      } finally {
        if (!cancelled) setRecentArtifactsLoading(false)
      }
    }

    void loadRecentArtifacts()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [isClientRole, t])

  useEffect(() => {
    setPersistedArtifactId(String(initialArtifactId || "").trim())
  }, [initialArtifactId])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadArtifact() {
      if (!persistedArtifactId) {
        setArtifactLoading(false)
        setArtifactError("")
        return
      }

      if (workspaceResult?.id === persistedArtifactId) {
        setArtifactLoading(false)
        setArtifactError("")
        return
      }

      setArtifactLoading(true)
      setArtifactError("")

      try {
        const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(persistedArtifactId)}`, {
          cache: "no-store",
          signal: controller.signal
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.message || t("documents.errors.load_artifact"))
        if (cancelled) return
        const nextArtifact = payload?.artifact || null
        applyWorkspaceResult(nextArtifact)
        const nextContent = String(nextArtifact?.content || "")
        if (nextContent.trim()) {
          setWorkspaceVersions([
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              kind: "loaded",
              title: String(nextArtifact?.title || ""),
              content: nextContent,
              type: String(nextArtifact?.type || "REPORT_DRAFT"),
              templateId: String(nextArtifact?.templateId || ""),
              createdAt: new Date().toISOString()
            }
          ])
        } else {
          setWorkspaceVersions([])
        }
      } catch (error) {
        if (controller.signal.aborted || cancelled) return
        applyWorkspaceResult(null)
        setWorkspaceVersions([])
        setArtifactError(error?.message || t("documents.errors.load_artifact"))
      } finally {
        if (!cancelled) setArtifactLoading(false)
      }
    }

    void loadArtifact()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [persistedArtifactId, t, workspaceResult?.id])

  const outputTypeOptions = useMemo(() => {
    if (isClientRole) {
      return CLIENT_AGENT_TASK_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
        artifactType: option.artifactType
      }))
    }

    return AGENT_ARTIFACT_TYPE_VALUES
      .filter((value) => value !== "TRANSCRIPT_SUMMARY")
      .map((value) => ({ value, label: artifactTypeLabel(value, t) }))
  }, [isClientRole, t])
  const audienceOptions = useMemo(
    () => [
      { value: "worker", label: t("chat.deep_research.scope_output_worker") },
      { value: "client", label: t("chat.deep_research.scope_output_client") }
    ],
    [t]
  )
  const toneOptions = useMemo(
    () => [
      { value: "professional", label: t("documents.agent_workspace.tones.professional") },
      { value: "supportive", label: t("documents.agent_workspace.tones.supportive") },
      { value: "plain", label: t("documents.agent_workspace.tones.plain") }
    ],
    [t]
  )
  const languageOptions = useMemo(
    () => [
      { value: "et", label: t("common.languages.et") },
      { value: "en", label: t("common.languages.en") },
      { value: "ru", label: t("common.languages.ru") }
    ],
    [t]
  )
  const lengthOptions = useMemo(
    () => [
      { value: "short", label: t("documents.agent_workspace.lengths.short") },
      { value: "standard", label: t("documents.agent_workspace.lengths.standard") },
      { value: "detailed", label: t("documents.agent_workspace.lengths.detailed") }
    ],
    [t]
  )

  const selectedCount = documents.length
  const selectedAudioSource = useMemo(
    () => audioSources.find((source) => source.id === selectedAudioDocumentId) || null,
    [audioSources, selectedAudioDocumentId]
  )
  const activeTranscriptDocument = audioTranscriptDocument || selectedAudioSource?.transcript || null
  const canTranscribeAudio = Boolean(selectedAudioSource?.id) && !transcribingAudio && !audioUploading
  const canSaveAudioTranscript =
    Boolean(activeTranscriptDocument?.id && audioTranscriptDraft.trim()) &&
    String(audioTranscriptDraft || "") !== String(activeTranscriptDocument?.content || activeTranscriptDocument?.preview || "")
  const canCreateAudioSummary =
    Boolean(activeTranscriptDocument?.id && audioTranscriptDraft.trim()) &&
    !starting &&
    !summarizingAudio &&
    !savingAudioTranscript &&
    !refiningResult &&
    !savingResult &&
    !approvingResult
  const selectedCountLimitReached = isClientRole && selectedCount >= CLIENT_MAX_DOCUMENTS
  const templateTargetType = String(workspaceResult?.type || outputType || "REPORT_DRAFT")
  const allowedTemplates = useMemo(() => templates.filter((template) => template.agentAllowed), [templates])
  const activeTemplate =
    allowedTemplates.find((template) => template.id === selectedTemplateId) ||
    (workspaceResult?.template && String(workspaceResult.template.id || "") === String(selectedTemplateId || "")
      ? workspaceResult.template
      : null)
  const compatibleTemplates = useMemo(() => {
    const base = allowedTemplates.filter((template) => isTemplateCompatible(template, templateTargetType))
    if (activeTemplate && !base.some((template) => template.id === activeTemplate.id)) {
      return [activeTemplate, ...base]
    }
    return base
  }, [activeTemplate, allowedTemplates, templateTargetType])
  const templateOptions = useMemo(
    () => compatibleTemplates.map((template) => ({ value: template.id, label: templateOptionLabel(template, t) })),
    [compatibleTemplates, t]
  )
  const templateDropdownOptions = useMemo(
    () => [{ value: "", label: t("documents.agent_workspace.template_none") }, ...templateOptions],
    [t, templateOptions]
  )
  const hasWorkspaceResult = Boolean(workspaceResult)
  const isWorkspaceResultSaved = Boolean(workspaceResult?.id)
  const canPersistResult = hasWorkspaceResult && resultContent.trim().length > 0
  const canClearWorkspaceResult = hasWorkspaceResult && !starting && !refiningResult && !savingResult && !approvingResult
  const hasDraftEdits =
    hasWorkspaceResult &&
    (String(resultTitle || "").trim() !== String(workspaceResult?.title || "").trim() ||
      String(resultContent || "") !== String(workspaceResult?.content || ""))
  const canRestoreSavedVersion =
    isWorkspaceResultSaved &&
    workspaceResult?.status === "DRAFT" &&
    hasDraftEdits &&
    !refiningResult &&
    !savingResult &&
    !approvingResult
  const canRunAlternateOutput =
    !isClientRole &&
    selectedCount > 0 &&
    instruction.trim().length > 0 &&
    !starting &&
    !refiningResult &&
    !savingResult &&
    !approvingResult
  const alternateOutputOptions = outputTypeOptions.filter((option) => option.value !== String(workspaceResult?.type || outputType || ""))
  const activeArtifactDetailHref = !isClientRole && isWorkspaceResultSaved
    ? localizePath(`/documents/artifacts/${encodeURIComponent(workspaceResult.id)}`, locale)
    : ""
  const artifactResultsHref = !isClientRole ? localizePath("/documents?artifacts=all#artifacts", locale) : ""
  const isAgentBusy = starting || refiningResult
  const conversationIntroText = selectedCount
    ? t(`documents.agent_workspace.conversation_intro_with_docs_${roleScope}`, { count: selectedCount })
    : t(`documents.agent_workspace.conversation_intro_empty_${roleScope}`)
  const conversationHelpText = isAgentBusy
    ? starting
      ? t("documents.agent_workspace.conversation_generating")
      : t("documents.agent_workspace.conversation_refining")
    : !selectedCount
      ? t(isClientRole ? "documents.agent_workspace.client_needs_documents" : "documents.agent_workspace.needs_documents")
      : hasWorkspaceResult && workspaceResult?.status === "DRAFT" && resultContent.trim()
        ? t("documents.agent_workspace.conversation_refine_help")
        : t("documents.agent_workspace.conversation_ready_help")
  const clientResultLabel =
    outputTypeOptions.find((option) => option.value === clientTask)?.label || t("documents.agent_workspace.client_tasks.letter_request")
  const agentConversationVars = useMemo(
    () => ({
      "--chat-window-max-w": "100%",
      "--chat-window-shift-x": "0rem",
      "--chat-window-shift-y": "0rem",
      "--chat-window-top-offset": "0rem",
      "--chat-window-pad-top": isMobile ? "0.4rem" : "0.7rem",
      "--chat-window-pad-bottom": isMobile ? "1.15rem" : "1.4rem",
      "--chat-window-top-safe": isMobile ? "0.65rem" : "0.85rem",
      "--chat-window-bottom-gap": "0rem",
      "--chat-window-mobile-extra-height": "0rem",
      "--chat-window-mobile-width-right": "0rem",
      "--chat-window-bottom-safe": "0rem",
      "--chat-window-fade-top": "0rem",
      "--chat-window-fade-bottom": "0rem",
      "--chat-window-pad-x": isMobile ? "0.52rem" : "0.9rem",
      "--chat-content-top-offset": "0rem",
      "--chat-content-spacer": isMobile ? "0.1rem" : "0.2rem",
      "--chat-content-bottom-spacer": isMobile ? "0.45rem" : "0.35rem",
      "--chat-input-shift": "0rem",
      "--chat-input-focus-shift": "0rem",
      "--chat-inputbar-left-pull": "0rem",
      "--chat-attach-left-pull": "0rem",
      "--chat-hpad-left": isMobile ? "0.08rem" : "0rem",
      "--chat-hpad-right": isMobile ? "0.08rem" : "0rem",
      "--chat-hpad": "0rem",
      "--chat-input-max-w": "100%",
      "--chat-vk-offset": "0px",
      "--chat-composer-main-control-size": "3.34rem",
      "--chat-composer-send-control-size": "3rem",
      "--chat-composer-send-icon-size": "1.1rem",
      "--chat-composer-listen-icon-size": "2.05rem",
      "--chat-composer-mic-icon-size": "1.82rem",
      "--chat-send-btn-scale": "0.965",
      "--chat-send-btn-shift-x": "0.1rem",
      "--chat-send-btn-shift-y": "0rem",
      "--inputbar-h": "3.08rem",
      "--chat-window-top-text-fade-extra": "0rem"
    }),
    [isMobile]
  )

  useEffect(() => {
    if (workspaceResult || !selectedTemplateId) return
    const selectedTemplate = allowedTemplates.find((template) => template.id === selectedTemplateId)
    if (!selectedTemplate || !isTemplateCompatible(selectedTemplate, outputType)) {
      setSelectedTemplateId("")
    }
  }, [allowedTemplates, outputType, selectedTemplateId, workspaceResult])

  useEffect(() => {
    if (!workspaceResult?.content || conversationMessages.length > 0) return
    setConversationMessages([
      createWorkspaceMessage({
        role: "ai",
        text: formatArtifactMessage(workspaceResult, t),
        attachments: buildSourceAttachments(workspaceResult.sources, t)
      })
    ])
  }, [conversationMessages.length, t, workspaceResult])

  function appendConversationMessage(message) {
    const nextMessage = createWorkspaceMessage(message)
    setConversationMessages((current) => [...current, nextMessage])
    return nextMessage
  }

  function removeConversationMessage(messageId) {
    setConversationMessages((current) => current.filter((entry) => entry.id !== messageId))
  }

  function handleJumpToBottom() {
    const node = chatWindowRef.current
    if (!node) return
    node.scrollTo({
      top: node.scrollHeight,
      behavior: "smooth"
    })
  }

  function handleStopAgentRequest() {
    activeRequestAbortRef.current?.abort?.()
  }

  async function refreshRecentArtifacts() {
    if (!isClientRole) return

    try {
      const response = await fetch("/api/documents/artifacts?limit=10", {
        cache: "no-store",
        headers: { "x-ui-locale": locale }
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.artifacts.errors.list_failed"))
      setRecentArtifacts(Array.isArray(payload?.artifacts) ? payload.artifacts : [])
      setRecentArtifactsError("")
    } catch (error) {
      setRecentArtifactsError(error?.message || t("documents.artifacts.errors.list_failed"))
    }
  }

  async function handleClientUpload(event) {
    const file = event?.target?.files?.[0]
    event.target.value = ""
    if (!file) return

    if (selectedCount >= CLIENT_MAX_DOCUMENTS) {
      setClientUploadError(t("documents.agent_workspace.client_file_limit_reached", { count: CLIENT_MAX_DOCUMENTS }))
      return
    }

    setClientUploading(true)
    setClientUploadError("")
    clearResultMessages()

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("kind", "MATERIAL")

      const uploadResponse = await fetch("/api/documents", {
        method: "POST",
        headers: { "x-ui-locale": locale },
        body: formData
      })
      const uploadPayload = await uploadResponse.json().catch(() => ({}))
      if (!uploadResponse.ok) throw new Error(uploadPayload?.message || t("documents.errors.upload_failed"))

      const uploadedDocument = uploadPayload?.document || null
      if (!uploadedDocument?.id) throw new Error(t("documents.errors.upload_failed"))

      const allowResponse = await fetch(`/api/documents/${encodeURIComponent(uploadedDocument.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-ui-locale": locale
        },
        body: JSON.stringify({
          kind: "MATERIAL",
          agentAllowed: true
        })
      })
      const allowPayload = await allowResponse.json().catch(() => ({}))
      if (!allowResponse.ok) throw new Error(allowPayload?.message || t("documents.errors.update_failed"))

      const nextDocument = allowPayload?.document || uploadedDocument
      setDocuments((current) => [...current, nextDocument].slice(0, CLIENT_MAX_DOCUMENTS))
      setSelectedDocumentIds((current) =>
        Array.from(new Set([...current, nextDocument.id])).slice(0, CLIENT_MAX_DOCUMENTS)
      )
      setMissingDocumentIds((current) => current.filter((id) => id !== nextDocument.id))
      setRunFeedback({
        message: t("documents.agent_workspace.client_file_added", {
          title: nextDocument.title || nextDocument.originalName
        })
      })
    } catch (error) {
      setClientUploadError(error?.message || t("documents.errors.upload_failed"))
    } finally {
      setClientUploading(false)
    }
  }

  async function handleClientRemoveDocument(documentId) {
    const nextId = String(documentId || "").trim()
    if (!nextId) return

    clearResultMessages()
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(nextId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-ui-locale": locale
        },
        body: JSON.stringify({ agentAllowed: false })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.update_failed"))

      setSelectedDocumentIds((current) => current.filter((id) => id !== nextId))
      setDocuments((current) => current.filter((document) => document.id !== nextId))
      setMissingDocumentIds((current) => current.filter((id) => id !== nextId))
      setRunFeedback({ message: t("documents.agent_workspace.client_file_removed") })
    } catch (error) {
      setRunFeedback(null)
      setRunError(error?.message || t("documents.errors.update_failed"))
    }
  }

  async function loadTranscriptDocument(transcript) {
    const transcriptId = String(transcript?.id || "").trim()
    if (!transcriptId) return null
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(transcriptId)}`, {
        cache: "no-store",
        headers: { "x-ui-locale": locale }
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.read_failed"))
      return payload?.document || transcript
    } catch {
      return transcript
    }
  }

  async function handleSelectAudioSource(documentId) {
    const nextId = String(documentId || "").trim()
    const nextSource = audioSources.find((source) => source.id === nextId) || null
    setSelectedAudioDocumentId(nextId)
    setAudioTranscriptDocument(null)
    setAudioTranscriptDraft("")
    setAudioSummaryArtifact(null)
    setAudioWorkflowError("")
    setAudioWorkflowFeedback(nextSource?.title ? t("documents.agent_workspace.audio_input.selected_source", { title: nextSource.title }) : "")
    if (nextId) {
      void fetch(`/api/documents/${encodeURIComponent(nextId)}/audio-select`, {
        method: "POST",
        headers: { "x-ui-locale": locale }
      }).catch(() => {})
    }
    if (nextSource?.transcript?.id) {
      const transcript = await loadTranscriptDocument(nextSource.transcript)
      setAudioTranscriptDocument(transcript)
      setAudioTranscriptDraft(String(transcript?.content || transcript?.preview || "").trim())
    }
  }

  async function handleAudioUpload(event) {
    const file = event?.target?.files?.[0]
    if (event?.target) event.target.value = ""
    if (!file) return

    if (!String(file.type || "").toLowerCase().startsWith("audio/") && !["video/webm", "video/mp4", "application/ogg"].includes(String(file.type || "").toLowerCase())) {
      setAudioWorkflowFeedback("")
      setAudioWorkflowError(t("documents.errors.audio_mime_not_allowed"))
      return
    }

    setAudioUploading(true)
    setAudioWorkflowError("")
    setAudioWorkflowFeedback("")
    setAudioTranscriptDocument(null)
    setAudioTranscriptDraft("")
    setAudioSummaryArtifact(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("title", file.name || t("documents.agent_workspace.audio_input.upload_label"))
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
      setAudioWorkflowFeedback(t("documents.agent_workspace.audio_input.upload_success"))
    } catch (error) {
      setAudioWorkflowFeedback("")
      setAudioWorkflowError(error?.message || t("documents.errors.audio_upload_failed"))
    } finally {
      setAudioUploading(false)
    }
  }

  async function handleTranscribeAudio() {
    if (!selectedAudioSource?.id || transcribingAudio) return

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
        body: JSON.stringify({ language })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.transcription_failed"))
      const transcript = payload?.transcriptDocument || null
      if (!transcript?.id) throw new Error(t("documents.errors.transcription_failed"))
      setAudioTranscriptDocument(transcript)
      setAudioTranscriptDraft(String(transcript.content || transcript.preview || "").trim())
      setAudioSources((current) =>
        current.map((source) =>
          source.id === selectedAudioSource.id
            ? { ...source, transcript: { ...transcript, preview: String(transcript.content || "").slice(0, 1200) } }
            : source
        )
      )
      setAudioWorkflowFeedback(t("documents.agent_workspace.audio_input.transcript_ready"))
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
        body: JSON.stringify({ content: audioTranscriptDraft })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.update_failed"))
      const updated = payload?.document || transcript
      setAudioTranscriptDocument(updated)
      setAudioTranscriptDraft(String(updated.content || "").trim())
      setAudioWorkflowFeedback(t("documents.agent_workspace.audio_input.transcript_saved"))
      return updated
    } finally {
      setSavingAudioTranscript(false)
    }
  }

  async function handleSaveAudioTranscript() {
    if (!canSaveAudioTranscript) return
    setAudioWorkflowError("")
    setAudioWorkflowFeedback("")
    try {
      await saveAudioTranscriptIfNeeded()
    } catch (error) {
      setAudioWorkflowError(error?.message || t("documents.errors.update_failed"))
    }
  }

  async function handleCreateAudioSummary() {
    if (!canCreateAudioSummary || !activeTranscriptDocument?.id) return
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
      const response = await fetch(`/api/documents/${encodeURIComponent(transcript.id)}/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ui-locale": locale
        },
        body: JSON.stringify({
          language,
          content: transcriptDocument.content
        })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.summary_failed"))
      const summary = payload?.summaryArtifact || null
      if (!summary?.id) throw new Error(t("documents.errors.summary_failed"))
      setAudioSummaryArtifact(summary)
      setDocuments([transcriptDocument])
      setSelectedDocumentIds([transcriptDocument.id])
      setMissingDocumentIds([])
      setOutputType("TRANSCRIPT_SUMMARY")
      applyWorkspaceResult(summary)
      setPersistedArtifactId(summary.id)
      setAudioWorkflowFeedback(t("documents.agent_workspace.audio_input.summary_ready"))
      appendConversationMessage({
        role: "ai",
        text: formatArtifactMessage(summary, t),
        attachments: buildSourceAttachments(summary.sources, t)
      })
    } catch (error) {
      setAudioWorkflowError(error?.message || t("documents.errors.summary_failed"))
    } finally {
      setSummarizingAudio(false)
    }
  }

  async function handleOpenClientArtifact(artifactId) {
    const nextArtifactId = String(artifactId || "").trim()
    if (!nextArtifactId) return

    clearResultMessages()
    setPersistedArtifactId(nextArtifactId)
    router.replace(buildWorkspaceHref(nextArtifactId), { scroll: false })
  }

  async function handleCopyRecentArtifact(artifactId) {
    try {
      const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}`, {
        cache: "no-store"
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.copy_failed"))
      await navigator.clipboard.writeText(String(payload?.artifact?.content || ""))
      setRunError("")
      setRunFeedback({ message: t("documents.feedback.copied") })
    } catch (error) {
      setRunFeedback(null)
      setRunError(error?.message || t("documents.errors.copy_failed"))
    }
  }

  async function handleDeleteClientArtifact(artifactId) {
    const nextArtifactId = String(artifactId || "").trim()
    if (!nextArtifactId) return

    clearResultMessages()

    try {
      const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(nextArtifactId)}`, {
        method: "DELETE",
        headers: { "x-ui-locale": locale }
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.artifacts.errors.delete_failed"))

      setRecentArtifacts((current) => current.filter((artifact) => artifact.id !== nextArtifactId))
      if (workspaceResult?.id === nextArtifactId) {
        clearWorkspaceResult()
        router.replace(buildWorkspaceHref(""), { scroll: false })
      }
      setRunFeedback({ message: t("documents.feedback.artifact_deleted") })
    } catch (error) {
      setRunError(error?.message || t("documents.artifacts.errors.delete_failed"))
    }
  }

  async function runGeneration({
    typeOverride = outputType,
    instructionOverride = instruction,
    documentsOverride = null,
    historyKind = "generated",
    feedbackKey = "documents.agent_workspace.result_ready",
    privacyDecision
  } = {}) {
    const effectiveInstruction = String(instructionOverride || "").trim()
    const sourceDocuments = Array.isArray(documentsOverride) ? documentsOverride : documents
    if (!sourceDocuments.length || !effectiveInstruction || starting) return null

    setStarting(true)
    clearResultMessages()

    const controller = new AbortController()
    activeRequestAbortRef.current = controller

    try {
      const effectiveType = isClientRole
        ? CLIENT_AGENT_TASK_OPTIONS.find((option) => option.value === clientTask)?.artifactType || "LETTER_DRAFT"
        : typeOverride
      const nextInstruction = isClientRole
        ? `${clientTaskInstruction(clientTask)}\n\n${effectiveInstruction}`
        : effectiveInstruction
      const nextTemplate = allowedTemplates.find((template) => template.id === selectedTemplateId)
      const templateIdToUse = nextTemplate && isTemplateCompatible(nextTemplate, effectiveType) ? nextTemplate.id : ""
      const response = await fetch("/api/documents/artifacts/generate", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-ui-locale": locale
        },
        body: JSON.stringify({
          documentIds: sourceDocuments.map((document) => document.id),
          type: effectiveType,
          templateId: isClientRole ? undefined : templateIdToUse || undefined,
          instruction: nextInstruction,
          audience,
          tone,
          language,
          length,
          privacyDecision
        })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.create_artifact_failed"))

      const nextDraft = payload?.draft || null
      // The draft is now persisted the instant it is generated, so it already carries a real id:
      // record it (not ""), so a later save updates this row instead of creating a duplicate.
      const nextDraftId = String(nextDraft?.id || "").trim()
      applyWorkspaceResult(nextDraft)
      resetWorkspaceVersionsFromResult(nextDraft, historyKind)
      setPersistedArtifactId(nextDraftId)
      setRunFeedback({ message: t(feedbackKey) })
      router.replace(buildWorkspaceHref(nextDraftId), { scroll: false })
      if (isClientRole) await refreshRecentArtifacts()
      return nextDraft
    } catch (error) {
      if (error?.name === "AbortError") {
        setRunFeedback({ message: t("chat.error.interrupted") })
        return null
      }
      setRunError(error?.message || t("documents.errors.create_artifact_failed"))
      return null
    } finally {
      if (activeRequestAbortRef.current === controller) {
        activeRequestAbortRef.current = null
      }
      setStarting(false)
    }
  }

  async function handleRefine(refinementInstructionOverride = refineInstruction, options = {}) {
    const effectiveRefinement = String(refinementInstructionOverride || "").trim()
    if (
      !hasWorkspaceResult ||
      workspaceResult?.status !== "DRAFT" ||
      !selectedCount ||
      !resultContent.trim() ||
      !effectiveRefinement ||
      refiningResult ||
      savingResult ||
      approvingResult
    ) {
      return null
    }

    setRefiningResult(true)
    clearResultMessages()

    const controller = new AbortController()
    activeRequestAbortRef.current = controller

    try {
      const effectiveType = isClientRole
        ? CLIENT_AGENT_TASK_OPTIONS.find((option) => option.value === clientTask)?.artifactType || "LETTER_DRAFT"
        : workspaceResult.type || outputType
      const response = await fetch("/api/documents/artifacts/refine", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-ui-locale": locale
        },
        body: JSON.stringify({
          documentIds: documents.map((document) => document.id),
          type: effectiveType,
          artifactId: workspaceResult.id || undefined,
          templateId: isClientRole ? undefined : selectedTemplateId || undefined,
          currentContent: resultContent,
          refinementInstruction: effectiveRefinement,
          audience,
          tone,
          language,
          length,
          privacyDecision: options.privacyDecision
        })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.artifacts.errors.update_failed"))

      const nextContent = String(payload?.content || "")
      const nextUpdatedAt = String(payload?.updatedAt || "")
      const nextDraft = workspaceResult
        ? {
            ...workspaceResult,
            title: resultTitle,
            content: nextContent,
            updatedAt: nextUpdatedAt || workspaceResult.updatedAt,
            templateId: selectedTemplateId || workspaceResult.templateId || ""
          }
        : null
      setResultContent(nextContent)
      setRefineInstruction("")
      appendWorkspaceVersion({
        kind: "refined",
        title: resultTitle,
        content: nextContent,
        type: effectiveType,
        templateId: isClientRole ? "" : selectedTemplateId
      })
      setRunFeedback({ message: t("documents.agent_workspace.refine_ready") })
      if (!workspaceResult?.id) {
        setWorkspaceResult((current) =>
          current
            ? {
                ...current,
                content: nextContent,
                updatedAt: nextUpdatedAt || current.updatedAt
              }
            : current
        )
      }
      return nextDraft
    } catch (error) {
      if (error?.name === "AbortError") {
        setRunFeedback({ message: t("chat.error.interrupted") })
        return null
      }
      setRunError(error?.message || t("documents.artifacts.errors.update_failed"))
      return null
    } finally {
      if (activeRequestAbortRef.current === controller) {
        activeRequestAbortRef.current = null
      }
      setRefiningResult(false)
    }
  }

  async function handleConversationSend(message, options = {}) {
    const trimmed = String(message || "").trim()
    if (!trimmed) return false
    if (!selectedCount) {
      setRunError(t(isClientRole ? "documents.agent_workspace.client_needs_documents" : "documents.agent_workspace.needs_documents"))
      return false
    }

    const userMessage = appendConversationMessage({ role: "user", text: trimmed })

    const shouldRefine =
      hasWorkspaceResult &&
      workspaceResult?.status === "DRAFT" &&
      String(resultContent || "").trim().length > 0

    if (shouldRefine) {
      setRefineInstruction(trimmed)
      const nextDraft = await handleRefine(trimmed, {
        privacyDecision: options?.privacyDecision
      })
      if (!nextDraft?.content) {
        removeConversationMessage(userMessage.id)
        return false
      }
      appendConversationMessage({
        role: "ai",
        text: formatArtifactMessage(nextDraft, t),
        attachments: buildSourceAttachments(nextDraft.sources || workspaceResult?.sources, t)
      })
      return true
    }

    setInstruction(trimmed)
    const nextDraft = await runGeneration({
      typeOverride: outputType,
      instructionOverride: trimmed,
      historyKind: hasWorkspaceResult ? "rerun" : "generated",
      feedbackKey: isClientRole
        ? "documents.agent_workspace.client_result_ready"
        : hasWorkspaceResult
          ? "documents.agent_workspace.quick_result_ready"
          : "documents.agent_workspace.result_ready",
      privacyDecision: options?.privacyDecision
    })
    if (!nextDraft?.content) {
      removeConversationMessage(userMessage.id)
      return false
    }
    appendConversationMessage({
      role: "ai",
      text: formatArtifactMessage(nextDraft, t),
      attachments: buildSourceAttachments(nextDraft.sources, t)
    })
    return true
  }

  async function handleAlternateOutput(option) {
    if (!canRunAlternateOutput || !option?.value) return
    const userMessage = appendConversationMessage({
      role: "user",
      text: t("documents.agent_workspace.quick_action_button", { type: option.label })
    })
    const nextDraft = await runGeneration({
      typeOverride: option.value,
      instructionOverride: instruction,
      historyKind: "rerun",
      feedbackKey: "documents.agent_workspace.quick_result_ready"
    })
    if (!nextDraft?.content) {
      removeConversationMessage(userMessage.id)
      return
    }
    appendConversationMessage({
      role: "ai",
      text: formatArtifactMessage(nextDraft, t),
      attachments: buildSourceAttachments(nextDraft.sources, t)
    })
  }

  function handleRestoreSavedVersion() {
    if (!canRestoreSavedVersion) return
    clearResultMessages()
    setResultTitle(String(workspaceResult?.title || ""))
    setResultContent(String(workspaceResult?.content || ""))
    setRefineInstruction("")
    setSelectedTemplateId(String(workspaceResult?.templateId || ""))
    setRunFeedback({ message: t("documents.agent_workspace.saved_version_restored") })
  }

  function handleRestoreWorkspaceVersion(versionId) {
    const version = workspaceVersions.find((entry) => entry.id === versionId)
    if (!version) return
    clearResultMessages()
    setOutputType(String(version.type || outputType))
    setResultTitle(String(version.title || ""))
    setResultContent(String(version.content || ""))
    setRefineInstruction("")
    setSelectedTemplateId(String(version.templateId || ""))
    setRunFeedback({ message: t("documents.agent_workspace.version_restored") })
  }

  function handleClearWorkspaceResult() {
    if (!canClearWorkspaceResult) return
    clearResultMessages()
    clearWorkspaceResult()
    router.replace(buildWorkspaceHref(""), { scroll: false })
    setRunFeedback({ message: t(isClientRole ? "documents.agent_workspace.client_result_removed" : "documents.agent_workspace.result_removed") })
  }

  async function persistCurrentDraft({ suppressFeedback = false } = {}) {
    if (!workspaceResult || !resultContent.trim()) return null

    const requestHeaders = {
      "Content-Type": "application/json",
      "x-ui-locale": locale
    }
    const payload = {
      documentIds: documents.map((document) => document.id),
      type: workspaceResult.type || outputType,
      title: resultTitle,
      content: resultContent
    }

    if (selectedTemplateId) payload.templateId = selectedTemplateId
    if (isClientRole) delete payload.templateId

    const response = workspaceResult.id
      ? await fetch(`/api/documents/artifacts/${encodeURIComponent(workspaceResult.id)}`, {
          method: "PATCH",
          headers: requestHeaders,
          body: JSON.stringify({
            title: resultTitle,
            content: resultContent,
            templateId: selectedTemplateId || null
          })
        })
      : await fetch("/api/documents/artifacts", {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify(payload)
        })

    const resultPayload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(
        resultPayload?.message ||
          (workspaceResult.id ? t("documents.artifacts.errors.update_failed") : t("documents.artifacts.errors.create_failed"))
      )
    }

    const nextArtifact = resultPayload?.artifact || null
    applyWorkspaceResult(nextArtifact)
    const nextArtifactId = String(nextArtifact?.id || "").trim()
    setPersistedArtifactId(nextArtifactId)
    setArtifactError("")
    if (nextArtifactId) router.replace(buildWorkspaceHref(nextArtifactId), { scroll: false })
    if (!suppressFeedback) {
      setRunFeedback({
        message:
          workspaceResult.id
            ? t(isClientRole ? "documents.agent_workspace.client_saved" : "documents.feedback.saved")
            : t(isClientRole ? "documents.agent_workspace.client_saved" : "documents.agent_workspace.saved_to_documents"),
        actionUrl: !isClientRole && nextArtifactId ? localizePath(`/documents/artifacts/${encodeURIComponent(nextArtifactId)}`, locale) : "",
        actionLabel: !isClientRole && nextArtifactId ? t("documents.agent_workspace.open_detail") : ""
      })
    }

    if (isClientRole) await refreshRecentArtifacts()
    return nextArtifact
  }

  async function handleSaveDraft() {
    if (!canPersistResult || savingResult || approvingResult) return

    setSavingResult(true)
    clearResultMessages()
    try {
      await persistCurrentDraft()
    } catch (error) {
      setRunError(error?.message || t("documents.artifacts.errors.create_failed"))
    } finally {
      setSavingResult(false)
    }
  }

  async function handleApprove() {
    if (!canPersistResult || savingResult || approvingResult) return

    setApprovingResult(true)
    clearResultMessages()
    try {
      const artifact = await persistCurrentDraft({ suppressFeedback: true })
      const artifactId = String(artifact?.id || "").trim()
      if (!artifactId) throw new Error(t("documents.artifacts.errors.create_failed"))

      const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}/approve`, {
        method: "POST",
        headers: { "x-ui-locale": locale }
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.artifacts.errors.approve_failed"))

      applyWorkspaceResult(payload?.artifact || artifact)
      setPersistedArtifactId(artifactId)
      setApprovalNotice({
        message: t(isClientRole ? "documents.agent_workspace.client_finished" : "documents.feedback.approved"),
        downloadUrls: payload?.downloadUrls || payload?.artifact?.downloadUrls || {}
      })
      router.replace(buildWorkspaceHref(artifactId), { scroll: false })
      if (isClientRole) await refreshRecentArtifacts()
    } catch (error) {
      setRunError(error?.message || t("documents.artifacts.errors.approve_failed"))
    } finally {
      setApprovingResult(false)
    }
  }

  async function handleCopyResult() {
    try {
      await navigator.clipboard.writeText(String(resultContent || workspaceResult?.content || ""))
      setRunError("")
      setRunFeedback({ message: t("documents.feedback.copied") })
    } catch {
      setRunError(t("documents.errors.copy_failed"))
    }
  }

  function isWorkspaceVersionActive(version) {
    return String(version?.title || "").trim() === String(resultTitle || "").trim() && String(version?.content || "") === String(resultContent || "")
  }

  const conversationItems = useMemo(() => {
    const baseMessages = conversationMessages.length
      ? conversationMessages
      : [createWorkspaceMessage({ role: "ai", text: conversationIntroText })]

    const items = baseMessages.map((message) => (
      <ChatMessageItem
        key={message.id}
        role={message.role}
        text={message.text}
        attachments={message.attachments}
        t={t}
      />
    ))

    if (isAgentBusy) {
      items.push(
        <ChatMessageItem
          key="agent-mode-working"
          role="ai"
          text={starting ? t("documents.agent_workspace.conversation_generating") : t("documents.agent_workspace.conversation_refining")}
          t={t}
        />
      )
    }

    return items
  }, [conversationIntroText, conversationMessages, isAgentBusy, starting, t])

  function clientArtifactStatusLabel(status) {
    return t(
      status === "FINAL"
        ? "documents.agent_workspace.client_status_final"
        : "documents.agent_workspace.client_status_draft"
    )
  }

  const handleBack = useCallback(() => {
    if (typeof onBack === "function") {
      onBack()
      return
    }
    markChatWorkspaceRestore()
    if (typeof window === "undefined") {
      pushWithTransition(router, backHref)
      return
    }
    window.requestAnimationFrame(() => {
      pushWithTransition(router, backHref)
    })
  }, [backHref, onBack, router])

  const content = (
    <>
      {isAdmin && !embedded ? (
        <AdminRoleViewCycleButton
          t={t}
          locale={locale}
          value={effectiveRole}
          onRoleChanged={refreshEffectiveRole}
          ariaLabel={t("chat.workspace.view_role.label", "Töölaua vaade")}
        />
      ) : null}
      <div>
        <div>
          {!hideHeader ? (
            <SubpageHeader
              onBack={handleBack}
              backAriaLabel={t("documents.agent_workspace.back_to_chat")}
              anchorBack={false}
              /* ⓘ elab paneeli nurgas × kõrval (PanelFrame); vt
                 usePanelInfoSlot ülalpool. */
            >
              {t("chat.tools.agent_mode")}
            </SubpageHeader>
          ) : null}
          <section>
          {documentsError ? <div>{documentsError}</div> : null}
          {runError ? <div>{runError}</div> : null}
          {artifactError ? <div>{artifactError}</div> : null}
          {missingDocumentIds.length ? (
            <div>
              {t("documents.agent_workspace.missing_documents", { count: missingDocumentIds.length })}
            </div>
          ) : null}
          {runFeedback ? (
            <div>
              <span>{runFeedback.message}</span>
              <div>
                {runFeedback.actionUrl ? <Link href={runFeedback.actionUrl}>{runFeedback.actionLabel}</Link> : null}
                <button type="button" onClick={() => setRunFeedback(null)}>{t("common.close")}</button>
              </div>
            </div>
          ) : null}
          {approvalNotice ? (
            <div>
              <span>{approvalNotice.message}</span>
              <div>
                {approvalNotice.downloadUrls?.docx ? <a href={approvalNotice.downloadUrls.docx}>{t("documents.actions.download_docx")}</a> : null}
                {approvalNotice.downloadUrls?.pdf ? <a href={approvalNotice.downloadUrls.pdf}>{t("documents.actions.download_pdf")}</a> : null}
                <button type="button" onClick={() => setApprovalNotice(null)}>{t("common.close")}</button>
              </div>
            </div>
          ) : null}

          <div>
            <Panel variant="secondary" padding="sm">
              <div>
                <h2>
                  {t(isClientRole ? "documents.agent_workspace.client_task_title" : "documents.agent_workspace.goal_title")}
                </h2>
                <p>
                  {t(isClientRole ? "documents.agent_workspace.client_task_description" : "documents.agent_workspace.goal_description")}
                </p>
              </div>

              <div>
                {!isClientRole ? (
                  <div>
                    <div>
                      <div>
                        <span>{t("documents.agent_workspace.template_label")}</span>
                        <p>{t("documents.agent_workspace.template_description")}</p>
                      </div>
                      <div>
                      <DocumentsDropdown
                        ariaLabel={t("documents.agent_workspace.template_label")}
                        value={selectedTemplateId}
                        disabled={templatesLoading || (!compatibleTemplates.length && !selectedTemplateId)}
                        onChange={(nextValue) => {
                          setSelectedTemplateId(nextValue)
                          clearResultMessages()
                        }}
                        options={templateDropdownOptions}
                        placeholder={t("documents.agent_workspace.template_none")}
                      />
                      </div>
                    </div>
                    <p>
                      {templatesLoading
                        ? t("documents.agent_workspace.template_loading")
                        : templatesError
                          ? templatesError
                          : activeTemplate
                            ? t("documents.agent_workspace.template_selected", { title: activeTemplate.title || activeTemplate.originalName })
                            : compatibleTemplates.length
                              ? t("documents.agent_workspace.template_help")
                              : t("documents.agent_workspace.template_empty")}
                    </p>
                  </div>
                ) : null}

                <div>
                  <span>
                    {t(isClientRole ? "documents.agent_workspace.client_task_label" : "documents.agent_workspace.output_type_label")}
                  </span>
                  {!isClientRole ? (
                    <p>
                      {t("documents.agent_workspace.output_type_description")}
                    </p>
                  ) : null}
                  <div>
                    {outputTypeOptions.map((option) => (
                      <OptionCard
                        key={option.value}
                        type="radio"
                        name="agent-output-type"
                        value={option.value}
                        checked={(isClientRole ? clientTask : outputType) === option.value}
                        onChange={(event) => {
                          const nextValue = event.target.value
                          if (isClientRole) {
                            setClientTask(nextValue)
                          } else {
                            setOutputType(nextValue)
                          }
                          clearResultMessages()
                        }}
                        fitTextLines={2}
                      >
                        <span>
                          {option.label}
                        </span>
                      </OptionCard>
                    ))}
                  </div>
                </div>

                {!isClientRole ? (
                  <>
                    <div>
                      <div>
                        <div>
                          <div>
                            <h3>
                              {t("documents.agent_workspace.audio_input.title")}
                            </h3>
                            <p>
                              {t("documents.agent_workspace.audio_input.description")}
                            </p>
                          </div>

                          <div aria-label={t("documents.agent_workspace.audio_input.steps_label")}>
                            {["step_audio", "step_transcript", "step_review", "step_summary"].map((stepKey) => (
                              <span key={stepKey}>
                                {t(`documents.agent_workspace.audio_input.${stepKey}`)}
                              </span>
                            ))}
                          </div>

                          <div>
                            {audioInputSourceOptions.map((option) => (
                              <OptionCard
                                key={option.value}
                                type="radio"
                                name="agent-audio-source"
                                value={option.value}
                                checked={audioSourceMode === option.value}
                                onChange={(event) => {
                                  setAudioSourceMode(event.target.value)
                                  setAudioWorkflowError("")
                                  setAudioWorkflowFeedback("")
                                }}
                                fitTextLines={2}
                              >
                                <span>
                                  {t(option.labelKey)}
                                </span>
                              </OptionCard>
                            ))}
                          </div>

                          {audioSourceMode === "choose_existing" ? (
                            <div>
                              <div>
                                <h4>
                                  {t("documents.agent_workspace.audio_input.existing_title")}
                                </h4>
                                <p>
                                  {t("documents.agent_workspace.audio_input.no_auto_transcription")}
                                </p>
                              </div>
                              {audioSourcesLoading ? (
                                <div>
                                  {t("documents.agent_workspace.audio_input.existing_loading")}
                                </div>
                              ) : null}
                              {!audioSourcesLoading && !audioSources.length ? (
                                <div>
                                  {t("documents.agent_workspace.audio_input.existing_empty")}
                                </div>
                              ) : null}
                              {!audioSourcesLoading && audioSources.length ? (
                                <div>
                                  {audioSources.map((source) => {
                                    const isSelected = source.id === selectedAudioDocumentId
                                    const sourceLabel = source.kind === "CALL_AUDIO_RECORDING"
                                      ? t("documents.agent_workspace.audio_input.source_recording")
                                      : t("documents.agent_workspace.audio_input.source_upload")
                                    return (
                                      <article key={source.id}>
                                        <div>
                                          <div>
                                            <div>{source.title || source.originalName}</div>
                                            <div>
                                              {sourceLabel} - {formatDate(source.createdAt, locale)}
                                            </div>
                                            {source.callRecording?.durationSeconds ? (
                                              <div>
                                                {t("documents.agent_workspace.audio_input.duration", { duration: `${source.callRecording.durationSeconds}s` })}
                                              </div>
                                            ) : null}
                                            {source.callRecording?.purpose || source.callRecording?.purposeText ? (
                                              <div>
                                                {t("documents.agent_workspace.audio_input.purpose", { purpose: source.callRecording.purposeText || source.callRecording.purpose })}
                                              </div>
                                            ) : null}
                                            {source.callRecording?.callStartedAt ? (
                                              <div>
                                                {t("documents.agent_workspace.audio_input.room_context", { date: formatDate(source.callRecording.callStartedAt, locale) })}
                                              </div>
                                            ) : null}
                                          </div>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant={isSelected ? "primary" : "linkBrand"}
                                            onClick={() => void handleSelectAudioSource(source.id)}
                                          >
                                            {t("documents.agent_workspace.audio_input.choose_existing")}
                                          </Button>
                                        </div>
                                      </article>
                                    )
                                  })}
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {audioSourceMode === "upload_file" ? (
                            <div>
                              <input
                                ref={audioUploadInputRef}
                                type="file"
                                accept="audio/*,.ogg,.oga,.opus,.webm,.mp3,.m4a,.wav,.flac,.aac"
                                className="hidden"
                                onChange={handleAudioUpload}
                              />
                              <div>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => audioUploadInputRef.current?.click()}
                                  disabled={audioUploading}
                                >
                                  {audioUploading ? t("documents.agent_workspace.audio_input.uploading") : t("documents.agent_workspace.audio_input.upload_label")}
                                </Button>
                              </div>
                              <p>
                                {t("documents.agent_workspace.audio_input.upload_help")}
                              </p>
                            </div>
                          ) : null}

                          {selectedAudioSource ? (
                            <div>
                              {t("documents.agent_workspace.audio_input.selected_source", { title: selectedAudioSource.title || selectedAudioSource.originalName })}
                            </div>
                          ) : null}

                          <div>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void handleTranscribeAudio()}
                              disabled={!canTranscribeAudio}
                            >
                              {transcribingAudio ? t("documents.agent_workspace.audio_input.transcribing") : t("documents.agent_workspace.audio_input.transcribe")}
                            </Button>
                          </div>

                          {activeTranscriptDocument ? (
                            <div>
                              <div>
                                <h4>
                                  {t("documents.agent_workspace.audio_input.transcript_title")}
                                </h4>
                                <p>
                                  {t("documents.agent_workspace.audio_input.transcript_ready")}{" "}
                                  <a href={`/api/documents/${encodeURIComponent(activeTranscriptDocument.id)}/download`}>
                                    {t("documents.agent_workspace.audio_input.transcript_link")}
                                  </a>
                                </p>
                                <p>
                                  {t("documents.agent_workspace.audio_input.transcript_edit_help")}
                                </p>
                              </div>
                              <label>
                                <span>
                                  {t("documents.agent_workspace.audio_input.transcript_edit_label")}
                                </span>
                                <Textarea
                                  value={audioTranscriptDraft}
                                  onChange={(event) => setAudioTranscriptDraft(event.target.value)}
                                  rows={8}
                                />
                              </label>
                              <div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="primary"
                                  onClick={() => void handleSaveAudioTranscript()}
                                  disabled={!canSaveAudioTranscript || savingAudioTranscript}
                                >
                                  {savingAudioTranscript ? t("documents.agent_workspace.audio_input.saving_transcript") : t("documents.agent_workspace.audio_input.save_transcript")}
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          {activeTranscriptDocument ? (
                            <div>
                              <div>
                                <h4>
                                  {t("documents.agent_workspace.audio_input.summary_title")}
                                </h4>
                                <p>
                                  {t("documents.agent_workspace.audio_input.summary_help")}
                                </p>
                                {audioSummaryArtifact?.id ? (
                                  <p>
                                    {t("documents.agent_workspace.audio_input.summary_ready")}{" "}
                                    <Link href={localizePath(`/documents/artifacts/${encodeURIComponent(audioSummaryArtifact.id)}`, locale)}>
                                      {t("documents.agent_workspace.audio_input.summary_link")}
                                    </Link>
                                  </p>
                                ) : null}
                              </div>
                              <div>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => void handleCreateAudioSummary()}
                                  disabled={!canCreateAudioSummary}
                                >
                                  {summarizingAudio ? t("documents.agent_workspace.audio_input.summary_creating") : t("documents.agent_workspace.audio_input.create_summary")}
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          <p>
                            {t("documents.agent_workspace.audio_input.processing_note")}
                          </p>
                          {audioSourcesError || audioWorkflowError ? (
                            <div>
                              {audioWorkflowError || audioSourcesError}
                            </div>
                          ) : null}
                          {audioWorkflowFeedback ? (
                            <div>
                              {audioWorkflowFeedback}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div>
                      <span>{t("chat.deep_research.scope_output_label")}</span>
                      <p>
                        {t("documents.agent_workspace.scope_output_description")}
                      </p>
                      <div>
                        {audienceOptions.map((option) => (
                          <OptionCard
                            key={option.value}
                            type="radio"
                            name="agent-audience"
                            value={option.value}
                            checked={audience === option.value}
                            onChange={(event) => {
                              setAudienceTouched(true)
                              setAudience(event.target.value)
                              clearResultMessages()
                            }}
                            fitTextLines={2}
                          >
                            <span>
                              {option.label}
                            </span>
                          </OptionCard>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div>
                        <span>{t("documents.agent_workspace.style_settings_label")}</span>
                        <p>
                          {t("documents.agent_workspace.style_settings_description")}
                        </p>
                      </div>
                      <label>
                        <span>{t("documents.agent_workspace.tone_label")}</span>
                        <DocumentsDropdown
                          ariaLabel={t("documents.agent_workspace.tone_label")}
                          value={tone}
                          onChange={(nextValue) => {
                            setTone(nextValue)
                            clearResultMessages()
                          }}
                          options={toneOptions}
                        />
                      </label>
                      <label>
                        <span>{t("documents.agent_workspace.language_label")}</span>
                        <DocumentsDropdown
                          ariaLabel={t("documents.agent_workspace.language_label")}
                          value={language}
                          onChange={(nextValue) => {
                            setLanguage(nextValue)
                            clearResultMessages()
                          }}
                          options={languageOptions}
                        />
                      </label>
                      <label>
                        <span>{t("documents.agent_workspace.length_label")}</span>
                        <DocumentsDropdown
                          ariaLabel={t("documents.agent_workspace.length_label")}
                          value={length}
                          onChange={(nextValue) => {
                            setLength(nextValue)
                            clearResultMessages()
                          }}
                          options={lengthOptions}
                        />
                      </label>
                    </div>
                  </>
                ) : null}
              </div>
            </Panel>

            <section>
              <Panel variant="secondary" padding="sm">
                <div>
                  <div>
                    <h2>{t("documents.agent_workspace.selected_documents_title")}</h2>
                    <p>
                      {t(
                        isClientRole
                          ? clientTask === "FILL_FORM"
                            ? "documents.agent_workspace.client_selected_documents_fill_form_description"
                            : "documents.agent_workspace.client_selected_documents_description"
                          : "documents.agent_workspace.selected_documents_description"
                      )}
                    </p>
                  </div>
                  <div>
                    {!isClientRole && selectedDocumentIds.length ? (
                      <Link href={documentsHref}>
                        {t("documents.back_to_documents")}
                      </Link>
                    ) : null}
                  </div>
                </div>

                {isClientRole ? (
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => clientUploadInputRef.current?.click?.()}
                      disabled={clientUploading || selectedCountLimitReached}
                    >
                      {clientUploading ? t("documents.agent_workspace.client_uploading") : t("documents.agent_workspace.client_upload_button")}
                    </Button>
                    <input
                      ref={clientUploadInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="sr-only"
                      onChange={handleClientUpload}
                    />
                  </div>
                ) : null}

                <div>
                  {clientUploadError ? (
                    <div>
                      {clientUploadError}
                    </div>
                  ) : null}
                  {documentsLoading ? <div>{t("documents.loading")}</div> : null}
                  {!documentsLoading && !selectedDocumentIds.length ? (
                    <div>
                      <div>
                        <p>{t(isClientRole ? "documents.agent_workspace.client_empty_documents" : "documents.agent_workspace.empty_documents")}</p>
                      </div>
                      {!isClientRole ? (
                        <Button as="a" href={documentsHref} size="sm">
                          {t("documents.agent_workspace.select_documents")}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  {!documentsLoading && selectedDocumentIds.length > 0 && documents.length === 0 ? (
                    <div>
                      <p>{t("documents.agent_workspace.unavailable_documents")}</p>
                      {!isClientRole ? (
                        <Button as="a" href={documentsHref} size="sm">
                          {t("documents.back_to_documents")}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  {documents.map((document) => (
                    <article key={document.id}>
                      <div>
                        <div>
                          <div>
                            <h3>{document.title}</h3>
                            <span>{kindLabel(document.kind, t)}</span>
                            {document.templateFor ? <span>{templateForLabel(document.templateFor, t)}</span> : null}
                          </div>
                          <p>
                            {document.originalName} - {formatFileSize(document.size)} - {formatDate(document.updatedAt, locale)}
                          </p>
                        </div>
                        <div>
                          <Button as="a" href={`/api/documents/${encodeURIComponent(document.id)}/download`} size="sm" variant="linkBrand">
                            {t("documents.actions.download")}
                          </Button>
                          {isClientRole ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              onClick={() => void handleClientRemoveDocument(document.id)}
                            >
                              {t("documents.agent_workspace.client_remove_document")}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </Panel>
            </section>

            <section>
              <Panel variant="secondary" padding="sm">
                <div>
                  <h2>{t("documents.agent_workspace.conversation_title")}</h2>
                  <p>
                    {t(isClientRole ? "documents.agent_workspace.client_conversation_description" : "documents.agent_workspace.conversation_description")}
                  </p>
                </div>

                <div>
                  <div>
                    <span>
                      {t("documents.agent_workspace.summary_documents", { count: selectedCount })}
                    </span>
                    <span>
                      {t("documents.agent_workspace.summary_output", { type: isClientRole ? clientResultLabel : artifactTypeLabel(outputType, t) })}
                    </span>
                    {!isClientRole ? (
                      <span>
                        {audienceOptions.find((option) => option.value === audience)?.label}
                      </span>
                    ) : null}
                    {!isClientRole && activeTemplate ? (
                      <span>
                        {t("documents.agent_workspace.summary_template", { title: activeTemplate.title || activeTemplate.originalName })}
                      </span>
                    ) : null}
                  </div>
                  <p>{conversationHelpText}</p>
                </div>

                <div style={agentConversationVars}>
                  <ConversationView
                    t={t}
                    chatWindowRef={chatWindowRef}
                    isStreamingAny={isAgentBusy}
                    hiddenCount={0}
                    pageSize={0}
                    onRevealOlder={() => {}}
                    canHideOlder={false}
                    onHideOlder={() => {}}
                    onJumpToBottom={handleJumpToBottom}
                    messageItems={conversationItems}
                    isMobile={isMobile}
                    isLightTheme={isLightTheme}
                  />

                  <div>
                      <ChatComposer
                        t={t}
                        locale={locale}
                        isLightTheme={isLightTheme}
                        hideTools
                        embedded
                        forcePlaceholderVisible
                        placeholderText={t("chat.input.placeholder")}
                        acceptAttr=""
                        ensureAnalysisPanelVisible={() => {}}
                        fileInputRef={fileInputRef}
                        onFileChange={() => {}}
                        inputBarRef={inputBarRef}
                        inputRef={inputRef}
                        onFocusInput={() => setInputFocused(true)}
                        onBlurInput={() => setInputFocused(false)}
                        isGenerating={isAgentBusy}
                        isStreamingAny={false}
                        isRoomMode={false}
                        roomBlocked={false}
                        roomAuthRequired={false}
                        onStop={handleStopAgentRequest}
                        onSend={handleConversationSend}
                        showDictationButton={false}
                        voiceEnabled={false}
                        speakLatestReply={undefined}
                        canSpeakLatest={false}
                        isSpeaking={false}
                        recording={false}
                        recordingPulse={false}
                        handleMic={undefined}
                        draftApiRef={composerDraftApiRef}
                        inputFocused={inputFocused}
                        isMobile={isMobile}
                        activeModeKey="document"
                      />
                  </div>
                </div>

              </Panel>
            </section>

            <section>
              <Panel variant="secondary" padding="sm">
                <div>
                  <div>
                    <h2>{t("documents.agent_workspace.result_title")}</h2>
                    <p>
                      {t(isClientRole ? "documents.agent_workspace.client_result_description" : "documents.agent_workspace.result_description")}
                    </p>
                    {!isClientRole ? (
                      <p>
                        {t("documents.agent_workspace.result_results_link_intro")}{" "}
                        <Link href={artifactResultsHref}>
                          {t("documents.agent_workspace.result_results_link_label")}
                        </Link>
                        .
                      </p>
                    ) : null}
                  </div>
                  {hasWorkspaceResult ? (
                    <div>
                      {activeArtifactDetailHref ? (
                        <Link href={activeArtifactDetailHref}>
                          {t("documents.agent_workspace.open_detail")}
                        </Link>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={handleClearWorkspaceResult}
                        disabled={!canClearWorkspaceResult}
                      >
                        {t("documents.agent_workspace.clear_result")}
                      </Button>
                    </div>
                  ) : null}
                </div>

                {artifactLoading ? <div>{t("documents.loading")}</div> : null}
                {!artifactLoading && !workspaceResult && !artifactError ? (
                  <div>
                    <p>{t("documents.agent_workspace.result_empty")}</p>
                  </div>
                ) : null}

                {!artifactLoading && workspaceResult ? (
                  <div>
                    <div>
                      <span>
                        {isClientRole ? clientResultLabel : artifactTypeLabel(workspaceResult.type, t)}
                      </span>
                      <span>
                        {isClientRole ? clientArtifactStatusLabel(workspaceResult.status) : artifactStatusLabel(workspaceResult.status, t)}
                      </span>
                    </div>
                    <div>
                      <span>{formatDate(workspaceResult.createdAt, locale)}</span>
                      <span>{t("documents.updated_at")} {formatDate(workspaceResult.updatedAt, locale)}</span>
                      {!isClientRole && workspaceResult.approvedAt ? <span>{t("documents.approved_at")} {formatDate(workspaceResult.approvedAt, locale)}</span> : null}
                      <span>{t("documents.sources_label", { count: workspaceResult.sourceCount || 0 })}</span>
                    </div>

                    {!isWorkspaceResultSaved ? (
                      <div>
                        {t(isClientRole ? "documents.agent_workspace.client_result_unsaved" : "documents.agent_workspace.result_unsaved")}
                      </div>
                    ) : null}
                    {isWorkspaceResultSaved && hasDraftEdits ? (
                      <div>
                        {t(isClientRole ? "documents.agent_workspace.client_result_dirty" : "documents.agent_workspace.result_dirty")}
                      </div>
                    ) : null}
                    {activeTemplate ? (
                      <div>
                        {t("documents.agent_workspace.template_selected", { title: activeTemplate.title || activeTemplate.originalName })}
                      </div>
                    ) : null}

                    {!isClientRole && alternateOutputOptions.length ? (
                      <div>
                        <div>
                          <h3>{t("documents.agent_workspace.quick_actions_title")}</h3>
                          <p>{t("documents.agent_workspace.quick_actions_description")}</p>
                        </div>
                        <div>
                          {alternateOutputOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                void handleAlternateOutput(option)
                              }}
                              disabled={!canRunAlternateOutput}
                            >
                              {t("documents.agent_workspace.quick_action_button", { type: option.label })}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {workspaceResult.status === "DRAFT" ? (
                      <>
                        <div>
                          {t("documents.agent_workspace.refine_in_chat")}
                        </div>
                        <div>
                          <Input
                            value={resultTitle}
                            onChange={(event) => {
                              setResultTitle(event.target.value)
                              clearResultMessages()
                            }}
                            placeholder={t("documents.form.artifact_title_placeholder")}
                          />
                          <Textarea
                            value={resultContent}
                            onChange={(event) => {
                              setResultContent(event.target.value)
                              clearResultMessages()
                            }}
                            rows={14}
                          />
                        </div>
                        <div>
                          <Button type="button" size="sm" onClick={() => void handleApprove()} disabled={!canPersistResult || refiningResult || savingResult || approvingResult}>
                            {approvingResult ? t("documents.actions.approving") : t(isClientRole ? "documents.agent_workspace.client_finish" : "documents.actions.approve")}
                          </Button>
                          <Button type="button" size="sm" variant="primary" onClick={() => void handleSaveDraft()} disabled={!canPersistResult || refiningResult || savingResult || approvingResult}>
                            {savingResult ? t("documents.actions.saving") : t(isClientRole ? "documents.actions.save" : "documents.actions.save_draft")}
                          </Button>
                          {!isClientRole && canRestoreSavedVersion ? (
                            <Button type="button" size="sm" variant="primary" onClick={handleRestoreSavedVersion}>
                              {t("documents.agent_workspace.restore_saved")}
                            </Button>
                          ) : null}
                          <Button type="button" size="sm" variant="primary" onClick={() => void handleCopyResult()}>
                            {t("documents.actions.copy")}
                          </Button>
                        </div>
                        {!isClientRole && workspaceVersions.length ? (
                          <div>
                            <div>
                              <h3>{t("documents.agent_workspace.version_history_title")}</h3>
                              <p>{t("documents.agent_workspace.version_history_description")}</p>
                            </div>
                            {workspaceVersions.slice().reverse().map((version) => {
                              const isActive = isWorkspaceVersionActive(version)
                              return (
                                <div key={version.id}>
                                  <div>
                                    <div>
                                      <div>
                                        <span>
                                          {version.title || artifactTypeLabel(version.type, t)}
                                        </span>
                                        <span>
                                          {t(`documents.agent_workspace.version_kinds.${version.kind}`)}
                                        </span>
                                        {isActive ? (
                                          <span>
                                            {t("documents.agent_workspace.version_current")}
                                          </span>
                                        ) : null}
                                      </div>
                                      <p>
                                        {artifactTypeLabel(version.type, t)} - {formatDate(version.createdAt, locale)}
                                      </p>
                                    </div>
                                    {!isActive ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="primary"
                                        onClick={() => handleRestoreWorkspaceVersion(version.id)}
                                      >
                                        {t("documents.agent_workspace.restore_version")}
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div>
                          {workspaceResult.content}
                        </div>
                        <div>
                          {workspaceResult.downloadUrls?.docx ? <Button as="a" href={workspaceResult.downloadUrls.docx} size="sm">{t("documents.actions.download_docx")}</Button> : null}
                          {workspaceResult.downloadUrls?.pdf ? <Button as="a" href={workspaceResult.downloadUrls.pdf} size="sm" variant="linkBrand">{t("documents.actions.download_pdf")}</Button> : null}
                          <Button type="button" size="sm" variant="primary" onClick={() => void handleCopyResult()}>
                            {t("documents.actions.copy")}
                          </Button>
                        </div>
                      </>
                    )}

                    {workspaceResult.sources?.length ? (
                      <div>
                        {workspaceResult.sources.map((source) => (
                          <a key={source.id} href={`/api/documents/${encodeURIComponent(source.id)}/download`}>
                            <div>{source.title}</div>
                            <div>{source.originalName}</div>
                            <div>{t("documents.actions.download")}</div>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Panel>
            </section>

            {isClientRole ? (
              <Panel variant="secondary" padding="sm">
                <div>
                  <h2>{t("documents.agent_workspace.client_results_title")}</h2>
                  <p>{t("documents.agent_workspace.client_results_description")}</p>
                </div>

                {recentArtifactsError ? (
                  <div>
                    {recentArtifactsError}
                  </div>
                ) : null}
                {recentArtifactsLoading ? (
                  <div>
                    {t("documents.agent_workspace.client_recent_results_loading")}
                  </div>
                ) : null}
                {!recentArtifactsLoading && !recentArtifacts.length ? (
                  <div>
                    {t("documents.agent_workspace.client_recent_results_empty")}
                  </div>
                ) : null}

                {!recentArtifactsLoading && recentArtifacts.length ? (
                  <div>
                    {recentArtifacts.map((artifact) => (
                      <article key={artifact.id}>
                        <div>
                          <div>
                            <div>
                              <h3>
                                {artifact.title || artifact.snippet || t("documents.agent_workspace.result_title")}
                              </h3>
                              <span>
                                {clientArtifactStatusLabel(artifact.status)}
                              </span>
                            </div>
                            <p>
                              {formatDate(artifact.updatedAt || artifact.createdAt, locale)}
                            </p>
                          </div>
                          <div>
                            <Button type="button" size="sm" variant="primary" onClick={() => void handleOpenClientArtifact(artifact.id)}>
                              {t("documents.agent_workspace.client_open_result")}
                            </Button>
                              {artifact.downloadUrls?.docx ? (
                                <Button as="a" href={artifact.downloadUrls.docx} size="sm" variant="linkBrand">
                                  {t("documents.actions.download_docx")}
                                </Button>
                              ) : null}
                              {artifact.downloadUrls?.pdf ? (
                                <Button as="a" href={artifact.downloadUrls.pdf} size="sm" variant="linkBrand">
                                  {t("documents.actions.download_pdf")}
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="primary"
                                onClick={() => void handleCopyRecentArtifact(artifact.id)}
                            >
                              {t("documents.actions.copy")}
                            </Button>
                            <Button type="button" size="sm" variant="danger" onClick={() => void handleDeleteClientArtifact(artifact.id)}>
                              {t("documents.actions.delete")}
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </Panel>
            ) : null}
          </div>
        </section>
        </div>
      </div>
    </>
  )

  if (embedded) return content

  return (
    <section>
      {content}
    </section>
  )
}
