import { toResponsesInput, buildResponsesPayload, getPromptComponents, langStrings } from "@/lib/chat/promptBuilder";
import { isPromptTokenAuditEnabled, measurePromptComponents, withInputTokenGap } from "@/lib/chat/promptTokenAudit";
import { logEvent } from "@/lib/chat/logger";
import { logOpenAIUsage } from "@/lib/openaiUsage";
import { stableEvidenceHash } from "./ragAttemptEvidence.js";

export function modelRequestEvidence(payload) {
  const { input, ...settings } = payload;
  return { configured_model: payload.model, prompt_hash: stableEvidenceHash(input), model_settings_hash: stableEvidenceHash(settings) };
}

// Prompt-komponentide tokeniaudit. Ei tohi kunagi päringut kukutada:
// lipp väljas -> kohene väljumine; viga mõõtmisel -> hoiatus logisse ja edasi.
async function logPromptTokenAudit({ input, payload, response, route, stage, userId, role }) {
  if (!isPromptTokenAuditEnabled()) return;
  try {
    const components = getPromptComponents(input);
    if (!components) return;
    const measurement = await measurePromptComponents({ components, model: payload?.model });
    const withGap = withInputTokenGap(measurement, response?.usage?.input_tokens);
    await logEvent("chat_prompt_token_audit", {
      model: payload?.model || null,
      route,
      stage,
      max_output_tokens: payload?.max_output_tokens ?? null,
      reasoning_effort: payload?.reasoning?.effort ?? null,
      text_verbosity: payload?.text?.verbosity ?? null,
      ...withGap,
      ...(userId ? { userId } : {}),
      ...(role ? { role } : {})
    });
  } catch (error) {
    try {
      console.warn("[chat_prompt_token_audit] skipped", { route, stage, error: String(error?.message || error).slice(0, 200) });
    } catch {}
  }
}

const STREAM_DELTA_MIN_CHARS = 28;
const STREAM_DELTA_MAX_CHARS = 96;
const STREAM_DELTA_MIN_INTERVAL_MS = 120;
export const EMPTY_PROVIDER_REPLY = "Sorry, I couldn't generate an answer right now.";

