import assert from "node:assert/strict";
import test from "node:test";

import {
  encoderInfoForTests,
  measurePromptComponents,
  resetPromptTokenAuditEncoderForTests,
  withInputTokenGap
} from "@/lib/chat/promptTokenAudit";

const COMPONENTS = {
  system: "Sa oled SotsiaalAI abiline sotsiaaltöötajale.",
  user: "Kas Jõhvi vallas saab isikliku abistaja teenust?",
  history: [
    { role: "user", content: "Tere" },
    { role: "ai", content: "Tere, kuidas saan aidata?" }
  ],
  sourcePackage: "RAG_CONTEXT: Sotsiaalhoolekande seadus § 27 Isikliku abistaja teenus.",
  tools: null,
  otherDynamic: ["Vasta eesti keeles.", "Kasuta RAG_CONTEXT-i faktiväidete jaoks."]
};

test("mõõdab iga komponendi märgid, hinnangulised tokenid ja hashi", async () => {
  resetPromptTokenAuditEncoderForTests();
  const m = await measurePromptComponents({ components: COMPONENTS, model: "gpt-5.6-luna" });

  assert.equal(m.tokenizer_ok, true);
  for (const name of ["system_prompt", "user_input", "conversation_history", "source_package", "other_dynamic"]) {
    assert.ok(m[`${name}_chars`] > 0, `${name}_chars`);
    assert.ok(m[`${name}_tokens_estimated`] > 0, `${name}_tokens_estimated`);
    assert.match(m[`${name}_sha256_12`], /^[0-9a-f]{12}$/);
  }
  // Tööriistu ei saadeta mudelile — komponent on olemas, aga tühi.
  assert.equal(m.tool_definitions_chars, 0);
  assert.equal(m.tool_definitions_sha256_12, null);
});

test("tundmatu mudel langeb tagasi o200k_base peale", async () => {
  resetPromptTokenAuditEncoderForTests();
  await measurePromptComponents({ components: COMPONENTS, model: "gpt-5.6-luna" });
  const info = encoderInfoForTests();
  assert.equal(info.encoding, "o200k_base");
  assert.equal(info.source, "fallback");
});

test("estimated_component_sum on komponentide summa", async () => {
  resetPromptTokenAuditEncoderForTests();
  const m = await measurePromptComponents({ components: COMPONENTS, model: "gpt-5.6-luna" });
  const parts = [
    "system_prompt",
    "user_input",
    "conversation_history",
    "source_package",
    "tool_definitions",
    "other_dynamic"
  ].reduce((sum, name) => sum + (m[`${name}_tokens_estimated`] || 0), 0);
  assert.equal(m.estimated_component_sum, parts);
});

test("input_token_gap arvutatakse API väärtusest, mitte vastupidi", async () => {
  resetPromptTokenAuditEncoderForTests();
  const m = await measurePromptComponents({ components: COMPONENTS, model: "gpt-5.6-luna" });
  const withGap = withInputTokenGap(m, m.estimated_component_sum + 40);
  assert.equal(withGap.input_token_gap, 40);
  assert.ok(withGap.input_token_gap_pct > 0);
  assert.match(withGap.estimate_note, /hinnangulised/);
});

test("puuduv API-arv annab nulli, mitte väljamõeldud lõhe", async () => {
  resetPromptTokenAuditEncoderForTests();
  const m = await measurePromptComponents({ components: COMPONENTS, model: "gpt-5.6-luna" });
  const withGap = withInputTokenGap(m, undefined);
  assert.equal(withGap.api_input_tokens, null);
  assert.equal(withGap.input_token_gap, null);
  assert.equal(withGap.input_token_gap_pct, null);
});

test("tühjad komponendid ei kukuta mõõtmist", async () => {
  resetPromptTokenAuditEncoderForTests();
  const m = await measurePromptComponents({ components: {}, model: "gpt-5.6-luna" });
  assert.equal(m.tokenizer_ok, true);
  assert.equal(m.system_prompt_chars, 0);
  assert.equal(m.estimated_component_sum, 0);
});

test("sisu ennast ei lekita väljundisse", async () => {
  resetPromptTokenAuditEncoderForTests();
  const m = await measurePromptComponents({ components: COMPONENTS, model: "gpt-5.6-luna" });
  const serialized = JSON.stringify(m);
  assert.ok(!serialized.includes("RAG_CONTEXT"));
  assert.ok(!serialized.includes("Jõhvi"));
  assert.ok(!serialized.includes("SotsiaalAI abiline"));
});
