import assert from "node:assert/strict";
import test from "node:test";

import { extractOpenAIUsage } from "@/lib/openaiUsage";

function fullResponse(overrides = {}) {
  return {
    status: "completed",
    max_output_tokens: 1100,
    usage: {
      input_tokens: 4166,
      input_tokens_details: { cached_tokens: 4163 },
      output_tokens: 820,
      output_tokens_details: { reasoning_tokens: 166 },
      total_tokens: 4986
    },
    ...overrides
  };
}

test("täielikust vastusest loetakse kõik nõutud lõpetamis- ja kasutusväljad", () => {
  const out = extractOpenAIUsage(fullResponse());
  assert.equal(out.response_present, true);
  assert.equal(out.status, "completed");
  assert.equal(out.incomplete_reason, null);
  assert.equal(out.max_output_tokens, 1100);
  assert.equal(out.input_tokens, 4166);
  assert.equal(out.cached_tokens, 4163);
  assert.equal(out.output_tokens, 820);
  assert.equal(out.reasoning_tokens, 166);
  assert.equal(out.total_tokens, 4986);
});

test("nähtav väljund on output miinus reasoning", () => {
  const out = extractOpenAIUsage(fullResponse());
  assert.equal(out.visible_output_tokens, 654);
});

test("kärbe tuvastatakse API väljadest, mitte tekstist", () => {
  const capped = extractOpenAIUsage(
    fullResponse({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      usage: {
        input_tokens: 4166,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: 1100,
        output_tokens_details: { reasoning_tokens: 1034 },
        total_tokens: 5266
      }
    })
  );
  assert.equal(capped.status, "incomplete");
  assert.equal(capped.incomplete_reason, "max_output_tokens");
  assert.equal(capped.output_cap_reached, true);
  assert.equal(capped.visible_output_tokens, 66);
});

test("terve vastus ei ole kärbitud", () => {
  assert.equal(extractOpenAIUsage(fullResponse()).output_cap_reached, false);
});

test("puuduv vastus eristub puuduvast väljast", () => {
  const missing = extractOpenAIUsage(null);
  assert.equal(missing.response_present, false);
  assert.equal(missing.status, null);
  assert.equal(missing.output_tokens, null);
  assert.equal(missing.output_cap_reached, null);
  assert.equal(missing.visible_output_tokens, null);

  const noUsage = extractOpenAIUsage({ status: "completed" });
  assert.equal(noUsage.response_present, true);
  assert.equal(noUsage.status, "completed");
  assert.equal(noUsage.output_tokens, null);
  assert.equal(noUsage.output_cap_reached, null);
});

test("tühjad ja vigased stringid normaliseeritakse nulliks", () => {
  const out = extractOpenAIUsage({ status: "   ", incomplete_details: { reason: "" } });
  assert.equal(out.status, null);
  assert.equal(out.incomplete_reason, null);
});
