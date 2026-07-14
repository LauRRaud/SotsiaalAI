import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync(new URL("../../components/workspace/WorkspaceFeaturePage.jsx", import.meta.url), "utf8");
const map = fs.readFileSync(new URL("../../components/workspace/ServiceMapLeaflet.jsx", import.meta.url), "utf8");
const workspaceCss = fs.readFileSync(new URL("../../app/styles/workspace.css", import.meta.url), "utf8");
const adminRoute = fs.readFileSync(new URL("../../app/api/admin/service-availability/route.js", import.meta.url), "utf8");
const availabilityUi = fs.readFileSync(new URL("../../lib/serviceAvailabilityUi.js", import.meta.url), "utf8");

test("service map and pre-inquiry show textual availability, age and warning", () => {
  assert.match(map, /serviceAvailabilityPresentation/);
  assert.match(map, /availability\.ageText/);
  assert.match(map, /availability\.warning/);
  assert.doesNotMatch(map, /\.style\.(?:background|color)\s*=/);
  assert.match(workspace, /preInquiryAvailabilityNotices/);
  assert.match(workspace, /selectedRecipientAvailabilityNotices/);
  assert.match(workspace, /presentation\.ageText/);
  assert.match(workspace, /presentation\.warning/);
  assert.match(workspace, /pre-inquiry-recipient-card__availability/);
  assert.match(workspaceCss, /\.service-map-canvas \.leaflet-popup-content[\s\S]*max-height:[^;]+;[\s\S]*overflow-y: auto/);
});

test("not_accepting remains a warning and is not used as a map filter", () => {
  assert.match(availabilityUi, /status === "not_accepting"/);
  assert.doesNotMatch(map, /filter\([^\n]*not_accepting/);
  assert.doesNotMatch(workspace, /disabled=.*not_accepting/);
});

test("admin availability endpoint exposes list and reminder dispatch only", () => {
  assert.match(adminRoute, /export async function GET/);
  assert.match(adminRoute, /export async function POST/);
  assert.doesNotMatch(adminRoute, /export async function (PUT|PATCH|DELETE)/);
  assert.doesNotMatch(adminRoute, /confirmServiceAvailabilityForOwner/);
});

test("owner form preserves service identity without leaking it into location state", () => {
  const locationForm = workspace.match(/function createServiceProfileLocationForm[\s\S]*?\r?\n}\r?\n\r?\nfunction createServiceProfileServiceForm/)?.[0] || "";
  const serviceForm = workspace.match(/function createServiceProfileServiceForm[\s\S]*?\r?\n}\r?\n\r?\nfunction createServiceProfileForm/)?.[0] || "";
  assert.doesNotMatch(locationForm, /service\?\.id/);
  assert.match(serviceForm, /id: service\?\.id \|\| ""/);
});
