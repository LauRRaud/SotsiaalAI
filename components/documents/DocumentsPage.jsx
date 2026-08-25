"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useEffectiveRole } from "@/components/auth/useEffectiveRole"
import { useI18n } from "@/components/i18n/I18nProvider"
import AdminRoleViewCycleButton from "@/components/workspace/AdminRoleViewCycleButton"
import Button from "@/components/ui/Button"
import Checkbox from "@/components/ui/Checkbox"
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot"
import DocumentsDropdown from "@/components/documents/DocumentsDropdown"
import { SubpageHeader } from "@/components/ui/SubpageHeader"
import Input from "@/components/ui/Input"
import Panel from "@/components/ui/Panel"
import OptionCard from "@/components/ui/OptionCard"
import Form from "@/components/ui/Form";
import { ARTIFACT_LIST_LIMIT_ALL, TEMPLATE_FOR_VALUES } from "@/lib/documents/constants"
import {
  describeProvenance,
  formatDate,
  formatFileSize,
  kindLabel,
  templateForLabel,
  workspaceTypeLabel
} from "@/lib/documents/presentation"
import { buildWorkspaceItems } from "@/lib/documents/workspace"
import { familyHasNextPage, mergeOwnerPage } from "@/lib/documents/workspacePagination"
import { WORKER_FRAMEWORK_SIGNED_HREF, WORKER_FRAMEWORK_VERSION } from "@/lib/frameworkAcceptances"
import { localizePath } from "@/lib/localizePath"
import { pushWithTransition } from "@/lib/routeTransition"

const CHAT_WORKSPACE_RESTORE_STORAGE_KEY = "__SOTSIAALAI_CHAT_WORKSPACE_RESTORE__"
const WORKSPACE_WINDOW = 50

// Ühtse loendi kerge rühmafilter (mitte tabeli-juhtpaneel — üks selge loend, valikuline vaade).
const FILTER_GROUPS = {
  ALL: null,
  FILES: new Set(["source", "transcript"]),
  ANALYSIS: new Set(["analysis"]),
  ARTIFACTS: new Set(["draft", "final"]),
  RESEARCH: new Set(["research"]),
  // TEENUSPÄEVIK: KOV-ile esitatud kuuaruanded. Oma filter seepärast, et neid
  // otsitakse teisiti kui muid faile — mitte pealkirja, vaid perioodi järgi.
  SERVICE_LOG: new Set(["service_log"])
}

function markChatWorkspaceRestore() {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(
      CHAT_WORKSPACE_RESTORE_STORAGE_KEY,
      JSON.stringify({ ts: Date.now() })
    )
  } catch {}
}

function emptyFamily(extra = {}) {
  return { items: [], total: 0, error: "", ...extra }
}

