import test from "node:test";
import assert from "node:assert/strict";

import { getHelpListingsReturnTarget } from "../../lib/chat/helpListingsReturnTarget.js";

test("help listings opened from workspace return to workspace", () => {
  assert.equal(getHelpListingsReturnTarget("workspace"), "workspace");
});

test("help listings opened from profile return to profile", () => {
  assert.equal(getHelpListingsReturnTarget("profile"), "profile");
});

test("help listings opened from chat close back to chat", () => {
  assert.equal(getHelpListingsReturnTarget("chat"), "chat");
  assert.equal(getHelpListingsReturnTarget(""), "chat");
});
