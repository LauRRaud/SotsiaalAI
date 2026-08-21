import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const composer = readFileSync(join(root, "components/alalehed/chat/ChatComposer.jsx"), "utf8");
const css = readFileSync(join(root, "app/styles/chat.css"), "utf8");

test("transient privacy failure has a distinct compact retry prompt", () => {
  assert.match(composer, /conv-privacy-prompt/);
  assert.match(composer, /privacyCopy\.unavailableTitle/);
  assert.match(composer, /handlePrivacyRetry/);
  assert.match(composer, /data-state=\{privacyPrompt\.unavailable \? "unavailable" : "confirmation"\}/);
  assert.match(css, /\.conv-privacy-prompt\s*\{[^}]*display:\s*grid;[^}]*max-width:\s*100%;/s);
  assert.match(css, /\.conv-privacy-prompt__actions\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/s);
});

test("privacy prompt is not styled as the input pill", () => {
  assert.doesNotMatch(
    css,
    /form:has\(#chat-input\)\s*>\s*div:has\(#chat-input\)\s*>\s*div\s*\{/
  );
  assert.match(
    css,
    /form:has\(#chat-input\)\s*>\s*div:has\(#chat-input\)\s*>\s*div:has\(#chat-input\)\s*\{/
  );
});
