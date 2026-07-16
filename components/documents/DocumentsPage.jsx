"use client"

import Link from "next/link"
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useEffectiveRole } from "@/components/auth/useEffectiveRole"
import { useI18n } from "@/components/i18n/I18nProvider"
import AdminRoleViewCycleButton from "@/components/workspace/AdminRoleViewCycleButton"
import Button from "@/components/ui/Button"
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot"
import DocumentsDropdown from "@/components/documents/DocumentsDropdown"
import { SubpageHeader } from "@/components/ui/SubpageHeader"
import Input from "@/components/ui/Input"
import Panel from "@/components/ui/Panel"
import OptionCard from "@/components/ui/OptionCard"
import { ARTIFACT_LIST_LIMIT, ARTIFACT_LIST_LIMIT_ALL, DOCUMENT_KIND_VALUES, DOCUMENT_LIST_LIMIT, TEMPLATE_FOR_VALUES } from "@/lib/documents/constants"
import {
  artifactStatusLabel,
  artifactTypeLabel,
  formatDate,
  formatFileSize,
  kindLabel,
  templateForLabel
} from "@/lib/documents/presentation"
import { WORKER_FRAMEWORK_SIGNED_HREF, WORKER_FRAMEWORK_VERSION } from "@/lib/frameworkAcceptances"
import { localizePath } from "@/lib/localizePath"
import { pushWithTransition } from "@/lib/routeTransition"

const CHAT_WORKSPACE_RESTORE_STORAGE_KEY = "__SOTSIAALAI_CHAT_WORKSPACE_RESTORE__"

function markChatWorkspaceRestore() {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(
      CHAT_WORKSPACE_RESTORE_STORAGE_KEY,
      JSON.stringify({ ts: Date.now() })
    )
  } catch {}
}

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase()
}

function ChipLabel({ label, count }) {
  return (
    <>
      <span>{label}</span>
      {typeof count === "number" ? <span>&nbsp;({count})</span> : null}
    </>
  )
}

function createPaginationState(limit) {
  return {
    total: 0,
    limit,
    offset: 0,
    hasPrevious: false,
    hasNext: false,
    previousOffset: 0,
    nextOffset: 0
  }
}

function normalizePaginationState(payload, fallbackLimit, fallbackOffset = 0) {
  const pagination = payload?.pagination || {}
  const limit = Number.isFinite(Number(pagination.limit)) ? Math.max(1, Number(pagination.limit)) : fallbackLimit
  const offset = Number.isFinite(Number(pagination.offset)) ? Math.max(0, Number(pagination.offset)) : fallbackOffset
  const total = Number.isFinite(Number(pagination.total)) ? Math.max(0, Number(pagination.total)) : 0
  const hasPrevious = Boolean(pagination.hasPrevious)
  const hasNext = Boolean(pagination.hasNext)

  return {
    total,
    limit,
    offset,
    hasPrevious,
    hasNext,
    previousOffset: hasPrevious ? Math.max(0, Number(pagination.previousOffset) || offset - limit) : 0,
    nextOffset: hasNext ? Math.max(offset + limit, Number(pagination.nextOffset) || offset + limit) : offset
  }
}

