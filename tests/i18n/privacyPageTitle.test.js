import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const expectedPrivacyTitles = {
  et: "Privaatsus",
  en: "Privacy",
  ru: "Конфиденциальность"
};

test("privacy page heading is localized consistently", () => {
  for (const [locale, expectedTitle] of Object.entries(expectedPrivacyTitles)) {
    const messages = JSON.parse(readFileSync(`messages/${locale}.json`, "utf8"));

    assert.equal(messages.privacy.title, expectedTitle);
  }
});
