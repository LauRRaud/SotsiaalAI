import { logEvent } from "@/lib/chat/logger";
import { safeError } from "@/lib/privacy/safeError";

function toNullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractOpenAIUsage(response) {
  const usage = response?.usage || {};
  return {
    input_tokens: toNullableNumber(usage?.input_tokens),
    cached_tokens: toNullableNumber(usage?.input_tokens_details?.cached_tokens),
    output_tokens: toNullableNumber(usage?.output_tokens),
    reasoning_tokens: toNullableNumber(usage?.output_tokens_details?.reasoning_tokens)
  };
}

export async function logOpenAIUsage({
  response,
  model,
  route,
  stage,
  latencyMs,
  userId,
  role
}) {
  if (!route || !stage) return null;

  try {
    await logEvent("openai_usage", {
      model: model || null,
      route,
      stage,
      latency_ms: toNullableNumber(latencyMs),
      ...extractOpenAIUsage(response),
      ...(userId ? { userId } : {}),
      ...(role ? { role } : {})
    });
  } catch (error) {
    try {
      console.error("[openai_usage] failed", {
        route,
        stage,
        error: safeError(error)
      });
    } catch {}
  }

  return null;
}
