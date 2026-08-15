import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { isTrustedReportExportRequest } from "../../lib/serviceLog/exportRequest.js";

function request(headers = {}) {
  return new Request("https://sotsiaal.ai/api/service-reports/export?month=2026-07", { headers });
}

test("report archival rejects cross-site and same-site navigations", () => {
  assert.equal(isTrustedReportExportRequest(request({ "Sec-Fetch-Site": "cross-site" })), false);
  assert.equal(isTrustedReportExportRequest(request({ "Sec-Fetch-Site": "same-site" })), false);
});

test("report archival accepts application and explicit browser navigations", () => {
  assert.equal(isTrustedReportExportRequest(request({ "Sec-Fetch-Site": "same-origin" })), true);
  assert.equal(isTrustedReportExportRequest(request({ "Sec-Fetch-Site": "none" })), true);
});

test("missing Fetch Metadata requires an exact same-origin Origin", () => {
  assert.equal(isTrustedReportExportRequest(request({ Origin: "https://sotsiaal.ai" })), true);
  assert.equal(isTrustedReportExportRequest(request({ Origin: "https://attacker.example" })), false);
  assert.equal(isTrustedReportExportRequest(request()), false);
});

test("export route checks request provenance before auth and archival", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app/api/service-reports/export/route.js"),
    "utf8"
  );
  const provenance = source.indexOf("isTrustedReportExportRequest(req)");
  assert.ok(provenance >= 0);
  assert.ok(provenance < source.indexOf("guardServiceLogRequest(req"));
  assert.ok(provenance < source.indexOf("archiveMonthlyReport({"));
});
