import { compare as bcryptCompare } from "bcrypt";

import {
  PIN_THROTTLE_EMAIL_SCOPE,
  PIN_THROTTLE_IP_SCOPE,
  clearLoginThrottle,
  consumeLoginThrottle,
  pinThrottleSettings,
  throttleSubjectForEmail
} from "@/lib/auth/loginThrottle";

/**
 * SOL-AUTH-09 ja -10 — PIN-katse otsus, marsruudist väljas.
 *
 * Otsus kolis siia samal põhjusel, mis SOL-AUTH-08/-11 omad: marsruut impordib
 * `next/headers`, seega teda ei saa testijooksjast ega sondist üldse laadida — ja piir,
 * mida ei saa testida, ei ole piir. Siin on kolm asja, mis peavad käima KOOS:
 *
 *   1. **piir enne otsust** — püsiv, klastriülene loendur (`loginThrottle`);
 *   2. **üks vastus** — tundmatu e-post, peatatud konto ja vale PIN annavad sama tulemuse;
 *   3. **üks ajastus** — bcrypt jookseb ka siis, kui kontot ei ole.
 *
 * Neid ei saa eraldi lahendada: ühine vastus ilma ühise ajastuseta on ikka oraakel, ja
 * kasutaja ID järgi käiv loendur teeks 429-st uue oraakli.
 */

/**
 * Peibutusräsi tundmatu konto jaoks. Cost peab olema sama, mis päris PIN-idel (`register`,
 * `passwordResetLifecycle`, `accountLifecycle` — kõik 12); väiksem cost annaks kiirema
 * vastuse ja lekitaks konto puudumise ajastusega välja.
 */
export const DECOY_PIN_HASH = "$2b$12$i0ihYeu69OBZkHecuAmKB..7sgELuDkmJjbvqyFX4P/luWbmLdQ5O";

const USER_SELECT = {
  id: true,
  email: true,
  passwordHash: true,
  isAdmin: true,
  role: true,
  accessSuspendedAt: true
};

export async function authenticatePinAttempt({
  db,
  email,
  pin,
  trustedIp = null,
  compare = bcryptCompare,
  settings = pinThrottleSettings(),
  now = () => new Date()
}) {
  const emailSubject = email ? throttleSubjectForEmail(email) : null;

  // Piir tuleb ENNE andmebaasi- ja bcrypt-tööd: see on ainus koht, kus 10 000 varianti
  // päriselt otsa saavad.
  if (trustedIp) {
    const ipThrottle = await consumeLoginThrottle({
      db,
      scope: PIN_THROTTLE_IP_SCOPE,
      subject: trustedIp,
      now,
      ...settings.ip
    });
    if (!ipThrottle.allowed) {
      return { outcome: "rate_limited", scope: PIN_THROTTLE_IP_SCOPE, retryAfterSec: ipThrottle.retryAfterSec };
    }
  }

  if (emailSubject) {
    const emailThrottle = await consumeLoginThrottle({
      db,
      scope: PIN_THROTTLE_EMAIL_SCOPE,
      subject: emailSubject,
      now,
      ...settings.email
    });
    if (!emailThrottle.allowed) {
      return {
        outcome: "rate_limited",
        scope: PIN_THROTTLE_EMAIL_SCOPE,
        retryAfterSec: emailThrottle.retryAfterSec
      };
    }
  }

  const user = email ? await db.user.findUnique({ where: { email }, select: USER_SELECT }) : null;
  const usableHash = user?.passwordHash && !user.accessSuspendedAt ? user.passwordHash : null;

  // Bcrypt jookseb ALATI. Varem läks tundmatu e-post ja peatatud konto siit mööda, seega
  // vastus tuli kordades kiiremini — ja see vahe oli loetav ka siis, kui iga sõna vastuses
  // oleks olnud identne.
  const pinOk = await compare(pin, usableHash || DECOY_PIN_HASH);

  if (!email) return { outcome: "invalid", reason: "email_missing" };
  if (!user) return { outcome: "invalid", reason: "unknown_email" };
  if (!usableHash) return { outcome: "invalid", reason: "no_usable_credential" };
  if (!pinOk) return { outcome: "invalid", reason: "wrong_pin" };

  // Turvaline taastamine: õige PIN nullib loenduri, muidu koguneks aus kasutaja aeglaselt
  // lukustuse poole ja „ma ju sain sisse" ei tähendaks midagi.
  await clearLoginThrottle({ db, scope: PIN_THROTTLE_EMAIL_SCOPE, subject: emailSubject });
  if (trustedIp) {
    await clearLoginThrottle({ db, scope: PIN_THROTTLE_IP_SCOPE, subject: trustedIp });
  }

  return { outcome: "ok", user };
}
