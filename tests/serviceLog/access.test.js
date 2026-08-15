import test from "node:test";
import assert from "node:assert/strict";

import { cookieSourceFromRequest } from "../../lib/serviceLog/cookies.js";

test("cookie source tolerates malformed percent encoding without losing other cookies", () => {
  const cookies = cookieSourceFromRequest(
    new Request("http://localhost", {
      headers: { cookie: "bad=%E0%A4%A; sotsiaalai_admin_view_role=SERVICE_PROVIDER" }
    })
  );

  assert.equal(cookies.get("bad")?.value, "%E0%A4%A");
  assert.equal(cookies.get("sotsiaalai_admin_view_role")?.value, "SERVICE_PROVIDER");
});

test("cookie source still decodes valid encoded values", () => {
  const cookies = cookieSourceFromRequest(
    new Request("http://localhost", { headers: { cookie: "role=SERVICE%5FPROVIDER" } })
  );

  assert.equal(cookies.get("role")?.value, "SERVICE_PROVIDER");
});
