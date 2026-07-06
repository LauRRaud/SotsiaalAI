import assert from "node:assert/strict";
import test from "node:test";

import { createWorkspaceDashboardRows } from "../../lib/workspaceDashboardCards.js";

const noop = () => {};

function flatten(rows) {
  return rows.flat();
}

function inviteCardFor(role) {
  return flatten(createWorkspaceDashboardRows({
    activeRole: role,
    hasPaidAccess: true,
    t: (_key, fallback) => fallback,
    navigateTo: noop,
    openHelpPanel: noop,
    openInvite: noop
  })).find((card) => card.key === "add_person");
}

test("workspace add-person card uses an action title instead of the invite-list title", () => {
  for (const role of ["CLIENT", "SOCIAL_WORKER", "SERVICE_PROVIDER"]) {
    const card = inviteCardFor(role);

    assert.ok(card, `${role} dashboard should include add-person card`);
    assert.equal(card.title, "Lisa inimene");
    assert.equal(card.meta, "Kutsed");
  }
});
