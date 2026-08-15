import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildLoginConfirmUrl,
  confirmLoginEmailLink,
  describeLoginEmailConfirmation,
  persistLoginEmailLinkHash,
  prepareLoginEmailLink,
  resendLoginEmailLink
} from "../../lib/auth/login-email-link.js";

const NOW = new Date("2026-08-11T12:00:00.000Z");
const FUTURE = new Date("2026-08-11T12:10:00.000Z");
const PAST = new Date("2026-08-11T11:50:00.000Z");
const hashToken = (value) => `h:${value}`;
const now = () => NOW;

/** Üks rida + kirjutuste loendur: „GET ei kirjuta" on mõõdetav ainult nii. */
function makeDb(row) {
  const state = row ? { ...row } : null;
  const calls = { reads: 0, updates: 0, updateManys: 0 };

  return {
    calls,
    row: () => (state ? { ...state } : null),
    loginTempToken: {
      async findUnique({ where }) {
        calls.reads += 1;
        if (!state) return null;
        return state.emailLinkTokenHash === where.emailLinkTokenHash ? { ...state } : null;
      },
      async update({ where, data }) {
        calls.updates += 1;
        if (!state || state.id !== where.id) throw new Error("no such row");
        Object.assign(state, data);
        return { ...state };
      },
      async updateMany({ where, data }) {
        calls.updateManys += 1;
        if (!state) return { count: 0 };
        const matches =
          state.emailLinkTokenHash === where.emailLinkTokenHash &&
          state.requiresOtp === where.requiresOtp &&
          state.otpVerifiedAt === where.otpVerifiedAt &&
          state.usedAt === where.usedAt &&
          state.expiresAt > where.expiresAt.gt;
        if (!matches) return { count: 0 };
        Object.assign(state, data);
        return { count: 1 };
      }
    }
  };
}

const attemptRow = (overrides = {}) => ({
  id: "attempt-1",
  emailLinkTokenHash: hashToken("raw-link"),
  requiresOtp: true,
  otpVerifiedAt: null,
  usedAt: null,
  expiresAt: FUTURE,
  userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/140.0",
  ipAddress: "203.0.113.9",
  createdAt: new Date("2026-08-11T11:58:00.000Z"),
  ...overrides
});

// === SOL-AUTH-12: turvalingi origin ei tule kunagi kliendi päisest ==========

