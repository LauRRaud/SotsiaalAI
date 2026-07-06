import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const locales = ["et", "en", "ru"];

const requiredKeys = [
  "covision.workflow.steps.basic",
  "covision.workflow.steps.anonymous_description",
  "covision.workflow.steps.process_flow",
  "covision.workflow.steps.network_risks",
  "covision.workflow.steps.central_question",
  "covision.workflow.steps.review",
  "covision.workflow.anonymity_instruction",
  "covision.workflow.anonymity_confirmation",
  "covision.workflow.save_open_room",
  "covision.room.canvas",
  "covision.room.audio_no_recording",
  "covision.room.invite_participant",
  "covision.room.request_to_speak",
  "covision.room.written_discussion"
];

function readMessages(locale) {
  return JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"));
}

function getMessage(messages, path) {
  return path.split(".").reduce((value, key) => {
    if (!value || !Object.hasOwn(value, key)) return undefined;
    return value[key];
  }, messages);
}

test("covision workflow translations exist in all supported locales", () => {
  for (const locale of locales) {
    const messages = readMessages(locale);
    for (const key of requiredKeys) {
      assert.equal(typeof getMessage(messages, key), "string", `${locale} is missing ${key}`);
    }
  }
});