function PaginationControls({ itemCount, pagination, t, onPrevious, onNext }) {
  if (!pagination || pagination.total <= pagination.limit) return null
  const start = pagination.total > 0 ? pagination.offset + 1 : 0
  const end = pagination.total > 0 ? Math.min(pagination.offset + itemCount, pagination.total) : 0

  return (
    <div>
      <span>
        {t("documents.pagination.range", { start, end, total: pagination.total }, `${start}-${end} / ${pagination.total}`)}
      </span>
      <div>
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={!pagination.hasPrevious}
          onClick={onPrevious}
        >
          {t("documents.pagination.previous", "Eelmine")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={!pagination.hasNext}
          onClick={onNext}
        >
          {t("documents.pagination.next", "Jargmine")}
        </Button>
      </div>
    </div>
  )
}

export default function DocumentsPage({ initialArtifactLimit = ARTIFACT_LIST_LIMIT, artifactsExpanded = false, embedded = false, onBack = null, hideHeader = false }) {
  const router = useRouter()
  const { t, locale } = useI18n()
  const { effectiveRole, isAdmin, isRoleResolved, refresh: refreshEffectiveRole } = useEffectiveRole()
  const isClientRole = effectiveRole === "CLIENT"
  const isArtifactsExpanded = artifactsExpanded || initialArtifactLimit >= ARTIFACT_LIST_LIMIT_ALL
  const artifactPageSize = isArtifactsExpanded ? ARTIFACT_LIST_LIMIT_ALL : initialArtifactLimit
  const [kindFilter, setKindFilter] = useState("ALL")
  const [artifactFilter, setArtifactFilter] = useState("ALL")
  const [artifactSearch, setArtifactSearch] = useState("")
  const [artifactSort, setArtifactSort] = useState("updated_desc")
  const [documentsOffset, setDocumentsOffset] = useState(0)
  const [artifactsOffset, setArtifactsOffset] = useState(0)
  const [documents, setDocuments] = useState([])
  const [artifacts, setArtifacts] = useState([])
  const [documentsPagination, setDocumentsPagination] = useState(() => createPaginationState(DOCUMENT_LIST_LIMIT))
  const [artifactsPagination, setArtifactsPagination] = useState(() => createPaginationState(artifactPageSize))
  const [artifactCounts, setArtifactCounts] = useState({
    all: 0,
    draft: 0,
    final: 0
  })
  const [documentsLoading, setDocumentsLoading] = useState(true)
  const [artifactsLoading, setArtifactsLoading] = useState(true)
  const [documentsError, setDocumentsError] = useState("")
  const [artifactsError, setArtifactsError] = useState("")
  const [successNotice, setSuccessNotice] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploadKind, setUploadKind] = useState("MATERIAL")
  const [uploadTemplateFor, setUploadTemplateFor] = useState("")
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadDragActive, setUploadDragActive] = useState(false)
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([])
  const [frameworkStatus, setFrameworkStatus] = useState({
    loading: false,
    acceptance: null
  })
  const uploadInputRef = useRef(null)
  const deferredArtifactSearch = useDeferredValue(artifactSearch)
  const trimmedArtifactSearch = String(deferredArtifactSearch || "").trim()
  const roleScope = effectiveRole === "CLIENT" ? "client" : "worker"
  const handoffHelpText = selectedDocumentIds.length
    ? t(`documents.agent_handoff.ready_help_${roleScope}`)
    : t(`documents.agent_handoff.empty_help_${roleScope}`)

  const loadDocuments = useCallback(async (options = {}) => {
    const nextKind = options.kind ?? kindFilter
    const nextOffset = options.offset ?? documentsOffset
    setDocumentsLoading(true)
    setDocumentsError("")
    try {
      const params = new URLSearchParams({
        limit: String(DOCUMENT_LIST_LIMIT),
        offset: String(nextOffset)
      })
      if (nextKind !== "ALL") params.set("kind", nextKind)
      const response = await fetch(`/api/documents?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.load_documents"))
      const nextDocuments = Array.isArray(payload?.documents) ? payload.documents : []
      const nextPagination = normalizePaginationState(payload, DOCUMENT_LIST_LIMIT, nextOffset)
      if (!nextDocuments.length && nextPagination.total > 0 && nextOffset >= nextPagination.total) {
        setDocumentsOffset(nextPagination.previousOffset)
        return
      }
      setDocuments(nextDocuments)
      setDocumentsPagination(nextPagination)
    } catch (error) {
      setDocuments([])
      setDocumentsPagination(createPaginationState(DOCUMENT_LIST_LIMIT))
      setDocumentsError(error?.message || t("documents.errors.load_documents"))
    } finally {
      setDocumentsLoading(false)
    }
  }, [documentsOffset, kindFilter, t])

  const loadArtifacts = useCallback(async (options = {}) => {
    const nextOffset = isArtifactsExpanded ? (options.offset ?? artifactsOffset) : 0
    const nextFilter = options.filter ?? artifactFilter
    const nextSort = options.sort ?? artifactSort
    const nextSearch = options.search ?? trimmedArtifactSearch
    setArtifactsLoading(true)
    setArtifactsError("")
    try {
      const params = new URLSearchParams({
        limit: String(artifactPageSize),
        offset: String(nextOffset),
        sort: nextSort
      })
      if (nextFilter !== "ALL") params.set("status", nextFilter)
      if (nextSearch) params.set("search", nextSearch)
      const response = await fetch(`/api/documents/artifacts?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.load_artifacts"))
      const nextArtifacts = Array.isArray(payload?.artifacts) ? payload.artifacts : []
      const nextPagination = normalizePaginationState(payload, artifactPageSize, nextOffset)
      if (!nextArtifacts.length && nextPagination.total > 0 && nextOffset >= nextPagination.total) {
        setArtifactsOffset(nextPagination.previousOffset)
        return
      }
      setArtifacts(nextArtifacts)
      setArtifactsPagination(nextPagination)
      setArtifactCounts({
        all: Number(payload?.counts?.all) || 0,
        draft: Number(payload?.counts?.draft) || 0,
        final: Number(payload?.counts?.final) || 0
      })
    } catch (error) {
      setArtifacts([])
      setArtifactsPagination(createPaginationState(artifactPageSize))
      setArtifactCounts({
        all: 0,
        draft: 0,
        final: 0
      })
      setArtifactsError(error?.message || t("documents.errors.load_artifacts"))
    } finally {
      setArtifactsLoading(false)
    }
  }, [artifactFilter, artifactPageSize, artifactSort, artifactsOffset, isArtifactsExpanded, t, trimmedArtifactSearch])

  useEffect(() => { void loadDocuments() }, [loadDocuments])
  useEffect(() => { void loadArtifacts() }, [loadArtifacts])

  useEffect(() => {
    let cancelled = false

    async function loadFrameworkStatus() {
      if (isClientRole) {
        setFrameworkStatus({
          loading: false,
          acceptance: null
        })
        return
      }

      setFrameworkStatus((current) => ({
        ...current,
        loading: true
      }))

      try {
        const response = await fetch("/api/framework-acceptances/worker", {
          cache: "no-store"
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.message || t("documents.framework_acceptance.load_failed"))
        if (cancelled) return
        setFrameworkStatus({
          loading: false,
          acceptance: payload?.acceptance || null
        })
      } catch {
        if (cancelled) return
        setFrameworkStatus({
          loading: false,
          acceptance: null
        })
      }
    }

    void loadFrameworkStatus()

    return () => {
      cancelled = true
    }
  }, [isClientRole, t])

  useEffect(() => {
    if (!successNotice) return undefined
    const timer = window.setTimeout(() => setSuccessNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [successNotice])

  useEffect(() => {
    const blockedIds = new Set(documents.filter((document) => !document.agentAllowed).map((document) => document.id))
    if (!blockedIds.size) return
    setSelectedDocumentIds((current) => current.filter((id) => !blockedIds.has(id)))
  }, [documents])

  const kindOptions = useMemo(() => DOCUMENT_KIND_VALUES.map((kind) => ({ value: kind, label: kindLabel(kind, t) })), [t])
  const uploadKindOptions = useMemo(() => ["TEMPLATE", "MATERIAL", "OTHER"].map((kind) => ({ value: kind, label: kindLabel(kind, t) })), [t])
  const templateForOptions = useMemo(() => TEMPLATE_FOR_VALUES.map((value) => ({ value, label: templateForLabel(value, t) })), [t])
  const artifactSortOptions = useMemo(() => ([
    { value: "updated_desc", label: t("documents.artifacts.sort_updated_desc") },
    { value: "updated_asc", label: t("documents.artifacts.sort_updated_asc") },
    { value: "approved_desc", label: t("documents.artifacts.sort_approved_desc") },
    { value: "title_asc", label: t("documents.artifacts.sort_title_asc") }
  ]), [t])
  const agentModeHref = useMemo(() => {
    const basePath = localizePath("/dokreziim", locale)
    if (!selectedDocumentIds.length) return basePath
    const params = new URLSearchParams({ documents: selectedDocumentIds.join(",") })
    return `${basePath}?${params.toString()}`
  }, [locale, selectedDocumentIds])
  const filteredArtifacts = artifacts
  const artifactFilteredTotal = artifactsPagination.total
  const artifactHasSearch = normalizeSearchValue(artifactSearch).length > 0
  const showArtifactsToolbar = isArtifactsExpanded && (artifactCounts.all > 0 || artifactHasSearch || artifactFilter !== "ALL")
  const frameworkAcceptance = frameworkStatus.acceptance
  const hasFrameworkAcceptance = frameworkAcceptance?.accepted === true
  const frameworkAcceptedAtLabel = frameworkAcceptance?.acceptedAt
    ? formatDate(frameworkAcceptance.acceptedAt, locale)
    : ""
  const frameworkPageHref = localizePath("/tooalase-kasutuse-raamistik", locale)

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

  useEffect(() => {
    if (!isRoleResolved || !isClientRole) return
    router.replace(localizePath("/dokreziim", locale))
  }, [isClientRole, isRoleResolved, locale, router])

  async function submitUpload(event) {
    event.preventDefault()
    if (!uploadFile || uploading) return
    setUploading(true)
    setSuccessNotice(null)
    setDocumentsError("")
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
      setSuccessNotice({ message: t("documents.feedback.uploaded") })
      setDocumentsOffset(0)
      await loadDocuments({ offset: 0 })
    } catch (error) {
      setDocumentsError(error?.message || t("documents.errors.upload_failed"))
    } finally {
      setUploading(false)
    }
  }

  async function patchDocument(id, data, successKey = "documents.feedback.saved") {
    setSuccessNotice(null)
    setDocumentsError("")
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.save_failed"))
      setSuccessNotice({ message: t(successKey) })
      await loadDocuments()
      return true
    } catch (error) {
      setDocumentsError(error?.message || t("documents.errors.save_failed"))
      return false
    }
  }

  async function deleteDocument(id) {
    if (!window.confirm(t("documents.confirm.delete_document"))) return
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.delete_failed"))
      setSelectedDocumentIds((current) => current.filter((item) => item !== id))
      setSuccessNotice({ message: t("documents.feedback.deleted") })
      await loadDocuments()
    } catch (error) {
      setDocumentsError(error?.message || t("documents.errors.delete_failed"))
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
      setArtifactsError(error?.message || t("documents.errors.delete_artifact_failed"))
    }
  }

  async function copyArtifact(artifactId) {
    try {
      const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.copy_failed"))
      await navigator.clipboard.writeText(String(payload?.artifact?.content || ""))
      setArtifactsError("")
      setSuccessNotice({ message: t("documents.feedback.copied") })
    } catch (error) {
      setArtifactsError(error?.message || t("documents.errors.copy_failed"))
    }
  }

  async function saveRename(id) {
    const ok = await patchDocument(id, { title: editingTitle })
    if (ok) {
      setEditingId(null)
      setEditingTitle("")
    }
  }

  function toggleDocumentSelection(documentId, checked) {
    setSelectedDocumentIds((current) => {
      if (checked) return current.includes(documentId) ? current : [...current, documentId]
      return current.filter((id) => id !== documentId)
    })
  }

  const handleUploadFileSelection = useCallback((file) => {
    setUploadFile(file || null)
    setUploadDragActive(false)
  }, [])

  const handleUploadDragOver = useCallback((event) => {
    event.preventDefault()
    setUploadDragActive(true)
  }, [])

  const handleUploadDragLeave = useCallback((event) => {
    event.preventDefault()
    const relatedTarget = event.relatedTarget
    if (relatedTarget && event.currentTarget.contains?.(relatedTarget)) return
    setUploadDragActive(false)
  }, [])

  const handleUploadDrop = useCallback((event) => {
    event.preventDefault()
    const nextFile = event.dataTransfer?.files?.[0] || null
    handleUploadFileSelection(nextFile)
  }, [handleUploadFileSelection])

  /* Memoiseeritud, sest see läheb paneeli ⓘ-le usePanelInfoSlot'i kaudu:
     uus viide igal renderdusel paneks registreerimis-effecti tsüklisse. */
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
          <Button
            as="a"
            href={frameworkAcceptance.documentDownloadUrl}
            size="sm"
            variant="linkBrand"
            >
            {t("documents.framework_acceptance.download_record")}
          </Button>
        ) : null}
      </div>
    </div>
  ), [t, frameworkStatus.loading, hasFrameworkAcceptance, frameworkAcceptedAtLabel, frameworkAcceptance, frameworkPageHref])

  /* Paneeli ainus ⓘ (PanelFrame, × kõrval) saab siit dokumendilehe sisu +
     elava raamistiku-lisapaneeli. Hook peab olema ENNE isClientRole-i
     varajast returni. */
  const infoDetailExtras = useMemo(() => ({ 3: frameworkInfoPanel }), [frameworkInfoPanel])
  usePanelInfoSlot({
    infoId: "documents",
    title: t("documents.page_title"),
    detailExtras: infoDetailExtras,
    active: !embedded
  })

  if (isClientRole) {
    if (embedded) {
      return <div />
    }
    return (
      <section>
        <div />
      </section>
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
          ariaLabel={t("chat.workspace.view_role.label", "TĆ¶Ć¶laua vaade")}
        />
      ) : null}
      <div>
        <div>
          {!hideHeader ? (
            <SubpageHeader
              onBack={handleBack}
              backAriaLabel={t("buttons.back")}
              anchorBack={false}
              /* ⓘ elab paneeli nurgas × kõrval (PanelFrame); sisu antakse
                 usePanelInfoSlot'iga ülalpool. */
            >
              {t("documents.page_title")}
            </SubpageHeader>
          ) : null}
          <section>
            {successNotice ? (
              <div>
                <span>{successNotice.message}</span>
                <div>
                  {successNotice.actionUrl ? <Link href={successNotice.actionUrl}>{successNotice.actionLabel || t("documents.actions.open")}</Link> : null}
                  <Button type="button" size="sm" variant="linkBrand" onClick={() => setSuccessNotice(null)}>{t("common.close")}</Button>
                </div>
              </div>
            ) : null}
            {documentsError ? <div>{documentsError}</div> : null}
            {artifactsError ? <div>{artifactsError}</div> : null}

            <div>
              <div>
                <div>
                <Panel as="section" variant="secondary" padding="sm">
                  <div>
                    <h3>{t("documents.library_sections.upload_title")}</h3>
                    <p>{t("documents.library_sections.upload_description")}</p>
                  </div>
                <form onSubmit={submitUpload}>
                  <div>
                    <label>
                      <span>{t("documents.form.title_label", "Pealkiri")}</span>
                      <Input
                        value={uploadTitle}
                        onChange={(event) => setUploadTitle(event.target.value)}
                        placeholder={t("documents.form.title_placeholder")}
                      />
                    </label>
                    <label>
                      <span>{t("documents.form.kind_label")}</span>
                      <DocumentsDropdown
                        ariaLabel={t("documents.form.kind_label")}
                        value={uploadKind}
                        onChange={(nextValue) => {
                          setUploadKind(nextValue)
                          if (nextValue !== "TEMPLATE") setUploadTemplateFor("")
                        }}
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
                    onDragOver={handleUploadDragOver}
                    onDragEnter={handleUploadDragOver}
                    onDragLeave={handleUploadDragLeave}
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
                      <div>
                        {uploadDragActive ? t("documents.form.dropzone_active") : t("documents.form.dropzone_idle")}
                      </div>
                      <p>{t("documents.form.file_help")}</p>
                    </button>
                    <div>
                      {uploadFile ? `${uploadFile.name} Ā· ${formatFileSize(uploadFile.size)}` : t("documents.form.no_file_selected")}
                    </div>
                    <div>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => uploadInputRef.current?.click()}
                      >
                        {t("documents.form.choose_file")}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!uploadFile || uploading}
                    >
                      {uploading ? t("documents.form.uploading") : t("documents.actions.upload")}
                    </Button>
                  </div>
                </form>
                </Panel>

                <Panel as="section" variant="secondary" padding="sm">
                  <div>
                    <h3>{t("documents.library_sections.list_title")}</h3>
                    <p>{t("documents.library_sections.list_description")}</p>
                  </div>
                <div>
                  <div>
                    {["ALL", ...DOCUMENT_KIND_VALUES].map((kind) => (
                      <OptionCard
                        key={kind}
                        type="radio"
                        name="documents-kind-filter"
                        value={kind}
                        checked={kindFilter === kind}
                        onChange={(event) => {
                          setKindFilter(event.target.value)
                          setDocumentsOffset(0)
                        }}
                        fitTextLines={1}
                      >
                        <span>
                          {kind === "ALL" ? t("documents.filters.all") : kindLabel(kind, t)}
                        </span>
                      </OptionCard>
                    ))}
                  </div>
                </div>
                <div>
              {documentsLoading ? <div>{t("documents.loading")}</div> : null}
              {!documentsLoading && documents.length === 0 ? <div>{t("documents.empty_documents")}</div> : null}
              {documents.map((document) => {
                const isReadOnly = Boolean(document.readOnly)
                const frameworkAcceptance = document.frameworkAcceptance || null
                return <article key={document.id}>
                  <div>
                    <div>
                      <div>
                        {editingId === document.id && !isReadOnly ? (
                          <div>
                            <Input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} />
                            <Button type="button" size="sm" variant="primary" onClick={() => void saveRename(document.id)}>{t("buttons.save")}</Button>
                            <Button type="button" size="sm" variant="linkBrand" onClick={() => { setEditingId(null); setEditingTitle("") }}>{t("buttons.cancel")}</Button>
                          </div>
                        ) : (
                          <>
                            <div>
                              <h3>{document.title}</h3>
                              <span>{kindLabel(document.kind, t)}</span>
                              {isReadOnly ? <span>{t("documents.framework_acceptance.system_chip", "Acceptance")}</span> : null}
                              {document.templateFor ? <span>{templateForLabel(document.templateFor, t)}</span> : null}
                            </div>
                            <p>{document.originalName} Ā· {formatFileSize(document.size)} Ā· {formatDate(document.updatedAt, locale)}</p>
                            {frameworkAcceptance ? <p>{t("documents.framework_acceptance.accepted_at", "Accepted")}: {formatDate(frameworkAcceptance.acceptedAt, locale)} Ā· {t("documents.framework_acceptance.framework_version", "Version")}: {frameworkAcceptance.frameworkVersion} Ā· {t("documents.framework_acceptance.status_confirmed", "Confirmed")}</p> : null}
                            {document.callRecording ? <p>{t("documents.call_recording.purpose", "Salvestamise eesmärk")}: {document.callRecording.purposeText || document.callRecording.purpose || "-"} Ā· {t("documents.call_recording.consent_status", "Nõusoleku staatus")}: {document.callRecording.consentStatus || "-"}{document.callRecording.retentionUntil ? ` Ā· ${t("documents.call_recording.retention_until", "Säilitustähtaeg")}: ${formatDate(document.callRecording.retentionUntil, locale)}` : ""}</p> : null}
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      {!isReadOnly ? <label>
                        <input type="checkbox" checked={document.agentAllowed} onChange={(event) => { void patchDocument(document.id, { agentAllowed: event.target.checked }) }} />
                        <span>{t("documents.actions.agent_allowed")}</span>
                      </label> : <p>{t("documents.framework_acceptance.read_only_note", "This record was created by the system and cannot be changed or deleted.")}</p>}
                    </div>
                  </div>
                  <div>
                    {!isReadOnly && document.agentAllowed ? (
                      <label>
                        <input type="checkbox" checked={selectedDocumentIds.includes(document.id)} onChange={(event) => toggleDocumentSelection(document.id, event.target.checked)} aria-label={t("documents.actions.select_document", { title: document.title })} />
                        <span>
                          <span>{t("documents.actions.select_for_agent")}</span>
                        </span>
                      </label>
                    ) : (
                      <p>{isReadOnly ? t("documents.framework_acceptance.read_only_note", "This record was created by the system and cannot be changed or deleted.") : t("documents.multi_doc.enable_agent_allowed")}</p>
                    )}
                  </div>
                  <div>
                    {!isReadOnly ? <div>
                      <DocumentsDropdown ariaLabel={t("documents.form.kind_label")} value={document.kind} onChange={(nextKind) => { void patchDocument(document.id, { kind: nextKind, templateFor: nextKind === "TEMPLATE" ? document.templateFor : null }) }} options={kindOptions} />
                      {document.kind === "TEMPLATE" ? <DocumentsDropdown ariaLabel={t("documents.form.template_for_placeholder")} value={document.templateFor || ""} onChange={(nextValue) => { void patchDocument(document.id, { templateFor: nextValue || null }) }} options={templateForOptions} placeholder={t("documents.form.template_for_placeholder")} align="end" /> : null}
                    </div> : null}
                    <div>
                      <Button as="a" href={`/api/documents/${encodeURIComponent(document.id)}/download`} size="sm" variant="linkBrand">{t("documents.actions.download")}</Button>
                      {!isReadOnly ? <Button type="button" size="sm" variant="primary" onClick={() => { setEditingId(document.id); setEditingTitle(document.title || "") }}>{t("documents.actions.rename")}</Button> : null}
                      {!isReadOnly ? <Button type="button" size="sm" variant="danger" onClick={() => void deleteDocument(document.id)}>{t("documents.actions.delete")}</Button> : null}
                    </div>
                  </div>
                </article>
              })}
                </div>
                <PaginationControls
                  itemCount={documents.length}
                  pagination={documentsPagination}
                  t={t}
                  onPrevious={() => setDocumentsOffset(documentsPagination.previousOffset)}
                  onNext={() => setDocumentsOffset(documentsPagination.nextOffset)}
                />
                </Panel>

                </div>
              </div>
            </div>
          </section>

          <Panel as="section" variant="secondary" padding="sm">
            <div>
            <div>
            <div>
              <h3>{t("documents.agent_handoff.title")}</h3>
              <p>{handoffHelpText}</p>
            </div>
            <div>
              <div>
                <span>{t("documents.agent_handoff.selected_count", { count: selectedDocumentIds.length })}</span>
              </div>
              <div>
                {selectedDocumentIds.length ? (
                  <Button as="a" href={agentModeHref} size="sm">{t("documents.actions.open_agent_mode")}</Button>
                ) : (
                  <Button type="button" size="sm" disabled>{t("documents.actions.open_agent_mode")}</Button>
                )}
              </div>
            </div>
            </div>
            </div>
          </Panel>

          <Panel as="section" id="artifacts" variant="secondary" padding="sm">
            <div>
            <div>
            <div>
              <h3>{t("documents.outputs_title")}</h3>
              <p>{t("documents.outputs_description")}</p>
            </div>
            <div>
              <div>
                {[{ key: "ALL", label: t("documents.filters.all"), count: artifactCounts.all }, { key: "DRAFT", label: artifactStatusLabel("draft", t), count: artifactCounts.draft }, { key: "FINAL", label: artifactStatusLabel("final", t), count: artifactCounts.final }].map((item) => (
                  <OptionCard
                    key={item.key}
                    type="radio"
                    name="documents-artifact-filter"
                    value={item.key}
                    checked={artifactFilter === item.key}
                    onChange={(event) => {
                      setArtifactFilter(event.target.value)
                      setArtifactsOffset(0)
                    }}
                    fitTextLines={1}
                  >
                    <span>
                      <ChipLabel label={item.label} count={item.count} />
                    </span>
                  </OptionCard>
                ))}
              </div>
              <div>
                <Link href={localizePath(isArtifactsExpanded ? "/documents#artifacts" : "/documents?artifacts=all#artifacts", locale)}>{isArtifactsExpanded ? t("documents.actions.show_latest") : t("documents.actions.open_all_results")}</Link>
                <span>{t("documents.artifacts.results_count", { shown: filteredArtifacts.length, total: artifactFilteredTotal })}</span>
              </div>
            </div>
            {showArtifactsToolbar ? (
              <div>
                <p>
                  {artifactFilter === "FINAL" ? t("documents.artifacts.final_search_hint") : t("documents.artifacts.search_help")}
                </p>
                <div>
                  <label>
                    <span>{t("documents.actions.search")}</span>
                    <Input
                      value={artifactSearch}
                      onChange={(event) => {
                        setArtifactSearch(event.target.value)
                        setArtifactsOffset(0)
                      }}
                      placeholder={t("documents.artifacts.search_placeholder")}
                    />
                  </label>
                  <label>
                    <span>{t("documents.artifacts.sort_label")}</span>
                    <DocumentsDropdown
                      ariaLabel={t("documents.artifacts.sort_label")}
                      value={artifactSort}
                      onChange={(nextValue) => {
                        setArtifactSort(nextValue)
                        setArtifactsOffset(0)
                      }}
                      options={artifactSortOptions}
                      align="end"
                    />
                  </label>
                  {artifactHasSearch ? (
                    <div>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                                      onClick={() => {
                          setArtifactSearch("")
                          setArtifactsOffset(0)
                        }}
                      >
                        {t("documents.actions.clear_search", "Puhasta otsing")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div>
              {artifactsLoading ? <div>{t("documents.loading")}</div> : null}
              {!artifactsLoading && filteredArtifacts.length === 0 ? <div>{artifactHasSearch || artifactFilter !== "ALL" ? t("documents.artifacts.no_matches") : t("documents.empty_artifacts")}</div> : null}
              {filteredArtifacts.map((artifact) => (
                <article key={artifact.id}>
                  <div>
                    <h3>{artifact.title || artifactTypeLabel(artifact.type, t)}</h3>
                    <span>{artifactTypeLabel(artifact.type, t)}</span>
                    <span>{artifactStatusLabel(artifact.status, t)}</span>
                  </div>
                  <p>{formatDate(artifact.createdAt, locale)} Ā· {t("documents.updated_at")} {formatDate(artifact.updatedAt, locale)}{artifact.approvedAt ? ` Ā· ${t("documents.approved_at")} ${formatDate(artifact.approvedAt, locale)}` : ""}</p>
                  <p>{artifact.snippet}</p>
                  <p>{t("documents.sources_label", { count: artifact.sourceCount || 0 })}</p>
                  {isArtifactsExpanded && artifact.sources?.length ? <div>{artifact.sources.slice(0, 4).map((source) => <span key={source.id}>{source.title || source.originalName}</span>)}{artifact.sources.length > 4 ? <span>{t("documents.artifacts.source_preview_more", { count: artifact.sources.length - 4 })}</span> : null}</div> : null}
                  <div>
                    {artifact.downloadUrls?.docx ? <Button as="a" href={artifact.downloadUrls.docx} size="sm">{t("documents.actions.download_docx")}</Button> : null}
                    {artifact.downloadUrls?.pdf ? <Button as="a" href={artifact.downloadUrls.pdf} size="sm" variant="linkBrand">{t("documents.actions.download_pdf")}</Button> : null}
                    <Link href={localizePath(`/documents/artifacts/${encodeURIComponent(artifact.id)}`, locale)}>{t("documents.actions.open")}</Link>
                    <Button type="button" size="sm" variant="primary" onClick={() => void copyArtifact(artifact.id)}>{t("documents.actions.copy")}</Button>
                    <Button type="button" size="sm" variant="danger" onClick={() => void deleteArtifact(artifact.id)}>{t("documents.actions.delete")}</Button>
                  </div>
                </article>
              ))}
            </div>
            {isArtifactsExpanded ? (
              <PaginationControls
                itemCount={filteredArtifacts.length}
                pagination={artifactsPagination}
                t={t}
                onPrevious={() => setArtifactsOffset(artifactsPagination.previousOffset)}
                onNext={() => setArtifactsOffset(artifactsPagination.nextOffset)}
              />
            ) : null}
            </div>
            </div>
          </Panel>
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
