import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import test from "node:test";

import {
  PENDING_LOGIN_COOKIE_NAME,
  buildPendingLoginCookie,
  clearedPendingLoginCookie,
  confirmLoginEmailLink,
  describeLoginEmailConfirmation
} from "@/lib/auth/login-email-link";
import { AUTO_CONFIRM_SCRIPT, SIGN_IN_SCRIPT } from "@/lib/auth/loginConfirmScripts";
import {
  LOGIN_HANDOFF_MESSAGE,
  LOGIN_HANDOFF_PREFS_KEY,
  loginAttemptMarker
} from "@/lib/auth/loginHandoff";
import { hashOpaqueToken } from "@/lib/auth/pin-login";

const PIN_TAB_TOKEN = "pin-tab-temp-token";
const EMAIL_TOKEN = "email-link-token";
const ATTEMPT = loginAttemptMarker(PIN_TAB_TOKEN);

function fakeDb({ usedAt = null, otpVerifiedAt = null } = {}) {
  const row = {
    tokenHash: hashOpaqueToken(PIN_TAB_TOKEN),
    emailLinkTokenHash: hashOpaqueToken(EMAIL_TOKEN),
    requiresOtp: true,
    otpVerifiedAt,
    usedAt,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1",
    ipAddress: "192.0.2.10",
    createdAt: new Date()
  };
  return {
    row,
    loginTempToken: {
      async findUnique({ where }) {
        return where.emailLinkTokenHash && where.emailLinkTokenHash === row.emailLinkTokenHash
          ? { ...row }
          : null;
      },
      async updateMany({ where, data }) {
        const matches =
          where.emailLinkTokenHash === row.emailLinkTokenHash &&
          row.requiresOtp === where.requiresOtp &&
          row.otpVerifiedAt === null &&
          row.usedAt === null &&
          row.expiresAt > where.expiresAt.gt;
        if (!matches) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }
    }
  };
}

test("the PIN browser is marked with a short-lived cookie only the confirm route receives", () => {
  const cookie = buildPendingLoginCookie(PIN_TAB_TOKEN);
  assert.equal(cookie.name, PENDING_LOGIN_COOKIE_NAME);
  assert.equal(cookie.value, PIN_TAB_TOKEN);
  assert.equal(cookie.options.httpOnly, true);
  // Kiri avab lingi teisest rakendusest või saidilt: strict küpsis jääks saatmata.
  assert.equal(cookie.options.sameSite, "lax");
  assert.equal(cookie.options.path, "/api/auth/login-confirm");
  assert.ok(cookie.options.maxAge > 0 && cookie.options.maxAge <= 60 * 60);

  const cleared = clearedPendingLoginCookie();
  assert.equal(cleared.name, cookie.name);
  assert.equal(cleared.options.path, cookie.options.path);
  assert.equal(cleared.options.maxAge, 0);
});

test("only the browser that entered the PIN is recognised as the same browser", async () => {
  const db = fakeDb();
  const same = await describeLoginEmailConfirmation({ db, token: EMAIL_TOKEN, pendingLoginToken: PIN_TAB_TOKEN });
  assert.equal(same.ok, true);
  assert.equal(same.sameBrowser, true);

  const scanner = await describeLoginEmailConfirmation({ db, token: EMAIL_TOKEN });
  assert.equal(scanner.ok, true);
  assert.equal(scanner.sameBrowser, false);
  // Võõras brauser näeb endiselt, kelle katset ta kinnitaks.
  assert.match(scanner.attempt.device, /iPhone/);

  const otherAttempt = await describeLoginEmailConfirmation({ db, token: EMAIL_TOKEN, pendingLoginToken: "another-attempt" });
  assert.equal(otherAttempt.sameBrowser, false);
  assert.equal(db.row.otpVerifiedAt, null, "describing never confirms");
});

