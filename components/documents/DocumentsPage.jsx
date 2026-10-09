"use client"

/**
 * Dokumendid: töötaja failid, AI koostatud tekstid, salvestatud analüüsid ja
 * süvauuringud ühes kohas; pöördujal tema lähtefailid.
 *
 * KUJU (09.10, kujundusaudit K07 ja omaniku reeglid). Leht oli üks pikk veerg:
 * küsimus kaartidega, sama pinna sees avanev üleslaadimise vorm ja selle all
 * kogu loend, kõik klaaspaneeli sees veel kahes tumedas kastis. Nüüd on leht
 * sammulaval (`components/stage/StepFlight.jsx`) ja selle osad on eraldi
 * vaated: tegevused, faili lisamine, loend, avatud dokument ja tööalase
 * kasutuse raamistik. Osad ei ole järjestikused sammud, seepärast annab leht
 * lavale `parts`: numbreid ega noolt „järgmine” ei ole, kiirmenüüs on „Kõik
 * osad” ja avatud osa nimi.
 *
 * Loendi rida on madal (pealkiri, märk, aeg, üks tegevus „Ava”). Kõik, mis
 * varem tegi rea kõrgeks, on avatud dokumendi vaates: päritolu faktid,
 * ümbernimetamine, töörežiimi luba, analüüsi tekst ja ülejäänud tegevused.
 * Kustutamine ja uuringu peatamine küsivad teist vajutust.
 *
 * PÖÖRDUJA näeb ainult oma lähtefaile (materjalid). Tal on üks loend, seega
 * sammulava ei ole: loend ja avatud fail vahetuvad kohapeal.
 *
 * Siin on andmed, päringud ja see, mis vaateid olekuga seob. Vaated on failis
 * ./workspace/DocumentsViews.jsx, read ja reeglid failis
 * ./workspace/documentRows.js, kujundus failis ./workspace/documents.module.css.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useEffectiveRole } from "@/components/auth/useEffectiveRole"
import { useI18n } from "@/components/i18n/I18nProvider"
import StepFlight from "@/components/stage/StepFlight"
import AdminRoleViewCycleButton from "@/components/workspace/AdminRoleViewCycleButton"
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot"
import { SubpageHeader } from "@/components/ui/SubpageHeader"
import { ARTIFACT_LIST_LIMIT_ALL, TEMPLATE_FOR_VALUES } from "@/lib/documents/constants"
import { formatDate, formatFileSize, kindLabel, templateForLabel } from "@/lib/documents/presentation"
import { buildWorkspaceItems } from "@/lib/documents/workspace"
import { familyHasNextPage, mergeOwnerPage } from "@/lib/documents/workspacePagination"
import { WORKER_FRAMEWORK_SIGNED_HREF, WORKER_FRAMEWORK_VERSION } from "@/lib/frameworkAcceptances"
import { localizePath } from "@/lib/localizePath"
import { pushWithTransition } from "@/lib/routeTransition"

import { AddFileView, EntryView, FrameworkView, ItemView, ListView } from "./workspace/DocumentsViews"
import {
  REMOVAL_NOTE_KEYS,
  UPLOAD_ACCEPT,
  documentRow,
  entryCards,
  filterItems,
  filterOptions,
  itemActions,
  itemSheet,
  uploadProblem,
  viewKeysFor
} from "./workspace/documentRows"
import styles from "./workspace/documents.module.css"

const CHAT_WORKSPACE_RESTORE_STORAGE_KEY = "__SOTSIAAL.PRO_CHAT_WORKSPACE_RESTORE__"
const LIST_RETURN_STORAGE_KEY = "__SOTSIAAL.PRO_DOCUMENTS_LIST_RETURN__"
const LIST_RETURN_MAX_AGE_MS = 30 * 60 * 1000
const WORKSPACE_WINDOW = 50
/* Teine vajutus (kustutamine, peatamine) peab tulema selle aja sees. */
const CONFIRM_MS = 8000
const CONFIRM_MIN_GAP_MS = 400
const NO_ANALYSIS = { id: null, content: "", loading: false, error: "" }

