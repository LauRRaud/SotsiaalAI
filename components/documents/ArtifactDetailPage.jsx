"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/components/i18n/I18nProvider"
import BackButton from "@/components/ui/BackButton"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Panel from "@/components/ui/Panel"
import MeetingSummaryRoomShare from "@/components/documents/MeetingSummaryRoomShare"
import { localizePath } from "@/lib/localizePath"

function formatDate(value, locale) {
  if (!value) return ""
  try {
    return new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  } catch {
    return ""
  }
}

function artifactTypeLabel(type, t) {
  return t(`documents.artifact_types.${String(type || "other").toLowerCase()}`)
}

function artifactStatusLabel(status, t) {
  return t(`documents.status.${String(status || "draft").toLowerCase()}`)
}

function joinMetaParts(parts) {
  return parts.filter(Boolean).join(" · ")
}

export default function ArtifactDetailPage({ artifactId }) {
  const router = useRouter()
  const { t, locale } = useI18n()
  const [artifact, setArtifact] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")
  const [feedback, setFeedback] = useState("")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approvalNotice, setApprovalNotice] = useState(null)

  useEffect(() => {
    if (!approvalNotice) return undefined
    const timer = window.setTimeout(() => setApprovalNotice(null), 8000)
    return () => window.clearTimeout(timer)
  }, [approvalNotice])

  const loadArtifact = useCallback(async () => {
    setLoading(true)
    setErrorText("")
    try {
      const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.load_artifact"))
      setArtifact(payload?.artifact || null)
      setTitle(payload?.artifact?.title || "")
      setContent(payload?.artifact?.content || "")
    } catch (error) {
      setArtifact(null)
      setErrorText(error?.message || t("documents.errors.load_artifact"))
    } finally {
      setLoading(false)
    }
  }, [artifactId, t])

  useEffect(() => {
    void loadArtifact()
  }, [loadArtifact])

  async function saveDraft() {
    if (saving || !artifact || artifact.status !== "DRAFT") return
    setSaving(true)
    setFeedback("")
    setErrorText("")
    try {
      const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.artifacts.errors.update_failed"))
      setArtifact(payload?.artifact || null)
      setTitle(payload?.artifact?.title || "")
      setContent(payload?.artifact?.content || "")
      setApprovalNotice(null)
      setFeedback(t("documents.feedback.saved"))
    } catch (error) {
      setErrorText(error?.message || t("documents.artifacts.errors.update_failed"))
    } finally {
      setSaving(false)
    }
  }

  async function approveArtifact() {
    if (approving || !artifact || artifact.status !== "DRAFT") return
    setApproving(true)
    setFeedback("")
    setErrorText("")
    setApprovalNotice(null)
    try {
      const saveResponse = await fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content })
      })
      const savePayload = await saveResponse.json().catch(() => ({}))
      if (!saveResponse.ok) throw new Error(savePayload?.message || t("documents.artifacts.errors.update_failed"))
      const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}/approve`, { method: "POST" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.artifacts.errors.approve_failed"))
      setArtifact(payload?.artifact || null)
      setTitle(payload?.artifact?.title || "")
      setContent(payload?.artifact?.content || "")
      setApprovalNotice({
        message: t("documents.feedback.approved"),
        downloadUrls: payload?.downloadUrls || payload?.artifact?.downloadUrls || {}
      })
    } catch (error) {
      setErrorText(error?.message || t("documents.artifacts.errors.approve_failed"))
    } finally {
      setApproving(false)
    }
  }

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(String(artifact?.content || content || ""))
      setErrorText("")
      setFeedback(t("documents.feedback.copied"))
    } catch {
      setErrorText(t("documents.errors.copy_failed"))
    }
  }

  async function deleteArtifact() {
    if (!window.confirm(t("documents.confirm.delete_artifact"))) return
    try {
      const response = await fetch(`/api/documents/artifacts/${encodeURIComponent(artifactId)}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || t("documents.errors.delete_artifact_failed"))
      router.push(localizePath("/documents", locale))
    } catch (error) {
      setErrorText(error?.message || t("documents.errors.delete_artifact_failed"))
    }
  }

  const handleBack = useCallback(() => {
    router.push(localizePath("/documents", locale))
  }, [locale, router])

  return (
    <section>
      <div>
        <Panel variant="secondary" padding="md">
          <BackButton
            onClick={handleBack}
            ariaLabel={t("buttons.back")}
          />
          <div>
            <header>
              <div>
                <div>
                  <h1>{t("documents.artifact_detail_title")}</h1>
                </div>
              </div>
              {approvalNotice ? (
                <div>
                  <span>{approvalNotice.message}</span>
                  <div>
                    {approvalNotice.downloadUrls?.docx ? (
                      <a href={approvalNotice.downloadUrls.docx}>
                        {t("documents.actions.download_docx")}
                      </a>
                    ) : null}
                    {approvalNotice.downloadUrls?.pdf ? (
                      <a href={approvalNotice.downloadUrls.pdf}>
                        {t("documents.actions.download_pdf")}
                      </a>
                    ) : null}
                    <button type="button" onClick={() => setApprovalNotice(null)}>
                      {t("common.close")}
                    </button>
                  </div>
                </div>
              ) : null}
              {feedback ? (
                <div>
                  {feedback}
                </div>
              ) : null}
              {loading ? (
                <div>
                  {t("documents.loading")}
                </div>
              ) : null}
              {!loading && errorText ? (
                <div>
                  {errorText}
                </div>
              ) : null}
            </header>

            {!loading && !errorText && artifact ? (
              <div>
                <div>
                  <span>
                    {artifactTypeLabel(artifact.type, t)}
                  </span>
                  <span>
                    {artifactStatusLabel(artifact.status, t)}
                  </span>
                </div>
                <h2>
                  {artifact.title || artifactTypeLabel(artifact.type, t)}
                </h2>
                <div>
                  {joinMetaParts([
                    formatDate(artifact.createdAt, locale),
                    `${t("documents.updated_at")} ${formatDate(artifact.updatedAt, locale)}`,
                    artifact.approvedAt ? `${t("documents.approved_at")} ${formatDate(artifact.approvedAt, locale)}` : ""
                  ])}
                </div>

                {artifact.status === "DRAFT" ? (
                  <>
                    <div>
                      <Input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder={t("documents.form.artifact_title_placeholder")}
                      />
                      <textarea
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                      />
                    </div>
                    <div>
                      {t("documents.draft_notice")}
                    </div>
                    <div>
                      <Button type="button" size="sm" onClick={() => void approveArtifact()} disabled={approving}>
                        {approving ? t("documents.actions.approving") : t("documents.actions.approve")}
                      </Button>
                      <Button type="button" size="sm" variant="primary" onClick={() => void saveDraft()} disabled={saving}>
                        {saving ? t("documents.actions.saving") : t("documents.actions.save_draft")}
                      </Button>
                      <Button type="button" size="sm" variant="primary" onClick={() => setFeedback(t("documents.feedback.refine_stub"))}>
                        {t("documents.actions.refine_stub")}
                      </Button>
                      <Button type="button" size="sm" variant="primary" onClick={() => void copyContent()}>
                        {t("documents.actions.copy")}
                      </Button>
                      <Button type="button" size="sm" variant="danger" onClick={() => void deleteArtifact()}>
                        {t("documents.actions.delete")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      {artifact.content}
                    </div>
                    <div>
                      {t("documents.feedback.approved")}
                    </div>
                    <div>
                      {artifact.downloadUrls?.docx ? (
                        <Button as="a" href={artifact.downloadUrls.docx} size="sm">
                          {t("documents.actions.download_docx")}
                        </Button>
                      ) : null}
                      {artifact.downloadUrls?.pdf ? (
                        <Button as="a" href={artifact.downloadUrls.pdf} size="sm" variant="linkBrand">
                          {t("documents.actions.download_pdf")}
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="primary" onClick={() => void copyContent()}>
                        {t("documents.actions.copy")}
                      </Button>
                      <Button type="button" size="sm" variant="danger" onClick={() => void deleteArtifact()}>
                        {t("documents.actions.delete")}
                      </Button>
                    </div>
                    {artifact.type === "MEETING_SUMMARY" ? (
                      <MeetingSummaryRoomShare artifactId={artifactId} />
                    ) : null}
                  </>
                )}

                {artifact.template ? (
                  <div>
                    <h2>{t("documents.template_label")}</h2>
                    <p>
                      {artifact.template.title || artifact.template.originalName}
                    </p>
                  </div>
                ) : null}
                <div>
                  <h2>{t("documents.sources_section_title")}</h2>
                  <div>
                    {artifact.sources?.length ? (
                      artifact.sources.map((source) => (
                        <div key={source.id}>
                          <div>{source.title}</div>
                          <div>{source.originalName}</div>
                        </div>
                      ))
                    ) : (
                      <p>{t("documents.empty_sources")}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </section>
  )
}
