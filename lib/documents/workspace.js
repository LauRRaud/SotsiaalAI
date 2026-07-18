// E3 — ühtse "Minu dokumendid" tööruumi mudel.
// Ühendab neli omaniku-skoobitud objektiperet (üles laaditud failid & transkriptid,
// AI-artefaktid mustand/kinnitatud, salvestatud analüüsid, süvauuringud) üheks lamedaks
// sorteeritavaks loendiks, kus igal real on sama päritolu/privaatsus-deskriptor: kes näeb,
// kust ta tuli, mis olekus on, kui kaua säilib ja kas ta puudutab jagatud RAG-indeksit.
// Puhas — ei prisma't, ei i18n't — seega ohutu kliendipaketis ja ühik-testitav.

export const WORKSPACE_TYPES = ["source", "transcript", "analysis", "draft", "final", "research"]

// Dokumendi liigid, mida esitleme transkriptidena (mitte algfailina).
const TRANSCRIPT_KINDS = new Set(["AUDIO_TRANSCRIPT", "CALL_TRANSCRIPT", "TRANSCRIPT_SUMMARY"])

function toMs(value) {
  const ms = Date.parse(value || "")
  return Number.isFinite(ms) ? ms : 0
}

function documentType(kind) {
  return TRANSCRIPT_KINDS.has(String(kind || "").toUpperCase()) ? "transcript" : "source"
}

function mapDocument(doc) {
  const type = documentType(doc?.kind)
  const agentAllowed = Boolean(doc?.agentAllowed)
  const updatedAt = doc?.updatedAt || null
  return {
    key: `document:${doc?.id}`,
    type,
    id: doc?.id,
    title: doc?.title || doc?.originalName || "",
    updatedAt,
    sortTs: toMs(updatedAt),
    readOnly: Boolean(doc?.readOnly),
    provenance: {
      // agentAllowed dokument läheb koostamisel jagatud otsingusse — see on ainus objekt,
      // mille privaatsuspiir sõltub kasutaja valikust, seega eristame audience'i selle järgi.
      audience: agentAllowed ? "owner_and_worktree" : "owner_only",
      origin: type === "transcript" ? "transcript" : "uploaded",
      state: { kind: "document", value: doc?.kind },
      retention: { key: "retention_days", days: 90 },
      rag: agentAllowed ? "in_search_when_shared" : "not_in_search"
    },
    raw: doc
  }
}

function mapArtifact(artifact) {
  const isFinal = String(artifact?.status || "").toUpperCase() === "FINAL"
  const updatedAt = artifact?.updatedAt || null
  return {
    key: `artifact:${artifact?.id}`,
    type: isFinal ? "final" : "draft",
    id: artifact?.id,
    title: artifact?.title || "",
    updatedAt,
    sortTs: toMs(updatedAt),
    provenance: {
      audience: "owner_only",
      origin: isFinal ? "ai_final" : "ai_draft",
      state: { kind: "artifact", value: isFinal ? "final" : "draft" },
      retention: { key: "retention_days", days: 90 },
      rag: "not_in_search"
    },
    raw: artifact
  }
}

function mapAnalysis(analysis) {
  const updatedAt = analysis?.updatedAt || null
  return {
    key: `analysis:${analysis?.id}`,
    type: "analysis",
    id: analysis?.id,
    title: analysis?.title || "",
    updatedAt,
    sortTs: toMs(updatedAt),
    disclaimer: analysis?.disclaimer || null,
    provenance: {
      audience: "owner_only",
      origin: "analysis",
      state: { kind: "analysis", value: "saved" },
      retention: { key: "retention_until_deleted" },
      rag: "not_in_search"
    },
    raw: analysis
  }
}

function mapResearch(job) {
  const updatedAt = job?.updatedAt || job?.createdAt || null
  return {
    key: `research:${job?.id}`,
    type: "research",
    id: job?.id,
    title: job?.query || "",
    updatedAt,
    sortTs: toMs(updatedAt),
    convId: job?.convId || null,
    provenance: {
      audience: "owner_only",
      origin: "research",
      state: { kind: "research", value: job?.status },
      retention: { key: "retention_days", days: 14 },
      // Süvauuring loeb teadmusbaasi, aga tema tulemus ei lähe jagatud indeksisse.
      rag: "reads_kb"
    },
    raw: job
  }
}

// Ühenda kõik pered üheks loendiks, uusim ees. Sisendid on juba omaniku-skoobitud
// (serveri marsruudid jõustavad selle); see funktsioon ainult normaliseerib ja sordib.
export function buildWorkspaceItems({ documents = [], artifacts = [], analyses = [], research = [] } = {}) {
  const items = [
    ...(Array.isArray(documents) ? documents : []).map(mapDocument),
    ...(Array.isArray(artifacts) ? artifacts : []).map(mapArtifact),
    ...(Array.isArray(analyses) ? analyses : []).map(mapAnalysis),
    ...(Array.isArray(research) ? research : []).map(mapResearch)
  ].filter((item) => item && item.id)
  items.sort((a, b) => b.sortTs - a.sortTs)
  return items
}