/* Jäädav kustutamine pere kaupa: kuhu päring läheb ja mis sõnadega leht
   küsib, kinnitab ja teatab veast. Neli peret, üks rada (`removeItem`). */
const REMOVALS = {
  document: {
    url: (id) => `/api/documents/${encodeURIComponent(id)}`,
    askKey: "documents.confirm.delete_document",
    doneKey: "documents.feedback.deleted",
    failKey: "documents.errors.delete_failed"
  },
  artifact: {
    url: (id) => `/api/documents/artifacts/${encodeURIComponent(id)}`,
    askKey: "documents.confirm.delete_artifact",
    doneKey: "documents.feedback.artifact_deleted",
    failKey: "documents.errors.delete_artifact_failed"
  },
  analysis: {
    url: (id) => `/api/documents/analyses/${encodeURIComponent(id)}`,
    askKey: "documents.analyses.confirm_delete",
    doneKey: "documents.analyses.feedback_deleted",
    failKey: "documents.analyses.errors.delete_failed"
  },
  research: {
    url: (id) => `/api/research/jobs/${encodeURIComponent(id)}`,
    askKey: "documents.workspace.research_confirm_delete",
    doneKey: "documents.workspace.research_deleted",
    failKey: "documents.workspace.research_delete_failed"
  }
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

/* Koostatud teksti detailileht on omaette leht ja toob siia tagasi lehe
   algusesse. Kes läks sinna loendist, tahab tagasi tulles loendit näha: märk
   pannakse lahkudes ja loetakse üks kord tagasi jõudes. */
function markListReturn() {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(LIST_RETURN_STORAGE_KEY, JSON.stringify({ ts: Date.now() }))
  } catch {}
}

