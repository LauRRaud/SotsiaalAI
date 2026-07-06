"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { useI18n } from "@/components/i18n/I18nProvider"
import Button from "@/components/ui/Button"
import { DashboardInfoTrigger } from "@/components/ui/DashboardInfoOverlay"
import { SubpageHeader } from "@/components/ui/SubpageHeader"
import Textarea from "@/components/ui/Textarea"
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

export default function MaterialsPage({ locale = "et", embedded = false, onBack = null, hideHeader = false }) {
  const router = useRouter()
  const { t, locale: activeLocale } = useI18n()
  const resolvedLocale = activeLocale || locale

  const fileInputRef = useRef(null)
  const [comment, setComment] = useState("")
  const [files, setFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(""), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!files.length || submitting) return

    setSubmitting(true)
    setError("")
    setNotice("")

    try {
      const formData = new FormData()
      for (const selectedFile of files) {
        formData.append("file", selectedFile)
      }
      formData.append("comment", comment)

      const response = await fetch("/api/materials", {
        method: "POST",
        body: formData
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || t("materials_page.errors.upload_failed"))
      }

      setComment("")
      setFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ""
      setNotice(t("materials_page.submit_success"))
    } catch (submitError) {
      setError(submitError?.message || t("materials_page.errors.upload_failed"))
    } finally {
      setSubmitting(false)
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

  const content = (
    <div>
          {!hideHeader ? (
            <SubpageHeader
              onBack={handleBack}
              backAriaLabel={t("profile.back_to_chat")}
              holdPressedVisualDisabled
              anchorBack={false}
              rightSlot={
                <DashboardInfoTrigger
                  infoId="materials"
                  title={t("materials_page.title")}
                />
              }
            >
              {t("materials_page.title")}
            </SubpageHeader>
          ) : null}

          <section>
            <form onSubmit={handleSubmit}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
              />

              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                {files.length === 1 ? (
                  <span>{files[0].name}</span>
                ) : files.length > 1 ? (
                  <span>{t("materials_page.files_selected", { count: files.length })}</span>
                ) : (
                  <span>{t("materials_page.choose_file")}</span>
                )}
              </Button>

              {files.length > 1 ? (
                <p>
                  {files.map((selectedFile) => selectedFile.name).join(", ")}
                </p>
              ) : null}

              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={5}
                placeholder={t("materials_page.comment_placeholder_multiple")}
              />

              {error ? (
                <p role="alert">
                  {error}
                </p>
              ) : null}

              {notice ? (
                <p>
                  {notice}
                </p>
              ) : null}

              <div>
                <Button
                  type="submit"
                  disabled={!files.length || submitting}
                >
                  {submitting ? t("materials_page.submitting") : t("materials_page.submit")}
                </Button>
              </div>
            </form>
          </section>
    </div>
  )

  if (embedded) return content

  return (
    <div>
      <div>
        {content}
      </div>
    </div>
  )
}
