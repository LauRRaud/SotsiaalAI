import { toResponsesInput, buildResponsesPayload } from "@/lib/chat/promptBuilder";
import { logEvent } from "@/lib/chat/logger";
import { logOpenAIUsage } from "@/lib/openaiUsage";

const STREAM_DELTA_MIN_CHARS = 28;
const STREAM_DELTA_MAX_CHARS = 96;
const STREAM_DELTA_MIN_INTERVAL_MS = 120;

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
  userId,
  role
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
    stream: false,
    effectiveRole
  });
  const startedAt = Date.now();
  const response = await client.responses.create(payload);

  await logOpenAIUsage({
    response,
    model: payload.model,
    route: "api/chat",
    stage: "chat",
    latencyMs: Date.now() - startedAt,
    userId,
    role
  });

  return {
    reply: response.output_text?.trim() || "Sorry, I couldn't generate an answer right now."
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
  role
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
    effectiveRole
  });
  const startedAt = Date.now();
  const stream = await client.responses.stream(payload);
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
