export function classifyModelFailure(error, { signal = null, reasoningEffort = null } = {}) {
  const aborted = signal?.aborted === true ||
    error?.name === "AbortError" ||
    error?.name === "APIUserAbortError";
  if (aborted) return "request_cancelled";

  const status = Number(error?.status || error?.response?.status);
  const providerCode = String(error?.code || error?.error?.code || "").toLowerCase();
  const providerParam = String(error?.param || error?.error?.param || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  const effort = String(reasoningEffort || "").trim().toLowerCase();
  const compatibleStatus = !Number.isFinite(status) || status === 400 || /^400\b/u.test(message);
  const unsupported = providerCode === "unsupported_value" || /unsupported value|not supported/u.test(message);
  const effortIdentified = providerParam.includes("reasoning") || providerParam.includes("effort") ||
    (effort && (message.includes(`'${effort}'`) || message.includes(`"${effort}"`)));
  return compatibleStatus && unsupported && effortIdentified
    ? "model_reasoning_effort_unsupported"
    : "model_failed";
}
