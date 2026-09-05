// Notifications continue normally while the old RAG recovery worker is retired.
// Do not claim jobs, consume their retry budgets or report them as completed.
export async function runEffectivePracticeRagRecovery() {
  return { state: "retired", skipped: true, reason: "rag_retired" };
}
