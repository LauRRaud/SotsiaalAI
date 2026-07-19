import {
  SUPERVISION_MEMBER_ROLES,
  conflict,
  forbidden,
  invalid,
  normalizeText,
  notFound,
  recordSupervisionAudit,
  resolveDb,
  unprocessable
} from "./shared.js";

/**
 * M1 SupervisorGrant — superviisori lisatiitel (Q2.2 M1, otsused 3/4/5).
 * Peegeldab PracticeCapability mustrit (grantBasis KOHUSTUSLIK; ACTIVE on
 * tuletatud, mitte salvestatud). Admin ainuõigus; "1 aktiivne grant/kasutaja"
 * jõustatakse teenusetasandil luku all (DB-indeks toetab).
 */

function toTime(value) {
  if (value instanceof Date) return value.getTime();
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.getTime() : NaN;
}

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function parseOptionalDate(value) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) throw invalid("INVALID_VALID_UNTIL");
  return d;
}

/** Tuletatud olek: ACTIVE = revokedAt IS NULL AND (validUntil IS NULL OR validUntil > now). */
export function isGrantActive(grant, now = new Date()) {
  if (!grant || grant.revokedAt) return false;
  if (grant.validUntil && toTime(grant.validUntil) <= toTime(now)) return false;
  return true;
}

function activeGrantWhere(userId, now) {
  return {
    userId,
    revokedAt: null,
    OR: [{ validUntil: null }, { validUntil: { gt: now } }]
  };
}

// Kasutaja-skoobitud advisory-lukk (grant pole protsess). "1 aktiivne" kontroll
// ja insert käivad sama luku all → paralleelne topeltandmine → 409.
async function withGrantLock(db, userId, callback) {
  return db.$transaction(async (tx) => {
    if (typeof tx?.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`supervisor-grant:${userId}`}))`;
    }
    return callback(tx);
  });
}

/**
 * Admin-vaate serializer. grantBasis on nähtav AINULT siin (admin) — ei jõua
 * kunagi mitte-admin serializer'isse (otsus 4: avalikku märgist ei kasutata).
 */
export function serializeGrantForAdmin(grant, now = new Date()) {
  return {
    id: grant.id,
    userId: grant.userId,
    grantBasis: grant.grantBasis,
    grantedByUserId: grant.grantedByUserId || null,
    revokedByUserId: grant.revokedByUserId || null,
    validFrom: toIso(grant.validFrom),
    validUntil: grant.validUntil ? toIso(grant.validUntil) : null,
    revokedAt: grant.revokedAt ? toIso(grant.revokedAt) : null,
    active: isGrantActive(grant, now),
    createdAt: toIso(grant.createdAt)
  };
}

export async function listGrants({ userId = null } = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const where = userId ? { userId: String(userId).trim() } : {};
  const grants = await db.supervisorGrant.findMany({ where, orderBy: [{ createdAt: "desc" }] });
  return grants.map((grant) => serializeGrantForAdmin(grant, now));
}

export async function getActiveGrant(userId, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const uid = String(userId || "").trim();
  if (!uid) return null;
  return db.supervisorGrant.findFirst({ where: activeGrantWhere(uid, now) });
}

/** Protsessi loomise värav: aktiivne grant kohustuslik, muidu 403. */
export async function assertActiveSupervisorGrant(userId, options = {}) {
  const grant = await getActiveGrant(userId, options);
  if (!grant) throw forbidden("supervision.errors.grant_required", "GRANT_REQUIRED");
  return grant;
}

export async function issueGrant({ actorUserId, userId, grantBasis, validUntil = null }, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const targetUserId = String(userId || "").trim();
  if (!targetUserId) throw invalid("MISSING_USER");
  const basis = normalizeText(grantBasis, { max: 2000, required: true, field: "grant_basis" });
  const validUntilDate = parseOptionalDate(validUntil);

  return withGrantLock(db, targetUserId, async (tx) => {
    const target = await tx.user.findUnique({ where: { id: targetUserId }, select: { id: true, role: true } });
    if (!target) throw invalid("UNKNOWN_USER");
    const role = String(target.role || "").toUpperCase();
    if (!SUPERVISION_MEMBER_ROLES.includes(role)) {
      throw unprocessable("supervision.errors.role_not_allowed", "GRANT_ROLE_NOT_ALLOWED");
    }
    const existingActive = await tx.supervisorGrant.findFirst({ where: activeGrantWhere(targetUserId, now) });
    if (existingActive) throw conflict("supervision.errors.grant_exists", "GRANT_ALREADY_ACTIVE");

    const grant = await tx.supervisorGrant.create({
      data: {
        userId: targetUserId,
        grantedByUserId: actorUserId || null,
        grantBasis: basis,
        validFrom: now,
        validUntil: validUntilDate
      }
    });
    await recordSupervisionAudit(tx, {
      action: "GRANT_ISSUED",
      actorUserId,
      targetKind: "user",
      targetId: targetUserId,
      metadata: { grantId: grant.id }
    });
    return serializeGrantForAdmin(grant, now);
  });
}

export async function revokeGrant({ actorUserId, grantId }, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const id = String(grantId || "").trim();
  if (!id) throw invalid("MISSING_GRANT");

  const existing = await db.supervisorGrant.findUnique({ where: { id } });
  if (!existing) throw notFound();

  return withGrantLock(db, existing.userId, async (tx) => {
    const fresh = await tx.supervisorGrant.findUnique({ where: { id } });
    if (!fresh) throw notFound();
    if (fresh.revokedAt) {
      // Idempotentne: juba tühistatud → sama seis, ei uut auditit.
      return serializeGrantForAdmin(fresh, now);
    }
    const updated = await tx.supervisorGrant.update({
      where: { id },
      data: { revokedAt: now, revokedByUserId: actorUserId || null }
    });
    await recordSupervisionAudit(tx, {
      action: "GRANT_REVOKED",
      actorUserId,
      targetKind: "user",
      targetId: fresh.userId,
      metadata: { grantId: id }
    });
    return serializeGrantForAdmin(updated, now);
  });
}