test("login-lingi URL nõuab kanoonilist baas-URL-i ja keeldub ilma selleta", () => {
  const previous = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    AUTH_URL: process.env.AUTH_URL,
    APP_URL: process.env.APP_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    NODE_ENV: process.env.NODE_ENV
  };
  for (const key of Object.keys(previous)) delete process.env[key];
  process.env.NODE_ENV = "production";

  try {
    assert.throws(() => buildLoginConfirmUrl("raw-link", "et"), /base_url_missing/u);

    process.env.NEXTAUTH_URL = "https://sotsiaal.ai/";
    const url = new URL(buildLoginConfirmUrl("raw-link", "et"));
    assert.equal(url.origin, "https://sotsiaal.ai");
    assert.equal(url.pathname, "/api/auth/login-confirm");
    assert.equal(url.searchParams.get("token"), "raw-link");
    assert.equal(url.searchParams.get("locale"), "et");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("login-lingi moodul ei loe enam ühtegi kliendi hosti-päist", async () => {
  const source = await readFile(new URL("../../lib/auth/login-email-link.js", import.meta.url), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, "");

  // Vana `getRequestBaseUrl()` langes puuduva konfiguratsiooni korral just neile
  // päistele tagasi ja saatis nii tekkinud lingi konto e-posti aadressile.
  assert.doesNotMatch(code, /x-forwarded-host|x-forwarded-proto|get\(\s*["']host["']\s*\)/iu);
  assert.equal(buildLoginConfirmUrl.length, 2, "allkiri ei tohi enam request'i võtta");
});

// === SOL-AUTH-13: mint → SAADA → alles siis rotatsioon ======================

test("resend saadab enne ja rotreerib alles siis; tarnetõrge jätab vana lingi elama", async () => {
  const db = makeDb(attemptRow());
  const order = [];

  const failed = await resendLoginEmailLink({
    db,
    loginTokenId: "attempt-1",
    prepare: () => ({ token: "raw-new", tokenHash: hashToken("raw-new") }),
    deliver: async (token) => {
      order.push(`deliver:${token}`);
      throw new Error("smtp down");
    }
  });

  assert.equal(failed.ok, false);
  assert.equal(failed.reason, "delivery");
  assert.equal(db.calls.updates, 0, "tarnetõrge ei tohi rida puutuda");
  assert.equal(db.row().emailLinkTokenHash, hashToken("raw-link"), "vana link peab edasi kehtima");

  // Vana link töötab pärast nurjunud resend'i päriselt edasi — mitte ainult räsi
  // ei ole muutunud, vaid kinnitus läheb ka läbi.
  const stillWorks = await confirmLoginEmailLink({ db, token: "raw-link", hashToken, now });
  assert.equal(stillWorks.ok, true);

  const db2 = makeDb(attemptRow());
  const sent = await resendLoginEmailLink({
    db: db2,
    loginTokenId: "attempt-1",
    prepare: () => ({ token: "raw-new", tokenHash: hashToken("raw-new") }),
    deliver: async (token) => {
      order.push(`deliver:${token}`);
      assert.equal(db2.row().emailLinkTokenHash, hashToken("raw-link"), "saatmise HETKEL peab vana link veel kehtima");
    }
  });

  assert.equal(sent.ok, true);
  assert.equal(db2.row().emailLinkTokenHash, hashToken("raw-new"));
  assert.deepEqual(order, ["deliver:raw-new", "deliver:raw-new"]);
});

test("negatiivkontroll: vana järjekord tapab kohale jõudnud lingi juba enne saatmiskatset", async () => {
  const db = makeDb(attemptRow());
  const prepared = prepareLoginEmailLink({
    generateToken: () => "raw-new",
    hashToken
  });

  // Vana rada: kirjuta räsi, SIIS saada.
  await persistLoginEmailLinkHash({ db, id: "attempt-1", tokenHash: prepared.tokenHash });
  const deliveryFailed = new Error("smtp down");

  const stale = await confirmLoginEmailLink({ db, token: "raw-link", hashToken, now });
  assert.equal(stale.ok, false, "vana muster peab vana lingi ära tapma — muidu ei mõõda ülemine test midagi");
  assert.equal(deliveryFailed.message, "smtp down");
});

test("kirja läheb TOORTOKEN ja ritta ainult räsi", async () => {
  const db = makeDb(attemptRow());
  let delivered = null;

  await resendLoginEmailLink({
    db,
    loginTokenId: "attempt-1",
    prepare: () => ({ token: "raw-new", tokenHash: hashToken("raw-new") }),
    deliver: async (token) => {
      delivered = token;
    }
  });

  assert.equal(delivered, "raw-new");
  assert.notEqual(db.row().emailLinkTokenHash, delivered);
});

// === SOL-AUTH-08: kirjeldamine ei kinnita midagi ============================

test("katse kirjeldamine LOEB ja ei kirjuta — skanneri GET jätab otpVerifiedAt nulliks", async () => {
  const db = makeDb(attemptRow());

  const described = await describeLoginEmailConfirmation({
    db,
    token: "raw-link",
    hashToken,
    now,
    locale: "et"
  });

  assert.equal(described.ok, true);
  assert.equal(described.attempt.ipAddress, "203.0.113.9");
  assert.match(described.attempt.device, /Chrome/u);
  assert.ok(described.attempt.startedAt);

  assert.equal(db.calls.updates, 0);
  assert.equal(db.calls.updateManys, 0);
  assert.equal(db.row().otpVerifiedAt, null);
  assert.equal(db.row().emailLinkTokenHash, hashToken("raw-link"), "kirjeldamine ei tohi linki ära tarbida");
});

test("kirjeldamine ei avalda midagi kehtetu, aegunud, juba kinnitatud ega tarbitud katse kohta", async () => {
  const cases = [
    ["aegunud", attemptRow({ expiresAt: PAST })],
    ["juba kinnitatud", attemptRow({ otpVerifiedAt: PAST })],
    ["juba tarbitud", attemptRow({ usedAt: PAST })],
    ["ei nõua teist faktorit", attemptRow({ requiresOtp: false })]
  ];

  for (const [label, row] of cases) {
    const db = makeDb(row);
    const described = await describeLoginEmailConfirmation({ db, token: "raw-link", hashToken, now });
    assert.deepEqual(described, { ok: false }, label);
  }

  const empty = makeDb(null);
  assert.deepEqual(
    await describeLoginEmailConfirmation({ db: empty, token: "raw-link", hashToken, now }),
    { ok: false }
  );
  assert.deepEqual(await describeLoginEmailConfirmation({ db: empty, token: "", hashToken, now }), { ok: false });
});

test("kinnitamine on tingimuslik ja ühekordne", async () => {
  const db = makeDb(attemptRow());

  const first = await confirmLoginEmailLink({ db, token: "raw-link", hashToken, now });
  assert.deepEqual(first, { ok: true, count: 1 });
  assert.deepEqual(db.row().otpVerifiedAt, NOW);
  assert.equal(db.row().emailLinkTokenHash, null);

  const second = await confirmLoginEmailLink({ db, token: "raw-link", hashToken, now });
  assert.deepEqual(second, { ok: false, count: 0 }, "sama link ei tohi teist korda kinnitada");

  const expired = makeDb(attemptRow({ expiresAt: PAST }));
  assert.equal((await confirmLoginEmailLink({ db: expired, token: "raw-link", hashToken, now })).ok, false);
  assert.equal(expired.row().otpVerifiedAt, null);
});

// === Marsruudi leping ======================================================

test("login-confirm GET kirjeldab ja POST kinnitab — mitte vastupidi", async () => {
  const source = await readFile(
    new URL("../../app/api/auth/login-confirm/route.js", import.meta.url),
    "utf8"
  );

  assert.match(source, /export async function GET\(/u);
  assert.match(source, /export async function POST\(/u);

  const getBody = source.slice(
    source.indexOf("export async function GET("),
    source.indexOf("export async function POST(")
  );
  assert.match(getBody, /describeLoginEmailConfirmation/u);
  assert.doesNotMatch(getBody, /confirmLoginEmailLink|updateMany/u, "GET ei tohi kinnitada");

  const postBody = source.slice(source.indexOf("export async function POST("));
  assert.match(postBody, /confirmLoginEmailLink/u);

  // Auto-submit oleks skanneri vastu piisav, aga mitte selle leiu vastu: ohver
  // ise võib lingi avada ja peab nägema, KELLE katset ta kinnitab.
  assert.doesNotMatch(source, /\.submit\(\)/u, "kinnitusvorm ei tohi ennast ise saata");

  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, "");
  assert.doesNotMatch(
    code,
    /x-forwarded-host|x-forwarded-proto|get\(\s*["']host["']\s*\)/iu,
    "fallback-link ei tohi usaldada kliendi hosti- ega protokollipäiseid"
  );
  assert.match(source, /const homeUrl = ["']\/["'];/u);
});
