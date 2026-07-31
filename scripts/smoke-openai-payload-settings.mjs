#!/usr/bin/env node

// Kontrollib, et OpenAI-le saadetavas TEGELIKUS payload'is on need mudeli-,
// reasoning- ja verbosity-väärtused, mida keskkonnamuutujad ette näevad.
//
//   node scripts/smoke-openai-payload-settings.mjs            (kuiv: ainult payload)
//   node scripts/smoke-openai-payload-settings.mjs --live     (üks päris API-kutse)
//
// --live teeb ÜHE lühikese Responses-kutse ja trükib, mida OpenAI vastuses
// tagasi kajastab (model, reasoning.effort, text.verbosity, status).
// API-võtit ega selle osi ei trükita kunagi.

import { buildResponsesPayload, toResponsesInput } from "../lib/chat/promptBuilder.js";

const live = process.argv.includes("--live");
const ROLES = ["CLIENT", "SOCIAL_WORKER"];

function describe(role) {
  const input = toResponsesInput({
    history: [],
    userMessage: "Vasta ühe sõnaga: sobib.",
    context: [],
    effectiveRole: role,
    grounding: null,
    replyLang: "et",
    isCrisis: false,
    extraSystemInstructions: []
  });
  const payload = buildResponsesPayload(input, { stream: false, effectiveRole: role });
  return { role, payload };
}

function summarize(payload) {
  return {
    model: payload.model,
    reasoning_effort: payload.reasoning?.effort,
    text_verbosity: payload.text?.verbosity,
    max_output_tokens: payload.max_output_tokens,
    stream: payload.stream
  };
}

const results = ROLES.map(describe);

console.log("=== Keskkond ===");
console.log("OPENAI_MODEL             :", process.env.OPENAI_MODEL || "(määramata → koodi vaikeväärtus)");
console.log("OPENAI_REASONING_EFFORT  :", process.env.OPENAI_REASONING_EFFORT || "(määramata → low)");
console.log("OPENAI_TEXT_VERBOSITY    :", process.env.OPENAI_TEXT_VERBOSITY || "(määramata → medium)");
console.log("OPENAI_MAX_OUTPUT_TOKENS_CLIENT :", process.env.OPENAI_MAX_OUTPUT_TOKENS_CLIENT || "(määramata)");
console.log("OPENAI_MAX_OUTPUT_TOKENS_WORKER :", process.env.OPENAI_MAX_OUTPUT_TOKENS_WORKER || "(määramata)");
console.log("OPENAI_API_KEY olemas    :", Boolean(process.env.OPENAI_API_KEY));

console.log("\n=== Koostatud payload (kuiv) ===");
for (const { role, payload } of results) {
  console.log(role, JSON.stringify(summarize(payload)));
}

if (!live) {
  console.log("\n(--live puudub: päris API-kutset ei tehtud)");
  process.exit(0);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("\nOPENAI_API_KEY puudub — --live ei ole võimalik.");
  process.exit(2);
}

const { default: OpenAI } = await import("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { payload } = results.find(r => r.role === "SOCIAL_WORKER");
console.log("\n=== Päris kutse (SOCIAL_WORKER, stream:false) ===");
const startedAt = Date.now();
try {
  const response = await client.responses.create(payload);
  console.log(
    JSON.stringify(
      {
        vastuse_model: response.model,
        vastuse_reasoning_effort: response.reasoning?.effort ?? null,
        vastuse_text_verbosity: response.text?.verbosity ?? null,
        status: response.status,
        incomplete_reason: response.incomplete_details?.reason ?? null,
        input_tokens: response.usage?.input_tokens ?? null,
        output_tokens: response.usage?.output_tokens ?? null,
        latency_ms: Date.now() - startedAt
      },
      null,
      1
    )
  );
  const saadetud = summarize(payload);
  const kattub =
    response.model?.startsWith(saadetud.model) &&
    (response.reasoning?.effort ?? saadetud.reasoning_effort) === saadetud.reasoning_effort &&
    (response.text?.verbosity ?? saadetud.text_verbosity) === saadetud.text_verbosity;
  console.log(kattub ? "\nPAYLOAD_OK" : "\nPAYLOAD_MISMATCH");
  process.exit(kattub ? 0 : 1);
} catch (error) {
  console.error("\nAPI viga:", error?.status || "", error?.code || "", error?.message || String(error));
  process.exit(3);
}
