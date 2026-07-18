export function formatDate(value, locale) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(locale || "et", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export function formatFileSize(size) {
  const nextSize = Number(size || 0);
  if (nextSize >= 1024 * 1024) return `${(nextSize / (1024 * 1024)).toFixed(1)} MB`;
  if (nextSize >= 1024) return `${Math.round(nextSize / 1024)} KB`;
  return `${nextSize} B`;
}

export function kindLabel(kind, t) {
  if (kind === "TEMPLATE") return t("documents.kinds.template");
  if (kind === "MATERIAL") return t("documents.kinds.material");
  if (kind === "CALL_AUDIO_RECORDING") return t("documents.kinds.call_audio_recording", "Helikõne salvestus");
  if (kind === "CALL_TRANSCRIPT") return t("documents.kinds.call_transcript", "Helikõne transkriptsioon");
  if (kind === "AUDIO_TRANSCRIPT") return t("documents.kinds.audio_transcript", "Helifaili transkript");
  if (kind === "TRANSCRIPT_SUMMARY") return t("documents.kinds.transcript_summary", "Transkripti kokkuvõte");
  if (kind === "UPLOADED_AUDIO_SOURCE") return t("documents.kinds.uploaded_audio_source", "Helifail");
  return t("documents.kinds.other");
}

export function templateForLabel(value, t) {
  return value ? t(`documents.template_for.${String(value).toLowerCase()}`) : "";
}

export function artifactTypeLabel(type, t) {
  return t(`documents.artifact_types.${String(type || "other").toLowerCase()}`);
}

export function artifactStatusLabel(status, t) {
  return t(`documents.status.${String(status || "draft").toLowerCase()}`);
}

// E3 — ühtse tööruumi objekti-tüübi ja süvauuringu oleku sildid.
export function workspaceTypeLabel(type, t) {
  return t(`documents.workspace.types.${String(type || "source").toLowerCase()}`, t("documents.kinds.other"));
}

export function researchStatusLabel(status, t) {
  const key = String(status || "queued").toLowerCase();
  const known = ["queued", "running", "done", "error", "cancelled"].includes(key) ? key : "queued";
  return t(`documents.workspace.research_status.${known}`);
}

// E3 — päritolu/privaatsus-riba: võtab ühe workspace-rea (buildWorkspaceItems) ja tagastab
// viis lokaliseeritud silti: KES NÄEB · PÄRITOLU · OLEK · KEHTIVUS · RAG-kasutus.
function provenanceStateLabel(state, t) {
  if (!state) return "";
  if (state.kind === "document") return kindLabel(state.value, t);
  if (state.kind === "artifact") return artifactStatusLabel(state.value, t);
  if (state.kind === "research") return researchStatusLabel(state.value, t);
  if (state.kind === "analysis") return t("documents.workspace.state.analysis_saved");
  return "";
}

function provenanceRetentionLabel(retention, t) {
  if (!retention) return "";
  if (retention.key === "retention_days") {
    return t("documents.provenance.retention.days", { days: retention.days }, `${retention.days} p`);
  }
  return t("documents.provenance.retention.until_deleted");
}

export function describeProvenance(item, t) {
  const provenance = item?.provenance || {};
  return {
    audience: t(`documents.provenance.audience.${provenance.audience || "owner_only"}`),
    origin: t(`documents.provenance.origin.${provenance.origin || "uploaded"}`),
    state: provenanceStateLabel(provenance.state, t),
    retention: provenanceRetentionLabel(provenance.retention, t),
    rag: t(`documents.provenance.rag.${provenance.rag || "not_in_search"}`)
  };
}
