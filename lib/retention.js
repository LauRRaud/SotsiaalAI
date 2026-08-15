import crypto from "node:crypto";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logDataAudit } from "@/lib/privacy/audit";
import { safeError } from "@/lib/privacy/safeError";
import { usageService } from "@/lib/usage/service";
import { expireDataExports, runNextDataExport } from "@/lib/dataExport/service";
import { purgeExpiredCallRecordings } from "@/lib/calls/recordingRetention";
import { purgeExpiredServiceLogReportArchives } from "@/lib/serviceLog/reportRetention";
import { purgeExpiredServiceLogData } from "@/lib/serviceLog/privacyLifecycle";
import { cleanupVerificationLinkDispatchRetention } from "@/lib/auth/verificationLinkDispatch";

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_DAYS = 365;

function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

export const GENERAL_RETENTION_DAYS = Math.max(1, readPositiveNumber(process.env.DATA_RETENTION_DAYS, 90));
/* Seitse aastat ei ole siin vaikeväärtus, vaid AVALDATUD lubadus: privaatsus-
   tingimuste punkt 7.9 ütleb kasutajale „minimaalne makse- ja raamatupidamis-
   alune kirje säilib kuni 7 aastat". Põrand oli varem `GENERAL_RETENTION_DAYS`
   (90 päeva), seega `PAYMENT_RETENTION_DAYS=90` oleks selle lubaduse vaikselt
   90 päevale langetanud — ilma veata, hoiatuseta ja logireata. Sama veaklass
   mis `WELLBEING_MIN_GROUP_SIZE=1` (SOL-WB-06): keskkond saab säilitustähtaega
   ainult TÕSTA. Raamatupidamise seadus § 12 lubab seadusel nõuda pikemat. */
export const PAYMENT_MINIMUM_RETENTION_DAYS = 7 * YEAR_DAYS;

export function resolvePaymentRetentionDays(options = {}) {
  const env = options.env || process.env;
  return Math.max(
    PAYMENT_MINIMUM_RETENTION_DAYS,
    readPositiveNumber(env?.PAYMENT_RETENTION_DAYS, PAYMENT_MINIMUM_RETENTION_DAYS)
  );
}

export const PAYMENT_RETENTION_DAYS = resolvePaymentRetentionDays();
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
const USAGE_RESERVATION_REAPER_BATCH_SIZE = Math.min(
  1_000,
  Math.max(1, Math.trunc(readPositiveNumber(process.env.USAGE_RESERVATION_REAPER_BATCH_SIZE, 100)))
);

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

export function buildExpiredHelpListingWhere(generalCutoff) {
  return {
    updatedAt: { lt: generalCutoff },
    status: { in: ["CLOSED", "CANCELLED", "ARCHIVED"] },
    matches: { none: {} }
  };
}

export async function cleanupDomainEventRetention(
  db,
  { now = new Date(), logRetentionDays = LOG_RETENTION_DAYS } = {}
) {
  if (!db?.domainEvent?.deleteMany) throw new TypeError("DomainEvent retention database is required");
  const cutoff = (days) => new Date(now.getTime() - Math.max(1, Number(days) || 1) * DAY_MS);
  const [short30, standard90, auditLong] = await Promise.all([
    db.domainEvent.deleteMany({
      where: { retentionClass: "short30", occurredAt: { lt: cutoff(30) } }
    }),
    db.domainEvent.deleteMany({
      where: { retentionClass: "standard90", occurredAt: { lt: cutoff(90) } }
    }),
    db.domainEvent.deleteMany({
      where: { retentionClass: "audit_long", occurredAt: { lt: cutoff(logRetentionDays) } }
    })
  ]);
  return {
    short30: Number(short30?.count || 0),
    standard90: Number(standard90?.count || 0),
    auditLong: Number(auditLong?.count || 0)
  };
}

function normalizeIds(rows = []) {
  return rows
    .map((row) => String(row?.id || "").trim())
    .filter(Boolean);
}

