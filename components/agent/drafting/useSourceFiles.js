"use client"

/**
 * Koostamisruumi lähtefailid ja mallid: mis on valitud, nende laadimine ja
 * pöörduja faili lisamine.
 *
 * MIKS OMA FAIL. Need andmed ja päringud on ühe asja kohta (millest tekst
 * koostatakse) ega sõltu sellest, mis tulemusega parajasti töötatakse. Lehel
 * (`../AgentModePage.jsx`) jääb nii alles tulemuse töö: koostamine,
 * täiendamine, salvestamine ja kinnitamine.
 *
 * Valik tuleb lehe aadressist (`?documents=a,b`) ja laaditakse faili kaupa;
 * faili, mida enam ei ole või millele ei ole õigust, loetakse puuduvaks, mitte
 * veaks. Mallid on ainult spetsialistil. Pöörduja lisab faili siinsamas
 * (kuni `CLIENT_MAX_DOCUMENTS`) ja see lubatakse kohe töörežiimi.
 */

import { useEffect, useMemo, useState } from "react"

import { RequestFailure, failureText, localeHeaders } from "@/lib/documents/clientRequest"

import { CLIENT_MAX_DOCUMENTS, serverMessage } from "./draftingModel"

export default function useSourceFiles({ initialDocumentIds = [], isClientRole = false, locale, t }) {
  const initialDocumentIdsSignature = Array.isArray(initialDocumentIds)
    ? initialDocumentIds.map((value) => String(value || "").trim()).filter(Boolean).join("\u001f")
    : String(initialDocumentIds || "").trim()
  const initialSelectedDocumentIds = useMemo(
    () => Array.from(new Set(initialDocumentIdsSignature.split("\u001f").map((value) => value.trim()).filter(Boolean))),
    [initialDocumentIdsSignature]
  )
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
              headers: localeHeaders(locale),
              signal: controller.signal
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) {
              return {
                id,
                error: serverMessage(payload, t, "documents.errors.load_documents"),
                status: response.status
              }
            }
            return { id, document: payload?.document || null }
          } catch (error) {
            if (controller.signal.aborted) return { id, aborted: true }
            return {
              id,
              error: failureText(error, t("documents.errors.load_documents"))
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
  }, [locale, selectedDocumentIds, t])

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
          headers: localeHeaders(locale),
          signal: controller.signal
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new RequestFailure(serverMessage(payload, t, "documents.errors.load_documents"))
        if (cancelled) return
        setTemplates(Array.isArray(payload?.documents) ? payload.documents : [])
      } catch (error) {
        if (controller.signal.aborted || cancelled) return
        setTemplates([])
        setTemplatesError(failureText(error, t("documents.errors.load_documents")))
      } finally {
        if (!cancelled) setTemplatesLoading(false)
      }
    }

    void loadTemplates()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [isClientRole, locale, t])

  /**
   * Pöörduja lisab faili: fail laaditakse üles materjalina ja lubatakse kohe
   * töörežiimi. `onStart` kutsutakse, kui üleslaadimine päriselt algab (leht
   * võtab siis oma vanad teated maha).
   * @returns {Promise<{ ids: string[], document: object } | null>} uus valik või `null`, kui faili ei lisatud
   */
  async function uploadClientFile(file, { onStart } = {}) {
    if (!file || clientUploading) return null

    if (documents.length >= CLIENT_MAX_DOCUMENTS) {
      setClientUploadError(t("documents.drafting.files.limit", { count: CLIENT_MAX_DOCUMENTS }))
      return null
    }

    setClientUploading(true)
    setClientUploadError("")
    onStart?.()

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("kind", "MATERIAL")
      formData.append("agentAllowed", "true")

      const uploadResponse = await fetch("/api/documents", {
        method: "POST",
        headers: { "x-ui-locale": locale },
        body: formData
      })
      const uploadPayload = await uploadResponse.json().catch(() => ({}))
      if (!uploadResponse.ok) throw new RequestFailure(serverMessage(uploadPayload, t, "documents.errors.upload_failed"))

      const nextDocument = uploadPayload?.document || null
      if (!nextDocument?.id || !nextDocument.agentAllowed) throw new RequestFailure(t("documents.errors.upload_failed"))
      const nextIds = Array.from(new Set([...selectedDocumentIds, nextDocument.id])).slice(0, CLIENT_MAX_DOCUMENTS)
      setDocuments((current) => [...current, nextDocument].slice(0, CLIENT_MAX_DOCUMENTS))
      setSelectedDocumentIds(nextIds)
      setMissingDocumentIds((current) => current.filter((id) => id !== nextDocument.id))
      return { ids: nextIds, document: nextDocument }
    } catch (error) {
      setClientUploadError(failureText(error, t("documents.errors.upload_failed")))
      return null
    } finally {
      setClientUploading(false)
    }
  }

  /**
   * Fail võetakse selle töö juurest ära. Faili ennast ei kustutata.
   * @returns {string[] | null} uus valik
   */
  function removeFile(documentId) {
    const nextId = String(documentId || "").trim()
    if (!nextId) return null
    const nextIds = selectedDocumentIds.filter((id) => id !== nextId)
    setSelectedDocumentIds(nextIds)
    setDocuments((current) => current.filter((document) => document.id !== nextId))
    setMissingDocumentIds((current) => current.filter((id) => id !== nextId))
    return nextIds
  }

  /** Heli raja kokkuvõte: lähtefailiks saab transkript, millest kokkuvõte tehti. */
  function replaceWith(document) {
    setDocuments([document])
    setSelectedDocumentIds([document.id])
    setMissingDocumentIds([])
  }

  return {
    selectedDocumentIds,
    documents,
    missingDocumentIds,
    documentsLoading,
    documentsError,
    templates,
    templatesLoading,
    templatesError,
    clientUploadError,
    clientUploading,
    uploadClientFile,
    removeFile,
    replaceWith
  }
}
