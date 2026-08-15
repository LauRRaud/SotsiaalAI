import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { isSameOriginRequest } from "../../lib/security/sameOriginRequest.js";

function request(origin, url = "https://sotsiaal.ai/api/service-provider/profile") {
  return new Request(url, {
    method: "POST",
    headers: origin === undefined ? {} : { Origin: origin }
  });
}

test("availability mutations accept only an explicit exact same-origin header", () => {
  assert.equal(isSameOriginRequest(request("https://sotsiaal.ai")), true);
  assert.equal(isSameOriginRequest(request("https://evil.example")), false);
  assert.equal(isSameOriginRequest(request("https://sotsiaal.ai.evil.example")), false);
  assert.equal(isSameOriginRequest(request(undefined)), false);
  assert.equal(isSameOriginRequest(request("not a URL")), false);
});

test("both availability mutation routes enforce the shared origin boundary", async () => {
  const routes = [
    "app/api/admin/service-availability/route.js",
    "app/api/service-provider/profile/services/[serviceId]/availability-confirmation/route.js"
  ];

  for (const route of routes) {
    const source = await readFile(new URL(`../../${route}`, import.meta.url), "utf8");
    assert.match(source, /if \(!isSameOriginRequest\(request\)\) return errorJson\("api\.common\.forbidden", 403, locale\);/);
  }
});