export async function releaseExpiredUsageReservations({
  now = new Date(),
  prismaClient = prisma,
  service = usageService
} = {}) {
  const expired = await prismaClient.usageReservation.findMany({
    where: {
      status: "RESERVED",
      expiresAt: { lt: now }
    },
    orderBy: { expiresAt: "asc" },
    take: USAGE_RESERVATION_REAPER_BATCH_SIZE,
    select: {
      userId: true,
      idempotencyKey: true
    }
  });

  const counts = { released: 0, skipped: 0 };
  for (const reservation of expired) {
    try {
      const result = await service.release({
        userId: reservation.userId,
        idempotencyKey: reservation.idempotencyKey,
        reason: "reservation_expired"
      });
      if (result?.reused) counts.skipped += 1;
      else counts.released += 1;
    } catch (error) {
      if (error?.code === "USAGE_RESERVATION_STATE_CONFLICT") {
        counts.skipped += 1;
        continue;
      }
      throw error;
    }
  }
  return counts;
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
    verificationLinkDispatches: 0,
    emailOtpCodes: 0,
    loginTempTokens: 0,
    trustedDevices: 0,
    invites: 0,
    conversationRuns: 0,
    conversations: 0,
    chatLogs: 0,
    paymentLogs: 0,
    helpMatches: 0,
    helpRequests: 0,
    helpOffers: 0,
    rooms: 0,
    artifacts: 0,
    documents: 0,
    fieldVisits: 0,
    fieldAudio: 0,
    documentAudits: 0,
    paymentsRawTrimmed: 0,
    paymentsDeleted: 0,
    subscriptionsDeleted: 0,
    billingMandatesPurged: 0,
    paymentEmailOutboxDeleted: 0,
    cancelAtPeriodEndRevoked: 0,
    domainEventsShort30: 0,
    domainEventsStandard90: 0,
    domainEventsAuditLong: 0,
    accountDeletionJobsRetried: 0,
    accountDeletionJobsDone: 0,
    accountDeletionJobsFailed: 0,
    usageReservationsReleased: 0,
    usageReservationsReleaseSkipped: 0,
    dataExportsExpired: 0,
    dataExportsProcessed: 0,
    dataExportsFailed: 0,
    callRecordingsScanned: 0,
    callRecordingsPurged: 0,
    serviceLogReportArchivesScanned: 0,
    serviceLogReportArchivesPurged: 0,
    serviceLogReportArchivesFailed: 0,
    serviceReportSharesScanned: 0,
    serviceReportSharesPurged: 0,
    serviceReportSharesFailed: 0,
    serviceLogEntriesPurged: 0,
    serviceLogNarrativesPurged: 0,
    serviceLogVisitsPurged: 0,
    serviceLogRoutesPurged: 0,
    serviceLogReferralsPurged: 0,
    serviceLogTimeSamplesPurged: 0,
    serviceLogCoreFailed: 0,
    wellbeingSupportSharesScanned: 0,
    wellbeingSupportShareContentPurged: 0,
    wellbeingSupportShareReceiptsPurged: 0,
    materialRetentionQueued: 0,
    materialRetentionProcessed: 0,
    materialRetentionFailed: 0,
    materialQuarantinesPurged: 0,
    materialQuarantinesFailed: 0
  };

  const expiredUsageReservations = await releaseExpiredUsageReservations({ now });
  counts.usageReservationsReleased = expiredUsageReservations.released;
  counts.usageReservationsReleaseSkipped = expiredUsageReservations.skipped;

  if (prisma.domainEvent?.deleteMany) {
    const domainEvents = await cleanupDomainEventRetention(prisma, { now });
    counts.domainEventsShort30 = domainEvents.short30;
    counts.domainEventsStandard90 = domainEvents.standard90;
    counts.domainEventsAuditLong = domainEvents.auditLong;
  }

  counts.dataExportsExpired = await expireDataExports({ db: prisma, now });
  try {
    const exportJob = await runNextDataExport({ db: prisma, now });
    counts.dataExportsProcessed = exportJob ? 1 : 0;
  } catch (error) {
    counts.dataExportsFailed = 1;
    console.error("[retention] data export worker failed", safeError(error));
  }

  if (prisma.materialSubmission?.findMany && prisma.materialUploadQuarantine?.findMany) {
    try {
      const {
        processNextMaterialRetentionJob,
        scheduleDueMaterialRetention,
        sweepExpiredMaterialQuarantines
      } = await import("@/lib/materials/retention");
      const scheduled = await scheduleDueMaterialRetention({ db: prisma, now });
      counts.materialRetentionQueued = scheduled.queued;
      for (let processed = 0; processed < 100; processed += 1) {
        const outcome = await processNextMaterialRetentionJob({ db: prisma, now });
        if (!outcome) break;
        if (outcome.status === "failed") counts.materialRetentionFailed += 1;
        else counts.materialRetentionProcessed += 1;
      }
      const quarantines = await sweepExpiredMaterialQuarantines({ db: prisma, now });
      counts.materialQuarantinesPurged = quarantines.filter(item => item.status === "done").length;
      counts.materialQuarantinesFailed = quarantines.filter(item => item.status === "failed").length;
    } catch (error) {
      counts.materialRetentionFailed += 1;
      console.error("[retention] material retention worker failed", safeError(error));
    }
  }

  // E6 (12 K1): kõnesalvestiste retention'i jõustus — auto-purge (retentionUntil
  // möödas) kustutab füüsilise failiobjekti + seotud dokumendi ja märgib rea DELETED.
  // Uinub, kuni RECORDING_ENABLED lülitab salvestuse sisse (siis on ka read olemas).
  if (prisma.callRecordingFile?.findMany) {
    try {
      const recordings = await purgeExpiredCallRecordings({ db: prisma, now: () => now });
      counts.callRecordingsScanned = recordings.scanned;
      counts.callRecordingsPurged = recordings.purged;
      counts.callRecordingsPurgeFailed = recordings.failed || 0;
    } catch (error) {
      console.error("[retention] call recording purge failed", safeError(error));
    }

    /* SOL-CALL-10 — kestuselae jõustus. LiveKit ei tunne „maksimaalset kestust",
       seega peab peatamise ütlema server. See sweep on tema hääl: sama tee nagu
       inimese vajutatud stopp, ainult tegija on taotluse esitaja. Elab siin, sest
       see on ainus tsükkel, mis toodangus juba kindlalt käib — eraldi taimer
       oleks neljas asi, mida keegi ei jälgi. */
    try {
      /* Teenus ehitatakse OTSE, mitte `roomRoutes` kaudu: too tõmbaks kaasa
         next-auth'i ja `@/auth`-i (ja retention on nende impordiahelas juba ise
         sees). Peatamise rada vajab ainult prisma't ja egress'i. */
      const { createCallService } = await import("@/lib/calls/service");
      const overdue = await createCallService({ prisma }).stopOverdueRecordings({});
      counts.callRecordingsOverdueScanned = overdue.scanned;
      counts.callRecordingsAutoStopped = overdue.stopped;
      counts.callRecordingsAutoStopFailed = overdue.failed;
    } catch (error) {
      console.error("[retention] call recording duration sweep failed", safeError(error));
    }
  }

  if (prisma.serviceLogReportLegalArchive?.findMany) {
    const reportArchives = await purgeExpiredServiceLogReportArchives({ db: prisma, now });
    counts.serviceLogReportArchivesScanned = reportArchives.scanned;
    counts.serviceLogReportArchivesPurged = reportArchives.purged;
    counts.serviceLogReportArchivesFailed = reportArchives.failed;
  }

  if (prisma.serviceReportShare?.findMany) {
    const { purgeServiceReportShareFiles } = await import("@/lib/serviceLog/reportShare");
    const shares = await purgeServiceReportShareFiles({ db: prisma, now });
    counts.serviceReportSharesScanned = shares.scanned;
    counts.serviceReportSharesPurged = shares.purged;
    counts.serviceReportSharesFailed = shares.failed;
  }

  if (prisma.serviceEntry?.findMany) {
    try {
      const serviceLog = await purgeExpiredServiceLogData({ db: prisma, now });
      counts.serviceLogEntriesPurged = serviceLog.entries;
      counts.serviceLogNarrativesPurged = serviceLog.narratives;
      counts.serviceLogVisitsPurged = serviceLog.visits;
      counts.serviceLogRoutesPurged = serviceLog.routes;
      counts.serviceLogReferralsPurged = serviceLog.referrals;
      counts.serviceLogTimeSamplesPurged = serviceLog.timeSamples;
    } catch (error) {
      counts.serviceLogCoreFailed = 1;
      console.error("[retention] service log core purge failed", safeError(error));
    }
  }

  if (prisma.wellbeingSupportShare?.findMany) {
    const { purgeExpiredSupportShares } = await import("@/lib/org/supportShare");
    const supportShares = await purgeExpiredSupportShares({ db: prisma, now });
    counts.wellbeingSupportSharesScanned = supportShares.scanned;
    counts.wellbeingSupportShareContentPurged = supportShares.contentPurged;
    counts.wellbeingSupportShareReceiptsPurged = supportShares.receiptsPurged;
  }

  const retryBefore = new Date(Date.now() - 5 * 60 * 1000);
  const pendingAccountDeletionJobs = await prisma.dataDeletionJob.findMany({
    where: {
      action: "USER_DELETE",
      resourceType: "User",
      status: { in: ["pending", "failed"] },
      updatedAt: { lt: retryBefore }
    },
    orderBy: { updatedAt: "asc" },
    take: 20,
    select: { id: true }
  });

  const retryDeletionJob = pendingAccountDeletionJobs.length
    ? (await import("@/lib/privacy/retryDeletionJob")).retryDeletionJob
    : null;
  for (const job of pendingAccountDeletionJobs) {
    counts.accountDeletionJobsRetried += 1;
    try {
      const result = await retryDeletionJob({ jobId: job.id });
      if (result?.status === "done") counts.accountDeletionJobsDone += 1;
      else counts.accountDeletionJobsFailed += 1;
    } catch (error) {
      counts.accountDeletionJobsFailed += 1;
      console.error("[retention] account deletion retry failed", safeError(error));
    }
  }

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

  counts.verificationLinkDispatches = await cleanupVerificationLinkDispatchRetention(prisma, { now });

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
    where: buildExpiredHelpListingWhere(generalCutoff)
  })).count;

  counts.helpOffers = (await prisma.helpOffer.deleteMany({
    where: buildExpiredHelpListingWhere(generalCutoff)
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
      ownerId: true,
      title: true,
      originalName: true,
      kind: true,
      mime: true,
      size: true,
      sha256: true,
      storagePath: true,
      updatedAt: true
    }
  });

  if (staleDocuments.length) {
    const [{ deleteStoredDocument }, { deleteDocumentRagReference }, { deleteTrackedStorageFile }] = await Promise.all([
      import("@/lib/documents/server"),
      import("@/lib/privacy/documentDeletion"),
      import("@/lib/privacy/fileDeletion")
    ]);
    for (const document of staleDocuments) {
      const ragResult = await deleteDocumentRagReference({
        document,
        targetUserId: document.ownerId,
        action: "RAG_DELETE",
        auditResourceType: "UserDocument"
      });
      const fileResult = await deleteTrackedStorageFile({
        targetUserId: document.ownerId,
        resourceType: "UserDocument",
        resourceId: document.id,
        storagePath: document.storagePath,
        deleteFile: deleteStoredDocument
      });
      if (!ragResult.ok || !fileResult.ok) continue;
      const deleted = await prisma.userDocument.deleteMany({ where: { id: document.id } });
      counts.documents += deleted.count;
      if (deleted.count) {
        await logDataAudit({
          targetUserId: document.ownerId,
          action: "RETENTION_DOCUMENT_DELETE",
          resourceType: "UserDocument",
          resourceId: document.id,
          meta: { kind: document.kind, mime: document.mime, size: document.size }
        });
      }
    }
  }

  // FIELD-V1 (O-FD-1): visit + raw-audio retention lives in an injectable
  // helper so the promise is unit-tested; here it runs on the shared client.
  if (prisma.fieldVisit?.deleteMany) {
    const { sweepFieldRetention } = await import("@/lib/field/retentionSweep");
    const fieldCounts = await sweepFieldRetention({ db: prisma, now, generalCutoff });
    counts.fieldVisits = fieldCounts.fieldVisits;
    counts.fieldAudio = fieldCounts.fieldAudio;
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

  // T09 E3: eemalda krüptitud recurring-mandaat (ja jääk-plaintekst), kui
  // maksevahend ei ole enam aktiivne recurring — REVOKED/EXPIRED/FAILED.
  counts.billingMandatesPurged = (await prisma.billingMethod.updateMany({
    where: {
      status: { in: ["REVOKED", "EXPIRED", "FAILED"] },
      updatedAt: { lt: generalCutoff },
      OR: [
        { providerTokenCipher: { not: null } },
        { providerToken: { not: null } },
        { providerTokenKeyId: { not: null } }
      ]
    },
    data: {
      providerToken: null,
      providerTokenCipher: null,
      providerTokenKeyId: null
    }
  })).count;

  // T09 E6: korista terminalsed makse-/kutse outbox-kirjed.
  if (prisma.paymentEmailOutbox?.deleteMany) {
    counts.paymentEmailOutboxDeleted = (await prisma.paymentEmailOutbox.deleteMany({
      where: {
        status: { in: ["SENT", "FAILED", "SKIPPED"] },
        updatedAt: { lt: generalCutoff }
      }
    })).count;
  }

  // T09 E4/O-M4: perioodi lõpus idempotentne revoke — cancelAtPeriodEnd tellimus,
  // mille makstud periood on möödas, lõpetatakse ausalt (CANCELED).
  counts.cancelAtPeriodEndRevoked = (await prisma.subscription.updateMany({
    where: {
      status: "ACTIVE",
      cancelAtPeriodEnd: true,
      validUntil: { not: null, lt: now }
    },
    data: {
      status: "CANCELED",
      canceledAt: now,
      nextBilling: null
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
