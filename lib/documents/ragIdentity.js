export function buildAgentRagDocumentId(document) {
  return `agent::${document.id}::${document.sha256}`
}
