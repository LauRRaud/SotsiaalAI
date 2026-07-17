import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DomainEventType,
  EVENT_REGISTRY,
  validateDomainEventInput,
  validateEventRegistry
} from "../../lib/events/registry.js";

const messages = Object.fromEntries(await Promise.all(["et", "en", "ru"].map(async (locale) => [
  locale,
  JSON.parse(await readFile(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"))
])));

function hasPath(value, path) {
  return path.split(".").every((key) => (value = value?.[key]) !== undefined);
}

test("event registry has safe actions and translation parity", () => {
  assert.equal(validateEventRegistry({
    hasTranslation: (key) => Object.values(messages).every((message) => hasPath(message, key))
  }), true);
  assert.deepEqual(Object.keys(EVENT_REGISTRY).sort(), Object.values(DomainEventType).sort());
});

test("unknown event types and undeclared or free-text meta fail closed", () => {
  const base = {
    type: DomainEventType.PRE_INQUIRY_OPENED,
    actorKind: "user",
    actorUserId: "recipient-1",
    sourceId: "inquiry-1",
    workspaceId: "inquiry-1",
    actionTarget: "pre_inquiry:inquiry-1",
    idempotencyKey: "pre_inquiry.opened:inquiry-1:v1"
  };
  assert.throws(() => validateDomainEventInput({ ...base, type: "unknown.event" }), { code: "UNKNOWN_EVENT_TYPE" });
  assert.throws(() => validateDomainEventInput({ ...base, meta: { title: "private text" } }), { code: "UNDECLARED_EVENT_META" });
  assert.throws(() => validateDomainEventInput({ ...base, meta: { statusKey: "private text" } }), { code: "INVALID_EVENT_META" });
  assert.doesNotThrow(() => validateDomainEventInput({ ...base, meta: { statusKey: "READY" } }));
});
