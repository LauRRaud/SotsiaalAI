import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { ActionKind, ACTION_REGISTRY, buildActionHref } from "../../lib/actions/registry.js";

test("action registry builds only application-owned links", async () => {
  assert.equal(buildActionHref(ActionKind.OPEN_PRE_INQUIRY_SENT, "pre_inquiry:inq-1"), "/eelpoordumised?openInquiry=inq-1");
  assert.equal(buildActionHref(ActionKind.OPEN_ROOM, "room:room-1"), "/vestlus?roomId=room-1");
  assert.throws(() => buildActionHref(ActionKind.OPEN_ROOM, "https://evil.example/x"), { code: "INVALID_ACTION_TARGET" });
  assert.throws(() => buildActionHref("caller_url", "anything"), { code: "UNKNOWN_ACTION_KIND" });
  for (const [kind, value] of Object.entries(ACTION_REGISTRY)) {
    const href = value.route(kind === ActionKind.OPEN_WORKSPACE ? "room:test-id" : "test-id");
    const route = href.split("?")[0].replace(/^\//u, "");
    await access(new URL(`../../app/${route}/page.${route === "rooms" ? "js" : "jsx"}`, import.meta.url)).catch(async () => {
      await access(new URL(`../../app/${route}/page.js`, import.meta.url));
    });
  }
});
