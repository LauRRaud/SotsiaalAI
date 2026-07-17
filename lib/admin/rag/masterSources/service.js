import fs from "node:fs/promises";
import path from "node:path";

const ROOT = "Andmebaasi/Admebaasi-materjali-lisa";
const STATE = path.join(ROOT, "master_sources.state.json");
const CANDIDATES = path.join(ROOT, "master_sources.korje.json");

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    return { __invalid: true };
  }
}

function queueItems(state, candidates) {
  const sourceStates = Object.values(state?.sources || {});
  const candidateList = Array.isArray(candidates?.candidates) ? candidates.candidates : [];
  const candidateById = new Map(candidateList.map(item => [item.source_id, item]));
  return sourceStates
    .filter(item => ["missing", "incomplete", "stale_match", "needs_adoption", "needs_content_check", "redirected", "invalid_url"].includes(item.match_status))
    .map(item => ({
      source_id: item.source_id,
      status: item.match_status,
      candidate_status: candidateById.get(item.source_id)?.status || null,
      route: candidateById.get(item.source_id)?.route || null,
      actionable: ["missing", "incomplete", "stale_match", "needs_adoption", "needs_content_check"].includes(item.match_status)
    }))
    .sort((left, right) => left.status.localeCompare(right.status) || left.source_id.localeCompare(right.source_id));
}

export async function getMasterSourcesWorkQueue() {
  const [state, candidates] = await Promise.all([readJson(STATE), readJson(CANDIDATES)]);
  if (!state) return { ok: true, state: "empty", queue: [], counts: {}, generatedAt: null };
  if (state.__invalid || candidates?.__invalid) return { ok: true, state: "degraded", queue: [], counts: {}, generatedAt: null };
  const queue = queueItems(state, candidates);
  const counts = queue.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] || 0) + 1 }), {});
  return {
    ok: true,
    state: "ready",
    generatedAt: state.updated_at || null,
    registrySha256: state.registry_sha256 || null,
    counts,
    queue: queue.slice(0, 100),
    truncated: queue.length > 100
  };
}