export default function DocumentsPage({ embedded = false, onBack = null, hideHeader = false }) {
  const router = useRouter()
  const { t, locale } = useI18n()
  const { effectiveRole, isAdmin, refresh: refreshEffectiveRole } = useEffectiveRole()
  const isClientRole = effectiveRole === "CLIENT"

  const [docsState, setDocsState] = useState(() => emptyFamily())
  const [artifactsState, setArtifactsState] = useState(() => emptyFamily())
  const [analysesState, setAnalysesState] = useState(() => emptyFamily())
  const [researchState, setResearchState] = useState(() => emptyFamily({ enabled: true }))
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [typeFilter, setTypeFilter] = useState("ALL")
  const [searchDraft, setSearchDraft] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [successNotice, setSuccessNotice] = useState(null)
  const [actionError, setActionError] = useState("")

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploadKind, setUploadKind] = useState("MATERIAL")
  const [uploadTemplateFor, setUploadTemplateFor] = useState("")
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadDragActive, setUploadDragActive] = useState(false)
  const uploadInputRef = useRef(null)

  const [editingId, setEditingId] = useState(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [analysisView, setAnalysisView] = useState({ id: null, content: "", loading: false, error: "" })

  const [frameworkStatus, setFrameworkStatus] = useState({ loading: false, acceptance: null })

  const uploadKindOptions = useMemo(
    () => ["TEMPLATE", "MATERIAL", "OTHER"].map((kind) => ({ value: kind, label: kindLabel(kind, t) })),
    [t]
  )
  const templateForOptions = useMemo(
    () => TEMPLATE_FOR_VALUES.map((value) => ({ value, label: templateForLabel(value, t) })),
    [t]
  )

  const loadDocuments = useCallback(async (offset = 0) => {
    try {
      const params = new URLSearchParams({ limit: String(WORKSPACE_WINDOW), offset: String(offset) })
      if (isClientRole) params.set("kind", "MATERIAL")
      if (searchQuery) params.set("search", searchQuery)
      const response = await fetch(`/api/documents?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.load_documents"))
      setDocsState((current) => mergeOwnerPage(current, {
        items: payload?.documents,
        total: payload?.pagination?.total,
        offset
      }))
    } catch (error) {
      setDocsState((current) =>
        offset
          ? { ...current, error: error?.message || t("documents.errors.load_documents") }
          : emptyFamily({ error: error?.message || t("documents.errors.load_documents") })
      )
    }
  }, [isClientRole, searchQuery, t])

  const loadArtifacts = useCallback(async (offset = 0) => {
    try {
      const params = new URLSearchParams({ limit: String(ARTIFACT_LIST_LIMIT_ALL), offset: String(offset), sort: "updated_desc" })
      if (searchQuery) params.set("search", searchQuery)
      const response = await fetch(`/api/documents/artifacts?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.load_artifacts"))
      setArtifactsState((current) => mergeOwnerPage(current, {
        items: payload?.artifacts,
        total: payload?.pagination?.total,
        offset
      }))
    } catch (error) {
      setArtifactsState((current) =>
        offset
          ? { ...current, error: error?.message || t("documents.errors.load_artifacts") }
          : emptyFamily({ error: error?.message || t("documents.errors.load_artifacts") })
      )
    }
  }, [searchQuery, t])

  const loadAnalyses = useCallback(async (offset = 0) => {
    try {
      const params = new URLSearchParams({ limit: String(WORKSPACE_WINDOW), offset: String(offset) })
      if (searchQuery) params.set("search", searchQuery)
      const response = await fetch(`/api/documents/analyses?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.analyses.errors.list_failed"))
      setAnalysesState((current) => mergeOwnerPage(current, {
        items: payload?.analyses,
        total: payload?.pagination?.total,
        offset
      }))
    } catch (error) {
      setAnalysesState((current) =>
        offset
          ? { ...current, error: error?.message || t("documents.analyses.errors.list_failed") }
          : emptyFamily({ error: error?.message || t("documents.analyses.errors.list_failed") })
      )
    }
  }, [searchQuery, t])

  const loadResearch = useCallback(async (offset = 0) => {
    try {
      const params = new URLSearchParams({ limit: String(WORKSPACE_WINDOW), offset: String(offset) })
      if (searchQuery) params.set("search", searchQuery)
      const response = await fetch(`/api/research/jobs?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.workspace.research_load_failed"))
      setResearchState((current) => mergeOwnerPage(current, {
        items: payload?.jobs,
        total: payload?.pagination?.total,
        offset,
        extra: { enabled: payload?.enabled !== false }
      }))
    } catch (error) {
      setResearchState((current) =>
        offset
          ? { ...current, error: error?.message || t("documents.workspace.research_load_failed") }
          : emptyFamily({ enabled: true, error: error?.message || t("documents.workspace.research_load_failed") })
      )
    }
  }, [searchQuery, t])

  const loadWorkspace = useCallback(async () => {
    setLoading(true)
    await Promise.allSettled(isClientRole
      ? [loadDocuments()]
      : [loadDocuments(), loadArtifacts(), loadAnalyses(), loadResearch()])
    setLoading(false)
  }, [isClientRole, loadDocuments, loadArtifacts, loadAnalyses, loadResearch])

  useEffect(() => { void loadWorkspace() }, [loadWorkspace])

  const loadMoreWorkspace = useCallback(async () => {
    const requests = []
    if (familyHasNextPage(docsState)) requests.push(loadDocuments(docsState.items.length))
    if (familyHasNextPage(artifactsState)) requests.push(loadArtifacts(artifactsState.items.length))
    if (familyHasNextPage(analysesState)) requests.push(loadAnalyses(analysesState.items.length))
    if (familyHasNextPage(researchState)) requests.push(loadResearch(researchState.items.length))
    if (!requests.length) return
    setLoadingMore(true)
    await Promise.allSettled(requests)
    setLoadingMore(false)
  }, [
    analysesState,
    artifactsState,
    docsState,
    loadAnalyses,
    loadArtifacts,
    loadDocuments,
    loadResearch,
    researchState
  ])

  // Säilita vanad süvalingid /documents?artifacts=all#artifacts (chat + koostamine): maandu
  // ühtsel loendil, eelvalitud koostatud objektidele — sama tööruumi tähendusega.
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (window.location.hash === "#artifacts" || params.has("artifacts")) {
      setTypeFilter("ARTIFACTS")
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadFrameworkStatus() {
      if (isClientRole) {
        setFrameworkStatus({ loading: false, acceptance: null })
        return
      }
      setFrameworkStatus((current) => ({ ...current, loading: true }))
      try {
        const response = await fetch("/api/framework-acceptances/worker", { cache: "no-store" })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.message || t("documents.framework_acceptance.load_failed"))
        if (cancelled) return
        setFrameworkStatus({ loading: false, acceptance: payload?.acceptance || null })
      } catch {
        if (cancelled) return
        setFrameworkStatus({ loading: false, acceptance: null })
      }
    }
    void loadFrameworkStatus()
    return () => { cancelled = true }
  }, [isClientRole, t])

  useEffect(() => {
    if (!successNotice) return undefined
    const timer = window.setTimeout(() => setSuccessNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [successNotice])

  const items = useMemo(
    () => buildWorkspaceItems({
      documents: docsState.items,
      artifacts: artifactsState.items,
      analyses: analysesState.items,
      research: researchState.items
    }),
    [docsState.items, artifactsState.items, analysesState.items, researchState.items]
  )

  const filteredItems = useMemo(() => {
    const group = FILTER_GROUPS[typeFilter]
    if (!group) return items
    return items.filter((item) => group.has(item.type))
  }, [items, typeFilter])

  const anyFamilyError = docsState.error || artifactsState.error || analysesState.error || researchState.error
  const anyTruncated =
    familyHasNextPage(docsState) ||
    familyHasNextPage(artifactsState) ||
    familyHasNextPage(analysesState) ||
    familyHasNextPage(researchState)

  const handleBack = useCallback(() => {
    if (typeof onBack === "function") {
      onBack()
      return
    }
    markChatWorkspaceRestore()
    if (typeof window === "undefined") {
      pushWithTransition(router, localizePath("/vestlus", locale))
      return
    }
    window.requestAnimationFrame(() => {
      pushWithTransition(router, localizePath("/vestlus", locale))
    })
  }, [locale, onBack, router])

  async function submitUpload(event) {
    event.preventDefault()
    if (!uploadFile || uploading) return
    setUploading(true)
    setSuccessNotice(null)
    setActionError("")
    try {
      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("title", uploadTitle)
      formData.append("kind", uploadKind)
      if (uploadKind === "TEMPLATE" && uploadTemplateFor) formData.append("templateFor", uploadTemplateFor)
      const response = await fetch("/api/documents", { method: "POST", body: formData })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.upload_failed"))
      setUploadTitle("")
      setUploadKind("MATERIAL")
      setUploadTemplateFor("")
      setUploadFile(null)
      setUploadOpen(false)
      setSuccessNotice({ message: t("documents.feedback.uploaded") })
      await loadDocuments()
    } catch (error) {
      setActionError(error?.message || t("documents.errors.upload_failed"))
    } finally {
      setUploading(false)
    }
  }

  async function patchDocument(id, data, successKey = "documents.feedback.saved") {
    setSuccessNotice(null)
    setActionError("")
    try {
      const currentDocument = docsState.items.find((document) => document.id === id)
      if (!currentDocument?.updatedAt) throw new Error(t("documents.errors.save_failed"))
      const response = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, expectedUpdatedAt: currentDocument.updatedAt })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 409 && payload?.document?.id) {
          setDocsState((current) => ({
            ...current,
            items: current.items.map((document) =>
              document.id === payload.document.id ? payload.document : document
            )
          }))
        }
        throw new Error(payload?.message || t("documents.errors.save_failed"))
      }
      setSuccessNotice({ message: t(successKey) })
      await loadDocuments()
      return true
    } catch (error) {
      setActionError(error?.message || t("documents.errors.save_failed"))
      return false
    }
  }

  async function saveRename(id) {
    const ok = await patchDocument(id, { title: editingTitle })
    if (ok) {
      setEditingId(null)
      setEditingTitle("")
    }
  }

  async function deleteDocument(id) {
    if (!window.confirm(t("documents.confirm.delete_document"))) return
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.delete_failed"))
      setSuccessNotice({ message: t("documents.feedback.deleted") })
      await loadDocuments()
    } catch (error) {
      setActionError(error?.message || t("documents.errors.delete_failed"))
    }
  }

  async function deleteArtifact(id) {
    if (!window.confirm(t("documents.confirm.delete_artifact"))) return
    try {
      const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(id)}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.delete_artifact_failed"))
      setSuccessNotice({ message: t("documents.feedback.artifact_deleted") })
      await loadArtifacts()
    } catch (error) {
      setActionError(error?.message || t("documents.errors.delete_artifact_failed"))
    }
  }

  async function copyArtifact(artifactId) {
    try {
      const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.copy_failed"))
      await navigator.clipboard.writeText(String(payload?.artifact?.content || ""))
      setActionError("")
      setSuccessNotice({ message: t("documents.feedback.copied") })
    } catch (error) {
      setActionError(error?.message || t("documents.errors.copy_failed"))
    }
  }

  async function viewAnalysis(id) {
    if (analysisView.id === id) {
      setAnalysisView({ id: null, content: "", loading: false, error: "" })
      return
    }
    setAnalysisView({ id, content: "", loading: true, error: "" })
    try {
      const response = await fetch(`/api/documents/analyses/${encodeURIComponent(id)}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.analyses.errors.read_failed"))
      setAnalysisView({ id, content: String(payload?.analysis?.content || ""), loading: false, error: "" })
    } catch (error) {
      setAnalysisView({ id, content: "", loading: false, error: error?.message || t("documents.analyses.errors.read_failed") })
    }
  }

  async function deleteAnalysis(id) {
    if (!window.confirm(t("documents.analyses.confirm_delete"))) return
    try {
      const response = await fetch(`/api/documents/analyses/${encodeURIComponent(id)}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.analyses.errors.delete_failed"))
      if (analysisView.id === id) setAnalysisView({ id: null, content: "", loading: false, error: "" })
      setSuccessNotice({ message: t("documents.analyses.feedback_deleted") })
      await loadAnalyses()
    } catch (error) {
      setActionError(error?.message || t("documents.analyses.errors.delete_failed"))
    }
  }

  async function stopResearch(id) {
    if (!window.confirm(t("documents.workspace.research_confirm_stop"))) return
    try {
      const response = await fetch(`/api/research/jobs/${encodeURIComponent(id)}/stop`, { method: "POST" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.workspace.research_stop_failed"))
      setSuccessNotice({ message: t("documents.workspace.research_stopped") })
      await loadResearch()
    } catch (error) {
      setActionError(error?.message || t("documents.workspace.research_stop_failed"))
    }
  }

  async function deleteResearch(id) {
    if (!window.confirm(t("documents.workspace.research_confirm_delete"))) return
    try {
      const response = await fetch(`/api/research/jobs/${encodeURIComponent(id)}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.workspace.research_delete_failed"))
      setSuccessNotice({ message: t("documents.workspace.research_deleted") })
      await loadResearch()
    } catch (error) {
      setActionError(error?.message || t("documents.workspace.research_delete_failed"))
    }
  }

  const handleUploadFileSelection = useCallback((file) => {
    setUploadFile(file || null)
    setUploadDragActive(false)
  }, [])

  const handleUploadDrop = useCallback((event) => {
    event.preventDefault()
    handleUploadFileSelection(event.dataTransfer?.files?.[0] || null)
  }, [handleUploadFileSelection])

  /* Memoiseeritud: läheb paneeli ⓘ-le usePanelInfoSlot'i kaudu. */
  const frameworkAcceptance = frameworkStatus.acceptance
  const hasFrameworkAcceptance = frameworkAcceptance?.accepted === true
  const frameworkAcceptedAtLabel = frameworkAcceptance?.acceptedAt ? formatDate(frameworkAcceptance.acceptedAt, locale) : ""
  const frameworkPageHref = localizePath("/tooalase-kasutuse-raamistik", locale)

  const frameworkInfoPanel = useMemo(() => (
    <div>
      <div>
        <h3>{t("documents.framework_acceptance.manage_title")}</h3>
        <p>
          {frameworkStatus.loading
            ? t("documents.loading")
            : hasFrameworkAcceptance
            ? t("documents.framework_acceptance.manage_confirmed_short", {
                date: frameworkAcceptedAtLabel,
                version: frameworkAcceptance.frameworkVersion || WORKER_FRAMEWORK_VERSION
              })
            : t("documents.framework_acceptance.manage_pending")}
        </p>
      </div>
      <div>
        <Button as="a" href={frameworkPageHref} size="sm">
          {t("auth.register.worker_framework_open")}
        </Button>
        <Button as="a" href={WORKER_FRAMEWORK_SIGNED_HREF} size="sm">
          {t("auth.register.worker_framework_download_signed")}
        </Button>
        {hasFrameworkAcceptance && frameworkAcceptance?.documentDownloadUrl ? (
          <Button as="a" href={frameworkAcceptance.documentDownloadUrl} size="sm" variant="linkBrand">
            {t("documents.framework_acceptance.download_record")}
          </Button>
        ) : null}
      </div>
    </div>
  ), [t, frameworkStatus.loading, hasFrameworkAcceptance, frameworkAcceptedAtLabel, frameworkAcceptance, frameworkPageHref])

  const infoDetailExtras = useMemo(() => ({ 3: frameworkInfoPanel }), [frameworkInfoPanel])
  usePanelInfoSlot({
    infoId: "documents",
    title: t("documents.page_title"),
    detailExtras: infoDetailExtras,
    active: !embedded
  })

  if (isClientRole) {
    if (embedded) return <div />
    return (
      <section className="feature-page feature-page__surface feature-page--documents documents-page" data-dock-scroll-behavior="recede">
        <SubpageHeader
          title={t("documents.client_document_library.title")}
          onBack={() => router.push(localizePath("/dokreziim", locale))}
          backAriaLabel={t("documents.client_document_library.back_to_compose")}
          showBack={false}
        />
        <Panel as="section" variant="secondary" padding="sm">
          <p>{t("documents.client_document_library.description")}</p>
          {actionError ? <div className="documents-error" role="alert">{actionError}</div> : null}
          {successNotice?.message ? <div role="status">{successNotice.message}</div> : null}
          {loading ? (
            <div className="documents-list__status">{t("documents.loading")}</div>
          ) : docsState.items.length === 0 ? (
            <div className="documents-list__status">{t("documents.client_document_library.empty")}</div>
          ) : (
            <div className="documents-list">
              {docsState.items.map((document) => (
                <article key={document.id} className="documents-item">
                  <div className="documents-item__head">
                    <div>
                      <h2>{document.title || document.originalName}</h2>
                      <p className="documents-item__meta">
                        {document.originalName} · {formatFileSize(document.size)}
                      </p>
                    </div>
                    <span className="documents-item__updated">
                      {t("documents.updated_at")} {formatDate(document.updatedAt, locale)}
                    </span>
                  </div>
                  <div className="documents-item__actions">
                    <Button
                      as="a"
                      href={`/api/documents/${encodeURIComponent(document.id)}/download`}
                      size="sm"
                      variant="linkBrand"
                    >
                      {t("documents.actions.download")}
                    </Button>
                    <Button type="button" size="sm" variant="danger" onClick={() => void deleteDocument(document.id)}>
                      {t("documents.actions.delete")}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {docsState.items.length < docsState.total ? (
            <div className="documents-list__truncated">
              <Button
                type="button"
                variant="secondary"
                disabled={loadingMore}
                onClick={async () => {
                  setLoadingMore(true)
                  await loadDocuments(docsState.items.length)
                  setLoadingMore(false)
                }}
              >
                {loadingMore ? t("documents.loading") : t("documents.workspace.load_more")}
              </Button>
            </div>
          ) : null}
        </Panel>
      </section>
    )
  }

  const entryCards = [
    { key: "analyze", href: localizePath("/vestlus", locale) },
    { key: "compose", href: localizePath("/dokreziim", locale) },
    { key: "transcribe", href: localizePath("/dokreziim", locale) },
    { key: "research", href: localizePath("/vestlus", locale), disabled: !researchState.enabled }
  ]

  const filterChips = [
    { key: "ALL", label: t("documents.filters.all") },
    { key: "FILES", label: t("documents.workspace.filters.files") },
    { key: "ANALYSIS", label: t("documents.workspace.filters.analysis") },
    { key: "ARTIFACTS", label: t("documents.workspace.filters.artifacts") },
    { key: "RESEARCH", label: t("documents.workspace.filters.research") },
    { key: "SERVICE_LOG", label: t("documents.workspace.filters.service_log") }
  ]

  function renderRowActions(item) {
    const raw = item.raw || {}
    if (item.type === "source" || item.type === "transcript") {
      const composeHref = `${localizePath("/dokreziim", locale)}?documents=${encodeURIComponent(item.id)}`
      return (
        <>
          <Button as="a" href={`/api/documents/${encodeURIComponent(item.id)}/download`} size="sm" variant="linkBrand">
            {t("documents.actions.download")}
          </Button>
          {!item.readOnly && raw.agentAllowed ? (
            <Button as="a" href={composeHref} size="sm">{t("documents.workspace.compose_from")}</Button>
          ) : null}
          {!item.readOnly ? (
            <Button type="button" size="sm" variant="primary" onClick={() => { setEditingId(item.id); setEditingTitle(item.title || "") }}>
              {t("documents.actions.rename")}
            </Button>
          ) : null}
          {!item.readOnly ? (
            <Button type="button" size="sm" variant="danger" onClick={() => void deleteDocument(item.id)}>
              {t("documents.actions.delete")}
            </Button>
          ) : null}
        </>
      )
    }
    if (item.type === "analysis") {
      const open = analysisView.id === item.id
      return (
        <>
          <Button
            type="button"
            size="sm"
            onClick={() => void viewAnalysis(item.id)}
            aria-expanded={open}
          >
            {open ? t("documents.workspace.hide") : t("documents.actions.open")}
          </Button>
          <Button type="button" size="sm" variant="danger" onClick={() => void deleteAnalysis(item.id)}>
            {t("documents.actions.delete")}
          </Button>
        </>
      )
    }
    if (item.type === "draft" || item.type === "final") {
      return (
        <>
          <Link href={localizePath(`/documents/artifacts/${encodeURIComponent(item.id)}`, locale)}>
            {t("documents.actions.open")}
          </Link>
          {raw.downloadUrls?.docx ? <Button as="a" href={raw.downloadUrls.docx} size="sm">{t("documents.actions.download_docx")}</Button> : null}
          {raw.downloadUrls?.pdf ? <Button as="a" href={raw.downloadUrls.pdf} size="sm" variant="linkBrand">{t("documents.actions.download_pdf")}</Button> : null}
          <Button type="button" size="sm" variant="primary" onClick={() => void copyArtifact(item.id)}>{t("documents.actions.copy")}</Button>
          <Button type="button" size="sm" variant="danger" onClick={() => void deleteArtifact(item.id)}>{t("documents.actions.delete")}</Button>
        </>
      )
    }
    if (item.type === "research") {
      const isTerminal = ["done", "error", "cancelled"].includes(String(raw.status))
      return (
        <>
          {raw.convId ? (
            <Button as="a" href={`${localizePath("/vestlus", locale)}?conv=${encodeURIComponent(raw.convId)}`} size="sm">
              {t("documents.workspace.research_open")}
            </Button>
          ) : null}
          {isTerminal ? (
            <Button type="button" size="sm" variant="danger" onClick={() => void deleteResearch(item.id)}>
              {t("documents.actions.delete")}
            </Button>
          ) : (
            /* SOL-RES-07: aktiivsel real oli varem ainult vestluse link — tööd ei saanud kuskilt
               peatada. Peatamine on nüüd oma tegu ja ta on siin, kus töö nähtav on. */
            <Button type="button" size="sm" variant="danger" onClick={() => void stopResearch(item.id)}>
              {t("documents.workspace.research_stop")}
            </Button>
          )}
        </>
      )
    }
    return null
  }

  function renderRow(item) {
    const prov = describeProvenance(item, t)
    const raw = item.raw || {}
    const ragRemovalPending = ["pending", "failed"].includes(String(raw?.metadata?.ragRemoval?.status || ""))
    const isEditing = editingId === item.id && (item.type === "source" || item.type === "transcript")
    return (
      <article key={item.key} className="documents-item">
        <div className="documents-item__head">
          <div>
            <span className="documents-item__type">{workspaceTypeLabel(item.type, t)}</span>
            {isEditing ? (
              <div className="documents-item__rename">
                <Input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} aria-label={t("documents.form.title_label", "Pealkiri")} />
                <Button type="button" size="sm" variant="primary" onClick={() => void saveRename(item.id)}>{t("buttons.save")}</Button>
                <Button type="button" size="sm" variant="linkBrand" onClick={() => { setEditingId(null); setEditingTitle("") }}>{t("buttons.cancel")}</Button>
              </div>
            ) : (
              <h3>{item.title || t("documents.workspace.untitled")}</h3>
            )}
            {(item.type === "source" || item.type === "transcript") && raw.originalName ? (
              <p className="documents-item__meta">{raw.originalName} · {formatFileSize(raw.size)}</p>
            ) : null}
          </div>
          <span className="documents-item__updated">{t("documents.updated_at")} {formatDate(item.updatedAt, locale)}</span>
        </div>

        {item.type === "analysis" ? (
          <p className="documents-item__disclaimer">{t("documents.analyses.disclaimer")}</p>
        ) : null}

        <dl className="documents-provenance">
          <div><dt>{t("documents.provenance.labels.audience")}</dt><dd>{prov.audience}</dd></div>
          <div><dt>{t("documents.provenance.labels.origin")}</dt><dd>{prov.origin}</dd></div>
          <div><dt>{t("documents.provenance.labels.state")}</dt><dd>{prov.state}</dd></div>
          <div><dt>{t("documents.provenance.labels.retention")}</dt><dd>{prov.retention}</dd></div>
          <div><dt>{t("documents.provenance.labels.rag")}</dt><dd>{prov.rag}</dd></div>
        </dl>

        {(item.type === "source" || item.type === "transcript") && !item.readOnly ? (
          <label className="documents-item__ragtoggle">
            <Checkbox
              bare
              checked={Boolean(raw.agentAllowed)}
              disabled={ragRemovalPending}
              onChange={(checked) => void patchDocument(item.id, { agentAllowed: checked })}
            />
            <span>{ragRemovalPending
              ? t(`documents.workspace.rag_removal_${raw.metadata.ragRemoval.status}`)
              : t("documents.workspace.rag_toggle")}</span>
          </label>
        ) : null}

        {item.type === "analysis" && analysisView.id === item.id ? (
          <div className="documents-item__analysis" role="region" aria-live="polite">
            {analysisView.loading ? <p>{t("documents.loading")}</p> : null}
            {analysisView.error ? <p role="alert">{analysisView.error}</p> : null}
            {analysisView.content ? <p className="documents-item__analysis-text">{analysisView.content}</p> : null}
          </div>
        ) : null}

        <div className="documents-item__actions">
          {renderRowActions(item)}
        </div>
      </article>
    )
  }

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

      <div className="feature-page feature-page__surface feature-page--documents documents-page" data-dock-scroll-behavior="recede">
        {!hideHeader ? (
          <SubpageHeader onBack={handleBack} backAriaLabel={t("buttons.back")} showBack={false} anchorBack={false}>
            {t("documents.page_title")}
          </SubpageHeader>
        ) : null}

        {successNotice ? (
          <div className="documents-notice" role="status" aria-live="polite">
            <span>{successNotice.message}</span>
            <Button type="button" size="sm" variant="linkBrand" onClick={() => setSuccessNotice(null)}>{t("common.close")}</Button>
          </div>
        ) : null}
        {actionError ? <div className="documents-error" role="alert">{actionError}</div> : null}

        {/* Sisenemine küsimusest, mitte valikutest — vood on selle ruumi sissepääsud. */}
        <Panel as="section" variant="secondary" padding="sm">
          <h2>{t("documents.workspace.entry_title")}</h2>
          <p>{t("documents.workspace.entry_description")}</p>
          <div className="documents-entry">
            {entryCards.map((card) => (
              <Link key={card.key} href={card.href} className="documents-entry__card">
                <span className="documents-entry__card-title">{t(`documents.workspace.entry.${card.key}_title`)}</span>
                <span className="documents-entry__card-desc">{t(`documents.workspace.entry.${card.key}_desc`)}</span>
                {card.disabled ? <span className="documents-entry__card-note">{t("documents.workspace.research_disabled")}</span> : null}
              </Link>
            ))}
            <button type="button" className="documents-entry__card" onClick={() => setUploadOpen((open) => !open)} aria-expanded={uploadOpen}>
              <span className="documents-entry__card-title">{t("documents.workspace.entry.add_file_title")}</span>
              <span className="documents-entry__card-desc">{t("documents.workspace.entry.add_file_desc")}</span>
            </button>
          </div>

          {uploadOpen ? (
            <Form onSubmit={submitUpload} className="documents-upload">
              <div className="documents-upload__row">
                <label>
                  <span>{t("documents.form.title_label", "Pealkiri")}</span>
                  <Input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} placeholder={t("documents.form.title_placeholder")} />
                </label>
                <label>
                  <span>{t("documents.form.kind_label")}</span>
                  <DocumentsDropdown
                    ariaLabel={t("documents.form.kind_label")}
                    value={uploadKind}
                    onChange={(nextValue) => { setUploadKind(nextValue); if (nextValue !== "TEMPLATE") setUploadTemplateFor("") }}
                    options={uploadKindOptions}
                    align="end"
                  />
                </label>
              </div>
              {uploadKind === "TEMPLATE" ? (
                <label>
                  <span>{t("documents.form.template_for_placeholder")}</span>
                  <DocumentsDropdown
                    ariaLabel={t("documents.form.template_for_placeholder")}
                    value={uploadTemplateFor}
                    onChange={setUploadTemplateFor}
                    options={templateForOptions}
                    placeholder={t("documents.form.template_for_placeholder")}
                    align="end"
                  />
                </label>
              ) : null}
              <div
                className="documents-dropzone-wrap"
                onDragOver={(event) => { event.preventDefault(); setUploadDragActive(true) }}
                onDragEnter={(event) => { event.preventDefault(); setUploadDragActive(true) }}
                onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains?.(event.relatedTarget)) setUploadDragActive(false) }}
                onDrop={handleUploadDrop}
              >
                <input
                  ref={uploadInputRef}
                  className="sr-only"
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={(event) => handleUploadFileSelection(event.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  className="documents-dropzone"
                  data-drag-active={uploadDragActive ? "true" : undefined}
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <span>{uploadDragActive ? t("documents.form.dropzone_active") : t("documents.form.dropzone_idle")}</span>
                  <span>{t("documents.form.file_help")}</span>
                </button>
                <div className="documents-upload__file">
                  {uploadFile ? `${uploadFile.name} · ${formatFileSize(uploadFile.size)}` : t("documents.form.no_file_selected")}
                </div>
              </div>
              <div className="documents-upload__actions">
                <Button type="submit" size="sm" disabled={!uploadFile || uploading}>
                  {uploading ? t("documents.form.uploading") : t("documents.actions.upload")}
                </Button>
                <Button type="button" size="sm" variant="linkBrand" onClick={() => setUploadOpen(false)}>{t("common.close")}</Button>
              </div>
            </Form>
          ) : null}
        </Panel>

        {/* Üks ühtne objektiloend — igal real valdusriba ja üks järgmine toiming. */}
        <Panel as="section" id="artifacts" variant="secondary" padding="sm">
          <div className="documents-list__head">
            <h2>{t("documents.workspace.list_title")}</h2>
            <Form
              className="documents-list__search"
              onSubmit={(event) => {
                event.preventDefault()
                setSearchQuery(searchDraft.trim())
              }}
            >
              <Input
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={t("documents.workspace.search_placeholder")}
                aria-label={t("documents.workspace.search_placeholder")}
              />
              <Button type="submit" variant="secondary">
                {t("documents.workspace.search")}
              </Button>
            </Form>
            <div className="documents-list__filters" role="group" aria-label={t("documents.workspace.filter_label")}>
              {filterChips.map((chip) => (
                <OptionCard
                  key={chip.key}
                  type="radio"
                  name="documents-type-filter"
                  value={chip.key}
                  checked={typeFilter === chip.key}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  fitTextLines={1}
                >
                  <span>{chip.label}</span>
                </OptionCard>
              ))}
            </div>
          </div>

          {anyFamilyError ? <div className="documents-error" role="alert">{anyFamilyError}</div> : null}

          {loading ? (
            <div className="documents-list__status">{t("documents.loading")}</div>
          ) : filteredItems.length === 0 ? (
            <div className="documents-list__status">
              {typeFilter === "ALL" ? t("documents.workspace.empty_all") : t("documents.workspace.empty_filtered")}
            </div>
          ) : (
            <div className="documents-list">
              {filteredItems.map((item) => renderRow(item))}
            </div>
          )}

          {anyTruncated ? (
            <div className="documents-list__truncated">
              <p>{t("documents.workspace.truncated")}</p>
              <Button type="button" variant="secondary" disabled={loadingMore} onClick={loadMoreWorkspace}>
                {loadingMore ? t("documents.loading") : t("documents.workspace.load_more")}
              </Button>
            </div>
          ) : null}
        </Panel>
      </div>
    </>
  )

  if (embedded) return content

  return <section>{content}</section>
}
