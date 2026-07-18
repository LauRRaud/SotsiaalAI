import crypto from "node:crypto";

// Recurring makse-mandaadi tokeni krüpteering rest'is (T09 PAYMENTS-V1, O-J1).
//
// AES-256-GCM eraldi serverivõtmega. Ilma võtmeta recurring-tokeni vastuvõtt ja
// dekrüpteerimine EBAÕNNESTUB fail-closed — plaintekst-mandaati ei salvestata ega
// loeta uue koodi poolt. Võtmepööre: iga cipher kannab keyId-d; dekrüpteerimine
// valib võtme keyId järgi ja fail-closeb, kui seda võtit ei ole keyring'is.
//
// Cipher-vorming (URL-ohutu, ise-kirjeldav):
//   v1.<keyId>.<base64url(iv)>.<base64url(ciphertext)>.<base64url(tag)>

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const VERSION = "v1";

export class PaymentTokenCryptoError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "PaymentTokenCryptoError";
    this.code = code;
    this.paymentTokenCrypto = true;
  }
}

function b64urlEncode(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

function decodeKeyMaterial(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }

  try {
    const decoded = b64urlDecode(value);
    if (decoded.length === 32) return decoded;
  } catch {}

  return null;
}

function deriveKeyId(keyBuf, explicit) {
  const id = String(explicit || "").trim();
  if (id) return id;
  return crypto.createHash("sha256").update(keyBuf).digest("hex").slice(0, 12);
}

/**
 * Ehita keyring env-ist. Loetakse käivitusajal (mitte mooduli laadimisel), et
 * testid saaksid env-i seada. Süstitava keyring'i saab anda otse funktsioonidele.
 */
export function loadPaymentTokenKeyring(env = process.env) {
  const keyring = new Map();
  let activeKeyId = null;

  const primary = decodeKeyMaterial(env.PAYMENT_TOKEN_ENC_KEY);
  if (primary) {
    activeKeyId = deriveKeyId(primary, env.PAYMENT_TOKEN_ENC_KEY_ID);
    keyring.set(activeKeyId, primary);
  }

  // Lisavõtmed pöörde jaoks: "keyIdA:material,keyIdB:material"
  const extra = String(env.PAYMENT_TOKEN_ENC_KEYS || "").trim();
  if (extra) {
    for (const entry of extra.split(",")) {
      const separatorIndex = entry.indexOf(":");
      if (separatorIndex <= 0) continue;
      const id = entry.slice(0, separatorIndex).trim();
      const key = decodeKeyMaterial(entry.slice(separatorIndex + 1));
      if (id && key) keyring.set(id, key);
    }
  }

  const activeOverride = String(env.PAYMENT_TOKEN_ENC_KEY_ID || "").trim();
  if (activeOverride && keyring.has(activeOverride)) activeKeyId = activeOverride;
  if (!activeKeyId && keyring.size > 0) activeKeyId = [...keyring.keys()][0];

  return { keyring, activeKeyId };
}

export function isRecurringTokenEncryptionConfigured(env = process.env) {
  return Boolean(loadPaymentTokenKeyring(env).activeKeyId);
}

function resolveKeyring(options) {
  if (options?.keyring instanceof Map) {
    return { keyring: options.keyring, activeKeyId: options.activeKeyId || [...options.keyring.keys()][0] || null };
  }
  return loadPaymentTokenKeyring(options?.env || process.env);
}

/**
 * Krüpti recurring token. Fail-closed: ilma aktiivse võtmeta viskab
 * PAYMENT_TOKEN_KEY_UNAVAILABLE ja recurring-mandaat ei aktiveeru.
 * @returns {{ cipher: string, keyId: string }}
 */
export function encryptRecurringToken(plaintext, options = {}) {
  const token = String(plaintext ?? "");
  if (!token) throw new PaymentTokenCryptoError("PAYMENT_TOKEN_EMPTY", "empty recurring token");

  const { keyring, activeKeyId } = resolveKeyring(options);
  if (!activeKeyId || !keyring.has(activeKeyId)) {
    throw new PaymentTokenCryptoError("PAYMENT_TOKEN_KEY_UNAVAILABLE", "recurring token encryption key is not configured");
  }

  const key = keyring.get(activeKeyId);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    cipher: [VERSION, activeKeyId, b64urlEncode(iv), b64urlEncode(ciphertext), b64urlEncode(tag)].join("."),
    keyId: activeKeyId
  };
}

/**
 * Dekrüpti recurring token. Fail-closed: tundmatu keyId → PAYMENT_TOKEN_KEY_UNAVAILABLE;
 * rikutud/vale token → PAYMENT_TOKEN_DECRYPT_FAILED.
 */
export function decryptRecurringToken(cipherText, options = {}) {
  const value = String(cipherText || "");
  if (!value) throw new PaymentTokenCryptoError("PAYMENT_TOKEN_EMPTY", "empty cipher");

  const parts = value.split(".");
  if (parts.length !== 5 || parts[0] !== VERSION) {
    throw new PaymentTokenCryptoError("PAYMENT_TOKEN_FORMAT_INVALID", "unsupported cipher format");
  }

  const [, keyId, ivB64, ctB64, tagB64] = parts;
  const { keyring } = resolveKeyring(options);
  const key = keyring.get(keyId);
  if (!key) {
    throw new PaymentTokenCryptoError("PAYMENT_TOKEN_KEY_UNAVAILABLE", `no key for keyId ${keyId}`);
  }

  try {
    const decipher = crypto.createDecipheriv(ALGO, key, b64urlDecode(ivB64));
    decipher.setAuthTag(b64urlDecode(tagB64));
    const plaintext = Buffer.concat([decipher.update(b64urlDecode(ctB64)), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    throw new PaymentTokenCryptoError("PAYMENT_TOKEN_DECRYPT_FAILED", "recurring token could not be decrypted");
  }
}

/**
 * Loe billingMethod'i recurring token: eelista krüptitud cipher'it, fail-closed
 * puuduva võtme korral. Legacy plaintekst-rida (enne T09) toetatud tagasiühilduvuseks.
 * @returns {{ token: string, source: "cipher"|"plaintext" }}
 */
export function readBillingMethodRecurringToken(billingMethod, options = {}) {
  const cipher = String(billingMethod?.providerTokenCipher || "").trim();
  if (cipher) {
    return { token: decryptRecurringToken(cipher, options), source: "cipher" };
  }
  const plaintext = String(billingMethod?.providerToken || "").trim();
  if (plaintext) {
    return { token: plaintext, source: "plaintext" };
  }
  throw new PaymentTokenCryptoError("PAYMENT_TOKEN_MISSING", "no recurring token on billing method");
}
