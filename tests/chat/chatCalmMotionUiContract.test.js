import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const css = readFileSync(join(root, "app/styles/chat.css"), "utf8");
const messageItem = readFileSync(
  join(root, "components/alalehed/chat/ChatMessageItem.jsx"),
  "utf8"
);
const specularHighlight = readFileSync(
  join(root, "components/glass/SpecularHighlight.jsx"),
  "utf8"
);

test("scrolling never blurs an entire message bubble", () => {
  assert.doesNotMatch(css, /animation-name:\s*conv-msg-roll/);
  assert.doesNotMatch(css, /@keyframes\s+conv-msg-roll/);
});

test("thinking is a compact accessible S indicator without visible label or bubble", () => {
  assert.match(
    messageItem,
    /<span role="status" aria-live="polite" aria-label=\{thinkingLabel\}\s*\/>/
  );
  assert.match(messageItem, /tabIndex=\{showThinking \? -1 : 0\}/);
  assert.match(
    css,
    /\[data-thinking="true"\]\s*\{[^}]*padding:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s
  );
  assert.match(
    css,
    /\[data-thinking="true"\]::after\s*\{[^}]*content:\s*none;/s
  );
});

test("chat textarea stays visually transparent under the shared hover renderer", () => {
  assert.match(specularHighlight, /textarea:not\(#chat-input\)/);
});

test("busy composer line keeps tapered ends and sweeps without a dead pause", () => {
  assert.match(
    css,
    /div:has\(#chat-input\)::after\s*\{[^}]*mask-image:\s*linear-gradient\(90deg,\s*transparent/s
  );
  assert.match(css, /animation:\s*conv-energy\s+2\.4s\s+linear\s+infinite/);
  assert.match(css, /220%\s+100%\s+no-repeat/);
  assert.match(css, /background-position:\s*108%\s+0,\s*0\s+0/);
  assert.match(css, /background-position:\s*-8%\s+0,\s*0\s+0/);
});
