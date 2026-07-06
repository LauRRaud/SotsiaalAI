import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { FALLBACK_DOCS_STORAGE_DIR } from "@/lib/documents/constants";
import { prisma } from "@/lib/prisma";
import { logDataAudit } from "@/lib/privacy/audit";
import { safeError } from "@/lib/privacy/safeError";

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_DAYS = 365;

function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

export const GENERAL_RETENTION_DAYS = Math.max(1, readPositiveNumber(process.env.DATA_RETENTION_DAYS, 90));
export const PAYMENT_RETENTION_DAYS = Math.max(
  GENERAL_RETENTION_DAYS,
  readPositiveNumber(process.env.PAYMENT_RETENTION_DAYS, 7 * YEAR_DAYS)
);
export const PAYMENT_RAW_RETENTION_DAYS = Math.max(
  GENERAL_RETENTION_DAYS,
  readPositiveNumber(process.env.PAYMENT_RAW_RETENTION_DAYS, GENERAL_RETENTION_DAYS)
);
export const LOG_RETENTION_DAYS = Math.max(
  GENERAL_RETENTION_DAYS,
  readPositiveNumber(process.env.LOG_RETENTION_DAYS, GENERAL_RETENTION_DAYS)
);
const RETENTION_SWEEP_INTERVAL_MS = Math.max(
  5 * 60 * 1000,
  readPositiveNumber(process.env.RETENTION_SWEEP_INTERVAL_MS, 6 * 60 * 60 * 1000)
);
const RETENTION_CRON_KEY = String(process.env.RETENTION_CRON_KEY || process.env.CRON_SECRET || "").trim();

const globalForRetention = globalThis;

function retentionState() {
  if (!globalForRetention.__sotsiaalaiRetentionState) {
    globalForRetention.__sotsiaalaiRetentionState = {
      lastRunAt: 0,
      inFlight: null
    };
  }
  return globalForRetention.__sotsiaalaiRetentionState;
}

function daysAgo(days) {
  return new Date(Date.now() - Math.max(1, Number(days) || 1) * DAY_MS);
}

function normalizeIds(rows = []) {
  return rows
    .map((row) => String(row?.id || "").trim())
    .filter(Boolean);
}

