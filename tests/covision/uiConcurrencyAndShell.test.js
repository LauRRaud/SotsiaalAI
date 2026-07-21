import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLatestRequestGate } from "../../lib/client/latestRequestGate.js";
import {
  applyEffectivePracticeView,
  effectivePracticeViewKey,
  parseEffectivePracticeView
} from "../../lib/client/effectivePracticeView.js";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("latest request gate aborts and invalidates stale work deterministically", () => {
  const gate = createLatestRequestGate();
  const first = gate.begin("A");
  assert.equal(first.isCurrent(), true);
  const second = gate.begin("B");
  assert.equal(first.signal.aborted, true);
  assert.equal(first.isCurrent(), false);
  assert.equal(second.isCurrent(), true);
  gate.invalidate();
  assert.equal(second.signal.aborted, true);
  assert.equal(second.isCurrent(), false);
});

test("effective-practice URLs represent exactly one list, detail or editor view", () => {
  assert.deepEqual(parseEffectivePracticeView(""), { kind: "list", id: "" });
  assert.deepEqual(parseEffectivePracticeView("?practice=p-1"), { kind: "detail", id: "p-1" });
  assert.deepEqual(parseEffectivePracticeView("?practice=p-1&editor=edit"), { kind: "editor", id: "p-1" });
  assert.deepEqual(parseEffectivePracticeView("?editor=new"), { kind: "editor", id: "" });
  assert.deepEqual(parseEffectivePracticeView("?editor=unknown&practice=p-2"), { kind: "detail", id: "p-2" });
  assert.deepEqual(parseEffectivePracticeView("?editor=edit"), { kind: "list", id: "" });

  const base = "https://example.test/parimad-praktikad?lang=et&practice=old&editor=edit";
  assert.equal(applyEffectivePracticeView(base, { kind: "list", id: "" }).search, "?lang=et");
  assert.equal(applyEffectivePracticeView(base, { kind: "detail", id: "next" }).search, "?lang=et&practice=next");
  assert.equal(applyEffectivePracticeView(base, { kind: "editor", id: "next" }).search, "?lang=et&practice=next&editor=edit");
  assert.equal(applyEffectivePracticeView(base, { kind: "editor", id: "" }).search, "?lang=et&editor=new");
  assert.equal(effectivePracticeViewKey({ kind: "editor", id: "next" }), "editor:next");
});

test("wide workspaces and the single Kovisioon exit have explicit panel contracts", async () => {
  const [frame, panelCss, live, completedCss, practicesCss] = await Promise.all([
    read("components/room/PanelFrame.jsx"),
    read("app/styles/panel.css"),
    read("components/covision/CovisionLiveSession.jsx"),
    read("app/styles/completed-cases.css"),
    read("app/styles/effective-practices.css")
  ]);
  assert.match(frame, /\["\/teenusekaart", "\/lopetatud-juhtumid", "\/parimad-praktikad"\]\.includes\(normalized\)/);
  assert.equal((frame.match(/className="panel-exit"/g) || []).length, 1);
  assert.doesNotMatch(live, /panel-exit|covision\.live\.exit/);
  assert.match(panelCss, /button\.panel-exit\s*\{[\s\S]*position:\s*absolute[\s\S]*right:[\s\S]*width:\s*auto/);
  // Kanooniline keel: leht elab PanelFrame'i klaasaknas — oma viewport-kesta
  // (100dvh / safe-area) EI ole, kest venib paneeli sees min-height: 100%.
  assert.match(completedCss, /\.ccp-shell \{[^}]*min-height:\s*100%/);
  assert.match(practicesCss, /\.epp-shell \{[^}]*min-height:\s*100%/);
  assert.doesNotMatch(completedCss, /100dvh/);
  assert.doesNotMatch(practicesCss, /100dvh/);
});
