import test from "node:test";
import assert from "node:assert/strict";

import {
  RESERVED_WORKSPACE_KINDS,
  SUPPORTED_WORKSPACE_KINDS,
  WORKSPACE_KIND_REGISTRY,
  WorkspaceKind,
  WorkspaceKindStatus
} from "../../lib/workspaces/registry.js";
import { assertWorkspaceDescriptor, WorkspaceLifecycle, WorkspaceVisibility } from "../../lib/workspaces/descriptor.js";
import {
  listWorkspaces as listOrgSpaces,
  toOrgSpaceWorkspaceDescriptor
} from "../../lib/workspaces/adapters/orgSpaceAdapter.js";

const VIEWER = "user_a";

function row(overrides = {}) {
  return {
    startedAt: new Date("2026-07-01T00:00:00.000Z"),
    organization: {
      id: "org_1",
      displayName: "X vald",
      status: "ACTIVE",
      updatedAt: new Date("2026-07-20T10:00:00.000Z"),
      ...overrides
    }
  };
}

function makeDb(rows) {
  return {
    organizationMembership: {
      findMany: async ({ where }) =>
        rows.filter(
          (candidate) =>
            where.userId === VIEWER &&
            candidate.organization.status !== "ARCHIVED" &&
            candidate.membershipStatus !== "ENDED"
        )
    }
  };
}

/* O-E0-2: org_space liikus RESERVED → SUPPORTED. */

test("org_space is an activated K1 kind with its own adapter", () => {
  const entry = WORKSPACE_KIND_REGISTRY[WorkspaceKind.ORG_SPACE];
  assert.equal(entry.status, WorkspaceKindStatus.SUPPORTED);
  assert.equal(entry.adapter, "orgSpace");
  assert.ok(SUPPORTED_WORKSPACE_KINDS.includes("org_space"));
  assert.equal(RESERVED_WORKSPACE_KINDS.includes("org_space"), false);
});

test("the descriptor is a valid K1 descriptor and targets its own ref", () => {
  const descriptor = toOrgSpaceWorkspaceDescriptor(row(), VIEWER);
  assert.doesNotThrow(() => assertWorkspaceDescriptor(descriptor));
  assert.equal(descriptor.ref.kind, "org_space");
  assert.equal(descriptor.ref.id, "org_1");
  assert.equal(descriptor.href.target, "org_space:org_1");
});

test("an organisation space is ORG_META — neither private nor participant-shared", () => {
  const descriptor = toOrgSpaceWorkspaceDescriptor(row(), VIEWER);
  assert.equal(descriptor.visibility, WorkspaceVisibility.ORG_META);
});

test("lifecycle mirrors the organisation status", () => {
  assert.equal(toOrgSpaceWorkspaceDescriptor(row({ status: "DRAFT" }), VIEWER).lifecycle, WorkspaceLifecycle.DRAFT);
  assert.equal(
    toOrgSpaceWorkspaceDescriptor(row({ status: "PENDING_VERIFICATION" }), VIEWER).lifecycle,
    WorkspaceLifecycle.DRAFT
  );
  assert.equal(toOrgSpaceWorkspaceDescriptor(row({ status: "ACTIVE" }), VIEWER).lifecycle, WorkspaceLifecycle.ACTIVE);
  assert.equal(
    toOrgSpaceWorkspaceDescriptor(row({ status: "SUSPENDED" }), VIEWER).lifecycle,
    WorkspaceLifecycle.PAUSED
  );
});

test("the descriptor never reports a real member count", () => {
  const descriptor = toOrgSpaceWorkspaceDescriptor(row(), VIEWER);
  // Vaataja ise ja mitte midagi muud — liikmete arv on org-sisene fakt.
  assert.deepEqual(descriptor.participants, { active: 1, invited: 0 });
});

test("the descriptor carries no goal, phase, progress or next action — it holds no content", () => {
  const descriptor = toOrgSpaceWorkspaceDescriptor(row(), VIEWER);
  assert.equal(descriptor.goal, null);
  assert.equal(descriptor.phase, null);
  assert.equal(descriptor.progress, null);
  assert.equal(descriptor.nextAction, null);
});

test("an anonymous caller gets an empty list, never a query", async () => {
  let queried = false;
  const db = { organizationMembership: { findMany: async () => { queried = true; return []; } } };
  assert.deepEqual(await listOrgSpaces("", { db }), []);
  assert.deepEqual(await listOrgSpaces(null, { db }), []);
  assert.equal(queried, false);
});

test("listing returns one valid descriptor per active membership", async () => {
  const rows = [row(), row({ id: "org_2", displayName: "Y OÜ" })];
  const descriptors = await listOrgSpaces(VIEWER, { db: makeDb(rows) });
  assert.equal(descriptors.length, 2);
  for (const descriptor of descriptors) {
    assert.doesNotThrow(() => assertWorkspaceDescriptor(descriptor));
  }
  assert.deepEqual(descriptors.map((descriptor) => descriptor.ref.id), ["org_1", "org_2"]);
});