async function deleteStoredDocuments(rows = []) {
  const results = await Promise.allSettled(
    rows
      .map((row) => String(row?.storagePath || "").trim())
      .filter(Boolean)
      .map(async (storagePath) => {
        const root = path.resolve(String(process.env.DOCS_STORAGE_DIR || "").trim() || FALLBACK_DOCS_STORAGE_DIR);
        const uploadsRoot = path.resolve(path.join(root, "uploads"));
        const normalized = path.normalize(storagePath);
        const absolute = path.resolve(root, normalized);
        if (absolute !== uploadsRoot && !absolute.startsWith(`${uploadsRoot}${path.sep}`)) {
          throw new Error("Invalid document storage path");
        }
        try {
          await fs.unlink(absolute);
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      })
  );

  const failures = results.filter((entry) => entry.status === "rejected");
  if (failures.length) {
    console.error("[retention] document file cleanup failed", {
      failures: failures.length
    });
  }
}

export async function runRetentionCleanup() {
  const now = new Date();
  const generalCutoff = daysAgo(GENERAL_RETENTION_DAYS);
  const logCutoff = daysAgo(LOG_RETENTION_DAYS);
  const paymentCutoff = daysAgo(PAYMENT_RETENTION_DAYS);
  const paymentRawCutoff = daysAgo(PAYMENT_RAW_RETENTION_DAYS);
  const counts = {
    sessions: 0,
    verificationTokens: 0,
    emailOtpCodes: 0,
    loginTempTokens: 0,
    trustedDevices: 0,
    invites: 0,
    conversationRuns: 0,
    conversations: 0,
    analyzeUsage: 0,
    chatLogs: 0,
    paymentLogs: 0,
    helpMatches: 0,
    helpRequests: 0,
    helpOffers: 0,
    rooms: 0,
    artifacts: 0,
    documents: 0,
    documentAudits: 0,
    paymentsRawTrimmed: 0,
    paymentsDeleted: 0,
    subscriptionsDeleted: 0
  };

  counts.sessions = (await prisma.session.deleteMany({
    where: {
      expires: {
        lt: now
      }
    }
  })).count;

  counts.verificationTokens = (await prisma.verificationToken.deleteMany({
    where: {
      expires: {
        lt: now
      }
    }
  })).count;

  counts.emailOtpCodes = (await prisma.emailOtpCode.deleteMany({
    where: {
      OR: [
        {
          expiresAt: {
            lt: now
          }
        },
        {
          usedAt: {
            lt: generalCutoff
          }
        }
      ]
    }
  })).count;

  counts.loginTempTokens = (await prisma.loginTempToken.deleteMany({
    where: {
      OR: [
        {
          expiresAt: {
            lt: now
          }
        },
        {
          usedAt: {
            lt: generalCutoff
          }
        }
      ]
    }
  })).count;

  counts.trustedDevices = (await prisma.trustedDevice.deleteMany({
    where: {
      expiresAt: {
        lt: now
      }
    }
  })).count;

  counts.invites = (await prisma.invite.deleteMany({
    where: {
      OR: [
        {
          expiresAt: {
            lt: generalCutoff
          }
        },
        {
          createdAt: {
            lt: generalCutoff
          },
          status: {
            in: ["ACCEPTED", "REVOKED", "EXPIRED"]
          }
        }
      ]
    }
  })).count;

  counts.conversationRuns = (await prisma.conversationRun.deleteMany({
    where: {
      updatedAt: {
        lt: generalCutoff
      }
    }
  })).count;

  counts.conversations = (await prisma.conversation.deleteMany({
    where: {
      OR: [
        {
          expiresAt: {
            lt: now
          }
        },
        {
          lastActivityAt: {
            lt: generalCutoff
          }
        }
      ]
    }
  })).count;

  counts.analyzeUsage = (await prisma.analyzeUsage.deleteMany({
    where: {
      day: {
        lt: generalCutoff
      }
    }
  })).count;

  counts.chatLogs = (await prisma.chatLog.deleteMany({
    where: {
      createdAt: {
        lt: logCutoff
      },
      OR: [
        {
          role: null
        },
        {
          role: {
            not: "payment"
          }
        }
      ]
    }
  })).count;

  counts.paymentLogs = (await prisma.chatLog.deleteMany({
    where: {
      createdAt: {
        lt: paymentCutoff
      },
      role: "payment"
    }
  })).count;

  counts.helpMatches = (await prisma.helpMatch.deleteMany({
    where: {
      updatedAt: {
        lt: generalCutoff
      },
      status: {
        in: ["DECLINED", "CLOSED"]
      }
    }
  })).count;

  counts.helpRequests = (await prisma.helpRequest.deleteMany({
    where: {
      updatedAt: {
        lt: generalCutoff
      },
      status: {
        in: ["CLOSED", "CANCELLED", "ARCHIVED"]
      }
    }
  })).count;

  counts.helpOffers = (await prisma.helpOffer.deleteMany({
    where: {
      updatedAt: {
        lt: generalCutoff
      },
      status: {
        in: ["CLOSED", "CANCELLED", "ARCHIVED"]
      }
    }
  })).count;

  const staleRoomIds = normalizeIds(await prisma.room.findMany({
    where: {
      createdAt: {
        lt: generalCutoff
      },
      messages: {
        none: {
          deletedAt: null,
          createdAt: {
            gte: generalCutoff
          }
        }
      },
      invites: {
        none: {
          expiresAt: {
            gte: now
          }
        }
      }
    },
    select: {
      id: true
    }
  }));

  if (staleRoomIds.length) {
    counts.rooms = (await prisma.room.deleteMany({
      where: {
        id: {
          in: staleRoomIds
        }
      }
    })).count;
  }

  counts.artifacts = (await prisma.agentArtifact.deleteMany({
    where: {
      updatedAt: {
        lt: generalCutoff
      }
    }
  })).count;

  const staleDocuments = await prisma.userDocument.findMany({
    where: {
      updatedAt: {
        lt: generalCutoff
      },
      templateArtifacts: {
        none: {
          updatedAt: {
            gte: generalCutoff
          }
        }
      },
      sourceArtifactLinks: {
        none: {
          artifact: {
            updatedAt: {
              gte: generalCutoff
            }
          }
        }
      }
    },
    select: {
      id: true,
      storagePath: true
    }
  });

  if (staleDocuments.length) {
    await deleteStoredDocuments(staleDocuments);
    counts.documents = (await prisma.userDocument.deleteMany({
      where: {
        id: {
          in: normalizeIds(staleDocuments)
        }
      }
    })).count;
  }

  counts.documentAudits = (await prisma.documentAudit.deleteMany({
    where: {
      createdAt: {
        lt: generalCutoff
      }
    }
  })).count;

  counts.paymentsRawTrimmed = (await prisma.payment.updateMany({
    where: {
      createdAt: {
        lt: paymentRawCutoff
      }
    },
    data: {
      raw: null
    }
  })).count;

  counts.paymentsDeleted = (await prisma.payment.deleteMany({
    where: {
      createdAt: {
        lt: paymentCutoff
      }
    }
  })).count;

  counts.subscriptionsDeleted = (await prisma.subscription.deleteMany({
    where: {
      updatedAt: {
        lt: paymentCutoff
      },
      payments: {
        none: {}
      },
      OR: [
        {
          status: {
            not: "ACTIVE"
          }
        },
        {
          validUntil: {
            lt: paymentCutoff
          }
        }
      ]
    }
  })).count;

  const result = {
    ok: true,
    now: now.toISOString(),
    retention: {
      generalDays: GENERAL_RETENTION_DAYS,
      logDays: LOG_RETENTION_DAYS,
      paymentDays: PAYMENT_RETENTION_DAYS,
      paymentRawDays: PAYMENT_RAW_RETENTION_DAYS
    },
    counts
  };

  await logDataAudit({
    action: "RETENTION_CLEANUP",
    resourceType: "Retention",
    meta: result
  });

  return result;
}

export async function maybeRunRetentionCleanup({ force = false } = {}) {
  const state = retentionState();
  const now = Date.now();
  if (!force) {
    if (state.inFlight) return state.inFlight;
    if (state.lastRunAt && now - state.lastRunAt < RETENTION_SWEEP_INTERVAL_MS) return null;
  }

  state.inFlight = (async () => {
    let succeeded = false;
    try {
      const result = await runRetentionCleanup();
      succeeded = true;
      return result;
    } catch (error) {
      console.error("[retention] cleanup failed", safeError(error));
      return null;
    } finally {
      if (succeeded) {
        state.lastRunAt = Date.now();
      }
      state.inFlight = null;
    }
  })();

  return state.inFlight;
}

function timingSafeEqualToken(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  try {
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

export async function assertRetentionAccess(request) {
  const providedKey =
    request.headers.get("x-retention-key") ||
    request.headers.get("x-cron-key") ||
    request.headers.get("x-api-key") ||
    "";

  if (RETENTION_CRON_KEY && timingSafeEqualToken(providedKey, RETENTION_CRON_KEY)) {
    return {
      ok: true,
      scope: "cron"
    };
  }

  const session = await getServerSession(authConfig).catch(() => null);
  if (!session?.user) {
    return {
      ok: false,
      status: 401,
      message: "api.common.unauthorized"
    };
  }

  const role = String(session.user.role || "").toUpperCase();
  const isAdmin = role === "ADMIN" || session.user.isAdmin === true;
  if (!isAdmin) {
    return {
      ok: false,
      status: 403,
      message: "api.common.forbidden"
    };
  }

  return {
    ok: true,
    scope: "admin"
  };
}
