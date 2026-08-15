import test from "node:test";
import assert from "node:assert/strict";

import { openExternalNavigation } from "../../lib/serviceLog/externalNavigation.js";

test("external navigator receives client locations only after explicit confirmation", () => {
  const opened = [];
  const url = "https://waze.com/ul?q=Kolde%20tn%206&navigate=yes";

  assert.equal(openExternalNavigation(url, "warning", {
    confirm: () => false,
    open: (...args) => opened.push(args)
  }), false);
  assert.deepEqual(opened, [], "declining must not disclose the URL to the navigator");

  assert.equal(openExternalNavigation(url, "warning", {
    confirm: (message) => message === "warning",
    open: (...args) => opened.push(args)
  }), true);
  assert.deepEqual(opened, [[url, "_blank", "noopener,noreferrer"]]);
});
