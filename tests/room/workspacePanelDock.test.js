import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getDashboardInfoContent } from "../../lib/dashboardInfoContent.js";
import { panelHasRoomDock } from "../../lib/roomDock.js";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const t = (_key, fallback = "") => fallback;

test("Töölaua sisuleht saab alumise doki, Vestlus ise jääb dokita", () => {
  assert.equal(panelHasRoomDock("/vestlus"), false);
  assert.equal(panelHasRoomDock("/vestlus", { workspace: "" }), false);
  assert.equal(panelHasRoomDock("/vestlus", { workspace: "documents" }), true);
  assert.equal(panelHasRoomDock("/vestlus", { workspace: "document_drafting" }), true);
  assert.equal(panelHasRoomDock("/vestlus", { workspace: "help_requests" }), true);
  assert.equal(panelHasRoomDock("/teekond", { workspace: "documents" }), false);
});

test("mõlemad doki omanikud kasutavad workspace-parameetrit ja Töölaua komplekti", async () => {
  const [frame, stage, workspaceCss] = await Promise.all([
    read("components/room/PanelFrame.jsx"),
    read("components/room/RoomStage.jsx"),
    read("app/styles/workspace.css")
  ]);

  assert.match(frame, /panelHasRoomDock\(normalized, \{ workspace: workspaceParam \}\)/);
  assert.match(frame, /const isConversationSurface = isConversation && !isWorkspaceView/);
  assert.match(frame, /data-conversation=\{isConversationSurface \? "1" : "0"\}/);
  assert.match(stage, /panelHasRoomDock\(normalized, \{ workspace: workspaceParam \}\)/);
  assert.match(stage, /else if \(isWorkspacePanelRoute\) nextDockHub = "\/toolaud"/);
  assert.match(
    workspaceCss,
    /@media \(max-width: 768px\)[\s\S]*\.panel-scrim\[data-chat="1"\]\[data-dock="1"\] \.panel-body\s*\{[^}]*padding-bottom:\s*var\(--room-dock-reserve\)/,
    "mobiili Töölaua sisuleht peab jätma dokile ruumi ka pärast chat.css polstrireeglit"
  );
});

test("iga dokki saav kujundamata Töölaua vaade avaldab lehekohase info", async () => {
  const infoIds = [
    "documents",
    "document_drafting",
    "materials",
    "pre_inquiry",
    "intake",
    "help_requests",
    "help_offers"
  ];

  for (const infoId of infoIds) {
    const content = getDashboardInfoContent(t, infoId);
    assert.ok(content?.title, `${infoId}: info pealkiri puudub`);
    assert.ok(content?.details?.length, `${infoId}: lehe info sisu puudub`);
  }

  const panel = await read("components/chat/WorkspacePanel.jsx");
  assert.match(
    panel,
    /activeEmbeddedFeature === "pre_inquiries" && activeRole === "CLIENT"\s*\? "pre_inquiry"\s*:\s*activeEmbeddedMeta\?\.infoId/,
    "kliendi eelpöördumine peab näitama kliendi, mitte vastuvõtulaua infot"
  );
});
