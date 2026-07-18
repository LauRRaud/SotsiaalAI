import { errorJson, json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;
  if (process.env.MASTER_SOURCE_FILESYSTEM_ENABLED !== "1") {
    return json({ ok: true, state: "degraded", reason: "master_source_filesystem_disabled", queue: [], counts: {}, generatedAt: null });
  }
  try {
    const { getMasterSourcesWorkQueue } = await import("@/lib/admin/rag/masterSources/service");
    return json(await getMasterSourcesWorkQueue());
  } catch (error) {
    console.error("[master-sources] queue status failed", safeError(error));
    return errorJson("api.admin.kov.update_failed", 500, auth.locale);
  }
}

export async function POST(request) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;
  if (process.env.MASTER_SOURCE_FILESYSTEM_ENABLED !== "1") {
    return json({ ok: false, reason: "master_source_filesystem_disabled" }, 503);
  }
  let input;
  try {
    input = await request.json();
  } catch {
    return errorJson("api.common.invalid_request", 400, auth.locale);
  }
  const action = String(input?.action || "").trim();
  const sourceId = String(input?.sourceId || "").trim();
  const fingerprint = String(input?.candidateFingerprint || "").trim();
  if (!sourceId || !fingerprint || !["approve", "apply"].includes(action) || input?.confirmed !== true) {
    return json({ ok: false, reason: "admin_confirmation_or_candidate_required" }, 400);
  }
  if (action === "apply" && process.env.MASTER_SOURCE_APPLY_ENABLED !== "1") {
    return json({ ok: false, reason: "master_source_apply_disabled" }, 409);
  }
  try {
    const [{ readFile }, path, { loadSourceMasterRecords }, { createMasterSourceRuntimeStateStore }, { createMasterSourceLifecycleService }, { createMasterSourceRagClient }, { safeFetch }] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
      import("../../../../../scripts/lib/source-master-knowledge-docs.mjs"),
      import("../../../../../scripts/lib/master-source-runtime-state.mjs"),
      import("@/lib/rag/masterSourceLifecycle"),
      import("@/lib/rag/masterSourceRagClient"),
      import("../../../../../scripts/lib/safe-fetch.mjs")
    ]);
    const root = "Andmebaasi/Admebaasi-materjali-lisa";
    const masterPath = path.join(root, "master_sources_final.json");
    const candidates = JSON.parse(await readFile(path.join(root, "master_sources.korje.json"), "utf8"));
    const candidate = (candidates.candidates || []).find(item => item.source_id === sourceId);
    const record = (await loadSourceMasterRecords(masterPath)).find(item => item.source_id === sourceId);
    if (!candidate || !record) return json({ ok: false, reason: "candidate_not_found" }, 404);
    const crypto = await import("node:crypto");
    const registrySha256 = crypto.createHash("sha256").update(await readFile(masterPath)).digest("hex");
    const lifecycle = createMasterSourceLifecycleService({
      stateStore: createMasterSourceRuntimeStateStore(path.join(root, "master_sources.runtime.json"), registrySha256),
      db: prisma,
      rag: action === "apply" ? createMasterSourceRagClient({ baseUrl: process.env.RAG_SERVICE_URL, apiKey: process.env.RAG_SERVICE_API_KEY }) : null,
      fetcher: action === "apply" ? (url => safeFetch(url, { headers: { Accept: "text/html,application/xhtml+xml" } })) : null
    });
    const params = { sourceId, record, candidate, expectedFingerprint: fingerprint, actorUserId: auth.session?.user?.id, confirmed: true };
    const result = action === "approve" ? await lifecycle.approve(params) : await lifecycle.applyApproved(params);
    return json({ ok: true, action, result: { status: result.status, docId: result.docId || null } });
  } catch (error) {
    console.error("[master-sources] action failed", safeError(error));
    return json({ ok: false, reason: error?.code || "master_source_action_failed" }, 409);
  }
}
