import crypto from "node:crypto";

/**
 * One-time link secrets (password reset, e-mail verification) used to live in
 * `VerificationToken.token` as the raw bearer value: anyone who could read the
 * table — backup, dump, diagnostic query — held a working link (SOL-AUTH-03).
 * `PendingEmailChange` already showed the safer shape next door.
 *
 * The raw secret now exists only inside the e-mailed link. The row stores
 * `STORED_TOKEN_PREFIX + sha256(raw)`.
 *
 * The prefix is the transition mechanism, not decoration. Rows written before
 * this change still hold a raw secret, so consumption also looks the input up
 * verbatim — but ONLY when the input is not already in stored form. Without
 * that guard someone holding the stored value could paste it straight into the
 * link and the verbatim branch would match it, which is precisely the leak this
 * closes. Legacy rows die on their own TTL (60 min reset, 24 h verify); once
 * `SELECT count(*) FROM "VerificationToken" WHERE token NOT LIKE 'v2:%'` is 0,
 * the verbatim branch can be deleted.
 */
export const STORED_TOKEN_PREFIX = "v2:";

const RAW_TOKEN_BYTES = 32;

/** Stored form of a raw link secret. Empty input stays empty — never a match. */
export function hashVerificationToken(rawToken) {
  const raw = String(rawToken ?? "");
  if (!raw) return "";
  const digest = crypto.createHash("sha256").update(raw, "utf8").digest("hex");
  return `${STORED_TOKEN_PREFIX}${digest}`;
}

/** `raw` goes into the link, `stored` goes into the database. Never the reverse. */
export function createVerificationTokenSecret() {
  const raw = crypto.randomBytes(RAW_TOKEN_BYTES).toString("hex");
  return { raw, stored: hashVerificationToken(raw) };
}

/**
 * Values a submitted link secret may match in `VerificationToken.token`.
 * Always the stored form; the verbatim legacy value only when the caller did
 * not hand us something already in stored form.
 */
export function verificationTokenLookupValues(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return [];
  const values = [hashVerificationToken(raw)];
  if (!raw.startsWith(STORED_TOKEN_PREFIX)) {
    values.push(raw);
  }
  return values;
}

/**
 * Atomic one-time claim. Run it inside the transaction that applies the effect
 * and before any write: the loser of a race blocks on the row lock, then
 * deletes nothing and gets `false`, so the effect never happens twice.
 *
 * `deleteMany` rather than `delete` on purpose — `delete` throws P2025 on an
 * already-consumed row, which turns a normal double-click into a 500.
 */
export async function claimVerificationTokenRow({ db, identifier, token }) {
  const result = await db.verificationToken.deleteMany({
    where: { identifier, token }
  });
  return Number(result?.count || 0) === 1;
}
