"use client"

import { useEffect, useState } from "react"

import CardTitle from "@/components/ui/CardTitle"
import Button from "@/components/ui/Button"
import { useI18n } from "@/components/i18n/I18nProvider"

function formatFileSize(size) {
  const value = Number(size || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value, locale) {
  const dateLocale =
    locale === "ru"
      ? "ru-RU"
      : locale === "en"
        ? "en-GB"
        : "et-EE"

  try {
    return new Intl.DateTimeFormat(dateLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value))
  } catch {
    return ""
  }
}

function materialStatusLabel(t, status) {
  const normalized = String(status || "pending").toLowerCase()
  return t(`materials_page.admin.status.${normalized}`, normalized)
}

export default function MaterialsAdminSubmissionsPanel({
  variant = "materials",
  locale = "et",
  refreshKey = 0
}) {
  const { t, locale: activeLocale } = useI18n()
  const resolvedLocale = activeLocale || locale
  const isRagAdmin = variant === "ragAdmin"
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [adminError, setAdminError] = useState("")
  const [reviewingId, setReviewingId] = useState("")
  const [nextCursor, setNextCursor] = useState(null)
  const [statusFilter, setStatusFilter] = useState("")
  const [total, setTotal] = useState(0)

  async function refreshItems({ cursor = null, append = false, status = statusFilter } = {}) {
    setLoadingItems(true)
    setAdminError("")
    try {
      const query = new URLSearchParams({ limit: "100" })
      if (cursor) query.set("cursor", cursor)
      if (status) query.set("status", status)
      const response = await fetch(`/api/materials?${query.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || t("materials_page.errors.load_failed"))
      }
      const rows = Array.isArray(payload?.submissions) ? payload.submissions : []
      setItems((current) => append ? [...current, ...rows] : rows)
      setNextCursor(payload?.hasMore ? payload?.nextCursor || null : null)
      setTotal(Number(payload?.total || 0))
    } catch (loadError) {
      setItems([])
      setAdminError(loadError?.message || t("materials_page.errors.load_failed"))
    } finally {
      setLoadingItems(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadItems() {
      setLoadingItems(true)
      setAdminError("")
      try {
        const response = await fetch("/api/materials?limit=100", { cache: "no-store" })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.message || t("materials_page.errors.load_failed"))
        }
        if (!cancelled) {
          setItems(Array.isArray(payload?.submissions) ? payload.submissions : [])
          setNextCursor(payload?.hasMore ? payload?.nextCursor || null : null)
          setTotal(Number(payload?.total || 0))
        }
      } catch (loadError) {
        if (!cancelled) {
          setItems([])
          setAdminError(loadError?.message || t("materials_page.errors.load_failed"))
        }
      } finally {
        if (!cancelled) setLoadingItems(false)
      }
    }

    void loadItems()

    return () => {
      cancelled = true
    }
  }, [refreshKey, t])

  async function handleDelete(id) {
    if (!window.confirm(t("materials_page.admin.delete_confirm"))) return

    setAdminError("")
    try {
      const response = await fetch(`/api/materials/${encodeURIComponent(id)}`, {
        method: "DELETE"
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || t("materials_page.errors.delete_failed"))
      }
      setItems((current) => current.filter((item) => item.id !== id))
    } catch (deleteError) {
      setAdminError(deleteError?.message || t("materials_page.errors.delete_failed"))
    }
  }

  async function handleReview(id, action) {
    if (reviewingId) return
    const reviewNote = window.prompt(t("materials_page.admin.review_note_prompt", "Markus ulevaatuse kohta (valikuline):"), "")
    if (reviewNote === null) return

    setReviewingId(id)
    setAdminError("")
    try {
      const response = await fetch(`/api/materials/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action, reviewNote })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || t("materials_page.errors.review_failed", "Materjali ulevaatuse salvestamine ebaonnestus."))
      }
      const updated = payload?.submission
      if (updated?.id) {
        setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      }
    } catch (reviewError) {
      setAdminError(reviewError?.message || t("materials_page.errors.review_failed", "Materjali ulevaatuse salvestamine ebaonnestus."))
    } finally {
      setReviewingId("")
    }
  }

  const actionButtonSize = isRagAdmin ? "sm" : "md"

  const header = (
    <div>
      <div>
        <CardTitle>{t("materials_page.admin.title")}</CardTitle>
        <div>{t("materials_page.admin.subtitle")}</div>
      </div>
      <Button
        variant="primary"
        size={actionButtonSize}
        onClick={() => void refreshItems({ status: statusFilter })}
        disabled={loadingItems}
      >
        {t("materials_page.admin.refresh")}
      </Button>
      <select
        aria-label={t("materials_page.admin.status_filter")}
        value={statusFilter}
        onChange={(event) => {
          const value = event.target.value
          setStatusFilter(value)
          void refreshItems({ status: value })
        }}
      >
        <option value="">{t("materials_page.admin.all_statuses")}</option>
        {["pending", "reviewed", "rejected", "imported"].map((status) => (
          <option key={status} value={status}>{materialStatusLabel(t, status)}</option>
        ))}
      </select>
      <span>{t("materials_page.admin.total", { count: total })}</span>
    </div>
  )

  const content = (
    <>
      {header}

      {adminError ? (
        <p role="alert">
          {adminError}
        </p>
      ) : null}

      {loadingItems ? (
        <p>{t("materials_page.admin.loading")}</p>
      ) : items.length ? (
        <div>
          {items.map((item) => (
            <div key={item.id}>
              <div>
                <span>{formatDate(item.createdAt, resolvedLocale)}</span>
                <span>|</span>
                <span>{formatFileSize(item.size)}</span>
                {item.submittedByUser?.email ? (
                  <>
                    <span>|</span>
                    <span>{item.submittedByUser.email}</span>
                  </>
                ) : null}
                <span>{materialStatusLabel(t, item.status)}</span>
              </div>
              <div>
                <h3>{item.originalName}</h3>
                <p>
                  {item.comment || t("materials_page.admin.comment_missing")}
                </p>
                {item.reviewedAt || item.reviewNote ? (
                  <p>
                    {item.reviewedAt ? `${formatDate(item.reviewedAt, resolvedLocale)}${item.reviewedBy ? ` | ${item.reviewedBy}` : ""}` : null}
                    {item.reviewNote ? `${item.reviewedAt ? " | " : ""}${item.reviewNote}` : null}
                  </p>
                ) : null}
              </div>
              <div>
                <Button
                  as="a"
                  size={actionButtonSize}
                  href={`/api/materials/${encodeURIComponent(item.id)}/download`}
                >
                  {t("materials_page.admin.download")}
                </Button>
                <Button
                  variant="primary"
                  size={actionButtonSize}
                  disabled={reviewingId === item.id || item.status === "reviewed"}
                  onClick={() => void handleReview(item.id, "mark_reviewed")}
                >
                  {t("materials_page.admin.mark_reviewed", "Margi ule vaadatuks")}
                </Button>
                <Button
                  variant="primary"
                  size={actionButtonSize}
                  disabled={reviewingId === item.id || item.status === "imported"}
                  onClick={() => void handleReview(item.id, "mark_imported")}
                >
                  {t("materials_page.admin.mark_imported", "Margi impordituks")}
                </Button>
                <Button
                  variant="danger"
                  size={actionButtonSize}
                  disabled={reviewingId === item.id || item.status === "rejected"}
                  onClick={() => void handleReview(item.id, "reject")}
                >
                  {t("materials_page.admin.reject", "Lukka tagasi")}
                </Button>
                <Button
                  variant="danger"
                  size={actionButtonSize}
                  onClick={() => void handleDelete(item.id)}
                >
                  {t("materials_page.admin.delete")}
                </Button>
              </div>
            </div>
          ))}
          {nextCursor ? (
            <Button
              type="button"
              size={actionButtonSize}
              onClick={() => void refreshItems({ cursor: nextCursor, append: true })}
              disabled={loadingItems}
            >
              {t("materials_page.admin.load_more")}
            </Button>
          ) : null}
        </div>
      ) : (
        <p>{t("materials_page.admin.empty")}</p>
      )}
    </>
  )

  if (isRagAdmin) {
    return (
      <div id="rag-documents-submitted-materials">
        <div>{content}</div>
      </div>
    )
  }

  return (
    <section>
      {content}
    </section>
  )
}
