export class RagProxyExecutionError extends Error {
  constructor(code, cause = null) {
    super(code);
    this.name = "RagProxyExecutionError";
    this.code = code;
    this.cause = cause;
  }
}

function completedAudit(auditBase, meta) {
  return {
    ...auditBase,
    action: "rag_proxy_operation_completed",
    meta: { ...auditBase.meta, ...meta }
  };
}

export async function executeAuditedRagOperation({ auditBase, writeAudit, fetchUpstream }) {
  try {
    await writeAudit({
      ...auditBase,
      meta: { ...auditBase.meta, outcome: "started" }
    });
  } catch (error) {
    throw new RagProxyExecutionError("RAG_PROXY_AUDIT_START_FAILED", error);
  }

  let response;
  try {
    response = await fetchUpstream();
  } catch (error) {
    const isAbort = error?.name === "AbortError";
    try {
      await writeAudit(completedAudit(auditBase, {
        outcome: "failed",
        resultCode: isAbort ? "timeout" : "fetch_failed"
      }));
    } catch (auditError) {
      throw new RagProxyExecutionError("RAG_PROXY_AUDIT_RESULT_FAILED", auditError);
    }
    throw new RagProxyExecutionError(isAbort ? "RAG_PROXY_TIMEOUT" : "RAG_PROXY_FETCH_FAILED", error);
  }

  try {
    await writeAudit(completedAudit(auditBase, {
      outcome: response.ok ? "succeeded" : "rejected",
      upstreamStatus: response.status
    }));
  } catch (error) {
    try { await response.body?.cancel?.(); } catch {}
    throw new RagProxyExecutionError("RAG_PROXY_AUDIT_RESULT_FAILED", error);
  }

  return response;
}
