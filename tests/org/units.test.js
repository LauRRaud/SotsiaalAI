import test from "node:test";
import assert from "node:assert/strict";

import {
  assertUnitPlacement,
  collectSubtree,
  recomputeSubtreeDepths,
  subtreeHeight,
  unitScopeCovers,
  wouldCreateCycle
} from "../../lib/org/units.js";

const ORG = "org_1";
const OTHER_ORG = "org_2";

/**
 * osakond (1)
 *   ├── tiim_a (2)
 *   │     └── alamtiim (3)
 *   └── tiim_b (2)
 * teine_osakond (1)   — õdeharu, mille sisse skoop EI tohi lekkida
 */
function tree() {
  return [
    { id: "osakond", organizationId: ORG, parentUnitId: null, depth: 1, status: "ACTIVE" },
    { id: "tiim_a", organizationId: ORG, parentUnitId: "osakond", depth: 2, status: "ACTIVE" },
    { id: "alamtiim", organizationId: ORG, parentUnitId: "tiim_a", depth: 3, status: "ACTIVE" },
    { id: "tiim_b", organizationId: ORG, parentUnitId: "osakond", depth: 2, status: "ACTIVE" },
    { id: "teine_osakond", organizationId: ORG, parentUnitId: null, depth: 1, status: "ACTIVE" },
    { id: "voeras", organizationId: OTHER_ORG, parentUnitId: null, depth: 1, status: "ACTIVE" }
  ];
}

test("subtree collection includes the root and every descendant", () => {
  assert.deepEqual(collectSubtree("osakond", tree()).sort(), ["alamtiim", "osakond", "tiim_a", "tiim_b"]);
  assert.deepEqual(collectSubtree("alamtiim", tree()), ["alamtiim"]);
});

test("subtree height counts levels, not nodes", () => {
  assert.equal(subtreeHeight("osakond", tree()), 3);
  assert.equal(subtreeHeight("tiim_a", tree()), 2);
  assert.equal(subtreeHeight("tiim_b", tree()), 1);
});

test("a unit cannot be moved into its own subtree", () => {
  assert.equal(wouldCreateCycle("osakond", "tiim_a", tree()), true);
  assert.equal(wouldCreateCycle("osakond", "alamtiim", tree()), true);
  assert.equal(wouldCreateCycle("osakond", "osakond", tree()), true);
  assert.equal(wouldCreateCycle("tiim_a", "teine_osakond", tree()), false);
});

test("cycle detection terminates even if corrupted data already contains a loop", () => {
  const looped = [
    { id: "a", organizationId: ORG, parentUnitId: "b", depth: 1, status: "ACTIVE" },
    { id: "b", organizationId: ORG, parentUnitId: "a", depth: 1, status: "ACTIVE" }
  ];
  assert.deepEqual(collectSubtree("a", looped).sort(), ["a", "b"]);
  assert.ok(Number.isFinite(subtreeHeight("a", looped)));
});

test("creating a root unit is always depth 1", () => {
  const result = assertUnitPlacement({ organizationId: ORG, unitId: null, parentUnitId: null, units: tree() });
  assert.equal(result.depth, 1);
});

test("creating under a depth-2 parent yields depth 3", () => {
  const result = assertUnitPlacement({ organizationId: ORG, unitId: null, parentUnitId: "tiim_a", units: tree() });
  assert.equal(result.depth, 3);
});

test("creating under a depth-3 parent is rejected — V1 supports three levels", () => {
  assert.throws(
    () => assertUnitPlacement({ organizationId: ORG, unitId: null, parentUnitId: "alamtiim", units: tree() }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.messageKey, "org.errors.unit_depth_exceeded");
      return true;
    }
  );
});

/**
 * See on koht, kus naiivne „kontrolli ainult uue vanema sügavust" eksib:
 * `tiim_a` ise mahuks `tiim_b` alla (2+1 = 3), aga tema laps `alamtiim` kukuks
 * tasandile 4.
 */
test("moving a branch checks the WHOLE subtree, not just the moved node", () => {
  assert.throws(
    () => assertUnitPlacement({ organizationId: ORG, unitId: "tiim_a", parentUnitId: "tiim_b", units: tree() }),
    (error) => {
      assert.equal(error.messageKey, "org.errors.unit_depth_exceeded");
      assert.equal(error.details.attemptedDepth, 4);
      return true;
    }
  );
});

test("a leaf may move to depth 3 because its subtree is one level tall", () => {
  const result = assertUnitPlacement({
    organizationId: ORG,
    unitId: "tiim_b",
    parentUnitId: "tiim_a",
    units: tree()
  });
  assert.equal(result.depth, 3);
});

test("moving a unit under a foreign organisation's unit is NOT FOUND, not forbidden", () => {
  assert.throws(
    () => assertUnitPlacement({ organizationId: ORG, unitId: "tiim_a", parentUnitId: "voeras", units: tree() }),
    (error) => {
      // 404, muidu lekiks fakt, et võõras üksus on olemas.
      assert.equal(error.status, 404);
      assert.equal(error.messageKey, "org.errors.unit_not_found");
      return true;
    }
  );
});

test("an archived parent cannot receive new children", () => {
  const units = tree().map((unit) => (unit.id === "tiim_b" ? { ...unit, status: "ARCHIVED" } : unit));
  assert.throws(
    () => assertUnitPlacement({ organizationId: ORG, unitId: null, parentUnitId: "tiim_b", units }),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    }
  );
});

test("moving to root recomputes the whole subtree's depths", () => {
  const depths = recomputeSubtreeDepths("tiim_a", 1, tree());
  assert.equal(depths.get("tiim_a"), 1);
  assert.equal(depths.get("alamtiim"), 2);
  assert.equal(depths.size, 2);
});

/* -------------------------------------------------------------------------
   §11.3: „unit-scope ei leki õdeüksusesse".
   ------------------------------------------------------------------------- */

test("a unit scope covers itself and its subtree", () => {
  assert.equal(unitScopeCovers("osakond", "osakond", tree()), true);
  assert.equal(unitScopeCovers("osakond", "tiim_a", tree()), true);
  assert.equal(unitScopeCovers("osakond", "alamtiim", tree()), true);
});

test("a unit scope never leaks into a sibling or a parent", () => {
  assert.equal(unitScopeCovers("tiim_a", "tiim_b", tree()), false, "sibling must not be covered");
  assert.equal(unitScopeCovers("tiim_a", "osakond", tree()), false, "parent must not be covered");
  assert.equal(unitScopeCovers("osakond", "teine_osakond", tree()), false, "other root must not be covered");
});

test("an empty or missing scope covers nothing", () => {
  assert.equal(unitScopeCovers(null, "tiim_a", tree()), false);
  assert.equal(unitScopeCovers("tiim_a", null, tree()), false);
});
