import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const component = readFileSync(resolve(root, "components/workspace/WorkspaceFeaturePage.jsx"), "utf8");
const routePath = resolve(root, "app/api/pre-inquiries/organization-recipients/route.js");

test("pre-inquiry UI loads a dedicated organization intake projection", () => {
  assert.equal(existsSync(routePath), true);
  assert.match(component, /\/api\/pre-inquiries\/organization-recipients/u);
  assert.match(component, /recipientOrganizationId:\s*selectedRecipient\?\.recipientOrganizationId/u);
  assert.match(component, /activeInquiry\?\.recipientOrganizationId/u);
  assert.match(component, /recipientEntryId:\s*selectedRecipient\?\.type === "ORGANIZATION_INBOX" \? null/u);
  assert.match(component, /ORGANIZATION_INBOX/u);
  assert.match(component, /organization_inbox/u);
});

test("opening an organization inquiry restores its server-issued recipient selection", () => {
  assert.match(component, /organization-inbox:\$\{inquiry\.recipientOrganizationId\}/u);
  assert.match(component, /inquiry\.recipientOrganization\?\.displayName/u);
});
