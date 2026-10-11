"use client"

/**
 * Laekunud materjalide ülevaatus (administraator).
 *
 * KUJU (09.10). Paneel oli üks loend, kus iga rida kandis kuut teksti ja viit
 * nuppu ning märkust, õigusi ja kustutamist küsisid brauseri dialoogid. Nüüd
 * on korraga ees üks asi: loend seisu filtriga, avatud materjal või õiguste
 * vorm enne importi. Need vahetuvad kohapeal. Vaated on failis
 * ./views/ReviewViews.jsx, read ja reeglid failis ./views/materialRows.js.
 * Siin on andmed, päringud ja see, mis vaateid olekuga seob.
 *
 * KUS SEE ON. Materjalide lehel (`MaterialsPage`), administraatoril nupu
 * „Laekunud materjalid" taga. `variant="ragAdmin"` annab ümbrisele RAG-i
 * halduse ankru (`#rag-documents-submitted-materials`); see kasutus kadus koos
 * vana RAG-i haldusega (05.09) ja praegu seda ükski leht ei kasuta.
 *
 * IMPORT. Server keeldub impordist seni, kuni vana RAG on peatatud
 * (`lib/materials/ragLifecycle.js`): nupp ja õiguste vorm on alles, vastuseks
 * tuleb serveri selgitus.
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { useI18n } from "@/components/i18n/I18nProvider"
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage"

import { Notice } from "./views/MaterialsViews"
import { ReviewListView, RightsView, SubmissionView } from "./views/ReviewViews"
import {
  FILTER_ALL,
  emptyRights,
  rightsBasisOptions,
  rightsPayload,
  rightsReady,
  statusFilterOptions,
  submissionRows,
  submissionSheet
} from "./views/materialRows"
import styles from "./views/materials.module.css"

export default function MaterialsAdminSubmissionsPanel({
  variant = "materials",
  locale = "et",
  refreshKey = 0,
  back = null
}) {
  const { t, locale: activeLocale } = useI18n()
  const resolvedLocale = activeLocale || locale
  const isRagAdmin = variant === "ragAdmin"
  const panelRef = useRef(null)
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [adminError, setAdminError] = useState("")
  const [reviewingId, setReviewingId] = useState("")
  const [nextCursor, setNextCursor] = useState(null)
  const [statusFilter, setStatusFilter] = useState(FILTER_ALL)
  const [total, setTotal] = useState(0)
  /* Avatud materjal ja selle vaade: "sheet" (materjal ise) või "rights" (õiguste vorm). */
  const [openedId, setOpenedId] = useState("")
  const [mode, setMode] = useState("sheet")
  const [note, setNote] = useState("")
  const [rights, setRights] = useState(emptyRights)
  const [notice, setNotice] = useState("")
  const [actionError, setActionError] = useState("")
  /* Loendi laadimise järjekorranumber. Filtri vahetus teeb uue päringu enne, kui
     eelmine vastas: hiljem saabunud vana vastus ei tohi uut loendit üle
     kirjutada ega „näita veel" lisada ridu teise filtri loendile. */
  const loadSeqRef = useRef(0)
  const filterRef = useRef(statusFilter)

  const load = useCallback(async ({ cursor = null, append = false } = {}) => {
    const seq = append ? loadSeqRef.current : (loadSeqRef.current += 1)
    setLoadingItems(true)
    setAdminError("")
    try {
      const query = new URLSearchParams({ limit: "100" })
      if (cursor) query.set("cursor", cursor)
      if (filterRef.current !== FILTER_ALL) query.set("status", filterRef.current)
      const response = await fetch(`/api/materials?${query.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (seq !== loadSeqRef.current) return
      if (!response.ok) {
        throw new Error(resolveApiMessage({ payload, t, fallbackKey: "materials_page.errors.load_failed" }))
      }
      const rows = Array.isArray(payload?.submissions) ? payload.submissions : []
      setItems((current) => append ? [...current, ...rows] : rows)
      setNextCursor(payload?.hasMore ? payload?.nextCursor || null : null)
      setTotal(Number(payload?.total || 0))
    } catch (loadError) {
      if (seq !== loadSeqRef.current) return
      /* Ebaõnnestunud „näita veel" ei viska juba laaditud ridu ära. */
      if (!append) setItems([])
      setAdminError(loadError?.message || t("materials_page.errors.load_failed"))
    } finally {
      if (seq === loadSeqRef.current) setLoadingItems(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(""), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  /* Vaate vahetusel kaob nupp, mida vajutati („Ava", „Tagasi loendisse"), ja
     klaviatuuri fookus koos sellega: fookus läheb uue vaate pealkirjale.
     Esimesel joonistusel fookust ei võeta. */
  const shown = openedId ? `${openedId}:${mode}` : "list"
  const shownRef = useRef(shown)
  useEffect(() => {
    if (shownRef.current === shown) return
    shownRef.current = shown
    panelRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true })
  }, [shown])

  const openItem = (id) => {
    setActionError("")
    setNote("")
    setRights(emptyRights())
    setMode("sheet")
    setOpenedId(id)
  }
  const closeItem = () => {
    setActionError("")
    setMode("sheet")
    setOpenedId("")
  }
  const replaceItem = (next) => {
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)))
  }

  /* Teise seisu valimisel ei tohi eelmise filtri read ekraanile jääda, kuni uus
     loend laadib: need näeksid välja nagu uue filtri tulemus. */
  const changeFilter = (value) => {
    if (value === filterRef.current) return
    filterRef.current = value
    setStatusFilter(value)
    setItems([])
    setNextCursor(null)
    void load()
  }

  /* Kustutamine on jäädav. Siia jõuab alles teine vajutus (vt `SubmissionView`). */
  async function handleDelete(id) {
    if (reviewingId) return
    setReviewingId(id)
    setActionError("")
    try {
      const response = await fetch(`/api/materials/${encodeURIComponent(id)}`, {
        method: "DELETE"
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(resolveApiMessage({ payload, t, fallbackKey: "materials_page.errors.delete_failed" }))
      }
      setItems((current) => current.filter((item) => item.id !== id))
      setTotal((current) => Math.max(0, current - 1))
      closeItem()
      setNotice(t("materials_page.admin.deleted"))
    } catch (deleteError) {
      setActionError(deleteError?.message || t("materials_page.errors.delete_failed"))
    } finally {
      setReviewingId("")
    }
  }

  /* Märkus tuleb avatud materjali väljalt (vana leht küsis seda brauseri
     dialoogiga); tühi märkus on lubatud. */
  async function handleReview(id, action) {
    if (reviewingId) return

    setReviewingId(id)
    setActionError("")
    try {
      const response = await fetch(`/api/materials/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action, reviewNote: note, expectedRevision: items.find((item) => item.id === id)?.reviewRevision })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 409 && payload?.current?.id) {
          replaceItem(payload.current)
        }
        throw new Error(resolveApiMessage({ payload, t, fallbackKey: "materials_page.errors.review_failed" }))
      }
      const updated = payload?.submission
      if (updated?.id) {
        replaceItem(updated)
      }
      setNote("")
    } catch (reviewError) {
      setActionError(reviewError?.message || t("materials_page.errors.review_failed"))
    } finally {
      setReviewingId("")
    }
  }

  async function handleRagImport(item) {
    if (reviewingId || item.status !== "reviewed" || !rightsReady(rights)) return

    setReviewingId(item.id)
    setActionError("")
    try {
      const response = await fetch(`/api/materials/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_rag",
          expectedRevision: item.reviewRevision,
          rights: rightsPayload(rights)
        })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(resolveApiMessage({ payload, t, fallbackKey: "materials_page.errors.rag_ingest_failed" }))
      if (payload?.submission?.id) {
        replaceItem(payload.submission)
      }
      setRights(emptyRights())
      setMode("sheet")
    } catch (error) {
      setActionError(error?.message || t("materials_page.errors.rag_ingest_failed"))
    } finally {
      setReviewingId("")
    }
  }

  const opened = openedId ? items.find((item) => String(item.id) === openedId) || null : null
  const busy = Boolean(reviewingId)

  let body
  if (opened && mode === "rights") {
    body = (
      <RightsView
        t={t}
        error={actionError}
        busy={busy}
        form={{
          value: rights,
          bases: rightsBasisOptions(t),
          ready: rightsReady(rights),
          onChange: (field, value) => setRights((current) => ({ ...current, [field]: value }))
        }}
        onCancel={() => {
          setActionError("")
          setMode("sheet")
        }}
        onSubmit={() => void handleRagImport(opened)}
      />
    )
  } else if (opened) {
    body = (
      <SubmissionView
        t={t}
        sheet={submissionSheet(opened, { t, locale: resolvedLocale })}
        note={{ value: note, onChange: setNote }}
        error={actionError}
        busy={busy}
        onBack={closeItem}
        onReview={() => void handleReview(opened.id, "mark_reviewed")}
        onReject={() => handleReview(opened.id, "reject")}
        onImport={() => {
          setActionError("")
          setMode("rights")
        }}
        onDelete={() => handleDelete(opened.id)}
      />
    )
  } else {
    body = (
      <ReviewListView
        t={t}
        back={back}
        filter={{ value: statusFilter, options: statusFilterOptions(t), onChange: changeFilter }}
        total={t("materials_page.admin.total", { count: total })}
        status={loadingItems ? "loading" : adminError ? "error" : "ready"}
        error={adminError}
        rows={submissionRows(items, { t, locale: resolvedLocale }).map((row) => ({ ...row, onOpen: () => openItem(row.id) }))}
        emptyText={t(statusFilter === FILTER_ALL ? "materials_page.admin.empty" : "materials_page.admin.empty_filtered")}
        /* „Näita veel" kannab serveri kursorit ja on laadimise ajal keelatud. */
        more={nextCursor ? { busy: loadingItems, onClick: () => void load({ cursor: nextCursor, append: true }) } : null}
        onRefresh={() => void load()}
      />
    )
  }

  const content = (
    <>
      <Notice text={notice} tone="ok" />
      <div className={styles.flat}>{body}</div>
    </>
  )

  if (isRagAdmin) {
    return (
      <div id="rag-documents-submitted-materials" className={styles.panel} ref={panelRef}>
        {content}
      </div>
    )
  }

  return (
    <section className={styles.panel} ref={panelRef}>
      {content}
    </section>
  )
}
