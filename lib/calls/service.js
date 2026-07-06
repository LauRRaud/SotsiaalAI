import crypto from "node:crypto";

import { TrackSource } from "livekit-server-sdk";

import { createConfiguredEgressProvider } from "./egress.js";
import {
  buildRecordingFileName,
  CALL_RECORDING_MIME_TYPE,
  createRecordingStorage,
  retentionUntilFromEnv
} from "./recordingStorage.js";

const DEFAULT_MAX_PARTICIPANTS = 8;
const CALL_CONTEXT_ROOM = "ROOM";
const CALL_CONTEXT_COVISION = "COVISION";
const CALL_MODE_AUDIO = "AUDIO";
const CONSENT_TEXT_VERSION = "call-recording-consent-v1";
const OPEN_RECORDING_STATUSES = ["REQUESTED", "READY_TO_RECORD", "ACTIVE"];
const VISIBLE_RECORDING_STATUSES = ["REQUESTED", "READY_TO_RECORD", "DECLINED", "ACTIVE", "STOPPED", "COMPLETED", "FAILED"];

const RECORDING_PURPOSE_LABELS = {
  GENERAL_SUMMARY: "kokkuvõtte koostamine",
  CASE_SUMMARY: "juhtumikokkuvõtte mustand",
  PRE_ASSESSMENT_SUMMARY: "eelpöördumise kokkuvõte",
  STAR_HELPER: "STAR-i sisestamise abimaterjal",
  MENTORING_SUMMARY: "mentorluskohtumise kokkuvõte",
  COVISION_SUMMARY: "kovisiooni kokkuvõte",
  OTHER: "muu eesmärk"
};

function toPositiveInt(value, fallback = DEFAULT_MAX_PARTICIPANTS) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function normalizeCallProvider(value = process.env.CALL_PROVIDER) {
  const normalized = String(value || "mock").trim().toLowerCase();
  if (normalized === "livekit") return "LIVEKIT_SELF_HOSTED";
  return "MOCK";
}

export function getCallRuntimeConfig(env = process.env) {
  const provider = normalizeCallProvider(env.CALL_PROVIDER);
  const liveKitConfigured = Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
  return {
    provider,
    providerKey: provider === "LIVEKIT_SELF_HOSTED" ? "livekit" : "mock",
    liveKitConfigured,
    callServiceConfigured: provider !== "LIVEKIT_SELF_HOSTED" || liveKitConfigured,
    maxParticipants: toPositiveInt(env.CALL_MAX_PARTICIPANTS, DEFAULT_MAX_PARTICIPANTS),
    recordingEnabled: String(env.RECORDING_ENABLED || "false").toLowerCase() === "true",
    liveKitEgressEnabled: String(env.LIVEKIT_EGRESS_ENABLED || "false").toLowerCase() === "true"
  };
}

