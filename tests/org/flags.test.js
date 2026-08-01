import test from "node:test";
import assert from "node:assert/strict";

import {
  OrgFeatureDisabledError,
  assertOrgCreationEnabled,
  assertOrgWorkspaceEnabled,
  isOrgCreationEnabled,
  isOrgWorkspaceEnabled,
  readOrgFlags
} from "../../lib/org/flags.js";

test("every gate is off when the environment says nothing", () => {
  assert.deepEqual(readOrgFlags({}), { workspaceEnabled: false, creationEnabled: false });
});

test("only an explicit affirmative opens a gate — junk is off, not on", () => {
  for (const value of ["1", "true", "TRUE", "yes", "on", " On "]) {
    assert.equal(isOrgWorkspaceEnabled({ ORG_WORKSPACE_ENABLED: value }), true, `${value} should enable`);
  }
  for (const value of ["", "0", "false", "no", "off", "maybe", "enabled", undefined, null]) {
    assert.equal(isOrgWorkspaceEnabled({ ORG_WORKSPACE_ENABLED: value }), false, `${value} must stay closed`);
  }
});

test("creation requires BOTH gates — an org nobody can open must not be creatable", () => {
  assert.equal(isOrgCreationEnabled({ ORG_CREATION_ENABLED: "1" }), false);
  assert.equal(
    isOrgCreationEnabled({ ORG_CREATION_ENABLED: "1", ORG_WORKSPACE_ENABLED: "1" }),
    true
  );
  assert.equal(
    isOrgCreationEnabled({ ORG_CREATION_ENABLED: "0", ORG_WORKSPACE_ENABLED: "1" }),
    false
  );
});

test("a closed gate is indistinguishable from a missing page (404, never 403)", () => {
  assert.throws(
    () => assertOrgWorkspaceEnabled({}),
    (error) => {
      assert.ok(error instanceof OrgFeatureDisabledError);
      assert.equal(error.status, 404);
      assert.equal(error.code, "ORG_FEATURE_DISABLED");
      return true;
    }
  );
});

test("creation assertion fails on the workspace gate first", () => {
  assert.throws(
    () => assertOrgCreationEnabled({ ORG_CREATION_ENABLED: "1" }),
    (error) => {
      assert.equal(error.flagKey, "ORG_WORKSPACE_ENABLED");
      return true;
    }
  );
  assert.throws(
    () => assertOrgCreationEnabled({ ORG_WORKSPACE_ENABLED: "1" }),
    (error) => {
      assert.equal(error.flagKey, "ORG_CREATION_ENABLED");
      return true;
    }
  );
});

test("flags are read per call, so a test can never be polluted by import order", () => {
  const env = { ORG_WORKSPACE_ENABLED: "0" };
  assert.equal(isOrgWorkspaceEnabled(env), false);
  env.ORG_WORKSPACE_ENABLED = "1";
  assert.equal(isOrgWorkspaceEnabled(env), true);
});
