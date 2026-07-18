import test from "node:test";
import assert from "node:assert/strict";
import { access, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ActionKind, ACTION_REGISTRY, buildActionHref } from "../../lib/actions/registry.js";

const APP_DIR = fileURLToPath(new URL("../../app/", import.meta.url));

// Resolve a route path (possibly containing dynamic segments like a relation id)
// to the matching app/ directory, substituting a single `[param]` directory
// where the literal segment does not exist. Ensures every action deep-link
// points at a real page, including path-segment routes such as /mentorlus/suhe.
async function resolvePageDir(route) {
  const segments = route.split("/").filter(Boolean);
  let dir = APP_DIR;
  for (const segment of segments) {
    const literal = path.join(dir, segment);
    try {
      await access(literal);
      dir = literal;
      continue;
    } catch {
      const entries = await readdir(dir, { withFileTypes: true });
      const dynamic = entries.find((entry) => entry.isDirectory() && /^\[.+\]$/u.test(entry.name));
      assert.ok(dynamic, `No literal or dynamic segment for "${segment}" in ${dir}`);
      dir = path.join(dir, dynamic.name);
    }
  }
  return dir;
}

test("action registry builds only application-owned links", async () => {
  assert.equal(buildActionHref(ActionKind.OPEN_PRE_INQUIRY_SENT, "pre_inquiry:inq-1"), "/eelpoordumised?openInquiry=inq-1");
  assert.equal(buildActionHref(ActionKind.OPEN_ROOM, "room:room-1"), "/vestlus?roomId=room-1");
  assert.equal(buildActionHref(ActionKind.OPEN_MENTORING_RELATION, "mentoring_relation:rel-1"), "/mentorlus/suhe/rel-1");
  assert.throws(() => buildActionHref(ActionKind.OPEN_ROOM, "https://evil.example/x"), { code: "INVALID_ACTION_TARGET" });
  assert.throws(() => buildActionHref("caller_url", "anything"), { code: "UNKNOWN_ACTION_KIND" });
  for (const [kind, value] of Object.entries(ACTION_REGISTRY)) {
    const href = value.route(kind === ActionKind.OPEN_WORKSPACE ? "room:test-id" : "test-id");
    const route = href.split("?")[0].replace(/^\//u, "");
    const dir = await resolvePageDir(route);
    await access(path.join(dir, "page.jsx")).catch(async () => {
      await access(path.join(dir, "page.js"));
    });
  }
});
