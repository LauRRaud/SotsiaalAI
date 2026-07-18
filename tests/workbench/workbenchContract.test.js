import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("workbench keeps one primary action before secondary layers and reuses sharings route", async () => {
  const panel = await readFile(
    new URL("../../components/chat/WorkspacePanel.jsx", import.meta.url),
    "utf8"
  );
  const continuity = await readFile(
    new URL("../../components/workspace/WorkspaceContinuity.jsx", import.meta.url),
    "utf8"
  );

  assert.ok(panel.indexOf("<WorkspaceContinuity") < panel.indexOf("<NotificationCenter"));
  assert.ok(panel.indexOf("<NotificationCenter") < panel.indexOf("workspace-tools-drawer"));
  assert.match(panel, /navigateTo\("\/minu-jagamised"\)/u);
  assert.match(continuity, /const primary = items\[0\] \|\| null/u);
  assert.match(continuity, /const waiting = items\.slice\(1\)/u);
  assert.match(continuity, /<details className="workspace-continuity-waiting">/u);
});

test("role changes clear old server data before requesting the new view", async () => {
  const panel = await readFile(
    new URL("../../components/chat/WorkspacePanel.jsx", import.meta.url),
    "utf8"
  );
  const clearIndex = panel.indexOf('setContinuity({ status: "loading", items: [], badges: {}, role: nextRole })');
  const reloadIndex = panel.indexOf("reloadWorkbench();", clearIndex);
  assert.ok(clearIndex > 0);
  assert.ok(reloadIndex > clearIndex);
  assert.match(panel, /refreshKey=\{`\$\{dashboardRole\}:\$\{workbenchRefreshKey\}`\}/u);
});

test("workbench feature flag has a safe legacy fallback", async () => {
  const panel = await readFile(
    new URL("../../components/chat/WorkspacePanel.jsx", import.meta.url),
    "utf8"
  );
  assert.match(panel, /NEXT_PUBLIC_WORKBENCH_V1_ENABLED === "1"/u);
  assert.match(panel, /WORKBENCH_V1_ENABLED \? \(/u);
  assert.match(panel, /featureEnabled=\{WORKBENCH_V1_ENABLED\}/u);
  assert.match(panel, /\) : \(\s*<div>/u);
});

test("stale actions are revalidated without exposing target content", async () => {
  const panel = await readFile(
    new URL("../../components/chat/WorkspacePanel.jsx", import.meta.url),
    "utf8"
  );
  assert.match(panel, /fetch\("\/api\/workspace\/continuity"/u);
  assert.match(panel, /candidate\.id === item\.id && candidate\.kind === item\.kind/u);
  assert.match(panel, /workspace_continuity\.target_gone/u);
  assert.doesNotMatch(panel, /topic|situation|messageContent/u);
});
