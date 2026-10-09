"use client"

/**
 * Koostamisruum „Koosta dokument": valitud failide ja juhise põhjal koostatakse
 * tekst, mida saab üle vaadata, täiendada, salvestada ja kinnitada; heli rajal
 * koostatakse helifailist transkript ja selle kokkuvõte.
 *
 * KUJU (09.10, kujundusaudit K07 ja omaniku reeglid). Ruum oli üks pikk pind:
 * väljundi seaded, heli rada, valitud failid, vestlus ja tulemuse toimeti seisid
 * korraga ees kahes tumedas kastis. Nüüd on ruum sammulaval
 * (`components/stage/StepFlight.jsx`) ja igal asjal on oma väike vaade:
 *
 *  - KOOSTAMISE JADA (päris järjekord, seepärast nummerdatud sammud):
 *    lähtefailid, väljundi tüüp, mall, kellele ja kuidas, juhis. Kui tulemus on
 *    olemas, jätkuvad samas jadas tulemuse vaated: tekst, täiendamine,
 *    versioonid ja kinnitamine. Pöördujal on lühem tee (ülesanne, failid, juhis)
 *    ja lõpus tema viimased tulemused.
 *  - HELI RADA (ainult spetsialistil) on oma jada: helifail, transkript,
 *    ülevaatus, kokkuvõte. Sinna minnakse lähtefailide vaatest. Selle vaadete
 *    loend on alati sama, et lava ei ehitataks salvestamise ajal ümber.
 *
 * VESTLUST SIIN ENAM EI OLE. Juhis kirjutati varem vestluse sisestusribale ja
 * sama saatmisnupp kas koostas uue teksti või täiendas mustandit, olenevalt
 * sellest, mis parajasti ees oli. Nüüd on need kaks eri vaadet ja kaks nimega
 * nuppu. Vestluse mullid kordasid sama teksti, mis on toimetis.
 *
 * TASULISED TÖÖD käivituvad ainult nimega nupust (`PaidButton`), mitte
 * kerimisest ega sammu vahetusest:
 *    koostamine    POST /api/documents/artifacts/generate   (vaade „Juhis")
 *    täiendamine   POST /api/documents/artifacts/refine     (vaade „Täiendamine")
 *    transkript    POST /api/documents/<id>/transcribe      (heli rada, ./drafting/useAudioPath.js)
 *    kokkuvõte     POST /api/documents/<id>/summary         (heli rada, ./drafting/useAudioPath.js)
 * Päringud ise (aadress, keha, kavatsuse võti, järjekord) on samad mis enne.
 * Koostamise ja täiendamise ees käib isikuandmete kontroll, mille varem tegi
 * vestluse sisestusriba (`checkPrivacy`). Topeltklõps ja pooleli päring jäävad
 * vahele (`runPaid`), klahvikordus ei vajuta ühtegi nuppu (`onRootKeyDown`).
 *
 * SALVESTAMATA TEKST EI KAO VAIKSELT. Uus koostamine, vanema versiooni
 * taastamine, tulemuse eemaldamine, teise tulemuse avamine ja lehelt lahkumine
 * selle lehe oma nuppudest küsivad teist vajutust, kui toimetis on salvestamata
 * tekst (`guarded`). Akna sulgemisel küsib brauser ise; Esc küsib teist
 * vajutust, kui fookus on ruumi sees.
 *
 * KUS MIS ON. Siin on tulemuse töö (koostamine, täiendamine, salvestamine,
 * kinnitamine) ja see, mis vaateid olekuga seob. Kaustas ./drafting:
 *    useSourceFiles.js   lähtefailid ja mallid
 *    useAudioPath.js     heli raja andmed ja päringud
 *    usePressGuards.js   teine vajutus ja tasulise töö värav
 *    AudioPath.jsx       heli raja vaadete sidumine
 *    ComposeViews.jsx, ResultViews.jsx, AudioViews.jsx   vaated (ainult kuju)
 *    draftingModel.js    reeglid ilma JSX-ita
 *    drafting.module.css kujundus
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useEffectiveRole } from "@/components/auth/useEffectiveRole"
import { useI18n } from "@/components/i18n/I18nProvider"
import StepFlight from "@/components/stage/StepFlight"
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot"
import { SubpageHeader } from "@/components/ui/SubpageHeader"
import AdminRoleViewCycleButton from "@/components/workspace/AdminRoleViewCycleButton"
import { clientTaskInstruction } from "@/lib/documents/agentTasks"
import { localizePath } from "@/lib/localizePath"
import { requestPrivacyCheck } from "@/lib/privacy/privacyCheckClient"
import { pushWithTransition } from "@/lib/routeTransition"
import { buildIntentSignature, resolveIntentKey } from "@/lib/usage/intentKey"

import AudioPath from "./drafting/AudioPath"
import { ChoiceView, InstructionView, SourcesView, StyleView, TemplateView } from "./drafting/ComposeViews"
import { footNote } from "./drafting/DraftingBits"
import { ApproveView, RefineView, ResultsView, TextView, VersionsView } from "./drafting/ResultViews"
import {
  AUDIO_VIEWS,
  CLIENT_AGENT_TASK_OPTIONS,
  CLIENT_MAX_DOCUMENTS,
  FREE_VIEWS,
  privacyChoiceKey,
  privacyTextKeys,
  PRIVACY_WORKFLOW,
  RECENT_RESULTS_LIMIT,
  WORKSPACE_VERSION_LIMIT,
  activeViewFor,
  audienceOptions,
  clientStatusLabel,
  clientTaskOptions,
  composeBlocker,
  confirmTexts,
  hasUnsavedText,
  instructionLimit,
  isComposableType,
  isTemplateCompatible,
  languageOptions,
  lengthOptions,
  outputTypeOptions,
  privacyChoices,
  recentResultRows,
  refineBlocker,
  resultSheet,
  resultStateOf,
  serverMessage,
  snippet,
  sourceRows,
  statusLabel,
  templateOptions,
  textAtRisk,
  toneOptions,
  typeLabel,
  versionRows,
  viewKeysFor,
  viewStates
} from "./drafting/draftingModel"
import styles from "./drafting/drafting.module.css"
import useAudioPath from "./drafting/useAudioPath"
import { setPanelLeaveGuard } from "@/lib/panelLeaveGuard"
import usePressGuards from "./drafting/usePressGuards"
import useSourceFiles from "./drafting/useSourceFiles"

const CHAT_WORKSPACE_RESTORE_STORAGE_KEY = "__SOTSIAAL.PRO_CHAT_WORKSPACE_RESTORE__"

function markChatWorkspaceRestore() {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(
      CHAT_WORKSPACE_RESTORE_STORAGE_KEY,
      JSON.stringify({ ts: Date.now() })
    )
  } catch {}
}

export default function AgentModePage({ initialDocumentIds = [], initialArtifactId = "", initialPath = "compose", embedded = false, onBack = null, hideHeader = false }) {
  const router = useRouter()
  const { t, locale } = useI18n()
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
  const defaultAudience = effectiveRole === "CLIENT" ? "client" : "worker"
  const clientUploadInputRef = useRef(null)
  const activeRequestAbortRef = useRef(null)
  // Ühe kavatsuse võti elab kuni serveri kindla vastuseni: sama sisendiga kordus kannab sama
  // võtit (server ei võta teist tasu ega loo teist mustandit), õnnestumise järel ta kustub,
  // seega tahtlik uus jooks on aus uus töö. Vt lib/usage/intentKey.js.
  const generateIntentRef = useRef(null)
  const refineIntentRef = useRef(null)
  const surfaceRef = useRef(null)
  const focusFrame = useRef(0)

  /* Lähtefailid ja mallid: valik, laadimine ja pöörduja faili lisamine. */
  const files = useSourceFiles({ initialDocumentIds, isClientRole, locale, t })
  const { selectedDocumentIds, documents, missingDocumentIds, documentsLoading, documentsError, templates, templatesLoading, templatesError, clientUploadError, clientUploading } = files
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

  /* Mis on ees: jada (`compose` või heli rada `audio`) ja vaate võti. Tulemuse
     lingiga (?artifact=) avatud ruum avaneb tulemuse teksti juures; lingiga
     `?path=audio` avatud ruum heli rajal (pöörduja vaates heli rada ei ole). */
  const [level, setLevel] = useState(initialPath === "audio" && !String(initialArtifactId || "").trim() ? "audio" : "compose")
  const [view, setView] = useState(String(initialArtifactId || "").trim() ? "text" : "")
  /* Isikuandmete kontrolli küsimus: `{ action: "compose" | "refine", originalText, … }`. */
  const [privacyPrompt, setPrivacyPrompt] = useState(null)
  /* Isikuandmete kontroll käib: `compose`, `refine` või tühi. */
  const [checkingPrivacy, setCheckingPrivacy] = useState("")
  /* Teine vajutus ja tasulise töö värav (vt ./drafting/usePressGuards.js). */
  const { confirming, disarm: disarmConfirm, press: pressConfirm, guarded, runPaid } = usePressGuards()

  /* Fookus ees oleva vaate sisse: vajutatud nupp kaob sageli koos tegevusega
     (rida muutub, lava ehitatakse ümber). Vaade võib esimesel kaadril veel
     peidus olla, seepärast proovime kaadrite kaupa (nagu StepFlight sammu
     vahetusel). Kui otsitud välja ei ole, läheb fookus vaate pealkirjale. */
  const focusActive = useCallback((selector = "") => {
    window.cancelAnimationFrame(focusFrame.current)
    const deadline = performance.now() + 1200
    const tryFocus = () => {
      const plane = surfaceRef.current?.querySelector('[data-active="1"]')
      const target = (selector ? plane?.querySelector(selector) : null) || plane?.querySelector("[data-step-heading]")
      target?.focus({ preventScroll: true })
      if ((target && document.activeElement === target) || performance.now() > deadline) return
      focusFrame.current = window.requestAnimationFrame(tryFocus)
    }
    focusFrame.current = window.requestAnimationFrame(tryFocus)
  }, [])
  useEffect(() => () => window.cancelAnimationFrame(focusFrame.current), [])

  /* Heli raja andmed ja päringud. Olek elab siin, mitte heli raja vaadete
     küljes: valitud helifail ja transkripti parandused jäävad alles, kui inimene
     käib vahepeal koostamise jadas. */
  const audio = useAudioPath({
    isClientRole,
    locale,
    t,
    language,
    busy: { starting, refiningResult, savingResult, approvingResult },
    onSummary: handleAudioSummary,
    /* Vajutatud „Vali" asendus märgiga „Valitud": fookus läheb vaate pealkirjale. */
    onPicked: () => focusActive()
  })

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

  /* `keepChoices`: sama tulemuse salvestamine või kinnitamine. Siis uueneb
     ainult tulemus ise; täiendamise juhis (teine vaade) ning järgmise koostamise
     jaoks valitud liik ja mall jäävad nii, nagu inimene need jättis. Ilma selleta
     tühjendas salvestamine tekstivaates täiendamise vaatesse kirjutatud juhise ja
     viis valitud liigi vaikselt tagasi avatud tulemuse omaks, nii et „Koosta uus
     tekst" oleks saatnud vana liigi. Uue või teise tulemuse puhul (koostamine,
     avamine, kokkuvõte) võetakse valikud tulemuselt. */
  function applyWorkspaceResult(nextResult, { keepChoices = false } = {}) {
    setWorkspaceResult(nextResult)
    setResultTitle(String(nextResult?.title || ""))
    setResultContent(String(nextResult?.content || ""))
    if (keepChoices) return
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
    setPrivacyPrompt(null)
  }

  function buildWorkspaceHref(nextArtifactId = "", nextDocumentIds = selectedDocumentIds) {
    const basePath = localizePath("/dokreziim", locale)
    const params = new URLSearchParams()
    if (nextDocumentIds.length) params.set("documents", nextDocumentIds.join(","))
    if (nextArtifactId) params.set("artifact", nextArtifactId)
    const query = params.toString()
    return query ? `${basePath}?${query}` : basePath
  }

  /* Ruumi aadress kannab valitud faile ja avatud tulemust, et lehe uuesti
     laadimine tooks sama töö tagasi. Töölaua sees (`embedded`) on ruum vestluse
     lehe osa: seal viiks aadressi vahetus inimese töölaualt ära ja tühjendaks
     kogu ruumi oleku, seepärast aadressi seal ei muudeta. */
  function syncWorkspaceUrl(nextArtifactId = "", nextDocumentIds = selectedDocumentIds) {
    if (embedded) return
    router.replace(buildWorkspaceHref(nextArtifactId, nextDocumentIds), { scroll: false })
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

  useEffect(() => () => {
    activeRequestAbortRef.current?.abort?.()
  }, [])

  useEffect(() => {
    if (!audienceTouched) {
      setAudience(defaultAudience)
    }
  }, [audienceTouched, defaultAudience])

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

  const selectedCount = documents.length
  const selectedCountLimitReached = isClientRole && selectedCount >= CLIENT_MAX_DOCUMENTS
  /* Malli vaade näitab malle selle liigi jaoks, millega JÄRGMINE koostamine
     tehakse (valitud liik), mitte avatud tulemuse liigi jaoks. */
  const templateTargetType = String(outputType || workspaceResult?.type || "REPORT_DRAFT")
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
  const hasWorkspaceResult = Boolean(workspaceResult)
  const isWorkspaceResultSaved = Boolean(workspaceResult?.id)
  const canPersistResult = hasWorkspaceResult && resultContent.trim().length > 0
  const canClearWorkspaceResult = hasWorkspaceResult && !starting && !refiningResult && !savingResult && !approvingResult
  const hasDraftEdits = hasUnsavedText(workspaceResult, resultTitle, resultContent)
  const canRestoreSavedVersion =
    isWorkspaceResultSaved &&
    workspaceResult?.status === "DRAFT" &&
    hasDraftEdits &&
    !refiningResult &&
    !savingResult &&
    !approvingResult
  const activeArtifactDetailHref = !isClientRole && isWorkspaceResultSaved
    ? localizePath(`/documents/artifacts/${encodeURIComponent(workspaceResult.id)}`, locale)
    : ""
  const artifactResultsHref = !isClientRole ? localizePath("/documents?artifacts=all#artifacts", locale) : ""
  const resultBusy = starting || refiningResult || savingResult || approvingResult
  const resultState = resultStateOf({ result: workspaceResult, loading: artifactLoading, error: artifactError })
  /* Tekst, mida ei ole salvestatud ega üheski tööruumi versioonis. */
  const versionTextAtRisk = textAtRisk({ result: workspaceResult, title: resultTitle, content: resultContent, versions: workspaceVersions })
  const instructionMax = instructionLimit({ client: isClientRole, task: clientTask })

  const activeLevel = isClientRole ? "compose" : level
  const viewKeys = viewKeysFor({ client: isClientRole, level: activeLevel, resultState })
  const activeView = activeViewFor(view, viewKeys)
  const stageKey = `${activeLevel}|${viewKeys.join("|")}`

  useEffect(() => {
    if (workspaceResult || !selectedTemplateId) return
    const selectedTemplate = allowedTemplates.find((template) => template.id === selectedTemplateId)
    if (!selectedTemplate || !isTemplateCompatible(selectedTemplate, outputType)) {
      setSelectedTemplateId("")
    }
  }, [allowedTemplates, outputType, selectedTemplateId, workspaceResult])

  /* Salvestamata teksti korral küsib brauser akna sulgemisel või lehe uuesti
     laadimisel ise üle. Platvormi sees lahkumist (kiirmenüü) see ei kata. */
  const unsavedAnywhere = hasDraftEdits || audio.canSaveAudioTranscript
  /* „Kokkuvõte on valmis" ja tee mustandi juurde kehtivad ainult seni, kuni see
     kokkuvõte ON ruumis avatud tulemus. Kui see eemaldati või avati teine
     tulemus, viiks nupp võõra teksti juurde. */
  const summaryOpen = Boolean(audio.audioSummaryArtifact?.id) && String(audio.audioSummaryArtifact.id) === String(workspaceResult?.id || "")
  const escPassedRef = useRef(false)
  useEffect(() => {
    if (!unsavedAnywhere) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [unsavedAnywhere])

  /* PLATVORMI SEES LAHKUMINE. Kiirmenüü tagasi-nool ja paneeli sulgemine ei ole
     selle lehe nupud: leht peab need kinni ühise värava kaudu
     (lib/panelLeaveGuard.js). Esc püütakse akna tasemel PÜÜDMISE faasis:
     PanelFrame kuulab Esc-i samal aknal mullitamise faasis ja jätab vahele
     sündmuse, mille keegi on juba kinni pidanud. Nii kehtib küsimus ka siis, kui
     fookus ei ole ruumi sees (pärast klõpsu paneeli taustale on fookus lehel
     endal ja ruumi enda `onKeyDown` klahvi ei näeks).
     Mõlemad loevad värsket olekut viite kaudu: kuulaja pannakse üks kord. */
  const leaveGuardRef = useRef(null)
  leaveGuardRef.current = () => pressConfirm("panel") === "run"
  const escGuardRef = useRef(null)
  escGuardRef.current = (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return
    const target = event.target instanceof Element ? event.target : null
    /* Tekstiväljal, dialoogis ja oma Esc-alaga osas Esc paneeli ei sulge: seal ei ole midagi kaitsta. */
    if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [data-esc-scope]")) return
    if (document.body.classList.contains("modal-open") || document.documentElement.classList.contains("login-modal-open")) return
    /* Teine Esc läheb edasi ja paneel sulgub; esimene (ja topeltvajutuse teine pool) peetakse kinni. */
    if (pressConfirm("esc") !== "run") event.preventDefault()
  }
  useEffect(() => {
    if (!unsavedAnywhere) return undefined
    const release = setPanelLeaveGuard((reason) => (reason === "close" && escPassedRef.current ? true : leaveGuardRef.current()))
    const onKey = (event) => {
      escPassedRef.current = false
      escGuardRef.current?.(event)
      /* Esc, mille see kuulaja läbi lasi, sulgeb paneeli PanelFrame'i kaudu
         SAMA sündmuse mullitamise faasis: värav ei tohi sama vajutust teist
         korda küsida. Luba kehtib ainult selle sündmuse lõpuni. */
      if (event.key === "Escape" && !event.defaultPrevented) {
        escPassedRef.current = true
        window.setTimeout(() => {
          escPassedRef.current = false
        }, 0)
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => {
      release()
      window.removeEventListener("keydown", onKey, true)
    }
  }, [unsavedAnywhere])

  /* Kui vaadete loend muutub (tulemus tekkis või kadus, jada vahetus), ehitatakse
     lava uuesti ja fookus läheb uue vaate pealkirjale. Esimesel joonistusel
     fookust ei võeta. */
  const shownStage = useRef(stageKey)
  useEffect(() => {
    if (shownStage.current === stageKey) return
    shownStage.current = stageKey
    focusActive()
  }, [focusActive, stageKey])

  const openView = (key) => {
    disarmConfirm()
    setView(key)
  }

  /**
   * Kas salvestil on pooleli töö: salvestamine käib, osa on veel üles laadimisel
   * või osa jäi salvestamata ja ootab uut katset. Salvesti ütleb seda oma
   * juurelemendil (`data-recorder-busy`). Ainult salvestamise faasi lugedes
   * võeti salvesti lehelt maha ka siis, kui osa oli veel teel või ebaõnnestunud:
   * ebaõnnestunud osa elab ainult salvesti olekus ja oleks jäljetult kadunud.
   */
  function recorderBusy() {
    const node = surfaceRef.current?.querySelector("[data-recorder-phase]")
    if (!node) return false
    return node.getAttribute("data-recorder-busy") === "1" || (node.getAttribute("data-recorder-phase") || "idle") !== "idle"
  }

  /* Tee teisele lehele selle lehe oma nupust: salvestamata tekst küsib teist vajutust. */
  function leaveTo(href) {
    if (!href) return undefined
    return guarded(`leave:${href}`, unsavedAnywhere, () => pushWithTransition(router, href))
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

  async function handleClientUpload(file) {
    const added = await files.uploadClientFile(file, { onStart: clearResultMessages })
    if (!added) return
    syncWorkspaceUrl(persistedArtifactId, added.ids)
    setRunFeedback({
      message: t("documents.drafting.files.added", {
        title: added.document.title || added.document.originalName
      })
    })
  }

  function handleClientRemoveDocument(documentId) {
    const nextIds = files.removeFile(documentId)
    if (!nextIds) return
    clearResultMessages()
    syncWorkspaceUrl(persistedArtifactId, nextIds)
    setRunFeedback({ message: t("documents.drafting.files.removed") })
    /* Vajutatud nupp kadus koos reaga. */
    focusActive()
  }

  /* Heli raja kokkuvõte on uus tulemus: transkript saab lähtefailiks ja kokkuvõte
     tööruumi tekstiks, millest algavad ka tööruumi versioonid. */
  function handleAudioSummary({ summary, transcriptDocument }) {
    files.replaceWith(transcriptDocument)
    setOutputType("TRANSCRIPT_SUMMARY")
    applyWorkspaceResult(summary)
    resetWorkspaceVersionsFromResult(summary, "generated")
    setPersistedArtifactId(summary.id)
  }

  async function handleOpenClientArtifact(artifactId) {
    const nextArtifactId = String(artifactId || "").trim()
    if (!nextArtifactId) return

    clearResultMessages()
    setPrivacyPrompt(null)
    setPersistedArtifactId(nextArtifactId)
    syncWorkspaceUrl(nextArtifactId)
    setView("text")
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
        syncWorkspaceUrl("")
      }
      setRunFeedback({ message: t("documents.drafting.feedback.deleted") })
    } catch (error) {
      setRunError(error?.message || t("documents.artifacts.errors.delete_failed"))
    }
  }

  async function runGeneration({
    typeOverride = outputType,
    instructionOverride = instruction,
    documentsOverride = null,
    historyKind = "generated",
    feedbackKey = "documents.drafting.feedback.text_ready",
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
      const generationPayload = {
        documentIds: sourceDocuments.map((document) => document.id),
        type: effectiveType,
        templateId: isClientRole ? undefined : templateIdToUse || undefined,
        instruction: nextInstruction,
        audience,
        tone,
        language,
        length,
        privacyDecision
      }
      generateIntentRef.current = resolveIntentKey(
        generateIntentRef.current,
        buildIntentSignature(generationPayload)
      )
      const response = await fetch("/api/documents/artifacts/generate", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-ui-locale": locale
        },
        body: JSON.stringify({
          ...generationPayload,
          idempotencyKey: generateIntentRef.current.key
        })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(serverMessage(payload, t, "documents.errors.create_artifact_failed"))
      // Server andis kindla vastuse: kavatsus on lahendatud ja järgmine jooks on uus töö.
      generateIntentRef.current = null

      const nextDraft = payload?.draft || null
      // The draft is now persisted the instant it is generated, so it already carries a real id:
      // record it (not ""), so a later save updates this row instead of creating a duplicate.
      const nextDraftId = String(nextDraft?.id || "").trim()
      applyWorkspaceResult(nextDraft)
      resetWorkspaceVersionsFromResult(nextDraft, historyKind)
      setPersistedArtifactId(nextDraftId)
      setRunFeedback({ message: t(feedbackKey) })
      syncWorkspaceUrl(nextDraftId)
      if (isClientRole) await refreshRecentArtifacts()
      return nextDraft
    } catch (error) {
      if (error?.name === "AbortError") {
        setRunFeedback({ message: t("documents.drafting.feedback.compose_stopped") })
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
      const refinePayload = {
        documentIds: documents.map((document) => document.id),
        type: effectiveType,
        artifactId: workspaceResult.id || undefined,
        expectedUpdatedAt: workspaceResult.updatedAt,
        templateId: isClientRole ? undefined : selectedTemplateId || undefined,
        currentContent: resultContent,
        refinementInstruction: effectiveRefinement,
        audience,
        tone,
        language,
        length,
        privacyDecision: options.privacyDecision
      }
      refineIntentRef.current = resolveIntentKey(
        refineIntentRef.current,
        buildIntentSignature(refinePayload)
      )
      const response = await fetch("/api/documents/artifacts/refine", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-ui-locale": locale
        },
        body: JSON.stringify({
          ...refinePayload,
          idempotencyKey: refineIntentRef.current.key
        })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(serverMessage(payload, t, "documents.artifacts.errors.update_failed"))
      refineIntentRef.current = null

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
      setRunFeedback({ message: t("documents.drafting.feedback.refined") })
      setWorkspaceResult((current) =>
        current
          ? {
              ...current,
              content: nextContent,
              updatedAt: nextUpdatedAt || current.updatedAt
            }
          : current
      )
      return nextDraft
    } catch (error) {
      if (error?.name === "AbortError") {
        setRunFeedback({ message: t("documents.drafting.feedback.refine_stopped") })
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

  /**
   * Isikuandmete kontroll enne koostamist või täiendamist: sama päring ja sama
   * töövoo nimi, mille vestluse sisestusriba dokumendirežiimis saatis. Kui tekstis
   * on isikuandmeid, jääb töö seisma ja vaates on valikud (`answerPrivacy`); kui
   * kontroll ise ei vasta, saab proovida uuesti või teksti muuta.
   * @returns {Promise<{ text: string, privacyDecision?: { action: string } } | null>}
   */
  async function checkPrivacy(action, text) {
    setCheckingPrivacy(action)
    try {
      const { response, payload } = await requestPrivacyCheck({ text, workflow: PRIVACY_WORKFLOW })
      if (response.status === 401) {
        setPrivacyPrompt(null)
        setRunError(serverMessage(payload, t, "documents.drafting.privacy.signed_out"))
        return null
      }
      if (response.status === 409 && payload?.needsPrivacyConfirmation) {
        setPrivacyPrompt({ ...payload, action, originalText: text })
        return null
      }
      if (!response.ok || payload?.ok === false) {
        throw new Error("privacy_check_failed")
      }
      return {
        text: String(payload?.text || text),
        privacyDecision: payload?.appliedDecision
          ? { action: payload.appliedDecision }
          : undefined
      }
    } catch {
      setPrivacyPrompt({ action, originalText: text, unavailable: true, allowOriginal: false, redactedText: "", findings: [] })
      return null
    } finally {
      setCheckingPrivacy("")
    }
  }

  /**
   * „Koosta tekst". `options` tuleb isikuandmete kontrolli valikust: seal on
   * tekst juba valitud ja teist vajutust (salvestamata tekst) enam ei küsita.
   */
  function pressCompose(options = {}) {
    const text = String(options.textOverride ?? instruction).trim()
    const blocker = composeBlocker({
      client: isClientRole,
      documentCount: selectedCount,
      type: outputType,
      instruction: text,
      limit: instructionMax,
      busy: resultBusy || audio.summarizingAudio
    })
    if (blocker) {
      /* Isikuandmete küsimuse valik on küsimuse juba sulgenud: kui töö siiski
         ei käivitu (maskeeritud juhis on piirist pikem), öeldakse see välja,
         muidu ei teeks vajutus midagi ega ütleks midagi. */
      if (options.confirmed) setRunError(t(blocker === "too_long" ? "documents.artifacts.errors.instruction_too_long" : "documents.drafting.privacy.not_started"))
      return undefined
    }
    return guarded("compose", hasDraftEdits && !options.confirmed, () =>
      runPaid(async () => {
        const privacy = options.skipPrivacy
          ? { text, privacyDecision: options.privacyDecision }
          : await checkPrivacy("compose", text)
        if (!privacy) return
        const nextText = String(privacy.text || text).trim()
        setInstruction(nextText)
        const nextDraft = await runGeneration({
          typeOverride: outputType,
          instructionOverride: nextText,
          historyKind: hasWorkspaceResult ? "rerun" : "generated",
          feedbackKey: hasWorkspaceResult ? "documents.drafting.feedback.new_text_ready" : "documents.drafting.feedback.text_ready",
          privacyDecision: privacy.privacyDecision
        })
        /* Valmis tekst tuleb ette; lava ehitatakse tulemuse vaadetega uuesti. */
        if (nextDraft) setView("text")
      })
    )
  }

  /** „Täienda teksti": täiendus läheb teele ainult selle nupu vajutusest. */
  function pressRefine(options = {}) {
    const text = String(options.textOverride ?? refineInstruction).trim()
    const blocker = refineBlocker({
      resultState,
      documentCount: selectedCount,
      content: resultContent,
      instruction: text,
      limit: instructionLimit(),
      busy: resultBusy
    })
    if (blocker) {
      if (options.confirmed) setRunError(t(blocker === "too_long" ? "documents.artifacts.errors.instruction_too_long" : "documents.drafting.privacy.not_started"))
      return undefined
    }
    return runPaid(async () => {
      const privacy = options.skipPrivacy
        ? { text, privacyDecision: options.privacyDecision }
        : await checkPrivacy("refine", text)
      if (!privacy) return
      const nextText = String(privacy.text || text).trim()
      setRefineInstruction(nextText)
      const nextDraft = await handleRefine(nextText, { privacyDecision: privacy.privacyDecision })
      if (nextDraft) openView("text")
    })
  }

  /* Isikuandmete kontrolli valik: muuda teksti, proovi kontrolli uuesti või
     jätka sama tööd maskeeritud või algse tekstiga. */
  function answerPrivacy(choice) {
    const prompt = privacyPrompt
    if (!prompt) return undefined
    const press = prompt.action === "refine" ? pressRefine : pressCompose
    setPrivacyPrompt(null)
    if (choice === "retry") return press({ textOverride: prompt.originalText, confirmed: true })
    if (choice === "redacted" && prompt.redactedText) {
      return press({ skipPrivacy: true, textOverride: prompt.redactedText, privacyDecision: { action: "use_redacted" }, confirmed: true })
    }
    if (choice === "original" && prompt.allowOriginal) {
      return press({ skipPrivacy: true, textOverride: prompt.originalText, privacyDecision: { action: "send_original" }, confirmed: true })
    }
    /* „Muudan teksti": fookus tagasi juhise väljale. */
    focusActive("textarea")
    return undefined
  }

  function handleRestoreSavedVersion() {
    if (!canRestoreSavedVersion) return
    clearResultMessages()
    setResultTitle(String(workspaceResult?.title || ""))
    setResultContent(String(workspaceResult?.content || ""))
    setRefineInstruction("")
    setSelectedTemplateId(String(workspaceResult?.templateId || ""))
    setRunFeedback({ message: t("documents.drafting.feedback.saved_restored") })
    focusActive()
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
    setRunFeedback({ message: t("documents.drafting.feedback.version_restored") })
    /* Vajutatud „Taasta" kadus: see rida on nüüd praegune. */
    focusActive()
  }

  function handleClearWorkspaceResult() {
    if (!canClearWorkspaceResult) return
    clearResultMessages()
    clearWorkspaceResult()
    syncWorkspaceUrl("")
    setRunFeedback({ message: t(isClientRole ? "documents.drafting.feedback.cleared_client" : "documents.drafting.feedback.cleared") })
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
            templateId: selectedTemplateId || null,
            // Versioon, mida SEE tööpind nägi. Teine vahekaart ei kirjuta enam vaikselt üle.
            expectedUpdatedAt: workspaceResult.updatedAt
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
        serverMessage(
          resultPayload,
          t,
          workspaceResult.id ? "documents.artifacts.errors.update_failed" : "documents.artifacts.errors.create_failed"
        )
      )
    }

    const nextArtifact = resultPayload?.artifact || null
    applyWorkspaceResult(nextArtifact, { keepChoices: true })
    const nextArtifactId = String(nextArtifact?.id || "").trim()
    setPersistedArtifactId(nextArtifactId)
    setArtifactError("")
    if (nextArtifactId) syncWorkspaceUrl(nextArtifactId)
    if (!suppressFeedback) {
      setRunFeedback({
        message: t(isClientRole ? "documents.drafting.feedback.saved_client" : "documents.drafting.feedback.saved"),
        actionUrl: !isClientRole && nextArtifactId ? localizePath(`/documents/artifacts/${encodeURIComponent(nextArtifactId)}`, locale) : "",
        actionLabel: !isClientRole && nextArtifactId ? t("documents.drafting.text.open_detail") : ""
      })
    }

    if (isClientRole) await refreshRecentArtifacts()
    return nextArtifact
  }

  async function handleSaveDraft() {
    if (!canPersistResult || refiningResult || savingResult || approvingResult) return

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
    if (!canPersistResult || refiningResult || savingResult || approvingResult) return

    setApprovingResult(true)
    clearResultMessages()
    try {
      const artifact = await persistCurrentDraft({ suppressFeedback: true })
      const artifactId = String(artifact?.id || "").trim()
      if (!artifactId) throw new Error(t("documents.artifacts.errors.create_failed"))

      const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ui-locale": locale },
        // Kinnitatakse täpselt see versioon, mille salvestus just tagastas — kui keegi jõudis
        // vahepeale, tuleb 409, mitte võõra sisu kinnitamine.
        body: JSON.stringify({ expectedUpdatedAt: artifact?.updatedAt })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.artifacts.errors.approve_failed"))

      applyWorkspaceResult(payload?.artifact || artifact, { keepChoices: true })
      setPersistedArtifactId(artifactId)
      setApprovalNotice({
        message: t(isClientRole ? "documents.drafting.feedback.finished" : "documents.feedback.approved"),
        downloadUrls: payload?.downloadUrls || payload?.artifact?.downloadUrls || {}
      })
      syncWorkspaceUrl(artifactId)
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

  /* Kaks reeglit kogu ruumi kohta.
     1. Klahvikordus ei vajuta ühtegi nuppu ega linki: all hoitud Enter ei tohi
        läbida teist vajutust ega käivitada tasulist tööd uuesti kohe, kui
        eelmine lõppes.
     2. Esc-i salvestamata teksti korral peab kinni akna tasemel kuulaja
        (vt „PLATVORMI SEES LAHKUMINE" ülal), mitte see funktsioon: nii kehtib
        see ka siis, kui fookus ei ole ruumi sees. */
  function onRootKeyDown(event) {
    const target = event.target instanceof Element ? event.target : null
    if (event.repeat && (event.key === "Enter" || event.key === " ") && target?.closest("button, a[href]")) {
      event.preventDefault()
    }
  }

  /* ---- Sõnad ja read vaadetele ------------------------------------------ */

  const armed = confirmTexts(confirming)
  /* Teise vajutuse ajal kannab nupp teise vajutuse sõnu. */
  const labelFor = (key, label) => (confirming === key && armed?.labelKey ? t(armed.labelKey) : label)
  /* Selgitus, miks teist vajutust küsitakse: selle vaate jalareal, mis on ees. */
  const armedNote = armed ? t(armed.noteKey) : ""
  const downloadLinks = (urls) => [
    ...(urls?.docx ? [{ key: "docx", label: t("documents.actions.download_docx"), href: urls.docx }] : []),
    ...(urls?.pdf ? [{ key: "pdf", label: t("documents.actions.download_pdf"), href: urls.pdf }] : [])
  ]
  const composeNotice = approvalNotice
    ? { ok: approvalNotice.message, links: downloadLinks(approvalNotice.downloadUrls), onClose: () => setApprovalNotice(null), error: runError }
    : runFeedback
      ? {
          ok: runFeedback.message,
          links: runFeedback.actionUrl ? [{ key: "open", label: labelFor(`leave:${runFeedback.actionUrl}`, runFeedback.actionLabel), onClick: () => leaveTo(runFeedback.actionUrl) }] : [],
          onClose: () => setRunFeedback(null),
          error: runError
        }
      : { ok: "", error: runError }
  /* Teade on selles vaates, mis on parajasti ees. */
  const noticeFor = (key) => (key === activeView ? composeNotice : null)
  const noteFor = (key, text = "", go = null) => {
    const active = key === activeView
    return footNote({ text: (active && armedNote) || text, go: active && armedNote ? null : go })
  }
  const viewTitle = (key) => t(`documents.drafting.views.${key}.title`)
  const viewShort = (key) => t(`documents.drafting.views.${key}.short`)
  const filesViewKey = isClientRole ? "files" : "sources"
  const toFiles = { label: viewShort(filesViewKey), onClick: () => openView(filesViewKey) }

  const typeOptions = isClientRole ? clientTaskOptions(t) : outputTypeOptions(t)
  const clientTaskLabel = typeOptions.find((option) => option.value === clientTask)?.label || ""
  const audienceChoices = audienceOptions(t)
  const toneChoices = toneOptions(t)
  const languageChoices = languageOptions(t)
  const lengthChoices = lengthOptions(t)
  const labelOf = (choices, value) => choices.find((option) => option.value === value)?.label || ""
  const sheet = resultSheet(workspaceResult, { client: isClientRole, t, locale })
  const hasTranscript = Boolean(audio.activeTranscriptDocument?.id)

  const states = viewStates({
    documentCount: selectedCount,
    missingCount: missingDocumentIds.length,
    templateChosen: Boolean(activeTemplate),
    instruction,
    resultState,
    unsaved: hasDraftEdits,
    refineText: refineInstruction,
    versionCount: workspaceVersions.length,
    recentCount: recentArtifacts.length,
    audioChosen: Boolean(audio.selectedAudioSource),
    hasTranscript,
    transcriptUnsaved: audio.canSaveAudioTranscript,
    summaryReady: summaryOpen
  })
  const filesSummary = documentsLoading
    ? t("documents.loading")
    : selectedCount
      ? t("documents.drafting.summary.files", { count: selectedCount })
      : t("documents.drafting.summary.no_files")
  const summaries = {
    sources: filesSummary,
    files: filesSummary,
    type: isComposableType(outputType) ? typeLabel(outputType, t) : t("documents.drafting.summary.no_type"),
    task: clientTaskLabel,
    template: activeTemplate ? activeTemplate.title || activeTemplate.originalName : t("documents.drafting.template.none"),
    style: [labelOf(audienceChoices, audience), labelOf(toneChoices, tone), labelOf(languageChoices, language), labelOf(lengthChoices, length)].filter(Boolean).join(" · "),
    instruction: snippet(instruction) || t("documents.drafting.summary.no_instruction"),
    text:
      resultState === "loading"
        ? t("documents.loading")
        : resultState === "failed"
          ? t("documents.drafting.summary.text_failed")
          : hasDraftEdits
            ? t("documents.drafting.text.unsaved")
            : snippet(resultTitle) || (isClientRole ? clientStatusLabel(workspaceResult?.status, t) : typeLabel(workspaceResult?.type, t)),
    refine: snippet(refineInstruction) || t("documents.drafting.summary.no_refine"),
    versions: t("documents.drafting.summary.versions", { count: workspaceVersions.length }),
    approve: statusLabel(workspaceResult?.status, t),
    finish: clientStatusLabel(workspaceResult?.status, t),
    results: recentArtifactsLoading ? t("documents.loading") : t("documents.drafting.summary.results", { count: recentArtifacts.length }),
    audio: audio.selectedAudioSource ? snippet(audio.selectedAudioSource.title || audio.selectedAudioSource.originalName) : t("documents.drafting.summary.no_audio"),
    transcribe: hasTranscript ? t("documents.drafting.transcribe.exists") : t("documents.drafting.summary.no_transcript"),
    review: !hasTranscript
      ? t("documents.drafting.summary.no_transcript")
      : audio.canSaveAudioTranscript
        ? t("documents.drafting.review.unsaved")
        : t("documents.drafting.summary.transcript_ready"),
    summary: summaryOpen ? t("documents.drafting.summary_view.ready") : t("documents.drafting.summary.no_summary")
  }
  const steps = viewKeys.map((key) => ({
    key,
    label: viewTitle(key),
    short: viewShort(key),
    state: states[key],
    summary: summaries[key],
    free: FREE_VIEWS.includes(key)
  }))

  /* Isikuandmete kontrolli küsimus selle vaate jaoks, kust töö käivitati. */
  const privacyFor = (action) => {
    if (!privacyPrompt || privacyPrompt.action !== action) return null
    const findings = (Array.isArray(privacyPrompt.findings) ? privacyPrompt.findings : []).map((finding) => finding?.label).filter(Boolean)
    const main = privacyPrompt.unavailable ? "retry" : "redacted"
    const words = privacyTextKeys(action, Boolean(privacyPrompt.unavailable))
    return {
      title: t(words.title),
      text: t(words.text),
      findings: findings.join(", "),
      choices: privacyChoices(privacyPrompt).map((choice) => ({
        key: choice,
        label: t(privacyChoiceKey(action, choice)),
        primary: choice === main,
        onPress: () => answerPrivacy(choice)
      }))
    }
  }

  /* Heli rajalt tagasi koostamise jadasse. Kui salvestamine käib, küsib
     lahkumine teist vajutust: jada vahetus lõpetab salvestamise. */
  const leaveAudio = (key, nextView) =>
    guarded(key, recorderBusy(), () => {
      setLevel("compose")
      setView(nextView)
    })

  function renderSources(key, glow) {
    const unavailable = !documentsLoading && selectedDocumentIds.length > 0 && documents.length === 0
    const problems = [
      ...(clientUploadError ? [{ key: "upload", text: clientUploadError }] : []),
      ...(documentsError ? [{ key: "load", text: documentsError }] : []),
      ...(missingDocumentIds.length ? [{ key: "missing", text: t("documents.drafting.sources.missing", { count: missingDocumentIds.length }) }] : [])
    ]
    const rows = sourceRows(documents, { t, locale })
    if (isClientRole) {
      return (
        <SourcesView
          t={t}
          title={viewTitle(key)}
          lead={t(clientTask === "FILL_FORM" ? "documents.drafting.files.lead_form" : "documents.drafting.files.lead", { count: CLIENT_MAX_DOCUMENTS })}
          notice={noticeFor(key)}
          loading={documentsLoading}
          problems={problems}
          rows={rows.map((row) => ({ ...row, onRemove: () => handleClientRemoveDocument(row.key) }))}
          emptyText={t(unavailable ? "documents.drafting.sources.unavailable_client" : "documents.drafting.files.empty")}
          upload={{
            inputRef: clientUploadInputRef,
            accept: ".pdf,.docx,.txt",
            label: clientUploading ? t("documents.drafting.files.uploading") : t("documents.drafting.files.add"),
            disabled: clientUploading || selectedCountLimitReached,
            onPick: () => clientUploadInputRef.current?.click?.(),
            onFile: (file) => void handleClientUpload(file)
          }}
          note={noteFor(key, selectedCountLimitReached ? t("documents.drafting.files.limit", { count: CLIENT_MAX_DOCUMENTS }) : "")}
          glow={glow}
        />
      )
    }
    const documentsLeaveKey = `leave:${documentsHref}`
    const earlierLeaveKey = `leave:${artifactResultsHref}`
    return (
      <SourcesView
        t={t}
        title={viewTitle(key)}
        lead={rows.length ? t("documents.drafting.sources.lead") : undefined}
        notice={noticeFor(key)}
        loading={documentsLoading}
        problems={problems}
        rows={rows}
        emptyText={t(unavailable ? "documents.drafting.sources.unavailable" : "documents.drafting.sources.empty")}
        cardsLabel={t("documents.drafting.sources.ways")}
        cards={[
          {
            key: "pick",
            title: labelFor(documentsLeaveKey, t("documents.drafting.sources.pick_title")),
            description: confirming === documentsLeaveKey ? armedNote : t("documents.drafting.sources.pick_desc"),
            onClick: () => leaveTo(documentsHref)
          },
          {
            key: "audio",
            title: t("documents.drafting.sources.audio_title"),
            description: t("documents.drafting.sources.audio_desc"),
            onClick: () => {
              disarmConfirm()
              setLevel("audio")
              setView(AUDIO_VIEWS[0])
            }
          },
          {
            key: "earlier",
            title: labelFor(earlierLeaveKey, t("documents.drafting.sources.earlier_title")),
            description: confirming === earlierLeaveKey ? armedNote : t("documents.drafting.sources.earlier_desc"),
            onClick: () => leaveTo(artifactResultsHref)
          }
        ]}
        glow={glow}
      />
    )
  }

  function renderStyle(key) {
    /* Iga valik muudab ühte seadet ja võtab vana teate maha. */
    const row = (rowKey, label, options, value, onChange) => ({
      key: rowKey,
      label,
      options,
      value,
      onChange: (nextValue) => {
        onChange(nextValue)
        clearResultMessages()
      }
    })
    return (
      <StyleView
        t={t}
        title={viewTitle(key)}
        notice={noticeFor(key)}
        rows={[
          row("audience", t("documents.drafting.style.audience"), audienceChoices, audience, (nextValue) => {
            setAudienceTouched(true)
            setAudience(nextValue)
          }),
          row("tone", t("documents.drafting.style.tone"), toneChoices, tone, setTone),
          row("language", t("documents.drafting.style.language"), languageChoices, language, setLanguage),
          row("length", t("documents.drafting.style.length"), lengthChoices, length, setLength)
        ]}
        note={noteFor(key)}
      />
    )
  }

  function renderInstruction(key, glow) {
    const blocker = composeBlocker({
      client: isClientRole,
      documentCount: selectedCount,
      type: outputType,
      instruction,
      limit: instructionMax,
      busy: resultBusy || audio.summarizingAudio
    })
    const checking = checkingPrivacy === "compose"
    const blockText = checking
      ? t("documents.drafting.privacy.checking")
      : starting
        ? t("documents.drafting.instruction.working")
        : blocker === "documents"
          ? t(isClientRole ? "documents.drafting.instruction.needs_files_client" : "documents.drafting.instruction.needs_files")
          : blocker === "type"
            ? t("documents.drafting.instruction.needs_type")
            : blocker === "instruction"
              ? t("documents.drafting.instruction.needs_text")
              : blocker === "too_long"
                ? t("documents.artifacts.errors.instruction_too_long")
                : hasWorkspaceResult && isWorkspaceResultSaved
                  ? t(isClientRole ? "documents.drafting.instruction.replace_note_client" : "documents.drafting.instruction.replace_note")
                  : ""
    const go = starting || checking ? null : blocker === "documents" ? toFiles : blocker === "type" ? { label: viewShort("type"), onClick: () => openView("type") } : null
    const privacy = privacyFor("compose")
    return (
      <InstructionView
        t={t}
        title={viewTitle(key)}
        lead={t(isClientRole ? "documents.drafting.instruction.lead_client" : "documents.drafting.instruction.lead")}
        notice={noticeFor(key)}
        glow={glow}
        prompt={{
          label: viewTitle(key),
          value: instruction,
          limit: instructionMax,
          onChange: (value) => {
            setInstruction(value)
            /* Küsimus käis eelmise teksti kohta. */
            if (privacyPrompt?.action === "compose") setPrivacyPrompt(null)
          },
          chips: [
            { key: "files", text: selectedCount ? t("documents.drafting.summary.files", { count: selectedCount }) : "" },
            { key: "type", text: isClientRole ? clientTaskLabel : isComposableType(outputType) ? typeLabel(outputType, t) : "" },
            { key: "audience", text: isClientRole ? "" : labelOf(audienceChoices, audience) },
            { key: "template", text: !isClientRole && activeTemplate ? t("documents.drafting.instruction.template", { title: activeTemplate.title || activeTemplate.originalName }) : "" }
          ].filter((chip) => chip.text),
          privacy,
          note: noteFor(key, blockText, go),
          stop: starting ? { label: t("documents.drafting.instruction.stop"), onPress: handleStopAgentRequest } : null,
          action: labelFor("compose", t(hasWorkspaceResult ? "documents.drafting.instruction.compose_again" : "documents.drafting.instruction.compose")),
          disabled: Boolean(blocker) || checking || Boolean(privacy),
          onPress: () => pressCompose()
        }}
      />
    )
  }

  function renderText(key, glow) {
    const editable = resultState === "draft"
    const final = resultState === "final"
    const saveDisabled = !canPersistResult || refiningResult || savingResult || approvingResult
    const detailLeaveKey = `leave:${activeArtifactDetailHref}`
    const actions = []
    if (editable || final) {
      if (isClientRole && isWorkspaceResultSaved) {
        actions.push({
          key: "delete",
          label: labelFor("delete", t("documents.actions.delete")),
          disabled: resultBusy,
          /* Kustutamine on jäädav: alati teine vajutus. */
          onClick: () => guarded("delete", true, () => void handleDeleteClientArtifact(workspaceResult.id))
        })
      }
      actions.push({
        key: "clear",
        label: labelFor("clear", t("documents.drafting.text.clear")),
        disabled: !canClearWorkspaceResult,
        onClick: () => guarded("clear", hasDraftEdits, handleClearWorkspaceResult)
      })
      if (activeArtifactDetailHref) {
        actions.push({
          key: "detail",
          label: labelFor(detailLeaveKey, t("documents.drafting.text.open_detail")),
          onClick: () => leaveTo(activeArtifactDetailHref)
        })
      }
      actions.push({ key: "copy", label: t("documents.actions.copy"), onClick: () => void handleCopyResult() })
      if (editable) {
        actions.push({
          key: "save",
          label: savingResult ? t("documents.actions.saving") : t(isClientRole ? "documents.actions.save" : "documents.actions.save_draft"),
          variant: "primary",
          disabled: saveDisabled,
          onClick: () => void handleSaveDraft()
        })
      }
    }
    /* Mustand, mis on ainult selles tööruumis (ilma id-ta), tuleb enne salvestada;
       salvestatud mustandil ütleb rida, kui toimetis on salvestamata muudatusi. */
    const flag = !editable
      ? ""
      : !isWorkspaceResultSaved
        ? t("documents.drafting.text.only_here")
        : hasDraftEdits
          ? t("documents.drafting.text.unsaved")
          : ""
    return (
      <TextView
        t={t}
        title={viewTitle(key)}
        notice={noticeFor(key)}
        state={resultState}
        error={artifactError}
        sheet={sheet}
        flag={flag}
        editor={
          editable
            ? {
                title: resultTitle,
                onTitle: (value) => {
                  setResultTitle(value)
                  clearResultMessages()
                },
                content: resultContent,
                onContent: (value) => {
                  setResultContent(value)
                  clearResultMessages()
                }
              }
            : null
        }
        text={workspaceResult?.content || ""}
        sourcesLabel={t("documents.drafting.text.sources")}
        note={noteFor(
          key,
          final ? t("documents.drafting.text.final_note") : "",
          final ? { label: t("documents.drafting.text.downloads"), onClick: () => openView(isClientRole ? "finish" : "approve") } : null
        )}
        actions={actions}
        glow={glow}
      />
    )
  }

  function renderRefine(key, glow) {
    const blocker = refineBlocker({
      resultState,
      documentCount: selectedCount,
      content: resultContent,
      instruction: refineInstruction,
      limit: instructionLimit(),
      busy: resultBusy
    })
    const checking = checkingPrivacy === "refine"
    const blockText = checking
      ? t("documents.drafting.privacy.checking")
      : refiningResult
        ? t("documents.drafting.refine.working")
        : blocker === "documents"
          ? t(isClientRole ? "documents.drafting.refine.needs_files_client" : "documents.drafting.refine.needs_files")
          : blocker === "empty_text"
            ? t("documents.drafting.refine.needs_content")
            : blocker === "instruction"
              ? t("documents.drafting.refine.needs_text")
              : blocker === "too_long"
                ? t("documents.artifacts.errors.instruction_too_long")
                : ""
    const privacy = privacyFor("refine")
    return (
      <RefineView
        t={t}
        title={viewTitle(key)}
        lead={t("documents.drafting.refine.lead")}
        notice={noticeFor(key)}
        glow={glow}
        prompt={{
          label: viewTitle(key),
          value: refineInstruction,
          limit: instructionLimit(),
          rows: 5,
          onChange: (value) => {
            setRefineInstruction(value)
            if (privacyPrompt?.action === "refine") setPrivacyPrompt(null)
          },
          privacy,
          note: noteFor(key, blockText, !refiningResult && !checking && blocker === "documents" ? toFiles : null),
          stop: refiningResult ? { label: t("documents.drafting.instruction.stop"), onPress: handleStopAgentRequest } : null,
          action: t("documents.drafting.refine.action"),
          disabled: Boolean(blocker) || checking || Boolean(privacy),
          onPress: () => pressRefine()
        }}
      />
    )
  }

  function renderApprove(key, glow) {
    const final = resultState === "final"
    const disabled = !canPersistResult || refiningResult || savingResult || approvingResult
    return (
      <ApproveView
        t={t}
        title={viewTitle(key)}
        lead={
          final
            ? t(isClientRole ? "documents.drafting.finish.done" : "documents.drafting.approve.done")
            : t(isClientRole ? "documents.drafting.finish.lead" : "documents.drafting.approve.lead")
        }
        notice={noticeFor(key)}
        sheet={sheet}
        approve={
          final
            ? null
            : {
                label: approvingResult
                  ? t("documents.actions.approving")
                  : labelFor(key, t(isClientRole ? "documents.drafting.finish.action" : "documents.actions.approve")),
                disabled,
                /* Kinnitatud teksti ei saa enam muuta: alati teine vajutus. */
                onClick: () => guarded(key, true, () => void handleApprove())
              }
        }
        downloads={downloadLinks(workspaceResult?.downloadUrls)}
        note={noteFor(key, !final && !canPersistResult ? t("documents.drafting.refine.needs_content") : "")}
        glow={glow}
      />
    )
  }

  const renderView = (step, stepIndex, flight) => {
    const key = step.key
    /* Lava hoiab kõik vaated lehel, aga põhinupp joonistab oma läike eraldi
       pinnale ja brauser lubab neid korraga piiratud arvu: läige on ainult ees
       oleval vaatel. */
    const glow = flight?.isActive !== false
    if (activeLevel === "audio") {
      return (
        <AudioPath
          viewKey={key}
          active={key === activeView}
          glow={glow}
          t={t}
          locale={locale}
          audio={audio}
          summaryOpen={summaryOpen}
          press={{ guarded, runPaid, labelFor, armedNote }}
          language={{ options: languageChoices, value: language, onChange: setLanguage }}
          unsavedText={hasDraftEdits}
          recorderBusy={recorderBusy}
          viewTitle={viewTitle}
          viewShort={viewShort}
          onView={openView}
          onClose={() => leaveAudio("exit", "sources")}
          onOpenResult={() => leaveAudio("exit:result", "text")}
        />
      )
    }
    switch (key) {
      case "sources":
      case "files":
        return renderSources(key, glow)

      case "type":
        return (
          <ChoiceView
            t={t}
            title={viewTitle(key)}
            question={t("documents.drafting.type.question")}
            notice={noticeFor(key)}
            options={typeOptions}
            value={outputType}
            onChange={(nextValue) => {
              setOutputType(nextValue)
              clearResultMessages()
            }}
            note={noteFor(key, hasWorkspaceResult ? t("documents.drafting.type.next_note") : "")}
          />
        )

      case "task":
        return (
          <ChoiceView
            t={t}
            title={viewTitle(key)}
            question={t("documents.drafting.task.question")}
            notice={noticeFor(key)}
            options={typeOptions}
            value={clientTask}
            onChange={(nextValue) => {
              setClientTask(nextValue)
              clearResultMessages()
            }}
            note={noteFor(key)}
          />
        )

      case "template": {
        const leaveKey = `leave:${documentsHref}`
        return (
          <TemplateView
            t={t}
            title={viewTitle(key)}
            lead={t("documents.drafting.template.lead")}
            notice={noticeFor(key)}
            loading={templatesLoading}
            error={templatesError}
            options={templateOptions(compatibleTemplates, t)}
            value={selectedTemplateId}
            onChange={(nextValue) => {
              setSelectedTemplateId(nextValue)
              clearResultMessages()
            }}
            status={templatesLoading || templatesError || compatibleTemplates.length ? "" : t("documents.drafting.template.empty")}
            link={{ label: labelFor(leaveKey, t("documents.drafting.template.open_documents")), onClick: () => leaveTo(documentsHref) }}
            note={noteFor(key)}
          />
        )
      }

      case "style":
        return renderStyle(key)

      case "instruction":
        return renderInstruction(key, glow)

      case "text":
        return renderText(key, glow)

      case "refine":
        return renderRefine(key, glow)

      case "versions":
        return (
          <VersionsView
            t={t}
            title={viewTitle(key)}
            lead={t("documents.drafting.versions.lead", { count: WORKSPACE_VERSION_LIMIT })}
            notice={noticeFor(key)}
            rows={versionRows(workspaceVersions, { title: resultTitle, content: resultContent, t, locale }).map((row) => ({
              ...row,
              restoreLabel: labelFor(`version:${row.key}`, t("documents.drafting.versions.restore")),
              /* Rida, mis on juba toimetis, ei vaja taastamist. */
              onRestore: row.current ? null : () => guarded(`version:${row.key}`, versionTextAtRisk, () => handleRestoreWorkspaceVersion(row.key))
            }))}
            emptyText={t("documents.drafting.versions.empty")}
            saved={
              canRestoreSavedVersion
                ? {
                    label: labelFor("saved", t("documents.drafting.versions.restore_saved")),
                    onClick: () => guarded("saved", versionTextAtRisk, handleRestoreSavedVersion)
                  }
                : null
            }
            note={noteFor(key)}
          />
        )

      case "approve":
      case "finish":
        return renderApprove(key, glow)

      case "results":
        return (
          <ResultsView
            t={t}
            title={viewTitle(key)}
            lead={t("documents.drafting.results.lead", { count: RECENT_RESULTS_LIMIT })}
            notice={noticeFor(key)}
            loading={recentArtifactsLoading}
            error={recentArtifactsError}
            rows={recentResultRows(recentArtifacts, { currentId: workspaceResult?.id || "", t, locale }).map((row) => ({
              ...row,
              openLabel: labelFor(`open:${row.key}`, t("documents.actions.open")),
              /* Teise tulemuse avamine asendab toimetis oleva teksti. */
              onOpen: () => (row.current ? openView("text") : guarded(`open:${row.key}`, hasDraftEdits, () => void handleOpenClientArtifact(row.key)))
            }))}
            emptyText={t("documents.drafting.results.empty")}
            note={noteFor(key)}
          />
        )

      default:
        return null
    }
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
      {/* `onKeyDown` kuulab siin oma laste klahvivajutusi (vt `onRootKeyDown`);
          element ise ei ole vajutatav. */}
      <div className={styles.page} data-dock-scroll-behavior="recede" ref={surfaceRef} onKeyDown={onRootKeyDown}>
        {/* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale. */}
        {!hideHeader ? (
          <SubpageHeader
            onBack={handleBack}
            backAriaLabel={t("documents.drafting.back_to_chat")}
            showBack={false}
            anchorBack={false}
            headerClassName="sr-only"
            /* ⓘ elab paneeli nurgas × kõrval (PanelFrame); vt
               usePanelInfoSlot ülalpool. */
          >
            {t("chat.tools.agent_mode")}
          </SubpageHeader>
        ) : null}

        {/* Vaadete loend muutub, kui tulemus tekib või kaob ja kui minnakse
            heli rajale: siis ehitatakse lava uuesti ja see avaneb vaatel, kuhu
            inimene läks. Heli raja loend on alati sama. */}
        <StepFlight
          key={stageKey}
          label={t("chat.tools.agent_mode")}
          steps={steps}
          initialIndex={Math.max(0, viewKeys.indexOf(activeView))}
          activeKey={activeView}
          onStepChange={(index, step) => {
            if (!step) return
            disarmConfirm()
            setView(step.key)
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
