import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const provider = fs.readFileSync(new URL("../../components/accessibility/AccessibilityProvider.jsx", import.meta.url), "utf8");
const modal = fs.readFileSync(new URL("../../components/accessibility/AccessibilityModal.jsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../../app/layout.js", import.meta.url), "utf8");
const chatBody = fs.readFileSync(new URL("../../components/alalehed/ChatBody.jsx", import.meta.url), "utf8");
const stream = fs.readFileSync(new URL("../../components/chat/hooks/useChatStream.js", import.meta.url), "utf8");

test("plain-language preference has legacy-safe persistence and hydration paths", () => {
  assert.match(provider, /plainLanguage:\s*false/);
  assert.match(provider, /obj\?\.plainLanguage === true/);
  assert.match(provider, /data-plain-language/);
  assert.match(provider, /prefs\.plainLanguage === true \? "1" : "0"/);
  assert.match(layout, /plainLanguage:\s*obj\?\.plainLanguage === true/);
  assert.match(layout, /data-plain-language=\{initialA11yPrefs\?\.plainLanguage \? "1" : "0"\}/);
});

test("accessibility UI names and explains the setting and previews the same boolean", () => {
  assert.match(modal, /accessibility\.plain_language\.title/);
  assert.match(modal, /accessibility\.plain_language\.option/);
  assert.match(modal, /accessibility\.plain_language\.description/);
  assert.match(modal, /plainLanguage,/);
});

test("chat client serializes a normalized boolean only", () => {
  assert.match(chatBody, /plainLanguage:\s*prefs\?\.plainLanguage === true/);
  assert.match(stream, /plainLanguage:\s*cfg\.plainLanguage === true/);
});
