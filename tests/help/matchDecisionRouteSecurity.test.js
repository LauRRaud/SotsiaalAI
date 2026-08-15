import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { validateJsonMutationRequest } from "../../lib/security/jsonMutationRequest.js";

function request(headers = {}) {
  return new Request("https://sotsiaal.ai/api/help/matches/match-1/decision", {
    method: "POST",
    headers
  });
}

test("help-match decisions reject cross-origin and non-JSON browser mutations", () => {
  assert.equal(validateJsonMutationRequest(request({
    origin: "https://evil.example",
    "sec-fetch-site": "cross-site",
    "content-type": "text/plain"
  })), false);
  assert.equal(validateJsonMutationRequest(request({
    origin: "https://attacker.sotsiaal.ai",
    "sec-fetch-site": "same-site",
    "content-type": "application/json"
  })), false);
  assert.equal(validateJsonMutationRequest(request({
    origin: "https://sotsiaal.ai",
    "sec-fetch-site": "same-origin",
    "content-type": "text/plain"
  })), false);
  assert.equal(validateJsonMutationRequest(request({
    origin: "https://sotsiaal.ai",
    "sec-fetch-site": "same-origin",
    "content-type": "application/json; charset=utf-8"
  })), true);
});

test("help-match decision route validates the request before parsing its body", () => {
  const source = fs.readFileSync("app/api/help/matches/[matchId]/decision/route.js", "utf8");
  const validation = source.indexOf("validateJsonMutationRequest(request)");
  const parsing = source.indexOf("request.json()");
  assert.ok(validation >= 0, "route must validate the mutation request");
  assert.ok(parsing > validation, "route must validate before parsing the decision body");
});
