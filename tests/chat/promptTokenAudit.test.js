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
    assert.ok(m.components[name].chars > 0, `${name}.chars`);
    assert.ok(m.components[name].tokens_estimated > 0, `${name}.tokens_estimated`);
    assert.match(m.components[name].sha256_12, /^[0-9a-f]{12}$/);
  }
  // Tööriistu ei saadeta mudelile — komponent on olemas, aga tühi.
  assert.equal(m.components.tool_definitions.chars, 0);
  assert.equal(m.components.tool_definitions.sha256_12, null);
});

test("komponendid on pesastatud, et redactObject 30-võtme lagi neid ei kärbiks", async () => {
  resetPromptTokenAuditEncoderForTests();
  const m = await measurePromptComponents({ components: COMPONENTS, model: "gpt-5.6-luna" });
  const withGap = withInputTokenGap(m, 2000);
  // Sündmuse ülemine tase peab jääma tublisti alla 30 võtme (logEvent lisab veel
  // model/route/stage/max_output_tokens/reasoning_effort/text_verbosity/userId/role).
  assert.ok(Object.keys(withGap).length <= 16, `ülemisi võtmeid: ${Object.keys(withGap).length}`);
  assert.equal(typeof withGap.components, "object");
  assert.equal(Object.keys(withGap.components).length, 6);
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
  const parts = Object.values(m.components).reduce((sum, c) => sum + (c.tokens_estimated || 0), 0);
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
  assert.equal(m.components.system_prompt.chars, 0);
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