test("confirming in the PIN browser hands the sign-in to that page", async () => {
  const db = fakeDb();
  const result = await confirmLoginEmailLink({ db, token: EMAIL_TOKEN, pendingLoginToken: PIN_TAB_TOKEN });
  assert.equal(result.ok, true);
  assert.equal(result.sameBrowser, true);
  assert.ok(db.row.otpVerifiedAt instanceof Date);
  assert.equal(db.row.emailLinkTokenHash, null);
});

test("confirming in another browser still confirms, but never signs that browser in", async () => {
  const db = fakeDb();
  const result = await confirmLoginEmailLink({ db, token: EMAIL_TOKEN });
  assert.equal(result.ok, true);
  assert.equal(result.sameBrowser, false);
  assert.ok(db.row.otpVerifiedAt instanceof Date);
});

test("a spent link does not hand over the sign-in even in the PIN browser", async () => {
  const db = fakeDb({ usedAt: new Date() });
  const result = await confirmLoginEmailLink({ db, token: EMAIL_TOKEN, pendingLoginToken: PIN_TAB_TOKEN });
  assert.equal(result.ok, false);
  assert.equal(result.sameBrowser, false);
});

function page({ prefs, responses, sessionUser = null }) {
  const calls = [];
  const posted = [];
  const navigations = [];
  const storage = new Map(prefs === undefined ? [] : [[LOGIN_HANDOFF_PREFS_KEY, JSON.stringify(prefs)]]);
  const bodyAttrs = new Map();
  const timers = [];
  const queue = [...responses];
  const reply = (ok, data) => ({ ok, json: async () => data });
  const fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url === "/api/auth/session") return reply(true, sessionUser ? { user: sessionUser } : {});
    const next = queue.shift();
    if (!next) throw new Error(`unexpected fetch ${url}`);
    assert.equal(url, next.url);
    return reply(next.ok !== false, next.data || {});
  };
  class BroadcastChannel {
    postMessage(message) {
      posted.push(message.type);
    }
  }
  const root = {
    getAttribute: name => ({ "data-token": PIN_TAB_TOKEN, "data-locale": "et" })[name] || null
  };
  const context = {
    document: {
      getElementById: id => (id === "lc" ? root : null),
      body: {
        setAttribute: (name, value) => bodyAttrs.set(name, value),
        removeAttribute: name => bodyAttrs.delete(name)
      }
    },
    window: {
      location: { origin: "https://sotsiaal.ai", replace: url => navigations.push(url) },
      localStorage: {
        getItem: key => (storage.has(key) ? storage.get(key) : null),
        removeItem: key => storage.delete(key)
      }
    },
    fetch,
    BroadcastChannel,
    URL,
    URLSearchParams,
    setTimeout: fn => {
      timers.push(fn);
      return timers.length;
    }
  };
  runInNewContext(SIGN_IN_SCRIPT, context);
  return { calls, posted, navigations, storage, bodyAttrs, timers };
}

async function settle(state) {
  for (let round = 0; round < 40; round += 1) {
    await new Promise(resolve => setImmediate(resolve));
    const timer = state.timers.shift();
    if (timer) timer();
  }
}

const SIGNED_IN = [
  { url: "/api/auth/login-step2", data: { status: "verified" } },
  { url: "/api/auth/csrf", data: { csrfToken: "csrf-1" } },
  { url: "/api/auth/callback/credentials", data: { url: "https://sotsiaal.ai/vestlus" } }
];

test("the email window signs in with the PIN window's choices and opens the app", async () => {
  const state = page({
    prefs: { attempt: ATTEMPT, remember: true, name: "Töö telefon", next: "/vestlus?x=1" },
    responses: SIGNED_IN
  });
  assert.equal(state.bodyAttrs.get("data-waiting"), "1", "only the dots show while signing in");
  await settle(state);

  const step2 = JSON.parse(state.calls[0].init.body);
  assert.deepEqual(
    { token: step2.temp_login_token, remember: step2.remember_device, name: step2.device_name },
    { token: PIN_TAB_TOKEN, remember: true, name: "Töö telefon" }
  );
  const signIn = new URLSearchParams(state.calls[2].init.body);
  assert.equal(signIn.get("temp_login_token"), PIN_TAB_TOKEN);
  assert.equal(signIn.get("csrfToken"), "csrf-1");
  assert.equal(signIn.get("json"), "true");

  assert.deepEqual(state.navigations, ["/vestlus?x=1"]);
  assert.equal(state.storage.has(LOGIN_HANDOFF_PREFS_KEY), false);
  assert.deepEqual(state.posted, [LOGIN_HANDOFF_MESSAGE.finishing, LOGIN_HANDOFF_MESSAGE.complete]);
});

