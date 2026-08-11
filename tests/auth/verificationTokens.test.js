import assert from "node:assert/strict";
import test from "node:test";
import {
  STORED_TOKEN_PREFIX,
  claimVerificationTokenRow,
  createVerificationTokenSecret,
  hashVerificationToken,
  verificationTokenLookupValues
} from "../../lib/auth/verificationTokens.js";

test("the issued secret and the stored value are different things", () => {
  const { raw, stored } = createVerificationTokenSecret();

  assert.notEqual(raw, stored);
  assert.equal(stored, hashVerificationToken(raw));
  assert.ok(stored.startsWith(STORED_TOKEN_PREFIX));
  assert.match(raw, /^[0-9a-f]{64}$/);
});

test("two issues never collide", () => {
  const a = createVerificationTokenSecret();
  const b = createVerificationTokenSecret();

  assert.notEqual(a.raw, b.raw);
  assert.notEqual(a.stored, b.stored);
});

test("a submitted link secret matches its stored hash", () => {
  const { raw, stored } = createVerificationTokenSecret();

  assert.ok(verificationTokenLookupValues(raw).includes(stored));
});

test("the stored value is not itself a usable link", () => {
  const { stored } = createVerificationTokenSecret();

  const values = verificationTokenLookupValues(stored);

  // This is the whole finding: without the guard the legacy verbatim branch
  // would hand a database reader a working link.
  assert.ok(!values.includes(stored));
  assert.deepEqual(values, [hashVerificationToken(stored)]);
});

test("a legacy raw value is still looked up verbatim", () => {
  const legacyRaw = "ab".repeat(32);

  const values = verificationTokenLookupValues(legacyRaw);

  assert.ok(values.includes(legacyRaw));
  assert.ok(values.includes(hashVerificationToken(legacyRaw)));
});

test("empty input matches nothing", () => {
  assert.deepEqual(verificationTokenLookupValues(""), []);
  assert.deepEqual(verificationTokenLookupValues("   "), []);
  assert.deepEqual(verificationTokenLookupValues(null), []);
  assert.deepEqual(verificationTokenLookupValues(undefined), []);
  assert.equal(hashVerificationToken(""), "");
});

test("the claim succeeds exactly once", async () => {
  let rows = [{ identifier: "password-reset:a@b.test", token: "v2:stored" }];
  const db = {
    verificationToken: {
      async deleteMany({ where }) {
        const before = rows.length;
        rows = rows.filter(
          (row) => !(row.identifier === where.identifier && row.token === where.token)
        );
        return { count: before - rows.length };
      }
    }
  };

  const first = await claimVerificationTokenRow({
    db,
    identifier: "password-reset:a@b.test",
    token: "v2:stored"
  });
  const second = await claimVerificationTokenRow({
    db,
    identifier: "password-reset:a@b.test",
    token: "v2:stored"
  });

  assert.equal(first, true);
  assert.equal(second, false);
});

test("a claim that deletes more than one row is not a claim", async () => {
  const db = {
    verificationToken: {
      async deleteMany() {
        return { count: 2 };
      }
    }
  };

  assert.equal(
    await claimVerificationTokenRow({ db, identifier: "x", token: "y" }),
    false
  );
});
