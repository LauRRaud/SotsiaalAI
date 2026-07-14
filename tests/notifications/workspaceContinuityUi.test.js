import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("continuity UI has a capped route-safe contract, CAS preference guard, and accessible badge geometry", async () => {
  const [panel, component, css] = await Promise.all([
    readFile(new URL("../../components/chat/WorkspacePanel.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../components/workspace/WorkspaceContinuity.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/styles/workspace.css", import.meta.url), "utf8")
  ]);
  assert.match(panel, /items: Array\.isArray\(payload\.items\) \? payload\.items\.slice\(0, 7\)/u);
  assert.match(panel, /if \(!normalized\.startsWith\("\/"\)\) return/u);
  assert.match(panel, /preferenceRequestRef[\s\S]+requestId !== preferenceRequestRef\.current/u);
  assert.match(component, /aria-labelledby="workspace-continuity-title"/u);
  assert.match(component, /type="checkbox"/u);
  assert.match(css, /\.workspace-dashboard-card \[data-badge-type="number"\][\s\S]+min-width/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]+workspace-continuity/u);
});

test("ET/EN/RU contain every new notification and continuity key", async () => {
  const catalogs = await Promise.all(["et", "en", "ru"].map(async (locale) => JSON.parse(await readFile(
    new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"
  ))));
  const keys = [
    "pre_inquiry_arrived", "pre_inquiry_status_changed", "room_invite", "room_activity",
    "help_match_created", "next_contact_due", "practice_review_assigned",
    "practice_review_overdue", "service_availability_stale"
  ];
  for (const catalog of catalogs) {
    for (const key of keys) assert.equal(typeof catalog.notifications.events[key], "string");
    assert.equal(typeof catalog.workspace_continuity.title, "string");
    assert.equal(typeof catalog.notifications.email_preference, "string");
  }
});
