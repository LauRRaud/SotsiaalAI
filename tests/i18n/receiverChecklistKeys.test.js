import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { normalizePreInquiryReceiverChecklist } from "../../lib/preInquiryReceiverWorkflow.js";

/**
 * The receiver checklist used to ship five hardcoded Estonian sentences that
 * were also persisted into the DB. The labels stay as a fallback for legacy
 * rows, but the visible string now comes from a key — these tests keep that
 * contract from silently regressing.
 */

const LOCALES = ["et", "en", "ru"];
const messages = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"))
  ])
);
const SOURCE = readFileSync(new URL("../../lib/preInquiryReceiverWorkflow.js", import.meta.url), "utf8");

const lookup = (locale, key) =>
  key.split(".").reduce((node, part) => (node == null ? node : node[part]), messages[locale]);

function assertResolves(keys) {
  const missing = [];
  for (const locale of LOCALES) {
    for (const key of keys) {
      if (typeof lookup(locale, key) !== "string") missing.push(`${locale}: ${key}`);
    }
  }
  assert.deepEqual(missing, [], "every checklist key must resolve in every locale");
}

test("every default checklist item carries a key that resolves in et, en and ru", () => {
  const items = normalizePreInquiryReceiverChecklist([], {});

  assert.equal(items.length, 5);
  for (const item of items) {
    assert.ok(item.labelKey, `${item.id} has a labelKey`);
    assert.ok(item.label, `${item.id} keeps an Estonian fallback for legacy rows`);
  }
  assertResolves(items.map((item) => item.labelKey));
});

test("the conditional variant keys resolve too, not just the defaults", () => {
  // These are chosen server-side from the assessment state, so a sample
  // inquiry cannot reach all of them — they are asserted explicitly.
  const VARIANTS = [
    "check_urgency_risk",
    "clarify_missing_unknown",
    "clarify_missing_unanswered",
    "clarify_missing_both"
  ];

  assertResolves(
    VARIANTS.map((name) => `workspace_feature_pages.pre_inquiries.receiver_checklist.${name}`)
  );

  // …and the source really does select among exactly these variants, so a new
  // branch cannot be added without extending this list.
  assert.match(SOURCE, /CHECKLIST_KEY_PREFIX\}\.check_urgency_risk/u);
  assert.match(SOURCE, /CHECKLIST_KEY_PREFIX\}\.clarify_missing_\$\{variant\}/u);
  const variantValues = SOURCE.match(/\?\s*"both"[\s\S]*?:\s*"unanswered"/u);
  assert.ok(variantValues, "the clarify_missing variant selector is still a three-way choice");
  for (const name of ["both", "unknown", "unanswered"]) {
    assert.match(variantValues[0], new RegExp(`"${name}"`, "u"));
  }
});

test("a stored or posted item cannot redirect the translation lookup", () => {
  const forged = [
    {
      id: "review_preinfo",
      labelKey: "common.languages.et",
      labelVars: { unknown: 99 },
      label: "Kliendi sisestatud tekst",
      checked: true
    }
  ];

  const [item] = normalizePreInquiryReceiverChecklist(forged, {});

  assert.equal(
    item.labelKey,
    "workspace_feature_pages.pre_inquiries.receiver_checklist.review_preinfo",
    "labelKey comes from the server table, never from the incoming item"
  );
  assert.equal(item.labelVars, undefined, "labelVars is server-assigned as well");
  // The free-text label is still honoured — that is the editable part.
  assert.equal(item.label, "Kliendi sisestatud tekst");
  assert.equal(item.checked, true);
});

test("no checklist item ships an untranslated sentence without a key", () => {
  const items = normalizePreInquiryReceiverChecklist([], {});
  for (const item of items) {
    assert.match(
      item.labelKey,
      /^workspace_feature_pages\.pre_inquiries\.receiver_checklist\./u,
      `${item.id} must use the checklist key namespace`
    );
  }
});
