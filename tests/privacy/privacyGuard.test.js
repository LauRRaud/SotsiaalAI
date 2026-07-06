import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateTextPrivacy, PRIVACY_DECISIONS } from "../../lib/privacy/privacyGuard.js";
import { redactPersonalData } from "../../lib/privacy/piiFilter.js";
import { getOpenAIPrivacyFilterConfig } from "../../lib/privacy/openaiPrivacyFilter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("privacy guard pauses public listings and does not allow original send", () => {
  const result = evaluateTextPrivacy("Elan Tamme tn 12 ja telefon 51234567.", {
    workflow: "help_request_public"
  });

  assert.equal(result.needsPrivacyConfirmation, true);
  assert.equal(result.allowOriginal, false);
  assert.deepEqual(result.actions, [
    PRIVACY_DECISIONS.edit,
    PRIVACY_DECISIONS.useRedacted
  ]);
  assert.match(result.redactedText, /\[aadress\]/);
  assert.match(result.redactedText, /\[telefoninumber\]/);
});

test("privacy guard allows explicit original send in private workflows", () => {
  const result = evaluateTextPrivacy("Minu telefon on 51234567.", {
    workflow: "chat_private",
    privacyDecision: { action: "send_original" }
  });

  assert.equal(result.needsPrivacyConfirmation, false);
  assert.equal(result.processedText, "Minu telefon on 51234567.");
  assert.equal(result.appliedDecision, "send_original");
});

test("privacy guard uses redacted text when user chooses masked send", () => {
  const result = evaluateTextPrivacy("Kirjuta aadressile mari@example.com.", {
    workflow: "document_generation",
    privacyDecision: { action: "use_redacted" }
  });

  assert.equal(result.needsPrivacyConfirmation, false);
  assert.equal(result.processedText, "Kirjuta aadressile [e-posti aadress].");
  assert.equal(result.appliedDecision, "use_redacted");
});

test("redactor replaces common personal data before downstream use", () => {
  const result = redactPersonalData("Kontakt: mari@example.com, telefon 51234567, Tamme tn 12.");

  assert.match(result.redactedText, /\[e-posti aadress\]/);
  assert.match(result.redactedText, /\[telefoninumber\]/);
  assert.match(result.redactedText, /\[aadress\]/);
});

test("privacy guard is wired into document sources, public listing edits and pre-inquiry save", () => {
  const sourceMaterialSource = readFileSync(resolve(__dirname, "../../lib/documents/sourceMaterial.js"), "utf8");
  const generationSource = readFileSync(resolve(__dirname, "../../lib/documents/generation.js"), "utf8");
  const helpListingRouteSource = readFileSync(resolve(__dirname, "../../app/api/help/listings/[kind]/[id]/route.js"), "utf8");
  const preInquirySource = readFileSync(resolve(__dirname, "../../lib/preInquiries.js"), "utf8");
  const piiFilterSource = readFileSync(resolve(__dirname, "../../lib/privacy/piiFilter.js"), "utf8");
  const openaiFilterSource = readFileSync(resolve(__dirname, "../../lib/privacy/openaiPrivacyFilter.js"), "utf8");

  assert.match(sourceMaterialSource, /redactDocumentSourceText\(rawText\)/);
  assert.match(generationSource, /redactPersonalData\(evidenceText\)\.redactedText/);
  assert.match(generationSource, /redactPersonalData\(currentContent\)\.redactedText/);
  assert.match(helpListingRouteSource, /redactPublicListingPayload/);
  assert.match(helpListingRouteSource, /redactPersonalData\(nextPayload\[field\]\)\.redactedText/);
  assert.match(preInquirySource, /evaluatePreInquiryPrivacy/);
  assert.match(preInquirySource, /privacyConfirmationResponsePayload/);
  assert.match(piiFilterSource, /runOpenAIPrivacyFilter/);
  assert.match(openaiFilterSource, /from opf import OPF/);
});

test("OpenAI Privacy Filter adapter is disabled unless explicitly configured", () => {
  const previous = process.env.PRIVACY_FILTER_PROVIDER;
  delete process.env.PRIVACY_FILTER_PROVIDER;
  try {
    const config = getOpenAIPrivacyFilterConfig();
    assert.equal(config.enabled, false);
    assert.equal(config.provider, "local_regex");
  } finally {
    if (previous === undefined) {
      delete process.env.PRIVACY_FILTER_PROVIDER;
    } else {
      process.env.PRIVACY_FILTER_PROVIDER = previous;
    }
  }
});