function promptCacheKeyPart(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function buildPromptCacheKey({ effectiveRole, replyLang, isCrisis }) {
  const role = promptCacheKeyPart(effectiveRole, "client").slice(0, 16);
  const lang = promptCacheKeyPart(replyLang, "et").slice(0, 4);
  // Eksplitsiitne breakpoint lõpeb enne RAG-konteksti, ajalugu ja kasutaja
  // küsimust. Seetõttu peab võti eristama ainult stabiilset süsteemiprompti
  // muutvaid variante, mitte looma sama prefiksi jaoks cache'i kasutaja kaupa.
  return `sotsiaalai:chat:v2:${role}:${lang}:${isCrisis ? "c" : "n"}`.slice(0, 64);
}

export function resolveProviderReply(reply, { replyLang = "et", isCrisis = false } = {}) {
  const normalizedReply = String(reply || "").trim();
  if (normalizedReply) return normalizedReply;
  return isCrisis ? langStrings(replyLang).crisisNoCtx : EMPTY_PROVIDER_REPLY;
}

export async function callOpenAI({
  history,
  userMessage,
  context,
  effectiveRole,
  grounding,
  includeSources,
  replyLang,
  isCrisis,
  extraSystemInstructions,
  maxOutputTokens,
  reasoningEffort,
  usageStage = "chat",
  userId,
  role,
  signal = null,
  onRuntimeObservation = null
}) {
  const { default: OpenAI } = await import("openai");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const client = new OpenAI({ apiKey });
  const input = toResponsesInput({
    history,
    userMessage,
    context,
    effectiveRole,
    grounding,
    includeSources,
    replyLang,
    isCrisis,
    extraSystemInstructions,
    maxOutputTokens
  });
  const payload = buildResponsesPayload(input, {
    stream: false,
    effectiveRole,
    effort: reasoningEffort,
    promptCacheKey: buildPromptCacheKey({ effectiveRole, replyLang, isCrisis })
  });
  const startedAt = Date.now();
  if (onRuntimeObservation) await onRuntimeObservation(modelRequestEvidence(payload));
  const response = await client.responses.create(payload, signal ? { signal } : undefined);
  if (onRuntimeObservation) await onRuntimeObservation({ actual_model: response.model });

  await logOpenAIUsage({
    response,
    model: payload.model,
    route: "api/chat",
    stage: usageStage,
    latencyMs: Date.now() - startedAt,
    userId,
    role
  });

  await logPromptTokenAudit({
    input,
    payload,
    response,
    route: "api/chat",
    stage: usageStage,
    userId,
    role
  });

  return {
    reply: resolveProviderReply(response.output_text, { replyLang, isCrisis })
  };
}

export async function streamOpenAI({
  history,
  userMessage,
  context,
  effectiveRole,
  grounding,
  includeSources,
  replyLang,
  isCrisis,
  extraSystemInstructions,
  userId,
  role,
  signal = null,
  onRuntimeObservation = null
}) {
  const { default: OpenAI } = await import("openai");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const client = new OpenAI({ apiKey });
  const input = toResponsesInput({
    history,
    userMessage,
    context,
    effectiveRole,
    grounding,
    includeSources,
    replyLang,
    isCrisis,
    extraSystemInstructions
  });
  const payload = buildResponsesPayload(input, {
    stream: true,
    effectiveRole,
    promptCacheKey: buildPromptCacheKey({ effectiveRole, replyLang, isCrisis })
  });
  const startedAt = Date.now();
  if (onRuntimeObservation) await onRuntimeObservation(modelRequestEvidence(payload));
  // Serveripoolne Stop: kliendi katkestus jõuab req.signal kaudu siia ja katkestab
  // päris provideri voo (mitte ainult kliendi kuvamise). Voog suletakse ka signal.abort()-iga.
  const stream = await client.responses.stream(payload, signal ? { signal } : undefined);
  if (signal) {
    try {
      if (signal.aborted) {
        stream.controller?.abort?.();
      } else {
        signal.addEventListener("abort", () => {
          try {
            stream.controller?.abort?.();
          } catch {}
        }, { once: true });
      }
    } catch {}
  }
  const streamCreatedAt = Date.now();
  let firstDeltaAt = null;
  let deltaCount = 0;
  let outputChars = 0;

  async function* iterator() {
    try {
      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          const delta = event.delta || "";
          if (!firstDeltaAt) firstDeltaAt = Date.now();
          deltaCount += 1;
          outputChars += delta.length;
          yield {
            type: "delta",
            text: delta
          };
          continue;
        }

        if (event.type === "response.error") {
          throw new Error(event.error?.message || "OpenAI stream error");
        }

        if (event.type === "response.completed") {
          if (onRuntimeObservation) await onRuntimeObservation({ actual_model: event.response?.model });
          yield {
            type: "done"
          };
        }
      }
    } finally {
      const completedAt = Date.now();
      const finalResponse = await stream.finalResponse().catch(() => null);

      await logOpenAIUsage({
        response: finalResponse,
        model: payload.model,
        route: "api/chat",
        stage: "chat",
        latencyMs: completedAt - startedAt,
        userId,
        role
      });

      await logPromptTokenAudit({
        input,
        payload,
        response: finalResponse,
        route: "api/chat",
        stage: "chat",
        userId,
        role
      });

      await logEvent("openai_stream_timing", {
        model: payload.model || null,
        route: "api/chat",
        stage: "chat",
        latency_ms: completedAt - startedAt,
        stream_create_latency_ms: streamCreatedAt - startedAt,
        first_delta_latency_ms: firstDeltaAt ? firstDeltaAt - startedAt : null,
        first_delta_after_stream_ms: firstDeltaAt ? firstDeltaAt - streamCreatedAt : null,
        delta_count: deltaCount,
        output_chars: outputChars,
        ...(userId ? { userId } : {}),
        ...(role ? { role } : {})
      });
    }
  }

  return iterator();
}

export function shouldFlushStreamDelta(text = "", lastFlushAt = 0) {
  if (!text) return false;
  if (text.length >= STREAM_DELTA_MAX_CHARS) return true;
  if (text.length < STREAM_DELTA_MIN_CHARS) return false;
  if (/[\n.!?;:]\s*$/.test(text)) return true;
  return Date.now() - lastFlushAt >= STREAM_DELTA_MIN_INTERVAL_MS;
}