test("the page only signs in an attempt this browser's PIN window started", async () => {
  // Võõra saidi vormi-POST võib küpsise istutada, aga mitte meie localStorage'it.
  for (const prefs of [undefined, { remember: true }, { attempt: "someone-else", remember: true }]) {
    const state = page({ prefs, responses: SIGNED_IN });
    await settle(state);
    assert.deepEqual(state.calls, [], JSON.stringify(prefs));
    assert.deepEqual(state.navigations, []);
    assert.equal(state.bodyAttrs.has("data-waiting"), false, "the failure text stays visible");
  }
});

test("an unchecked remember-device choice is carried over", async () => {
  const state = page({ prefs: { attempt: ATTEMPT, remember: false, name: "Jagatud arvuti" }, responses: SIGNED_IN });
  await settle(state);
  const step2 = JSON.parse(state.calls[0].init.body);
  assert.equal(step2.remember_device, false);
  assert.equal(step2.device_name, "");
  assert.deepEqual(state.navigations, ["/"]);
});

test("the stored destination can never leave the site", async () => {
  for (const next of ["//evil.example/x", "https://evil.example/", "javascript:alert(1)"]) {
    const state = page({ prefs: { attempt: ATTEMPT, remember: false, next }, responses: SIGNED_IN });
    await settle(state);
    assert.deepEqual(state.navigations, ["/"], next);
  }
});

test("if the awake PIN window won the race, the email window still opens the app", async () => {
  const state = page({
    prefs: { attempt: ATTEMPT, remember: true, next: "/vestlus" },
    responses: [{ url: "/api/auth/login-step2", ok: false, data: { code: "TOKEN_EXPIRED" } }],
    sessionUser: { id: "isolated-test" }
  });
  await settle(state);
  assert.deepEqual(state.navigations, ["/vestlus"]);
});

test("a failed sign-in shows the failure text and never sends the user into a new login", async () => {
  const state = page({
    prefs: { attempt: ATTEMPT, remember: true, next: "/vestlus" },
    responses: [
      { url: "/api/auth/login-step2", data: { status: "verified" } },
      { url: "/api/auth/csrf", data: { csrfToken: "csrf-1" } },
      {
        url: "/api/auth/callback/credentials",
        ok: false,
        data: { url: "https://sotsiaal.ai/api/auth/error?error=CredentialsSignin" }
      }
    ]
  });
  await settle(state);
  assert.deepEqual(state.navigations, []);
  assert.equal(state.bodyAttrs.has("data-waiting"), false, "the server-rendered failure text is visible");
  assert.deepEqual(state.posted, [LOGIN_HANDOFF_MESSAGE.finishing, LOGIN_HANDOFF_MESSAGE.failed]);
});

test("in the PIN browser the confirmation form submits itself", () => {
  let submitted = 0;
  const bodyAttrs = new Map();
  runInNewContext(AUTO_CONFIRM_SCRIPT, {
    document: {
      getElementById: id => (id === "lc-form" ? { submit: () => { submitted += 1; } } : null),
      body: {
        setAttribute: (name, value) => bodyAttrs.set(name, value),
        removeAttribute: name => bodyAttrs.delete(name)
      }
    },
    window: { addEventListener() {} }
  });
  assert.equal(submitted, 1);
  assert.equal(bodyAttrs.get("data-waiting"), "1");
});
