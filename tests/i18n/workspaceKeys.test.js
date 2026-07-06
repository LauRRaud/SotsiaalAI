import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const locales = ["et", "en", "ru"];
const requiredWorkspaceKeys = [
  "chat.workspace.cards.pre_inquiries.title_client",
  "chat.workspace.cards.pre_inquiries.title_staff",
  "chat.workspace.cards.pre_inquiries.meta_client",
  "chat.workspace.cards.pre_inquiries.meta_staff",
  "chat.workspace.view_role.label",
  "workspace_feature_pages.roles.client",
  "workspace_feature_pages.roles.service_provider",
  "workspace_feature_pages.roles.social_worker",
  "workspace_feature_pages.admin_role.label",
  "workspace_feature_pages.admin_role_label",
  "workspace_feature_pages.pre_inquiries.sections.assistant",
  "workspace_feature_pages.pre_inquiries.sections.receiving_settings",
  "workspace_feature_pages.pre_inquiries.sections.received",
  "workspace_feature_pages.pre_inquiries.sections.selected_received",
  "workspace_feature_pages.pre_inquiries.sections.saved",
  "workspace_feature_pages.pre_inquiries.actions.start_assessment",
  "workspace_feature_pages.pre_inquiries.actions.prepare_draft",
  "workspace_feature_pages.pre_inquiries.recipients_lead",
  "workspace_feature_pages.pre_inquiries.receiving.accepts_platform",
  "workspace_feature_pages.pre_inquiries.delivery.internal",
  "workspace_feature_pages.pre_inquiries.delivery.external_email",
  "about.features_page.items.privacy_safety.title",
  "about.features_page.items.privacy_safety.body",
  "about.features_page.items.crisis_routing.title",
  "about.features_page.items.crisis_routing.body",
  "about.features_page.items.youth_child_safety.title",
  "about.features_page.items.youth_child_safety.body",
  "about.features_page.items.trusted_access_security.title",
  "about.features_page.items.trusted_access_security.body",
  "about.features_page.items.workflow_orchestration.title",
  "about.features_page.items.workflow_orchestration.body",
  "about.features_page.items.domain_knowledge.title",
  "about.features_page.items.domain_knowledge.body"
];

function readMessages(locale) {
  return JSON.parse(
    readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8")
  );
}

function getMessage(messages, path) {
  return path.split(".").reduce((value, key) => {
    if (!value || !Object.hasOwn(value, key)) return undefined;
    return value[key];
  }, messages);
}

test("workspace i18n lookups used by role-specific dashboards exist", () => {
  for (const locale of locales) {
    const messages = readMessages(locale);
    for (const key of requiredWorkspaceKeys) {
      assert.equal(
        typeof getMessage(messages, key),
        "string",
        `${locale} is missing ${key}`
      );
    }
  }
});

test("pre-inquiry translation keys used by the workspace page exist", () => {
  const source = readFileSync(
    new URL("../../components/workspace/WorkspaceFeaturePage.jsx", import.meta.url),
    "utf8"
  );
  const keys = [
    ...source.matchAll(/readText\(t,\s*"((?:workspace_feature_pages\.)?pre_inquiries\.[^"]+|workspace_feature_pages\.pre_inquiries\.[^"]+)"/g)
  ]
    .map((match) => match[1])
    .map((key) => key.startsWith("workspace_feature_pages.") ? key : `workspace_feature_pages.${key}`);
  const uniqueKeys = [...new Set(keys)].sort();

  for (const locale of locales) {
    const messages = readMessages(locale);
    for (const key of uniqueKeys) {
      assert.notEqual(getMessage(messages, key), undefined, `${locale} is missing ${key}`);
    }
  }
});

test("pre-inquiry workflow is presented as assistant-led, not agent-led", () => {
  const messages = readMessages("et");
  const preInquiries = getMessage(messages, "workspace_feature_pages.pre_inquiries");
  const serialized = JSON.stringify(preInquiries);

  assert.equal(
    getMessage(messages, "workspace_feature_pages.pre_inquiries.sections.assistant"),
    "Täpsusta eelinfot"
  );
  assert.doesNotMatch(serialized, /\bagent/i);
  assert.doesNotMatch(serialized, /\bagendi/i);
});
