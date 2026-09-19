import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../app/api/auth/login-confirm/route.js", import.meta.url), "utf8");
const script = source.match(/const REDIRECT_SCRIPT = `([\s\S]*?)`;/)[1];

function browser(session) {
  const navigations = [];
  const handlers = {};
  const message = { textContent: "Return to the PIN window", getAttribute: () => "Waiting" };
  const button = { hidden: false, getAttribute: () => "/", addEventListener: (name, fn) => { handlers[name] = fn; } };
  runInNewContext(script, {
    document: {
      getElementById: id => id === "lc-msg" ? message : button,
      body: { setAttribute() {}, removeAttribute() {} },
    },
    window: { location: { replace: url => navigations.push(url) } },
    fetch: async () => ({ ok: true, json: async () => session }),
    setTimeout: () => 1,
    clearTimeout() {},
    Date,
  });
  return { navigations, handlers, button, message };
}

test("email window without a session never sends the user into a new login", async () => {
  const state = browser({});
  let prevented = false;
  state.handlers.click({ preventDefault: () => { prevented = true; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(prevented, true);
  assert.deepEqual(state.navigations, []);
  assert.equal(state.message.textContent, "Return to the PIN window");
  assert.equal(state.button.hidden, false);
});

test("a confirmed browser session can open the platform", async () => {
  const state = browser({ user: { id: "isolated-test" } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(state.navigations, ["/"]);
});
