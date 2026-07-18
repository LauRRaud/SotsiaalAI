import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ET, EN and RU expose the PDF fallback message", async () => {
  const messages = await Promise.all(
    ["et", "en", "ru"].map(async (locale) => {
      const text = await readFile(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8");
      return JSON.parse(text);
    })
  );

  for (const message of messages) {
    assert.equal(typeof message.api.exports.pdf_content_not_supported, "string");
    assert.match(message.api.exports.pdf_content_not_supported, /DOCX/);
  }
});