function consumeListReturn() {
  if (typeof window === "undefined") return false
  try {
    const raw = window.sessionStorage.getItem(LIST_RETURN_STORAGE_KEY)
    if (!raw) return false
    window.sessionStorage.removeItem(LIST_RETURN_STORAGE_KEY)
    const ts = Number(JSON.parse(raw)?.ts || 0)
    return Number.isFinite(ts) && Date.now() - ts < LIST_RETURN_MAX_AGE_MS
  } catch {
    return false
  }
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

  const [uploading, setUploading] = useState(false)
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploadKind, setUploadKind] = useState("MATERIAL")
  const [uploadTemplateFor, setUploadTemplateFor] = useState("")
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadDragActive, setUploadDragActive] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [analysisView, setAnalysisView] = useState(NO_ANALYSIS)
  /* Kiirelt kahe analüüsi vahel liikudes võib esimese vastus tulla hiljem:
     ekraanile läheb ainult viimati küsitud analüüsi tekst. */
  const analysisRequest = useRef(null)

  const [frameworkStatus, setFrameworkStatus] = useState({ loading: false, acceptance: null, failed: false })

  /* Milline osa on ees ja milline dokument on avatud (`document:<id>` jne). */
  const [view, setView] = useState("entry")
  const [openedKey, setOpenedKey] = useState("")
  /* Päring on teel: sama tegevust ei saadeta kaks korda. Nuppe selleks välja ei
     lülitata: väljalülitatud nupp kaotaks klaviatuuri fookuse. */
  const busyRef = useRef(false)
  /* Kustutamine ja peatamine küsivad teist vajutust: `remove:<võti>` või `stop:<võti>`. */
  const [confirming, setConfirming] = useState("")
  const confirmTimer = useRef(0)
  const armedAt = useRef(0)
  const armConfirm = useCallback((key) => {
    window.clearTimeout(confirmTimer.current)
    armedAt.current = Date.now()
    setConfirming(key)
    confirmTimer.current = window.setTimeout(() => setConfirming(""), CONFIRM_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(confirmTimer.current), [])

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

  /* Pöördujal on ainult materjalid: teisi peresid ei küsita ka siis, kui
     administraator vahetas vaadet ja nende vana seis on veel mälus. */
  const loadMoreWorkspace = useCallback(async () => {
    const requests = []
    if (familyHasNextPage(docsState)) requests.push(loadDocuments(docsState.items.length))
    if (!isClientRole) {
      if (familyHasNextPage(artifactsState)) requests.push(loadArtifacts(artifactsState.items.length))
      if (familyHasNextPage(analysesState)) requests.push(loadAnalyses(analysesState.items.length))
      if (familyHasNextPage(researchState)) requests.push(loadResearch(researchState.items.length))
    }
    if (!requests.length) return
    setLoadingMore(true)
    await Promise.allSettled(requests)
    setLoadingMore(false)
  }, [
    analysesState,
    artifactsState,
    docsState,
    isClientRole,
    loadAnalyses,
    loadArtifacts,
    loadDocuments,
    loadResearch,
    researchState
  ])

  /* Vanad süvalingid /documents?artifacts=all#artifacts (vestlus ja koostamine)
     maanduvad loendis, kus on ette valitud koostatud tekstid. Sama teeb
     tagasitulek koostatud teksti detaililt, kuhu mindi loendist. */
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (window.location.hash === "#artifacts" || params.has("artifacts")) {
      setTypeFilter("ARTIFACTS")
      setView("list")
      return
    }
    if (consumeListReturn()) setView("list")
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadFrameworkStatus() {
      if (isClientRole) {
        setFrameworkStatus({ loading: false, acceptance: null, failed: false })
        return
      }
      setFrameworkStatus((current) => ({ ...current, loading: true }))
      try {
        const response = await fetch("/api/framework-acceptances/worker", { cache: "no-store" })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.message || t("documents.framework_acceptance.load_failed"))
        if (cancelled) return
        setFrameworkStatus({ loading: false, acceptance: payload?.acceptance || null, failed: false })
      } catch {
        if (cancelled) return
        /* Laadimise viga ei ole „kinnitust ei ole”: vaade ütleb, et seisu ei saanud kätte. */
        setFrameworkStatus({ loading: false, acceptance: null, failed: true })
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
    () => buildWorkspaceItems(isClientRole
      ? { documents: docsState.items }
      : {
          documents: docsState.items,
          artifacts: artifactsState.items,
          analyses: analysesState.items,
          research: researchState.items
        }),
    [isClientRole, docsState.items, artifactsState.items, analysesState.items, researchState.items]
  )

  const filteredItems = useMemo(
    () => (isClientRole ? items : filterItems(items, typeFilter)),
    [isClientRole, items, typeFilter]
  )

  const openedItem = useMemo(
    () => (openedKey ? items.find((item) => item.key === openedKey) || null : null),
    [items, openedKey]
  )

  /* Avatud dokument kadus loendist (kustutati mujal, otsing ei leia seda enam):
     avatud vaadet ei ole enam millestki joonistada, tagasi loendisse. */
  useEffect(() => {
    if (!openedKey || loading || openedItem) return
    setOpenedKey("")
    setView((current) => (current === "item" ? "list" : current))
  }, [loading, openedItem, openedKey])

  /* Dokumendi avamine ja sulgemine ehitab lava uuesti (pöördujal vahetub vaade
     kohapeal) ja nupp, millel fookus oli, kaob. Fookus läheb uue vaate
     pealkirjale, et klaviatuuriga ei peaks lehe algusest uuesti alustama.
     Saabuv vaade võib esimestel kaadritel veel peidus olla, seepärast
     proovitakse kaadrite kaupa (sama võte mis StepFlight-il). */
  const pageRef = useRef(null)
  const focusActiveHeading = useCallback(() => {
    let frame = 0
    const deadline = performance.now() + 1200
    const tryFocus = () => {
      const root = pageRef.current
      const heading = root?.querySelector('[data-active="1"] [data-step-heading]') || root?.querySelector("[data-step-heading]")
      heading?.focus({ preventScroll: true })
      if ((heading && document.activeElement === heading) || performance.now() > deadline) return
      frame = requestAnimationFrame(tryFocus)
    }
    tryFocus()
    return () => cancelAnimationFrame(frame)
  }, [])
  const hasOpenedItem = Boolean(openedItem)
  const openedSeen = useRef(hasOpenedItem)
  useEffect(() => {
    if (openedSeen.current === hasOpenedItem) return undefined
    openedSeen.current = hasOpenedItem
    return focusActiveHeading()
  }, [focusActiveHeading, hasOpenedItem])

  const anyFamilyError = isClientRole
    ? docsState.error
    : docsState.error || artifactsState.error || analysesState.error || researchState.error
  const anyTruncated = isClientRole
    ? familyHasNextPage(docsState)
    : familyHasNextPage(docsState) ||
      familyHasNextPage(artifactsState) ||
      familyHasNextPage(analysesState) ||
      familyHasNextPage(researchState)
  const totalCount = docsState.total + artifactsState.total + analysesState.total + researchState.total

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

  /* Iga tegevus algab puhtalt lehelt: eelmise tegevuse teade ega viga ei jää
     uue tulemuse kõrvale seisma. */
  function beginAction() {
    setSuccessNotice(null)
    setActionError("")
  }

  function cancelRename() {
    setEditingId(null)
    setEditingTitle("")
  }

  /* Ümbernimetamise väli kaob koos fookusega: see läheb tagasi vaate pealkirjale. */
  function closeRename() {
    cancelRename()
    focusActiveHeading()
  }

  /* Üks muutev päring korraga: vajutus, mis tuleb enne eelmise vastust, jääb ära. */
  async function exclusive(run) {
    if (busyRef.current) return undefined
    busyRef.current = true
    try {
      return await run()
    } finally {
      busyRef.current = false
    }
  }

  async function loadAnalysis(id) {
    analysisRequest.current = id
    setAnalysisView({ id, content: "", loading: true, error: "" })
    try {
      const response = await fetch(`/api/documents/analyses/${encodeURIComponent(id)}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.analyses.errors.read_failed"))
      if (analysisRequest.current !== id) return
      setAnalysisView({ id, content: String(payload?.analysis?.content || ""), loading: false, error: "" })
    } catch (error) {
      if (analysisRequest.current !== id) return
      setAnalysisView({ id, content: "", loading: false, error: error?.message || t("documents.analyses.errors.read_failed") })
    }
  }

  /* Veateade käib selle vaate tegevuse kohta, kus see tekkis: teise vaatesse
     see kaasa ei tule (õnnestumise teade tuleb ja kaob mõne sekundi pärast). */
  function openItem(item) {
    window.clearTimeout(confirmTimer.current)
    setConfirming("")
    setActionError("")
    cancelRename()
    setOpenedKey(item.key)
    setView("item")
    /* Analüüsi tekst on see, mille pärast analüüs avatakse: see laaditakse kohe. */
    if (item.type === "analysis") void loadAnalysis(item.id)
  }

  function closeItem() {
    window.clearTimeout(confirmTimer.current)
    setConfirming("")
    setActionError("")
    cancelRename()
    analysisRequest.current = null
    setAnalysisView(NO_ANALYSIS)
    setOpenedKey("")
    setView("list")
  }

  const handleUploadFileSelection = useCallback((file) => {
    setUploadDragActive(false)
    const problem = uploadProblem(file)
    if (problem) {
      setUploadFile(null)
      setSuccessNotice(null)
      setActionError(t(problem))
      return
    }
    setUploadFile(file || null)
    if (file) setActionError("")
  }, [t])

  async function submitUpload(event) {
    event.preventDefault()
    if (!uploadFile || uploading) return
    setUploading(true)
    beginAction()
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
      /* Uus fail on loendis näha: filter, mis faile ei näita, läheb maha. */
      setTypeFilter((current) => (current === "ALL" || current === "FILES" ? current : "ALL"))
      setView("list")
      await loadDocuments()
    } catch (error) {
      setActionError(error?.message || t("documents.errors.upload_failed"))
    } finally {
      setUploading(false)
    }
  }

  async function patchDocument(id, data, successKey = "documents.feedback.saved") {
    return exclusive(async () => {
      beginAction()
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
    })
  }

  async function saveRename(id) {
    const ok = await patchDocument(id, { title: editingTitle })
    if (ok) closeRename()
  }

  /* Kustutamine on jäädav. Siia jõuab alles teine vajutus (vt `confirmAction`). */
  async function removeItem(kind, id) {
    const removal = REMOVALS[kind]
    if (!removal) return undefined
    return exclusive(async () => {
      beginAction()
      try {
        const response = await fetch(removal.url(id), { method: "DELETE" })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.message || t(removal.failKey))
        closeItem()
        setSuccessNotice({ message: t(removal.doneKey) })
        if (kind === "document") await loadDocuments()
        else if (kind === "artifact") await loadArtifacts()
        else if (kind === "analysis") await loadAnalyses()
        else await loadResearch()
      } catch (error) {
        setActionError(error?.message || t(removal.failKey))
      } finally {
        setConfirming("")
      }
    })
  }

  async function copyArtifact(artifactId) {
    return exclusive(async () => {
      beginAction()
      try {
        const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}`, { cache: "no-store" })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.message || t("documents.errors.copy_failed"))
        await navigator.clipboard.writeText(String(payload?.artifact?.content || ""))
        setSuccessNotice({ message: t("documents.feedback.copied") })
      } catch (error) {
        setActionError(error?.message || t("documents.errors.copy_failed"))
      }
    })
  }

  /* SOL-RES-07: töös olevat uuringut saab peatada seal, kus töö on näha. */
  async function stopResearch(id) {
    return exclusive(async () => {
      beginAction()
      try {
        const response = await fetch(`/api/research/jobs/${encodeURIComponent(id)}/stop`, { method: "POST" })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.message || t("documents.workspace.research_stop_failed"))
        setSuccessNotice({ message: t("documents.workspace.research_stopped") })
        await loadResearch()
      } catch (error) {
        setActionError(error?.message || t("documents.workspace.research_stop_failed"))
      } finally {
        setConfirming("")
      }
    })
  }

  const frameworkAcceptance = frameworkStatus.acceptance
  const hasFrameworkAcceptance = frameworkAcceptance?.accepted === true
  const frameworkAcceptedAtLabel = frameworkAcceptance?.acceptedAt ? formatDate(frameworkAcceptance.acceptedAt, locale) : ""
  const frameworkPageHref = localizePath("/tooalase-kasutuse-raamistik", locale)

  /* Raamistiku haldus on nüüd lehe enda osa (vaade „Raamistik”), mitte info
     lehe lisaplokk: nii on see olemas ka töölaua sees, kus info omanik on
     töölaud. Info sisu jääb samaks. */
  usePanelInfoSlot({
    infoId: "documents",
    title: t("documents.page_title"),
    active: !embedded
  })

  if (isClientRole && embedded) return <div />

  const viewKeys = viewKeysFor({ client: isClientRole, opened: Boolean(openedItem) })
  const activeView = viewKeys.includes(view) ? view : view === "item" ? "list" : viewKeys[0]
  const notice = { ok: successNotice?.message || "", error: actionError, onClose: () => setSuccessNotice(null) }
  /* Teade on selles vaates, mis on parajasti ees. */
  const noticeFor = (key) => (key === activeView ? notice : null)
  const confirmText = t("documents.views.confirm_delete")

  /* Tegevus, mis küsib teist vajutust: esimene vajutus muudab nupu sõnad ja
     värvi ning toob selle kõrvale selgituse, teine (kuni kaheksa sekundi
     jooksul) teeb töö ära. */
  const confirmAction = (key, label, armedLabel, note, run) => {
    const armed = confirming === key
    return {
      label: armed ? armedLabel : label,
      armed,
      note: armed ? note : "",
      onClick: () => {
        if (!armed) return armConfirm(key)
        /* Topeltklõps on kaks vajutust samal nupul: teine neist ei tohi kohe
           kustutada. Kinnitus peab tulema vähemalt CONFIRM_MIN_GAP_MS hiljem. */
        if (Date.now() - armedAt.current < CONFIRM_MIN_GAP_MS) return undefined
        return run()
      }
    }
  }

  function renderItem(key) {
    const item = openedItem
    if (!item) return null
    const can = itemActions(item, { locale, client: isClientRole })
    const removeKey = `remove:${item.key}`
    const stopKey = `stop:${item.key}`
    const actions = []
    if (can.open) {
      actions.push({
        key: "open",
        label: t("documents.views.item.open_text"),
        variant: "primary",
        onClick: () => {
          markListReturn()
          pushWithTransition(router, can.open)
        }
      })
    }
    if (can.chat) actions.push({ key: "chat", label: t("documents.workspace.research_open"), variant: "primary", href: can.chat })
    if (can.download) actions.push({ key: "download", label: t("documents.actions.download"), variant: "primary", href: can.download })
    if (can.docx) actions.push({ key: "docx", label: t("documents.actions.download_docx"), href: can.docx })
    if (can.pdf) actions.push({ key: "pdf", label: t("documents.actions.download_pdf"), href: can.pdf })
    if (can.compose) actions.push({ key: "compose", label: t("documents.workspace.compose_from"), href: can.compose })
    if (can.copy) actions.push({ key: "copy", label: t("documents.actions.copy"), onClick: () => void copyArtifact(item.id) })
    if (can.rename) {
      actions.push({
        key: "rename",
        label: t("documents.actions.rename"),
        onClick: () => {
          setEditingId(item.id)
          setEditingTitle(item.title || "")
        }
      })
    }
    actions.push({ key: "back", label: t("documents.views.back_to_list"), variant: "linkBrand", onClick: closeItem })
    /* Töös olevat uuringut peatatakse, kõike muud kustutatakse: vaates on üks
       tegevus, mis küsib teist vajutust. See seisab teistest tegevustest eraldi
       ja selgitus tuleb nupu kõrvale, et nupp teise vajutuse ajaks paigast ei
       liiguks. */
    const danger = can.stop
      ? confirmAction(stopKey, t("documents.workspace.research_stop"), t("documents.views.confirm_stop"), t("documents.workspace.research_confirm_stop"), () => void stopResearch(item.id))
      : can.remove
        ? confirmAction(removeKey, t("documents.actions.delete"), confirmText, t(REMOVALS[can.remove].askKey), () => void removeItem(can.remove, item.id))
        : null

    return (
      <ItemView
        t={t}
        notice={noticeFor(key)}
        sheet={itemSheet(item, { t, locale, plain: isClientRole })}
        rename={
          can.rename && editingId === item.id
            ? { value: editingTitle, onChange: setEditingTitle, onSave: () => void saveRename(item.id), onCancel: closeRename }
            : null
        }
        share={
          can.share
            ? {
                title: t("documents.views.item.share_title"),
                description: can.share.removal
                  ? t(REMOVAL_NOTE_KEYS[can.share.removal])
                  : t("documents.provenance.rag.in_search_when_shared"),
                checked: can.share.checked,
                disabled: Boolean(can.share.removal),
                onChange: (checked) => void patchDocument(item.id, { agentAllowed: checked })
              }
            : null
        }
        analysis={can.text ? (analysisView.id === item.id ? analysisView : { ...NO_ANALYSIS, loading: true }) : null}
        actions={actions}
        danger={danger}
      />
    )
  }

  function renderList(key) {
    return (
      <ListView
        t={t}
        title={t(isClientRole ? "documents.views.sources.title" : "documents.views.list.title")}
        lead={isClientRole ? t("documents.client_document_library.description") : undefined}
        notice={noticeFor(key)}
        search={
          isClientRole
            ? null
            : {
                value: searchDraft,
                onChange: setSearchDraft,
                onSubmit: (event) => {
                  event.preventDefault()
                  setSearchQuery(searchDraft.trim())
                }
              }
        }
        filter={isClientRole ? null : { value: typeFilter, onChange: setTypeFilter, options: filterOptions(t) }}
        error={anyFamilyError}
        loading={loading}
        rows={filteredItems.map((item) => ({
          ...documentRow(item, { t, locale, plain: isClientRole }),
          onOpen: () => openItem(item)
        }))}
        emptyText={
          isClientRole
            ? t("documents.client_document_library.empty")
            : typeFilter === "ALL"
              ? t("documents.views.list.empty")
              : t("documents.workspace.empty_filtered")
        }
        more={
          anyTruncated
            ? { note: isClientRole ? "" : t("documents.workspace.truncated"), busy: loadingMore, onClick: loadMoreWorkspace }
            : null
        }
      />
    )
  }

  /* Administraator saab vaadet vahetada ka pöörduja vaates: muidu jääks ta
     sellel lehel pöörduja vaatesse kinni. */
  const roleButton = isAdmin && !embedded ? (
    <AdminRoleViewCycleButton
      t={t}
      locale={locale}
      value={effectiveRole}
      onRoleChanged={refreshEffectiveRole}
      ariaLabel={t("chat.workspace.view_role.label", "Töölaua vaade")}
    />
  ) : null

  if (isClientRole) {
    return (
      <section>
        {roleButton}
        <div className={styles.page} data-dock-scroll-behavior="recede" ref={pageRef}>
          {/* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale. */}
          <SubpageHeader
            title={t("documents.views.sources.title")}
            onBack={() => router.push(localizePath("/dokreziim", locale))}
            backAriaLabel={t("documents.client_document_library.back_to_compose")}
            showBack={false}
            headerClassName="sr-only"
          />
          <div className={styles.flat}>{openedItem ? renderItem(activeView) : renderList(activeView)}</div>
        </div>
      </section>
    )
  }

  const stepState = {
    entry: "done",
    add: "done",
    list: items.length ? "done" : "empty",
    item: "done",
    framework: hasFrameworkAcceptance ? "done" : "empty"
  }
  const frameworkSummary = frameworkStatus.loading
    ? t("documents.loading")
    : frameworkStatus.failed
      ? t("documents.framework_acceptance.load_failed")
      : hasFrameworkAcceptance
        ? t("documents.views.framework.summary_confirmed")
        : t("documents.views.framework.summary_pending")
  const stepSummary = {
    entry: t("documents.views.entry.summary"),
    add: uploadFile ? `${uploadFile.name} · ${formatFileSize(uploadFile.size)}` : t("documents.views.add.summary"),
    list: loading ? t("documents.loading") : t("documents.views.list.count", { count: totalCount }),
    item: openedItem?.title || t("documents.workspace.untitled"),
    framework: frameworkSummary
  }
  const steps = viewKeys.map((key) => ({
    key,
    label: t(`documents.views.${key}.title`),
    short: t(`documents.views.${key}.short`),
    state: stepState[key],
    summary: stepSummary[key],
    /* Loend ja avatud analüüsi tekst võivad olla pikad: nende järgi ühist
       kõrgust ei võeta ja siis kerib kogu paneel. */
    free: key === "list" || key === "item"
  }))

  const renderView = (step) => {
    switch (step.key) {
      case "add":
        return (
          <AddFileView
            t={t}
            notice={noticeFor(step.key)}
            form={{
              title: uploadTitle,
              onTitle: setUploadTitle,
              kind: uploadKind,
              kinds: uploadKindOptions,
              onKind: (nextValue) => {
                setUploadKind(nextValue)
                if (nextValue !== "TEMPLATE") setUploadTemplateFor("")
              },
              templateFor:
                uploadKind === "TEMPLATE"
                  ? { value: uploadTemplateFor, options: templateForOptions, onChange: setUploadTemplateFor }
                  : null,
              accept: UPLOAD_ACCEPT,
              file: uploadFile ? { name: uploadFile.name, size: formatFileSize(uploadFile.size) } : null,
              onFile: handleUploadFileSelection,
              dragActive: uploadDragActive,
              onDrag: setUploadDragActive,
              busy: uploading,
              onSubmit: submitUpload
            }}
          />
        )
      case "list":
        return renderList(step.key)
      case "item":
        return renderItem(step.key)
      case "framework":
        return (
          <FrameworkView
            t={t}
            notice={noticeFor(step.key)}
            text={
              frameworkStatus.loading
                ? t("documents.loading")
                : frameworkStatus.failed
                  ? t("documents.framework_acceptance.load_failed")
                  : hasFrameworkAcceptance
                    ? t("documents.framework_acceptance.manage_confirmed_short", {
                        date: frameworkAcceptedAtLabel,
                        version: frameworkAcceptance.frameworkVersion || WORKER_FRAMEWORK_VERSION
                      })
                    : t("documents.framework_acceptance.manage_pending")
            }
            confirmed={hasFrameworkAcceptance}
            links={[
              { key: "open", label: t("auth.register.worker_framework_open"), variant: "primary", href: frameworkPageHref },
              { key: "signed", label: t("auth.register.worker_framework_download_signed"), href: WORKER_FRAMEWORK_SIGNED_HREF },
              ...(hasFrameworkAcceptance && frameworkAcceptance?.documentDownloadUrl
                ? [{ key: "record", label: t("documents.framework_acceptance.download_record"), href: frameworkAcceptance.documentDownloadUrl }]
                : [])
            ]}
          />
        )
      default:
        return (
          <EntryView
            t={t}
            notice={noticeFor(step.key)}
            cards={entryCards({ t, locale, researchEnabled: researchState.enabled !== false }).map((card) => ({
              ...card,
              onClick: () => (card.view ? setView(card.view) : pushWithTransition(router, card.href))
            }))}
          />
        )
    }
  }

  const content = (
    <>
      {roleButton}

      <div className={styles.page} data-dock-scroll-behavior="recede" ref={pageRef}>
        {/* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale. */}
        {!hideHeader ? (
          <SubpageHeader onBack={handleBack} backAriaLabel={t("buttons.back")} showBack={false} anchorBack={false} headerClassName="sr-only">
            {t("documents.page_title")}
          </SubpageHeader>
        ) : null}

        {/* Osade loend muutub, kui dokument avatakse või suletakse: siis
            ehitatakse lava uuesti ja see avaneb osal, kuhu inimene läks. */}
        <StepFlight
          key={viewKeys.join("|")}
          label={t("documents.page_title")}
          steps={steps}
          parts
          texts={{
            all: t("documents.views.all"),
            position: (current, total, label) => t("documents.views.position", { current, total, label })
          }}
          initialIndex={Math.max(0, viewKeys.indexOf(activeView))}
          activeKey={activeView}
          onStepChange={(index, step) => {
            if (!step) return
            setView(step.key)
            setActionError("")
          }}
        >
          {renderView}
        </StepFlight>
      </div>
    </>
  )

  if (embedded) return content

  return <section>{content}</section>
}
