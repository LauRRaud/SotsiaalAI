import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createWorkspaceDashboardRows } from "../../lib/workspaceDashboardCards.js";

function flatten(rows) {
  return rows.flat();
}

const t = (_key, fallback) => fallback;
const noop = () => {};

function cardsFor(role) {
  return flatten(createWorkspaceDashboardRows({
    activeRole: role,
    hasPaidAccess: true,
    t,
    navigateTo: noop,
    openHelpPanel: noop,
    openInvite: noop
  }));
}

test("wellbeing dashboard card is visible only for social workers", () => {
  const socialWorkerCards = cardsFor("SOCIAL_WORKER");
  const clientCards = cardsFor("CLIENT");
  const providerCards = cardsFor("SERVICE_PROVIDER");

  assert.ok(socialWorkerCards.some((card) => card.key === "wellbeing"));
  assert.equal(clientCards.some((card) => card.key === "wellbeing"), false);
  assert.equal(providerCards.some((card) => card.key === "wellbeing"), false);
});

test("wellbeing dashboard card sits next to covision and routes to the real wellbeing page", () => {
  let routedPath = null;
  const rows = createWorkspaceDashboardRows({
    activeRole: "SOCIAL_WORKER",
    hasPaidAccess: true,
    t,
    navigateTo: (path) => {
      routedPath = path;
    },
    openHelpPanel: noop,
    openInvite: noop
  });
  const row = rows.find((items) => items.some((card) => card.key === "kovision"));

  assert.ok(row, "social worker dashboard should include the covision row");
  assert.deepEqual(row.map((card) => card.key), ["kovision", "wellbeing"]);

  const wellbeing = row.find((card) => card.key === "wellbeing");
  assert.equal(wellbeing.title, "Tööheaolu");
  assert.equal(wellbeing.route, "/tooheaolu");
  assert.equal(
    wellbeing.description,
    "Märka töökoormust, vaata ülevaateid ning hoia fookuses taastumine, piirid ja tööprotsessid."
  );
  wellbeing.onClick();
  assert.equal(routedPath, "/tooheaolu");
});

test("wellbeing dashboard icon uses a social support mark instead of a medical pulse", () => {
  const source = readFileSync(new URL("../../components/chat/WorkspacePanel.jsx", import.meta.url), "utf8");
  const wellbeingIcon = source.match(/if \(type === "wellbeing"\) \{[\s\S]*?return \([\s\S]*?<\/svg>[\s\S]*?\);\s*\}/)?.[0] || "";

  assert.match(wellbeingIcon, /M12 1\.85c2\.72 1\.72/);
  assert.match(wellbeingIcon, /translate\(5\.65 4\.55\) scale\(0\.53\)/);
  assert.match(wellbeingIcon, /M9\.3 15H14\.7C16\.8 15 18\.4 16 19 17\.6/);
  assert.match(wellbeingIcon, /<circle cx="12" cy="7" r="4"/);
  assert.doesNotMatch(wellbeingIcon, /M12 20\.25c-/);
  assert.doesNotMatch(wellbeingIcon, /1\.12-2\.7/);
});
