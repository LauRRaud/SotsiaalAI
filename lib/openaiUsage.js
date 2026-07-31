import { logEvent } from "@/lib/chat/logger";
import { safeError } from "@/lib/privacy/safeError";

function toNullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

// Vastuse lõpetamis- ja kasutusväljad. `response_present: false` eristab
// "vastust ei saadud kätte" (nt katkestatud voog, kus finalResponse() kukkus)
// olukorrast, kus vastus oli olemas, aga väli puudus.
export function extractOpenAIUsage(response) {
  const usage = response?.usage || {};
  return {
    response_present: Boolean(response),
    status: toNullableString(response?.status),
    incomplete_reason: toNullableString(response?.incomplete_details?.reason),
    max_output_tokens: toNullableNumber(response?.max_output_tokens),
    input_tokens: toNullableNumber(usage?.input_tokens),
    cached_tokens: toNullableNumber(usage?.input_tokens_details?.cached_tokens),
    output_tokens: toNullableNumber(usage?.output_tokens),
    reasoning_tokens: toNullableNumber(usage?.output_tokens_details?.reasoning_tokens),
    total_tokens: toNullableNumber(usage?.total_tokens),
    // Nähtav väljund = kogu väljund miinus reasoning. Null, kui kumbki puudub.
    visible_output_tokens:
      Number.isFinite(Number(usage?.output_tokens)) &&
      Number.isFinite(Number(usage?.output_tokens_details?.reasoning_tokens))
        ? Number(usage.output_tokens) - Number(usage.output_tokens_details.reasoning_tokens)
        : null,
    // Kärbe on tuvastatav ainult API väljadest, mitte vastuse tekstist.
    output_cap_reached:
      Number.isFinite(Number(usage?.output_tokens)) && Number.isFinite(Number(response?.max_output_tokens))
        ? Number(usage.output_tokens) >= Number(response.max_output_tokens)
        : null
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
