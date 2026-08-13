export function buildArtifactGenerationMetadata(existingMetadata, debugMeta) {
  const existing = existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
    ? existingMetadata
    : {}
  if (!debugMeta) return existing

  return {
    ...existing,
    generation: {
      model: debugMeta.model || null,
      promptVersion: debugMeta.prompt_version || null,
      retrievalMode: debugMeta.retrieval_mode || null,
      evidenceChunks: Array.isArray(debugMeta.evidence_chunks) ? debugMeta.evidence_chunks : []
    }
  }
}

export function readArtifactGenerationProvenance(metadata) {
  const generation = metadata?.generation
  return generation && typeof generation === "object" && !Array.isArray(generation)
    ? generation
    : {}
}
