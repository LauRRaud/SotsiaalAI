import test from "node:test";
import assert from "node:assert/strict";

import {
  encryptRecurringToken,
  decryptRecurringToken,
  isRecurringTokenEncryptionConfigured,
  readBillingMethodRecurringToken,
  PaymentTokenCryptoError
} from "../../lib/payments/tokenCrypto.js";

const KEY = Buffer.alloc(32, 7).toString("base64");
const OTHER_KEY = Buffer.alloc(32, 9).toString("base64");
const env = { PAYMENT_TOKEN_ENC_KEY: KEY };

test("encrypt/decrypt roundtrip and cipher hides the plaintext", () => {
  const { cipher, keyId } = encryptRecurringToken("mk_tok_secret_123", { env });
  assert.equal(decryptRecurringToken(cipher, { env }), "mk_tok_secret_123");
  assert.ok(keyId && keyId.length > 0);
  assert.ok(!cipher.includes("secret"), "cipher must not contain plaintext");
  assert.match(cipher, /^v1\./);
});

test("encryption is fail-closed when no key is configured", () => {
  assert.equal(isRecurringTokenEncryptionConfigured({}), false);
  assert.throws(
    () => encryptRecurringToken("x", { env: {} }),
    (error) => error instanceof PaymentTokenCryptoError && error.code === "PAYMENT_TOKEN_KEY_UNAVAILABLE"
  );
});

test("decryption is fail-closed when the keyId is unknown (rotation gap)", () => {
  const { cipher } = encryptRecurringToken("mk_tok", { env });
  assert.throws(
    () => decryptRecurringToken(cipher, { env: { PAYMENT_TOKEN_ENC_KEY: OTHER_KEY } }),
    (error) => error.code === "PAYMENT_TOKEN_KEY_UNAVAILABLE"
  );
});

test("tampered ciphertext fails authentication", () => {
  const { cipher } = encryptRecurringToken("mk_tok", { env });
  const parts = cipher.split(".");
  parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
  assert.throws(
    () => decryptRecurringToken(parts.join("."), { env }),
    (error) => error.code === "PAYMENT_TOKEN_DECRYPT_FAILED"
  );
});

test("key rotation: a keyId from a previous key still decrypts via the keyring", () => {
  const { cipher, keyId } = encryptRecurringToken("mk_tok_old", { env });
  // New active key + old key kept in the ring by id.
  const rotatedEnv = {
    PAYMENT_TOKEN_ENC_KEY: OTHER_KEY,
    PAYMENT_TOKEN_ENC_KEYS: `${keyId}:${KEY}`
  };
  assert.equal(decryptRecurringToken(cipher, { env: rotatedEnv }), "mk_tok_old");
});

test("readBillingMethodRecurringToken prefers cipher, falls back to legacy plaintext", () => {
  const { cipher } = encryptRecurringToken("cipher_tok", { env });
  const fromCipher = readBillingMethodRecurringToken(
    { providerTokenCipher: cipher, providerToken: "LEGACY" },
    { env }
  );
  assert.deepEqual(fromCipher, { token: "cipher_tok", source: "cipher" });

  const fromLegacy = readBillingMethodRecurringToken({ providerToken: "LEGACY_PLAIN" }, { env });
  assert.deepEqual(fromLegacy, { token: "LEGACY_PLAIN", source: "plaintext" });

  assert.throws(
    () => readBillingMethodRecurringToken({}, { env }),
    (error) => error.code === "PAYMENT_TOKEN_MISSING"
  );
});
