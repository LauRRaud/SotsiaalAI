import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync(new URL("../../components/workspace/WorkspaceFeaturePage.jsx", import.meta.url), "utf8");
const preInquiryStart = workspace.indexOf("function PreInquiriesSurface");
const preInquiryEnd = workspace.indexOf("function hasServiceMapCoordinates", preInquiryStart);
const preInquiry = workspace.slice(preInquiryStart, preInquiryEnd);
const serviceProfile = workspace.slice(workspace.indexOf("function serviceProfileCommunicationSupportOptions"));

test("plain mode exposes two explicit collection views and one active panel", () => {
  assert.match(preInquiry, /const \[plainCollectView, setPlainCollectView\] = useState\("form"\)/);
  assert.match(preInquiry, /aria-pressed=\{plainCollectView === "form"\}/);
  assert.match(preInquiry, /aria-pressed=\{plainCollectView === "assistant"\}/);
  assert.match(preInquiry, /activeWorkflowStep === "collect" && \(!plainLanguage \|\| plainCollectView === "form"\)/);
  assert.match(preInquiry, /activeWorkflowStep === "collect" && \(!plainLanguage \|\| plainCollectView === "assistant"\)/);
});

test("plain mode retains consent, urgency, risk and original save payload", () => {
  assert.match(preInquiry, /fields\.consent/);
  assert.match(preInquiry, /fields\.urgency/);
  assert.match(preInquiry, /riskGate\.userVisibleMessage/);
  assert.match(preInquiry, /assessmentState:\s*assessmentStateForSave/);
  assert.doesNotMatch(preInquiry, /plainLanguage[^\n]*(?:draft|situation|assessmentState)\s*=/);
});

test("reader preference is not coupled to provider simple-language capability", () => {
  assert.doesNotMatch(preInquiry, /simple_language/);
  assert.doesNotMatch(serviceProfile, /plainLanguage/);
  assert.match(serviceProfile, /communication_support_options\.simple_language/);
});
