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
