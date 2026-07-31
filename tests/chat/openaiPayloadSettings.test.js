import test from "node:test";
import assert from "node:assert/strict";

// Env tuleb seada ENNE mooduli importi: settings.js ja promptBuilder.js loevad
// process.env-i mooduli laadimise ajal. `node --test` annab igale testifailile
// oma protsessi, seega need väärtused ei leki teistesse testidesse.
process.env.OPENAI_MAX_OUTPUT_TOKENS = "1100";
process.env.OPENAI_MAX_OUTPUT_TOKENS_CLIENT = "900";
process.env.OPENAI_MAX_OUTPUT_TOKENS_WORKER = "1200";
process.env.OPENAI_REASONING_EFFORT = "high";
process.env.OPENAI_TEXT_VERBOSITY = "low";

const { toResponsesInput, buildResponsesPayload } = await import(
  "../../lib/chat/promptBuilder.js"
);

const baseArgs = {
  userMessage: "Kas mul on õigus koduteenusele?",
  history: [],
  context: null,
  replyLang: "et"
};

test("vestluse väljundilagi tuleb rollist, mitte globaalsest OPENAI_MAX_OUTPUT_TOKENS-ist", () => {
  const client = toResponsesInput({ ...baseArgs, effectiveRole: "CLIENT" });
  const worker = toResponsesInput({ ...baseArgs, effectiveRole: "SOCIAL_WORKER" });

  assert.equal(client.max_output_tokens, 900, "CLIENT peab saama _CLIENT väärtuse");
  assert.equal(worker.max_output_tokens, 1200, "SOCIAL_WORKER peab saama _WORKER väärtuse");
  assert.notEqual(
    client.max_output_tokens,
    1100,
    "globaalne OPENAI_MAX_OUTPUT_TOKENS ei tohi rollipõhist jaotust nullida"
  );
});

test("selgesõnaline maxOutputTokens võidab rollipõhise lae", () => {
  const input = toResponsesInput({
    ...baseArgs,
    effectiveRole: "CLIENT",
    maxOutputTokens: 300
  });

  assert.equal(input.max_output_tokens, 300);
});

test("tundmatu roll langeb kliendi laele", () => {
  const input = toResponsesInput({ ...baseArgs, effectiveRole: "DEFAULT" });
  assert.equal(input.max_output_tokens, 900);
});

test("reasoning.effort ja text.verbosity tulevad env-ist", () => {
  const payload = buildResponsesPayload({ model: "test-model", input: [] });

  assert.equal(payload.reasoning.effort, "high", "effort peab olema env-ist loetav");
  assert.equal(payload.text.verbosity, "low", "verbosity peab olema env-ist loetav");
});

test("selgesõnalised options võidavad env-i", () => {
  const payload = buildResponsesPayload(
    { model: "test-model", input: [] },
    { effort: "minimal", verbosity: "high" }
  );

  assert.equal(payload.reasoning.effort, "minimal");
  assert.equal(payload.text.verbosity, "high");
});

test("vigane või tühi env-väärtus langeb tagasi vaikeväärtusele", async () => {
  process.env.OPENAI_REASONING_EFFORT = "ultra";
  process.env.OPENAI_TEXT_VERBOSITY = "";

  // Päringustring sunnib ESM-i värske mooduliinstantsi laadima, et muudetud
  // env uuesti läbi valideerija käiks.
  const settings = await import("../../lib/chat/settings.js?reload=invalid-enums");

  assert.equal(settings.OPENAI_REASONING_EFFORT, "low");
  assert.equal(settings.OPENAI_TEXT_VERBOSITY, "medium");
});