function slugSegment(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function buildProviderRoomName({ roomId, contextType = CALL_CONTEXT_ROOM, contextId = roomId, callSessionId }) {
  const context = String(contextType || CALL_CONTEXT_ROOM).toLowerCase();
  return `sotsiaalai-${context}-${slugSegment(contextId || roomId)}-call-${slugSegment(callSessionId)}`;
}

export function buildLiveKitGrant({ providerRoomName }) {
  return {
    room: providerRoomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canPublishSources: [TrackSource.MICROPHONE]
  };
}

function hashOptional(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function normalizeRecordingPurpose(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(RECORDING_PURPOSE_LABELS, normalized)
    ? normalized
    : "GENERAL_SUMMARY";
}

function recordingPurposeLabel(purpose, purposeText = "") {
  const normalized = normalizeRecordingPurpose(purpose);
  const custom = String(purposeText || "").trim();
  if (normalized === "OTHER" && custom) return custom;
  return RECORDING_PURPOSE_LABELS[normalized] || RECORDING_PURPOSE_LABELS.GENERAL_SUMMARY;
}

function buildRecordingConsentText({ requesterName, purpose, purposeText }) {
  const name = String(requesterName || "").trim() || "Kõne osaleja";
  const purposeLabel = recordingPurposeLabel(purpose, purposeText);
  return `${name} soovib selle helikõne salvestada.

Salvestust kasutatakse ainult märgitud eesmärgil: ${purposeLabel}.

Salvestus võib sisaldada isikuandmeid või tundlikku infot. Salvestus tehakse kättesaadavaks ainult õigustatud kasutajatele SotsiaalAI dokumentide vaates. Salvestust ei transkribeerita ega kasutata kokkuvõtte koostamiseks automaatselt; need tegevused käivitatakse eraldi kasutaja toiminguna.

Kas nõustud selle kõne salvestamisega?`;
}

function displayNameFor(entry) {
  const direct = String(entry?.displayName || "").trim();
  if (direct) return direct;
  const profileName = [entry?.user?.profile?.firstName, entry?.user?.profile?.lastName].filter(Boolean).join(" ").trim();
  if (profileName) return profileName;
  return String(entry?.user?.email || entry?.email || "").trim();
}

function serializeRecording(recording, currentUserId = "") {
  if (!recording) return null;
  const request = recording.request || recording;
  const consents = Array.isArray(recording.consents) ? recording.consents : request.consents || [];
  const files = Array.isArray(recording.files) ? recording.files : request.files || [];
  const consentedCount = consents.filter(consent => consent.status === "CONSENTED").length;
  const requiredCount = consents.length;
  const requesterName = displayNameFor(request.requestedBy) || request.requesterName || "Kõne osaleja";
  return {
    id: request.id,
    callSessionId: request.callSessionId,
    requestedByUserId: request.requestedByUserId,
    requesterName,
    purpose: request.purpose || "GENERAL_SUMMARY",
    purposeText: request.purposeText || "",
    purposeLabel: recordingPurposeLabel(request.purpose, request.purposeText),
    status: request.status || "REQUESTED",
    consentTextVersion: request.consentTextVersion,
    consentTextSnapshot: request.consentTextSnapshot,
    requestedAt: request.requestedAt,
    startedAt: request.startedAt || null,
    stoppedAt: request.stoppedAt || null,
    completedAt: request.completedAt || null,
    consentedCount,
    requiredCount,
    myConsent: currentUserId
      ? consents.find(consent => consent.userId === currentUserId) || null
      : null,
    consents: consents.map(consent => ({
      id: consent.id,
      userId: consent.userId,
      status: consent.status || "REQUESTED",
      respondedAt: consent.respondedAt || null,
      withdrawnAt: consent.withdrawnAt || null,
      displayName: displayNameFor(consent)
    })),
    files: files.map(file => ({
      id: file.id,
      status: file.status || "NOT_CREATED",
      createdDocumentId: file.createdDocumentId || null
    }))
  };
}

export function serializeCallSession(call, extras = {}) {
  if (!call) return null;
  const participants = Array.isArray(extras.participants) ? extras.participants : [];
  const speakRequests = Array.isArray(extras.speakRequests) ? extras.speakRequests : [];
  return {
    id: call.id,
    contextType: call.contextType || CALL_CONTEXT_ROOM,
    contextId: call.contextId || call.roomId || "",
    roomId: call.roomId || "",
    provider: call.provider || "MOCK",
    providerRoomName: call.providerRoomName || "",
    mode: call.mode || CALL_MODE_AUDIO,
    status: call.status || "ACTIVE",
    startedByUserId: call.startedByUserId || "",
    startedAt: call.startedAt,
    endedAt: call.endedAt || null,
    maxParticipants: call.maxParticipants || DEFAULT_MAX_PARTICIPANTS,
    participants: participants.map(participant => ({
      id: participant.id,
      userId: participant.userId,
      role: participant.role || "PARTICIPANT",
      joinedAt: participant.joinedAt,
      leftAt: participant.leftAt || null,
      micMuted: participant.micMuted === true,
      displayName: displayNameFor(participant)
    })),
    participantCount: participants.filter(participant => !participant.leftAt).length,
    speakRequests: speakRequests.map(request => ({
      id: request.id,
      userId: request.userId,
      status: request.status || "ACTIVE",
      requestedAt: request.requestedAt,
      resolvedAt: request.resolvedAt || null,
      resolvedByUserId: request.resolvedByUserId || null,
      displayName: displayNameFor(request)
    })),
    activeSpeakRequestCount: speakRequests.filter(request => request.status === "ACTIVE").length,
    recordingAllowed: call.contextType !== CALL_CONTEXT_COVISION,
    recording: call.contextType === CALL_CONTEXT_COVISION ? null : serializeRecording(extras.recording, extras.currentUserId),
    providerAvailable: extras.providerAvailable !== false,
    providerKey: extras.providerKey || (call.provider === "LIVEKIT_SELF_HOSTED" ? "livekit" : "mock")
  };
}

async function findActiveRoomCall(prisma, roomId) {
  return prisma.callSession.findFirst({
    where: {
      contextType: CALL_CONTEXT_ROOM,
      roomId,
      status: "ACTIVE"
    },
    orderBy: { startedAt: "desc" }
  });
}

async function findActiveContextCall(prisma, { contextType, contextId }) {
  return prisma.callSession.findFirst({
    where: {
      contextType,
      contextId,
      status: "ACTIVE"
    },
    orderBy: { startedAt: "desc" }
  });
}

async function loadCallState(prisma, callSessionId) {
  const call = await prisma.callSession.findFirst({
    where: { id: callSessionId }
  });
  if (!call) return null;
  const [participants, speakRequests, recordingRequest] = await Promise.all([
    prisma.callParticipant.findMany({
      where: { callSessionId, leftAt: null },
      orderBy: { joinedAt: "asc" },
      include: {
        user: {
          select: {
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    }),
    prisma.callSpeakRequest.findMany({
      where: { callSessionId, status: "ACTIVE" },
      orderBy: { requestedAt: "asc" },
      include: {
        user: {
          select: {
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    }),
    prisma.callRecordingRequest?.findFirst({
      where: {
        callSessionId,
        status: { in: VISIBLE_RECORDING_STATUSES }
      },
      orderBy: { requestedAt: "desc" },
      include: {
        requestedBy: {
          select: {
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        consents: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: {
                email: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        },
        files: true
      }
    })
  ]);
  return { call, participants, speakRequests, recording: recordingRequest ? { request: recordingRequest } : null };
}

async function ensureParticipant(prisma, { callSessionId, userId, role = "PARTICIPANT", now }) {
  const existing = await prisma.callParticipant.findFirst({
    where: {
      callSessionId,
      userId,
      leftAt: null
    }
  });
  if (existing) return existing;
  return prisma.callParticipant.create({
    data: {
      callSessionId,
      userId,
      role,
      joinedAt: now(),
      micMuted: false
    }
  });
}

async function endCallAndWriteSystemMessage(prisma, { call, now }) {
  const endedAt = now();
  const updated = await prisma.callSession.update({
    where: { id: call.id },
    data: {
      status: "ENDED",
      endedAt
    }
  });
  if (call.roomId && call.startedByUserId && prisma.roomMessage?.create) {
    await prisma.roomMessage.create({
      data: {
        roomId: call.roomId,
        authorId: call.startedByUserId,
        senderType: "ASSISTANT",
        content: `Helikõne toimus ${endedAt.toLocaleString("et-EE", { timeZone: "Europe/Tallinn" })}.`
      }
    });
  }
  return updated;
}

export async function createSpeakRequest({ prisma, callSessionId, userId, now = () => new Date() }) {
  const existing = await prisma.callSpeakRequest.findFirst({
    where: {
      callSessionId,
      userId,
      status: "ACTIVE"
    }
  });
  if (existing) return existing;
  return prisma.callSpeakRequest.create({
    data: {
      callSessionId,
      userId,
      status: "ACTIVE",
      requestedAt: now()
    }
  });
}

export async function cancelSpeakRequest({ prisma, callSessionId, userId, now = () => new Date() }) {
  return prisma.callSpeakRequest.updateMany({
    where: {
      callSessionId,
      userId,
      status: "ACTIVE"
    },
    data: {
      status: "CANCELLED",
      resolvedAt: now()
    }
  });
}

async function writeRecordingAudit(prisma, { action, actorUserId, resourceId, callSessionId, purpose, status }) {
  if (!prisma.dataAuditLog?.create) return null;
  return prisma.dataAuditLog.create({
    data: {
      actorUserId,
      action,
      resourceType: "CallRecordingRequest",
      resourceId,
      meta: {
        callSessionId,
        purpose,
        status
      }
    }
  }).catch(() => null);
}

async function activeParticipantFor(prisma, { callSessionId, userId }) {
  return prisma.callParticipant.findFirst({
    where: {
      callSessionId,
      userId,
      leftAt: null
    }
  });
}

async function activeParticipantsFor(prisma, callSessionId) {
  return prisma.callParticipant.findMany({
    where: {
      callSessionId,
      leftAt: null
    },
    orderBy: { joinedAt: "asc" }
  });
}

async function findOpenRecordingRequest(prisma, callSessionId) {
  if (!prisma.callRecordingRequest?.findFirst) return null;
  return prisma.callRecordingRequest.findFirst({
    where: {
      callSessionId,
      status: { in: OPEN_RECORDING_STATUSES }
    },
    orderBy: { requestedAt: "desc" }
  });
}

async function findActiveRecordingRequest(prisma, callSessionId) {
  if (!prisma.callRecordingRequest?.findFirst) return null;
  return prisma.callRecordingRequest.findFirst({
    where: {
      callSessionId,
      status: "ACTIVE"
    },
    orderBy: { startedAt: "desc" }
  });
}

async function ensureRecordingFilePlaceholder(prisma, { recordingRequestId, callSessionId }) {
  if (!prisma.callRecordingFile?.findFirst || !prisma.callRecordingFile?.create) return null;
  const existing = await prisma.callRecordingFile.findFirst({
    where: {
      recordingRequestId,
      callSessionId
    }
  });
  if (existing) return existing;
  return prisma.callRecordingFile.create({
    data: {
      recordingRequestId,
      callSessionId,
      status: "NOT_CREATED"
    }
  });
}

async function findRecordingFile(prisma, { recordingRequestId, callSessionId }) {
  if (!prisma.callRecordingFile?.findFirst) return null;
  return prisma.callRecordingFile.findFirst({
    where: {
      recordingRequestId,
      callSessionId
    }
  });
}

async function updateRecordingReadiness(prisma, { request, now = () => new Date() }) {
  const consents = await prisma.callRecordingConsent.findMany({
    where: { recordingRequestId: request.id }
  });
  if (consents.some(consent => consent.status === "DECLINED" || consent.status === "WITHDRAWN")) {
    return prisma.callRecordingRequest.update({
      where: { id: request.id },
      data: { status: "DECLINED", stoppedAt: request.stoppedAt || now() }
    });
  }
  if (consents.length > 0 && consents.every(consent => consent.status === "CONSENTED")) {
    return prisma.callRecordingRequest.update({
      where: { id: request.id },
      data: { status: "READY_TO_RECORD" }
    });
  }
  if (request.status === "READY_TO_RECORD") {
    return prisma.callRecordingRequest.update({
      where: { id: request.id },
      data: { status: "REQUESTED" }
    });
  }
  return request;
}

async function ensureConsentRowsForActiveParticipants(prisma, { request, participants, now = () => new Date() }) {
  for (const participant of participants) {
    const existing = await prisma.callRecordingConsent.findFirst({
      where: {
        recordingRequestId: request.id,
        userId: participant.userId
      }
    });
    if (!existing) {
      await prisma.callRecordingConsent.create({
        data: {
          recordingRequestId: request.id,
          callSessionId: request.callSessionId,
          userId: participant.userId,
          status: "REQUESTED",
          consentTextVersion: request.consentTextVersion,
          consentTextSnapshot: request.consentTextSnapshot,
          createdAt: now()
        }
      });
    }
  }
  return updateRecordingReadiness(prisma, { request, now });
}

export async function createRecordingRequest({
  prisma,
  callSessionId,
  userId,
  canModerate = false,
  purpose = "GENERAL_SUMMARY",
  purposeText = "",
  requesterName = "",
  now = () => new Date()
}) {
  const state = await loadCallState(prisma, callSessionId);
  if (!state || state.call.status !== "ACTIVE") throw new Error("call.not_active");
  if (state.call.contextType === CALL_CONTEXT_COVISION) throw new Error("call.recording_not_allowed");
  const requester = await activeParticipantFor(prisma, { callSessionId, userId });
  if (!requester) throw new Error("call.participant_not_found");
  if (!canModerate && requester.role !== "HOST") throw new Error("call.recording_forbidden");

  const existing = await findOpenRecordingRequest(prisma, callSessionId);
  if (existing) return existing;

  const normalizedPurpose = normalizeRecordingPurpose(purpose);
  const snapshot = buildRecordingConsentText({
    requesterName,
    purpose: normalizedPurpose,
    purposeText
  });
  const request = await prisma.callRecordingRequest.create({
    data: {
      callSessionId,
      requestedByUserId: userId,
      purpose: normalizedPurpose,
      purposeText: String(purposeText || "").trim() || null,
      status: "REQUESTED",
      consentTextVersion: CONSENT_TEXT_VERSION,
      consentTextSnapshot: snapshot,
      requestedAt: now()
    }
  });
  const participants = await activeParticipantsFor(prisma, callSessionId);
  await ensureConsentRowsForActiveParticipants(prisma, { request, participants, now });
  await ensureRecordingFilePlaceholder(prisma, { recordingRequestId: request.id, callSessionId });
  await writeRecordingAudit(prisma, {
    action: "CALL_RECORDING_REQUESTED",
    actorUserId: userId,
    resourceId: request.id,
    callSessionId,
    purpose: normalizedPurpose,
    status: "REQUESTED"
  });
  return request;
}

async function respondToRecordingConsent({
  prisma,
  callSessionId,
  recordingRequestId,
  userId,
  decision,
  ipAddress,
  userAgent,
  now = () => new Date()
}) {
  const normalizedDecision = String(decision || "").trim().toUpperCase();
  if (!["CONSENTED", "DECLINED", "WITHDRAWN"].includes(normalizedDecision)) {
    throw new Error("call.recording_invalid_decision");
  }
  const participant = await activeParticipantFor(prisma, { callSessionId, userId });
  if (!participant) throw new Error("call.participant_not_found");
  const request = await prisma.callRecordingRequest.findFirst({
    where: {
      id: recordingRequestId,
      callSessionId,
      status: { in: OPEN_RECORDING_STATUSES }
    }
  });
  if (!request) throw new Error("call.recording_request_not_found");
  let consent = await prisma.callRecordingConsent.findFirst({
    where: {
      recordingRequestId,
      userId
    }
  });
  if (!consent) {
    consent = await prisma.callRecordingConsent.create({
      data: {
        recordingRequestId,
        callSessionId,
        userId,
        status: "REQUESTED",
        consentTextVersion: request.consentTextVersion,
        consentTextSnapshot: request.consentTextSnapshot
      }
    });
  }
  const status = normalizedDecision;
  const updatedConsent = await prisma.callRecordingConsent.update({
    where: { id: consent.id },
    data: {
      status,
      respondedAt: status === "WITHDRAWN" ? consent.respondedAt || now() : now(),
      withdrawnAt: status === "WITHDRAWN" ? now() : null,
      ipAddressHash: hashOptional(ipAddress),
      userAgentHash: hashOptional(userAgent)
    }
  });
  const updatedRequest = await updateRecordingReadiness(prisma, { request, now });
  await writeRecordingAudit(prisma, {
    action: status === "CONSENTED" ? "CALL_RECORDING_CONSENTED" : status === "DECLINED" ? "CALL_RECORDING_DECLINED" : "CALL_RECORDING_WITHDRAWN",
    actorUserId: userId,
    resourceId: request.id,
    callSessionId,
    purpose: request.purpose,
    status: updatedRequest.status
  });
  return {
    ...updatedRequest,
    consent: updatedConsent
  };
}

async function cancelRecordingRequest({
  prisma,
  callSessionId,
  recordingRequestId,
  userId,
  canModerate = false,
  now = () => new Date()
}) {
  const request = await prisma.callRecordingRequest.findFirst({
    where: {
      id: recordingRequestId,
      callSessionId,
      status: { in: OPEN_RECORDING_STATUSES }
    }
  });
  if (!request) throw new Error("call.recording_request_not_found");
  if (request.requestedByUserId !== userId && !canModerate) throw new Error("call.forbidden");
  const updated = await prisma.callRecordingRequest.update({
    where: { id: request.id },
    data: {
      status: "STOPPED",
      stoppedAt: now()
    }
  });
  await writeRecordingAudit(prisma, {
    action: "CALL_RECORDING_CANCELLED",
    actorUserId: userId,
    resourceId: request.id,
    callSessionId,
    purpose: request.purpose,
    status: "STOPPED"
  });
  return updated;
}

export function createCallService({
  prisma,
  provider = null,
  egress = null,
  recordingStorage = null,
  now = () => new Date(),
  maxParticipants = getCallRuntimeConfig().maxParticipants
}) {
  if (!prisma) throw new Error("call.prisma_required");
  const resolvedProvider = provider || {
    provider: normalizeCallProvider(),
    async createJoinToken() {
      return null;
    }
  };
  const resolvedEgress = egress || createConfiguredEgressProvider();
  const resolvedRecordingStorage = recordingStorage || createRecordingStorage();

  async function requireRecordingController({ callSessionId, recordingRequest, userId, canModerate }) {
    const participant = await activeParticipantFor(prisma, { callSessionId, userId });
    const isHost = participant?.role === "HOST";
    const isRequester = recordingRequest?.requestedByUserId === userId;
    if (!participant && !canModerate) throw new Error("call.participant_not_found");
    if (!isRequester && !isHost && !canModerate) throw new Error("call.recording_forbidden");
    return participant;
  }

  async function allRequiredConsentsPresent({ recordingRequestId, callSessionId }) {
    const [participants, consents] = await Promise.all([
      activeParticipantsFor(prisma, callSessionId),
      prisma.callRecordingConsent.findMany({ where: { recordingRequestId } })
    ]);
    if (participants.length < 1) return false;
    const byUserId = new Map(consents.map(consent => [consent.userId, consent]));
    return participants.every(participant => byUserId.get(participant.userId)?.status === "CONSENTED");
  }

  async function createRecordingDocument({ recordingRequest, fileName, finalized }) {
    if (!prisma.userDocument?.create) return null;
    return prisma.userDocument.create({
      data: {
        ownerId: recordingRequest.requestedByUserId,
        title: `Helikõne salvestus – ${now().toLocaleDateString("et-EE", { timeZone: "Europe/Tallinn" })}`,
        originalName: fileName,
        kind: "CALL_AUDIO_RECORDING",
        templateFor: null,
        agentAllowed: false,
        mime: finalized.mimeType,
        size: finalized.fileSizeBytes,
        sha256: finalized.checksum,
        storagePath: finalized.storagePath
      }
    });
  }

  async function stopActiveRecordingForCall({ callSessionId, userId }) {
    const activeRecording = await findActiveRecordingRequest(prisma, callSessionId);
    if (!activeRecording) return null;
    return stopRecording({
      callSessionId,
      recordingRequestId: activeRecording.id,
      userId,
      canModerate: true
    }).catch(async () => {
      await prisma.callRecordingRequest.update({
        where: { id: activeRecording.id },
        data: {
          status: "FAILED",
          stoppedAt: now()
        }
      }).catch(() => null);
      return null;
    });
  }

  async function startRecording({ callSessionId, recordingRequestId, userId, canModerate = false }) {
    const state = await loadCallState(prisma, callSessionId);
    if (!state || state.call.status !== "ACTIVE") throw new Error("call.not_active");
    if (state.call.mode !== CALL_MODE_AUDIO) throw new Error("call.recording_audio_only_required");
    const request = await prisma.callRecordingRequest.findFirst({
      where: {
        id: recordingRequestId,
        callSessionId
      }
    });
    if (!request || request.status !== "READY_TO_RECORD") throw new Error("call.recording_not_ready");
    await requireRecordingController({ callSessionId, recordingRequest: request, userId, canModerate });
    const consentReady = await allRequiredConsentsPresent({ recordingRequestId, callSessionId });
    if (!consentReady) throw new Error("call.recording_not_ready");
    if (resolvedEgress.configured === false) throw new Error("call.recording_disabled");

    await resolvedRecordingStorage.ensureReady?.();
    const startedAt = now();
    const fileName = buildRecordingFileName({ callSessionId, recordingRequestId, now: startedAt });
    const retentionUntil = retentionUntilFromEnv(process.env, startedAt);
    const existingFile = await ensureRecordingFilePlaceholder(prisma, { recordingRequestId, callSessionId });
    await prisma.callRecordingFile.update({
      where: { id: existingFile.id },
      data: {
        status: "PROCESSING",
        filePath: fileName,
        mimeType: CALL_RECORDING_MIME_TYPE,
        retentionUntil
      }
    });

    let egressInfo;
    try {
      egressInfo = await resolvedEgress.startAudioRecording({
        callSessionId,
        recordingRequestId,
        providerRoomName: state.call.providerRoomName,
        fileName,
        audioOnly: true,
        videoOnly: false
      });
    } catch (error) {
      await prisma.callRecordingFile.update({
        where: { id: existingFile.id },
        data: { status: "FAILED" }
      }).catch(() => null);
      throw error;
    }

    await prisma.callRecordingFile.update({
      where: { id: existingFile.id },
      data: {
        egressId: egressInfo?.egressId || null,
        status: "PROCESSING",
        filePath: fileName,
        mimeType: CALL_RECORDING_MIME_TYPE,
        retentionUntil
      }
    });
    const updated = await prisma.callRecordingRequest.update({
      where: { id: request.id },
      data: {
        status: "ACTIVE",
        startedAt
      }
    });
    await writeRecordingAudit(prisma, {
      action: "CALL_RECORDING_STARTED",
      actorUserId: userId,
      resourceId: request.id,
      callSessionId,
      purpose: request.purpose,
      status: "ACTIVE"
    });
    return updated;
  }

  async function stopRecording({ callSessionId, recordingRequestId, userId, canModerate = false }) {
    const state = await loadCallState(prisma, callSessionId);
    if (!state) throw new Error("call.not_active");
    const request = await prisma.callRecordingRequest.findFirst({
      where: {
        id: recordingRequestId,
        callSessionId
      }
    });
    if (!request || request.status !== "ACTIVE") throw new Error("call.recording_not_active");
    await requireRecordingController({ callSessionId, recordingRequest: request, userId, canModerate });
    const stoppedAt = now();
    const file = await findRecordingFile(prisma, { recordingRequestId, callSessionId });
    if (!file) throw new Error("call.recording_file_not_found");

    try {
      await resolvedEgress.stopRecording?.({ egressId: file.egressId, callSessionId, recordingRequestId });
      const finalized = await resolvedRecordingStorage.finalizeRecordingFile({
        fileName: file.filePath,
        startedAt: request.startedAt,
        stoppedAt
      });
      const retentionUntil = file.retentionUntil || retentionUntilFromEnv(process.env, stoppedAt);
      const document = await createRecordingDocument({
        recordingRequest: request,
        fileName: file.filePath,
        finalized
      });
      await prisma.callRecordingFile.update({
        where: { id: file.id },
        data: {
          status: "AVAILABLE",
          filePath: finalized.storagePath,
          mimeType: finalized.mimeType,
          fileSizeBytes: finalized.fileSizeBytes,
          durationSeconds: finalized.durationSeconds,
          checksum: finalized.checksum,
          createdDocumentId: document?.id || null,
          retentionUntil
        }
      });
      const updated = await prisma.callRecordingRequest.update({
        where: { id: request.id },
        data: {
          status: "COMPLETED",
          stoppedAt,
          completedAt: stoppedAt
        }
      });
      await writeRecordingAudit(prisma, {
        action: "CALL_RECORDING_STOPPED",
        actorUserId: userId,
        resourceId: request.id,
        callSessionId,
        purpose: request.purpose,
        status: "COMPLETED"
      });
      return updated;
    } catch (error) {
      await prisma.callRecordingFile.update({
        where: { id: file.id },
        data: { status: "FAILED" }
      }).catch(() => null);
      await prisma.callRecordingRequest.update({
        where: { id: request.id },
        data: {
          status: "FAILED",
          stoppedAt
        }
      }).catch(() => null);
      throw error;
    }
  }

  async function getRoomCall({ roomId }) {
    const call = await findActiveRoomCall(prisma, roomId);
    if (!call) return null;
    const state = await loadCallState(prisma, call.id);
    return serializeCallSession(state.call, {
      participants: state.participants,
      speakRequests: state.speakRequests,
      recording: state.recording,
      providerKey: resolvedProvider.provider === "LIVEKIT_SELF_HOSTED" ? "livekit" : "mock"
    });
  }

  async function getContextCall({ contextType, contextId }) {
    const call = await findActiveContextCall(prisma, { contextType, contextId });
    if (!call) return null;
    const state = await loadCallState(prisma, call.id);
    return serializeCallSession(state.call, {
      participants: state.participants,
      speakRequests: state.speakRequests,
      recording: state.call.contextType === CALL_CONTEXT_COVISION ? null : state.recording,
      providerKey: resolvedProvider.provider === "LIVEKIT_SELF_HOSTED" ? "livekit" : "mock"
    });
  }

  async function startRoomCall({ roomId, userId }) {
    const existing = await findActiveRoomCall(prisma, roomId);
    if (existing) return existing;
    let call;
    try {
      call = await prisma.callSession.create({
        data: {
          contextType: CALL_CONTEXT_ROOM,
          contextId: roomId,
          roomId,
          provider: resolvedProvider.provider || normalizeCallProvider(),
          providerRoomName: "",
          mode: CALL_MODE_AUDIO,
          status: "ACTIVE",
          startedByUserId: userId,
          startedAt: now(),
          maxParticipants: toPositiveInt(maxParticipants, DEFAULT_MAX_PARTICIPANTS)
        }
      });
    } catch (error) {
      const active = await findActiveRoomCall(prisma, roomId);
      if (active) return active;
      throw error;
    }
    const providerRoomName = buildProviderRoomName({ roomId, callSessionId: call.id });
    const updated = await prisma.callSession.update({
      where: { id: call.id },
      data: { providerRoomName }
    });
    await ensureParticipant(prisma, {
      callSessionId: updated.id,
      userId,
      role: "HOST",
      now
    });
    return updated;
  }

  async function startContextCall({ contextType, contextId, userId }) {
    const existing = await findActiveContextCall(prisma, { contextType, contextId });
    if (existing) return existing;
    let call;
    try {
      call = await prisma.callSession.create({
        data: {
          contextType,
          contextId,
          roomId: contextType === CALL_CONTEXT_ROOM ? contextId : null,
          provider: resolvedProvider.provider || normalizeCallProvider(),
          providerRoomName: "",
          mode: CALL_MODE_AUDIO,
          status: "ACTIVE",
          startedByUserId: userId,
          startedAt: now(),
          maxParticipants: toPositiveInt(maxParticipants, DEFAULT_MAX_PARTICIPANTS)
        }
      });
    } catch (error) {
      const active = await findActiveContextCall(prisma, { contextType, contextId });
      if (active) return active;
      throw error;
    }
    const providerRoomName = buildProviderRoomName({ contextType, contextId, callSessionId: call.id });
    const updated = await prisma.callSession.update({
      where: { id: call.id },
      data: { providerRoomName }
    });
    await ensureParticipant(prisma, {
      callSessionId: updated.id,
      userId,
      role: "HOST",
      now
    });
    return updated;
  }

  async function joinCall({ callSessionId, userId }) {
    const state = await loadCallState(prisma, callSessionId);
    if (!state || state.call.status !== "ACTIVE") throw new Error("call.not_active");
    const existing = state.participants.find(participant => participant.userId === userId);
    if (!existing && state.participants.length >= state.call.maxParticipants) {
      throw new Error("call.participants_full");
    }
    await ensureParticipant(prisma, {
      callSessionId,
      userId,
      role: state.call.startedByUserId === userId ? "HOST" : "PARTICIPANT",
      now
    });
    const openRecording = await findOpenRecordingRequest(prisma, callSessionId);
    if (openRecording) {
      await ensureConsentRowsForActiveParticipants(prisma, {
        request: openRecording,
        participants: await activeParticipantsFor(prisma, callSessionId),
        now
      });
    }
    const token = await resolvedProvider.createJoinToken?.({
      callSession: state.call,
      userId
    });
    const refreshed = await loadCallState(prisma, callSessionId);
    return {
      call: serializeCallSession(refreshed.call, {
        participants: refreshed.participants,
        speakRequests: refreshed.speakRequests,
        recording: refreshed.recording,
        currentUserId: userId,
        providerKey: resolvedProvider.provider === "LIVEKIT_SELF_HOSTED" ? "livekit" : "mock"
      }),
      token
    };
  }

  async function leaveCall({ callSessionId, userId }) {
    const state = await loadCallState(prisma, callSessionId);
    if (!state || state.call.status !== "ACTIVE") throw new Error("call.not_active");
    await prisma.callParticipant.updateMany({
      where: {
        callSessionId,
        userId,
        leftAt: null
      },
      data: {
        leftAt: now()
      }
    });
    await cancelSpeakRequest({ prisma, callSessionId, userId, now });
    const activeCount = await prisma.callParticipant.count({
      where: {
        callSessionId,
        leftAt: null
      }
    });
    if (activeCount < 1) {
      await stopActiveRecordingForCall({ callSessionId, userId });
      return endCallAndWriteSystemMessage(prisma, { call: state.call, now });
    }
    return state.call;
  }

  async function endCall({ callSessionId, userId, canModerate = false }) {
    const state = await loadCallState(prisma, callSessionId);
    if (!state || state.call.status !== "ACTIVE") throw new Error("call.not_active");
    if (state.call.startedByUserId !== userId && !canModerate) throw new Error("call.forbidden");
    await stopActiveRecordingForCall({ callSessionId, userId });
    await prisma.callParticipant.updateMany({
      where: {
        callSessionId,
        leftAt: null
      },
      data: { leftAt: now() }
    });
    await prisma.callSpeakRequest.updateMany({
      where: {
        callSessionId,
        status: "ACTIVE"
      },
      data: {
        status: "CANCELLED",
        resolvedAt: now()
      }
    });
    return endCallAndWriteSystemMessage(prisma, { call: state.call, now });
  }

  async function setMuted({ callSessionId, userId, micMuted }) {
    const participant = await prisma.callParticipant.findFirst({
      where: {
        callSessionId,
        userId,
        leftAt: null
      }
    });
    if (!participant) throw new Error("call.participant_not_found");
    return prisma.callParticipant.update({
      where: { id: participant.id },
      data: { micMuted: micMuted === true }
    });
  }

  async function resolveSpeakRequest({ callSessionId, requestId, userId, canModerate = false }) {
    if (!canModerate) throw new Error("call.forbidden");
    const request = await prisma.callSpeakRequest.findFirst({
      where: {
        id: requestId,
        callSessionId,
        status: "ACTIVE"
      }
    });
    if (!request) throw new Error("call.speak_request_not_found");
    return prisma.callSpeakRequest.update({
      where: { id: requestId },
      data: {
        status: "RESOLVED",
        resolvedAt: now(),
        resolvedByUserId: userId
      }
    });
  }

  return {
    getRoomCall,
    getContextCall,
    startRoomCall,
    startContextCall,
    joinCall,
    leaveCall,
    endCall,
    setMuted,
    createSpeakRequest: ({ callSessionId, userId }) => createSpeakRequest({ prisma, callSessionId, userId, now }),
    cancelSpeakRequest: ({ callSessionId, userId }) => cancelSpeakRequest({ prisma, callSessionId, userId, now }),
    resolveSpeakRequest,
    createRecordingRequest: ({ callSessionId, userId, canModerate, purpose, purposeText, requesterName }) => createRecordingRequest({
      prisma,
      callSessionId,
      userId,
      canModerate,
      purpose,
      purposeText,
      requesterName,
      now
    }),
    respondToRecordingConsent: ({ callSessionId, recordingRequestId, userId, decision, ipAddress, userAgent }) => respondToRecordingConsent({
      prisma,
      callSessionId,
      recordingRequestId,
      userId,
      decision,
      ipAddress,
      userAgent,
      now
    }),
    cancelRecordingRequest: ({ callSessionId, recordingRequestId, userId, canModerate }) => cancelRecordingRequest({
      prisma,
      callSessionId,
      recordingRequestId,
      userId,
      canModerate,
      now
    }),
    startRecording,
    stopRecording
  };
}
