import assert from "node:assert/strict";
import test from "node:test";

import {
  fieldLabel,
  firstInvalidField,
  validationMessage,
  validationRule
} from "../../lib/forms/validationMessage.js";
import et from "../../messages/et.json" with { type: "json" };

/* Sama otsing, mida I18nProvider teeb — nii katsuvad testid PÄRIS eestikeelseid
   tekste, mitte kohatäiteid. */
function translate(key, vars, fallback) {
  const value = String(key)
    .split(".")
    .reduce((node, part) => (node && Object.prototype.hasOwnProperty.call(node, part) ? node[part] : undefined), et);
  if (value == null) return fallback || key;
  if (!vars) return value;
  return String(value).replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) && vars[name] != null ? String(vars[name]) : match
  );
}

const VALID = Object.freeze({
  valid: true,
  valueMissing: false,
  typeMismatch: false,
  patternMismatch: false,
  tooShort: false,
  tooLong: false,
  rangeUnderflow: false,
  rangeOverflow: false,
  stepMismatch: false,
  badInput: false
});

function field(overrides = {}, validity = {}) {
  return {
    type: "text",
    validity: { ...VALID, valid: false, ...validity },
    getAttribute: () => null,
    ...overrides
  };
}

test("a valid field produces no rule and no message", () => {
  const ok = field({}, { valid: true });
  assert.equal(validationRule(ok), null);
  assert.equal(validationMessage(ok, translate), "");
});

test("an empty required field speaks Estonian, not the browser's language", () => {
  const message = validationMessage(field({}, { valueMissing: true }), translate);
  assert.equal(message, "See väli on kohustuslik.");
  assert.ok(!/please/i.test(message));
});

test("the missing value is named before the format — an empty field has no format", () => {
  const rule = validationRule(field({ type: "email" }, { valueMissing: true, typeMismatch: true }));
  assert.equal(rule.key, "forms.error.required");
});

test("type mismatch picks the message for that very type", () => {
  assert.equal(validationRule(field({ type: "email" }, { typeMismatch: true })).key, "forms.error.email");
  assert.equal(validationRule(field({ type: "url" }, { typeMismatch: true })).key, "forms.error.url");
  assert.equal(validationRule(field({ type: "week" }, { typeMismatch: true })).key, "forms.error.invalid");
});

test("length and range limits carry their own number into the text", () => {
  assert.deepEqual(validationRule(field({ minLength: 4 }, { tooShort: true })).vars, { min: 4 });
  assert.deepEqual(validationRule(field({ maxLength: 8 }, { tooLong: true })).vars, { max: 8 });
  assert.deepEqual(validationRule(field({ min: "1" }, { rangeUnderflow: true })).vars, { min: "1" });
  assert.deepEqual(validationRule(field({ max: "9" }, { rangeOverflow: true })).vars, { max: "9" });
  assert.equal(
    validationMessage(field({ minLength: 4 }, { tooShort: true }), translate),
    "Liiga lühike — vähemalt 4 märki."
  );
});

test("an unknown validity flag still says something instead of staying silent", () => {
  const unknown = field({}, { somethingNew: true });
  assert.equal(validationRule(unknown).key, "forms.error.invalid");
});

test("the visible label is put in front of the message so long forms name the field", () => {
  const labelled = field({ labels: [{ textContent: "  E-post \n" }] }, { valueMissing: true });
  assert.equal(fieldLabel(labelled), "E-post");
  assert.equal(validationMessage(labelled, translate), "E-post: See väli on kohustuslik.");
});

test("aria-label and placeholder stand in when there is no <label>", () => {
  assert.equal(fieldLabel(field({ getAttribute: name => (name === "aria-label" ? "Ühik" : null) })), "Ühik");
  assert.equal(fieldLabel(field({ placeholder: "nt tartu_linn" })), "nt tartu_linn");
  assert.equal(fieldLabel(field()), "");
});

test("focus never lands on a field the person cannot see or reach", () => {
  const broken = validity => ({ ...field({}, validity), offsetParent: {}, getClientRects: () => [{}] });
  const disabled = { ...broken({ valueMissing: true }), disabled: true };
  const hidden = { ...broken({ valueMissing: true }), type: "hidden" };
  const displayNone = {
    ...broken({ valueMissing: true }),
    offsetParent: null,
    getClientRects: () => []
  };
  const reachable = broken({ valueMissing: true });

  assert.equal(firstInvalidField({ elements: [disabled, hidden, displayNone] }), null);
  assert.equal(firstInvalidField({ elements: [disabled, hidden, displayNone, reachable] }), reachable);
});

test("the first broken field wins — that is where the person is sent", () => {
  const make = () => ({ ...field({}, { valueMissing: true }), offsetParent: {}, getClientRects: () => [{}] });
  const first = make();
  const second = make();
  const good = { ...field({}, { valid: true }), offsetParent: {} };
  assert.equal(firstInvalidField({ elements: [good, first, second] }), first);
});

test("every message key the rules can reach exists in the Estonian dictionary", () => {
  const keys = [
    "forms.error.field",
    "forms.error.required",
    "forms.error.email",
    "forms.error.url",
    "forms.error.tel",
    "forms.error.pattern",
    "forms.error.tooShort",
    "forms.error.tooLong",
    "forms.error.rangeUnderflow",
    "forms.error.rangeOverflow",
    "forms.error.step",
    "forms.error.badInput",
    "forms.error.invalid"
  ];
  for (const key of keys) {
    assert.notEqual(translate(key, null, null), null, `puudub võti ${key}`);
    assert.notEqual(translate(key, null, key), key, `puudub võti ${key}`);
  }
});
