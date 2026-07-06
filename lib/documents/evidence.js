const EVIDENCE_TOKEN_BUDGETS = {
  short: 1500,
  standard: 4000,
  detailed: 4500
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4)
}

function formatEvidenceBlock(chunk, index) {
  const chunkLabel = Number.isFinite(chunk?.chunkIndex) ? chunk.chunkIndex + 1 : index + 1
  return [
    `[E${index + 1}] ${chunk?.title || "Document"} | chunk ${chunkLabel}`,
    String(chunk?.text || "").trim()
  ]
    .filter(Boolean)
    .join("\n")
}

export function evidenceTokenBudgetForLength(length) {
  return EVIDENCE_TOKEN_BUDGETS[length] || EVIDENCE_TOKEN_BUDGETS.standard
}

export function buildEvidenceContext(chunks, tokenBudget) {
  const budget = Math.max(400, Number(tokenBudget) || EVIDENCE_TOKEN_BUDGETS.standard)
  const ordered = [...(Array.isArray(chunks) ? chunks : [])].sort((a, b) => {
    const aDistance = Number.isFinite(Number(a?.distance)) ? Number(a.distance) : Number.POSITIVE_INFINITY
    const bDistance = Number.isFinite(Number(b?.distance)) ? Number(b.distance) : Number.POSITIVE_INFINITY
    return aDistance - bDistance
  })

  const seen = new Set()
  const blocks = []
  let usedTokens = 0

  for (const chunk of ordered) {
    const dedupeKey = chunk?.chunkId || `${chunk?.docId || "doc"}:${chunk?.chunkIndex ?? "x"}`
    if (seen.has(dedupeKey)) continue

    const block = formatEvidenceBlock(chunk, blocks.length)
    const blockTokens = estimateTokens(block)
    if (blocks.length && usedTokens + blockTokens > budget) break
    if (!blocks.length && blockTokens > budget) {
      blocks.push(block)
      usedTokens += blockTokens
      break
    }

    blocks.push(block)
    usedTokens += blockTokens
    seen.add(dedupeKey)
  }

  return {
    evidenceText: blocks.join("\n\n"),
    evidenceCount: blocks.length,
    usedTokens
  }
}
