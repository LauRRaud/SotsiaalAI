"use client"

/**
 * Materjalid: saada materjal ülevaatuseks ja vaata oma saadetud materjale.
 *
 * KUJU (09.10). Leht oli üks veerg nähtava pealkirja all: saatmise vorm ja
 * selle all teine pealkiri „Minu saadetud materjalid" kõrgete ridadega, 590 px
 * sisu 496 px kerivas kastis. Nüüd on korraga ees üks asi: minu materjalide
 * loend, avatud materjal või saatmise vorm. Need vahetuvad kohapeal, mitte
 * sammulaval: loend ja vorm ei ole kaks järjestikust sammu. Lehe nimi on
 * kiirmenüüs; pealkiri jääb ekraanilugejale.
 *
 * Loendi rida on madal (nimi, seis märgina, päev, „Ava”). Säilitamise read,
 * allalaadimine ja tagasivõtmine on avatud materjali vaates. Tagasivõtmine
 * kustutab materjali ja küsib teist vajutust.
 *
 * ADMINISTRAATOR näeb loendi kohal ka teed laekunud materjalide ülevaatuse
 * juurde (`MaterialsAdminSubmissionsPanel`). See paneel ei olnud pärast vana
 * RAG-i halduse eemaldamist (05.09) ühelgi lehel: laekunud materjale ei saanud
 * keegi üle vaadata.
 *
 * Siin on andmed, päringud ja see, mis vaateid olekuga seob. Vaated on failis
 * ./views/MaterialsViews.jsx, read ja reeglid failis ./views/materialRows.js,
 * kujundus failis ./views/materials.module.css.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

import { useI18n } from "@/components/i18n/I18nProvider"
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot"
import { SubpageHeader } from "@/components/ui/SubpageHeader"
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage"
import { localizePath } from "@/lib/localizePath"
import { pushWithTransition } from "@/lib/routeTransition"

import MaterialsAdminSubmissionsPanel from "./MaterialsAdminSubmissionsPanel"
import { MaterialItemView, MineListView, Notice, SendView } from "./views/MaterialsViews"
import { UPLOAD_ACCEPT, UPLOAD_LIMITS, fileRows, materialSheet, mineRows, uploadProblem } from "./views/materialRows"
import styles from "./views/materials.module.css"

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

export default function MaterialsPage({ locale = "et", embedded = false, onBack = null, hideHeader = false }) {
  const router = useRouter()
  const { t, locale: activeLocale } = useI18n()
  const { data: session } = useSession()
  const resolvedLocale = activeLocale || locale
  /* Sama reegel mis serveris (`isAdmin` failis lib/authz.js). Nupp on viisakus,
     mitte värav: ülevaatuse päringud kontrollib server ise. */
  const admin = session?.user?.isAdmin === true || String(session?.user?.role || "").toUpperCase() === "ADMIN"
  /* Paneeli ainus ⓘ (PanelFrame, × kõrval). Manustatuna on ⓘ omanik Töölaud. */
  usePanelInfoSlot({
    infoId: "materials",
    title: t("materials_page.title"),
    active: !embedded
  })

  const pageRef = useRef(null)
  const [comment, setComment] = useState("")
  const [files, setFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  /* Õnnestumise teade seisab vaadete kohal ja kaob ise; viga kuulub vaate
     juurde ja seisab selle vaate all servas. */
  const [notice, setNotice] = useState("")
  const [sendError, setSendError] = useState("")
  const [listError, setListError] = useState("")
  const [itemError, setItemError] = useState("")
  const idempotencyKeyRef = useRef("")
  const [myMaterials, setMyMaterials] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loadingMine, setLoadingMine] = useState(true)
  /* Milline vaade on ees: "list", "send" või "review"; avatud materjal on
     loendi asemel, kui `openedId` on seatud. */
  const [view, setView] = useState("list")
  const [openedId, setOpenedId] = useState("")
  const [withdrawingId, setWithdrawingId] = useState("")

  const loadMine = useCallback(async ({ cursor = null, append = false } = {}) => {
    setLoadingMine(true)
    setListError("")
    try {
      const query = new URLSearchParams({ limit: "20" })
      if (cursor) query.set("cursor", cursor)
      const response = await fetch(`/api/materials?${query.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(resolveApiMessage({ payload, t, fallbackKey: "materials_page.errors.load_failed" }))
      const rows = Array.isArray(payload?.submissions) ? payload.submissions : []
      setMyMaterials((current) => append ? [...current, ...rows] : rows)
      setNextCursor(payload?.hasMore ? payload?.nextCursor || null : null)
    } catch (loadError) {
      setListError(loadError?.message || t("materials_page.errors.load_failed"))
    } finally {
      setLoadingMine(false)
    }
  }, [t])

  useEffect(() => {
    void loadMine()
  }, [loadMine])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(""), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  /* Vaate vahetusel kaob nupp, mida vajutati („Saada materjal", „Ava", „Loobu"),
     ja klaviatuuri fookus koos sellega: fookus läheb uue vaate pealkirjale.
     Esimesel joonistusel fookust ei võeta. */
  const shown = openedId && view === "list" ? `item:${openedId}` : view
  const shownRef = useRef(shown)
  useEffect(() => {
    if (shownRef.current === shown) return
    shownRef.current = shown
    pageRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true })
  }, [shown])

  const problemKey = uploadProblem(files)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!files.length || submitting || problemKey) return

    setSubmitting(true)
    setSendError("")
    setNotice("")

    try {
      const formData = new FormData()
      for (const selectedFile of files) {
        formData.append("file", selectedFile)
      }
      formData.append("comment", comment)
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = window.crypto.randomUUID()
      formData.append("idempotencyKey", idempotencyKeyRef.current)

      const response = await fetch("/api/materials", {
        method: "POST",
        body: formData
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(resolveApiMessage({ payload, t, fallbackKey: "materials_page.errors.upload_failed" }))
      }

      setComment("")
      setFiles([])
      idempotencyKeyRef.current = ""
      setNotice(t("materials_page.submit_success"))
      /* Saadetud materjal on kohe näha: leht läheb tagasi loendisse. */
      setOpenedId("")
      setView("list")
      await loadMine()
    } catch (submitError) {
      setSendError(submitError?.message || t("materials_page.errors.upload_failed"))
    } finally {
      setSubmitting(false)
    }
  }

  /* Tagasivõtmine kustutab materjali. Siia jõuab alles teine vajutus (vt
     `MaterialItemView`). */
  async function withdraw(id) {
    if (withdrawingId) return
    setWithdrawingId(id)
    setItemError("")
    try {
      const response = await fetch(`/api/materials/${encodeURIComponent(id)}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setItemError(resolveApiMessage({ payload, t, fallbackKey: "materials_page.errors.delete_failed" }))
        return
      }
      setMyMaterials((current) => current.filter((row) => row.id !== id))
      setOpenedId("")
      setNotice(t("materials_page.mine.withdrawn"))
    } catch {
      setItemError(t("materials_page.errors.delete_failed"))
    } finally {
      setWithdrawingId("")
    }
  }

  const handleBack = useCallback(() => {
    if (typeof onBack === "function") {
      onBack()
      return
    }
    markChatWorkspaceRestore()
    if (typeof window === "undefined") {
      pushWithTransition(router, localizePath("/vestlus", resolvedLocale))
      return
    }
    window.requestAnimationFrame(() => {
      pushWithTransition(router, localizePath("/vestlus", resolvedLocale))
    })
  }, [onBack, resolvedLocale, router])

  const opened = openedId ? myMaterials.find((item) => String(item.id) === openedId) || null : null
  const listStatus = loadingMine ? "loading" : listError ? "error" : "ready"

  let body
  if (view === "review" && admin) {
    body = (
      <MaterialsAdminSubmissionsPanel
        locale={resolvedLocale}
        back={{ label: t("materials_page.views.list.title"), onClick: () => setView("list") }}
      />
    )
  } else if (view === "send") {
    body = (
      <SendView
        t={t}
        form={{
          accept: UPLOAD_ACCEPT,
          help: t("materials_page.views.send.file_help", { count: UPLOAD_LIMITS.count, size: UPLOAD_LIMITS.sizeMb }),
          files: fileRows(files),
          onFiles: (next) => {
            idempotencyKeyRef.current = ""
            setSendError("")
            setFiles(next)
          },
          comment,
          onComment: (value) => {
            idempotencyKeyRef.current = ""
            setComment(value)
          },
          commentHint: t(files.length > 1 ? "materials_page.comment_placeholder_multiple" : "materials_page.comment_placeholder"),
          /* Liiga palju või liiga suur fail: öeldakse kohe, mitte pärast serveri keeldumist. */
          error: problemKey ? t(problemKey) : sendError,
          blocked: Boolean(problemKey),
          busy: submitting,
          onSubmit: handleSubmit,
          onCancel: () => setView("list")
        }}
      />
    )
  } else if (opened) {
    body = (
      <MaterialItemView
        t={t}
        sheet={materialSheet(opened, { t, locale: resolvedLocale })}
        error={itemError}
        busy={Boolean(withdrawingId)}
        onBack={() => setOpenedId("")}
        onWithdraw={() => withdraw(opened.id)}
      />
    )
  } else {
    body = (
      <MineListView
        t={t}
        status={listStatus}
        error={listError}
        rows={mineRows(myMaterials, { t, locale: resolvedLocale }).map((row) => ({
          ...row,
          onOpen: () => {
            setItemError("")
            setOpenedId(row.id)
          }
        }))}
        /* „Näita veel" kannab serveri kursorit ja on laadimise ajal keelatud:
           kiire topeltvajutus lisaks samad read kaks korda. */
        more={nextCursor ? { busy: loadingMine, onClick: () => void loadMine({ cursor: nextCursor, append: true }) } : null}
        onRetry={() => void loadMine()}
        onSend={() => setView("send")}
        onReview={admin ? () => setView("review") : null}
      />
    )
  }

  const content = (
    <div className={styles.page} data-dock-scroll-behavior="recede" ref={pageRef}>
      {/* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale. */}
      {!hideHeader ? (
        <SubpageHeader
          onBack={handleBack}
          backAriaLabel={t("profile.back_to_chat")}
          showBack={false}
          holdPressedVisualDisabled
          anchorBack={false}
          headerClassName="sr-only"
          /* ⓘ elab paneeli nurgas × kõrval (PanelFrame); vt
             usePanelInfoSlot ülalpool. */
        >
          {t("materials_page.title")}
        </SubpageHeader>
      ) : null}
      <Notice text={notice} tone="ok" />
      <div className={styles.flat}>{body}</div>
    </div>
  )

  if (embedded) return content

  return <section>{content}</section>
}
