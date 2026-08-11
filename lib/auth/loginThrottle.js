import crypto from "node:crypto";

/**
 * SOL-AUTH-09 — sisselogimiskatsete piir, mis elab andmebaasis.
 *
 * Vana piir oli `lib/rate-limit.js` mooduli lokaalne `Map`: iga Next-instants pidas oma
 * arvet ja iga restart nullis kõik. Neljakohalisel PIN-il on 10 000 varianti, seega
 * klastriülene püsiv loendur ei ole lisakiht, vaid AINUS tõeline kaitse.
 *
 * Subjekt on **e-posti räsi, mitte kasutaja ID**. Kui loendur käiks konto järgi, teeks
 * lukustumine ise sama lekke, mille SOL-AUTH-10 sulgeb: tundmatu e-post ei lukustuks
 * kunagi, olemasolev lukustuks — ja ründaja loeks vastuse ajastusest konto olemasolu välja.
 */

export const LOGIN_THROTTLE_LOCK_NAMESPACE = 4713;

export const PIN_THROTTLE_EMAIL_SCOPE = "pin:email";
export const PIN_THROTTLE_IP_SCOPE = "pin:ip";

const readPositiveInteger = (value, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.trunc(numeric);
};

export const pinThrottleSettings = () => ({
  email: {
    limit: readPositiveInteger(process.env.LOGIN_PIN_MAX_ATTEMPTS_PER_EMAIL, 8),
    windowMs: readPositiveInteger(process.env.LOGIN_PIN_ATTEMPT_WINDOW_MINUTES, 15) * 60 * 1000,
    lockMs: readPositiveInteger(process.env.LOGIN_PIN_LOCK_MINUTES, 15) * 60 * 1000
  },
  ip: {
    limit: readPositiveInteger(process.env.LOGIN_PIN_MAX_ATTEMPTS_PER_IP, 40),
    windowMs: readPositiveInteger(process.env.LOGIN_PIN_ATTEMPT_WINDOW_MINUTES, 15) * 60 * 1000,
    lockMs: readPositiveInteger(process.env.LOGIN_PIN_LOCK_MINUTES, 15) * 60 * 1000
  }
});

/** E-post ei tohi loenduri reas toorelt seista — rida on kirjeldus katsest, mitte kontost. */
export function throttleSubjectForEmail(email) {
  return crypto
    .createHash("sha256")
    .update(String(email || "").trim().toLowerCase())
    .digest("hex");
}

/**
 * Võtab loenduri rea luku. Peab tulema LUGEMISE ETTE: kaks paralleelset katset loeksid
 * muidu sama seisu ja kirjutaksid mõlemad „esimene katse". Nõuandelukk (mitte `FOR UPDATE`),
 * sest esimesel katsel rida veel EI OLE — lukustada saab ainult võtit, mitte rida.
 */
async function defaultLock(tx, key) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOGIN_THROTTLE_LOCK_NAMESPACE}::int4, hashtext(${key})::int4)`;
}

const retryAfterSeconds = (until, at) => Math.max(1, Math.ceil((until.getTime() - at.getTime()) / 1000));

/**
 * Arvestab ühe katse ja ütleb, kas ta on lubatud.
 *
 * Aken on libisemata: esimene katse avab akna, lukustus algab siis, kui limiit ületatakse,
 * ja lukust vabanemine alustab uue akna — nii ei jää kasutaja igavesti lukku ainult sellepärast,
 * et ta kunagi eksis.
 */
export async function consumeLoginThrottle({
  db,
  scope,
  subject,
  limit,
  windowMs,
  lockMs,
  now = () => new Date(),
  lock = defaultLock
}) {
  if (!subject) return { allowed: true, remaining: limit, skipped: true };

  return db.$transaction(async (tx) => {
    await lock(tx, `${scope}:${subject}`);

    const at = now();
    const row = await tx.authThrottleCounter.findUnique({
      where: { scope_subject: { scope, subject } }
    });

    if (row?.lockedUntil && row.lockedUntil > at) {
      return {
        allowed: false,
        reason: "locked",
        retryAfterSec: retryAfterSeconds(row.lockedUntil, at),
        remaining: 0
      };
    }

    const windowOpen = Boolean(row) && !row.lockedUntil && row.windowEndsAt > at;
    const count = windowOpen ? row.count + 1 : 1;
    const windowEndsAt = windowOpen ? row.windowEndsAt : new Date(at.getTime() + windowMs);
    const lockedUntil = count > limit ? new Date(at.getTime() + lockMs) : null;

    await tx.authThrottleCounter.upsert({
      where: { scope_subject: { scope, subject } },
      create: { scope, subject, count, windowEndsAt, lockedUntil },
      update: { count, windowEndsAt, lockedUntil }
    });

    if (lockedUntil) {
      return {
        allowed: false,
        reason: "locked",
        retryAfterSec: retryAfterSeconds(lockedUntil, at),
        remaining: 0
      };
    }

    return { allowed: true, remaining: Math.max(0, limit - count) };
  });
}

/**
 * Turvaline taastamine: õnnestunud PIN kustutab loenduri. Ilma selleta koguneks aus
 * kasutaja aknasse aeglaselt lukustuse poole, ja „ma ju sain sisse" ei tähendaks midagi.
 */
export async function clearLoginThrottle({ db, scope, subject }) {
  if (!subject) return;
  await db.authThrottleCounter.deleteMany({ where: { scope, subject } });
}

/** Aegunud ja lukust vabanenud read ei kanna infot — nad on koristatavad. */
export async function pruneExpiredLoginThrottles({ db, now = () => new Date() }) {
  const at = now();
  const result = await db.authThrottleCounter.deleteMany({
    where: {
      windowEndsAt: { lt: at },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: at } }]
    }
  });
  return result.count;
}
