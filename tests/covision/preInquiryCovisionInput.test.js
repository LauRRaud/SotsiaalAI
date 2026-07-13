import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCaseFromPreInquiryDraft,
  buildPreInquiryCovisionCaseInput
} from "../../lib/covisionShared.js";

// A4: pre-inquiry -> Covision anonymity-confirmation forwarding.
// The route (POST /api/pre-inquiries/[id]/covision) was always-400 because it
// built a draft without an anonymity confirmation while normalizeCaseInput
// requires one. The fix forwards body.anonymityConfirmed. These tests pin the
// forwarding contract at the pure-function level.

const inquiry = {
  id: "inq_1",
  topic: "Toimetulek",
  situation: "Kirjeldan olukorda ilma isikuandmeteta."
};

test("buildCaseFromPreInquiryDraft links the source pre-inquiry but never pre-confirms anonymity", () => {
  const draft = buildCaseFromPreInquiryDraft(inquiry);

  assert.equal(draft.sourcePreInquiryId, "inq_1");
  assert.ok(Array.isArray(draft.anonymityIssues));
  assert.equal("anonymityConfirmed" in draft, false, "the draft must not imply confirmation");
  assert.equal(draft.status, "draft");
});

test("buildPreInquiryCovisionCaseInput forwards an explicit true confirmation", () => {
  const draft = buildCaseFromPreInquiryDraft(inquiry);
  const input = buildPreInquiryCovisionCaseInput(draft, { anonymityConfirmed: true });

  assert.equal(input.anonymityConfirmed, true);
  assert.equal(input.sourcePreInquiryId, "inq_1");
  assert.deepEqual(input.participants, []);
});

test("buildPreInquiryCovisionCaseInput leaves confirmation false when the body omits it (route then 400s)", () => {
  const draft = buildCaseFromPreInquiryDraft(inquiry);
  const input = buildPreInquiryCovisionCaseInput(draft, {});

  assert.equal(input.anonymityConfirmed, false);
});

test("buildPreInquiryCovisionCaseInput only accepts a strict boolean true (no truthy coercion)", () => {
  const draft = buildCaseFromPreInquiryDraft(inquiry);

  assert.equal(buildPreInquiryCovisionCaseInput(draft, { anonymityConfirmed: "true" }).anonymityConfirmed, false);
  assert.equal(buildPreInquiryCovisionCaseInput(draft, { anonymityConfirmed: 1 }).anonymityConfirmed, false);
  assert.equal(buildPreInquiryCovisionCaseInput(draft, { anonymityConfirmed: "yes" }).anonymityConfirmed, false);
});

test("buildPreInquiryCovisionCaseInput lets the body override title and central question", () => {
  const draft = buildCaseFromPreInquiryDraft(inquiry);
  const input = buildPreInquiryCovisionCaseInput(draft, {
    anonymityConfirmed: true,
    title: "Kohandatud pealkiri",
    centralQuestion: "Mis on keskne küsimus?"
  });

  assert.equal(input.title, "Kohandatud pealkiri");
  assert.equal(input.centralQuestion, "Mis on keskne küsimus?");
});

test("buildPreInquiryCovisionCaseInput falls back to the draft title/question when body omits them", () => {
  const draft = buildCaseFromPreInquiryDraft(inquiry);
  const input = buildPreInquiryCovisionCaseInput(draft, { anonymityConfirmed: true });

  assert.equal(input.title, draft.title);
  assert.equal(input.centralQuestion, draft.centralQuestion);
});
