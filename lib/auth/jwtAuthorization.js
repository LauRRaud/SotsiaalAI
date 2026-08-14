import { generateOpaqueToken, getActiveSessionMaxForUser } from "@/lib/auth/pin-login";

export const SESSION_USER_MISSING = "SESSION_USER_MISSING";
export const SESSION_REVOKED = "SESSION_REVOKED";

/**
 * PostgreSQL nõuandelukk seob sama kasutaja sessiooniloomised ühte järjekorda
 * (SOL-AUTH-02). Nimeruumi number on selle raja oma; `hashtext` annab teise
 * poole. Lukk vabaneb tehingu lõpus.
 */
export const SESSION_LOCK_NAMESPACE = 4711;

export const DEFAULT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function resolveSessionMaxAgeSeconds(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_SESSION_MAX_AGE_SECONDS;
}

export function isSessionInvalidationReason(reason) {
  return reason === SESSION_USER_MISSING || reason === SESSION_REVOKED;
}

/**
 * Fail-closed langetus (SOL-AUTH-01).
 *
 * Kui autoriseerimise värskendamine ebaõnnestub ootamatul põhjusel, ei tohi
 * token kanda edasi varasemat rolli ega administraatoriõigust. Väärtused
 * kirjutatakse madalaimale tasemele; järgmine õnnestunud värskendus taastab
 * need andmebaasist.
 */
export function applyFailClosedAuthorization(token) {
  token.role = "CLIENT";
  token.isAdmin = false;
  token.subActive = false;
  token.authDegraded = true;
  return token;
}

export async function createTrackedSessionForUser(user, { db, sessionMaxAgeSeconds, now = new Date() }) {
  const userId = String(user?.id || "");
  if (!userId) return null;

  const maxSessions = Math.max(1, getActiveSessionMaxForUser(user));
  const expires = new Date(now.getTime() + resolveSessionMaxAgeSeconds(sessionMaxAgeSeconds) * 1000);

  return db.$transaction(async tx => {
    // Ilma selle lukuta loevad kaks paralleelset sisselogimist sama algseisu
    // ja loovad mõlemad uue rea — ülempiir ületatakse vaikselt.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SESSION_LOCK_NAMESPACE}::int4, hashtext(${userId})::int4)`;

    await tx.session.deleteMany({
      where: {
        userId,
        expires: {
          lte: now
        }
      }
    });

    const activeSessions = await tx.session.findMany({
      where: {
        userId,
        expires: {
          gt: now
        }
      },
      select: {
        id: true
      },
      orderBy: {
        expires: "asc"
      }
    });

    const overflow = activeSessions.length - maxSessions + 1;
    const evictIds = overflow > 0
      ? activeSessions.slice(0, overflow).map(session => session.id)
      : [];

    if (evictIds.length > 0) {
      await tx.session.deleteMany({
        where: {
          id: {
            in: evictIds
          }
        }
      });
    }

    return tx.session.create({
      data: {
        sessionToken: generateOpaqueToken(32),
        userId,
        expires
      },
      select: {
        id: true
      }
    });
  });
}

export async function hasActiveTrackedSession(sessionRecordId, userId, { db, now = new Date() }) {
  if (!sessionRecordId || !userId) return false;
  const sessionRecord = await db.session.findFirst({
    where: {
      id: String(sessionRecordId),
      userId: String(userId),
      expires: {
        gt: now
      }
    },
    select: {
      id: true
    }
  });
  return Boolean(sessionRecord);
}

async function loadAuthorizationSubject(token, { db, now }) {
  return db.user.findUnique({
    where: {
      id: String(token.id)
    },
    select: {
      role: true,
      isAdmin: true,
      sessionVersion: true,
      accessSuspendedAt: true,
      subscriptions: {
        where: {
          status: "ACTIVE",
          OR: [{
            validUntil: null
          }, {
            validUntil: {
              gt: now
            }
          }]
        },
        select: {
          id: true
        },
        take: 1
      }
    }
  });
}

/**
 * Värskendab tokeni autoriseerimisinfo andmebaasist.
 *
 * Viskab `SESSION_USER_MISSING`/`SESSION_REVOKED`, kui sessioon peab lõppema.
 * Iga muu tõrge langetab tokeni õigused (`applyFailClosedAuthorization`) ja
 * tagastab `{ degraded: true, error }` — sessioon jääb alles, aga ilma
 * varasema rolli ja administraatoriõiguseta.
 */
export async function refreshTokenAuthorization(token, { db, sessionMaxAgeSeconds, now = new Date() }) {
  try {
    const currentUser = await loadAuthorizationSubject(token, { db, now });
    if (!currentUser) {
      throw new Error(SESSION_USER_MISSING);
    }
    if (currentUser.accessSuspendedAt) {
      throw new Error(SESSION_REVOKED);
    }
    if (Number(token.sessionVersion ?? 0) !== Number(currentUser.sessionVersion ?? 0)) {
      throw new Error(SESSION_REVOKED);
    }

    if (token.sessionRecordId) {
      const active = await hasActiveTrackedSession(token.sessionRecordId, token.id, { db, now });
      if (!active) {
        throw new Error(SESSION_REVOKED);
      }
    } else {
      const sessionRecord = await createTrackedSessionForUser(
        {
          id: token.id,
          role: currentUser.role,
          isAdmin: currentUser.isAdmin
        },
        { db, sessionMaxAgeSeconds, now }
      );
      if (sessionRecord?.id) {
        token.sessionRecordId = sessionRecord.id;
      }
    }

    token.role = currentUser.role ?? "CLIENT";
    token.isAdmin = Boolean(currentUser.isAdmin);
    token.subActive = currentUser.subscriptions.length > 0;
    if (token.authDegraded) delete token.authDegraded;
    return { degraded: false };
  } catch (error) {
    if (isSessionInvalidationReason(String(error?.message || ""))) {
      throw error;
    }
    applyFailClosedAuthorization(token);
    return { degraded: true, error };
  }
}

/**
 * Värskust nõudva lehepiiri administraatorikontroll.
 *
 * JWT rolliväide on ainult sisend: otsus tehakse sama andmebaasi-, peatamise-,
 * sessionVersion'i ja jälgitava sessiooni kontrolliga, mida kasutab NextAuthi
 * jwt callback. Iga tõrge või tühistus sulgeb piiri.
 */
export async function authorizeCurrentAdminToken(token, options) {
  if (!token?.id) return false;
  try {
    const { degraded } = await refreshTokenAuthorization(token, options);
    if (degraded) return false;
    return token.isAdmin === true || String(token.role || "").toUpperCase() === "ADMIN";
  } catch {
    return false;
  }
}
