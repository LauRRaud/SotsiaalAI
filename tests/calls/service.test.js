import assert from "node:assert/strict";
import test from "node:test";

import { AccessToken, TrackSource } from "livekit-server-sdk";

import {
  buildLiveKitGrant,
  cancelSpeakRequest,
  createCallService,
  createRecordingRequest,
  createSpeakRequest,
  serializeCallSession
} from "../../lib/calls/service.js";

function matchRows(rows, where = {}) {
  return rows.filter(row => {
    if (where?.id != null && row.id !== where.id) return false;
    if (where?.roomId != null && row.roomId !== where.roomId) return false;
    if (where?.callSessionId != null && row.callSessionId !== where.callSessionId) return false;
    if (where?.recordingRequestId != null && row.recordingRequestId !== where.recordingRequestId) return false;
    if (where?.userId != null && row.userId !== where.userId) return false;
    if (where?.leftAt === null && row.leftAt != null) return false;
    if (where?.status != null && typeof where.status !== "object" && row.status !== where.status) return false;
    if (where?.status?.in && !where.status.in.includes(row.status)) return false;
    return true;
  });
}

function createModel(initial = []) {
  const rows = [...initial];
  return {
    rows,
    async findFirst({ where, orderBy } = {}) {
      const filtered = rows.filter(row => {
        if (where?.id != null && row.id !== where.id) return false;
        if (where?.roomId != null && row.roomId !== where.roomId) return false;
        if (where?.status != null && typeof where.status !== "object" && row.status !== where.status) return false;
        if (where?.callSessionId != null && row.callSessionId !== where.callSessionId) return false;
        if (where?.recordingRequestId != null && row.recordingRequestId !== where.recordingRequestId) return false;
        if (where?.userId != null && row.userId !== where.userId) return false;
        if (where?.leftAt === null && row.leftAt != null) return false;
        if (where?.status?.in && !where.status.in.includes(row.status)) return false;
        return true;
      });
      if (orderBy?.requestedAt === "asc") {
        filtered.sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));
      }
      return filtered[0] || null;
    },
    async findMany({ where, orderBy } = {}) {
      let filtered = rows.filter(row => {
        if (where?.id != null && row.id !== where.id) return false;
        if (where?.callSessionId != null && row.callSessionId !== where.callSessionId) return false;
        if (where?.recordingRequestId != null && row.recordingRequestId !== where.recordingRequestId) return false;
        if (where?.userId != null && row.userId !== where.userId) return false;
        if (where?.leftAt === null && row.leftAt != null) return false;
        if (where?.status != null && typeof where.status !== "object" && row.status !== where.status) return false;
        if (where?.status?.in && !where.status.in.includes(row.status)) return false;
        return true;
      });
      if (orderBy?.requestedAt === "asc") {
        filtered = [...filtered].sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));
      }
      return filtered;
    },
    async count({ where } = {}) {
      return (await this.findMany({ where })).length;
    },
    async create({ data }) {
      const row = {
        id: data.id || `row_${rows.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data
      };
      rows.push(row);
      return row;
    },
    async update({ where, data }) {
      const row = rows.find(candidate => candidate.id === where.id);
      if (!row) throw new Error("not_found");
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
    updateMany({ where, data }) {
      // Üks UPDATE ... WHERE on andmebaasis atomaarne: sobivate ridade leidmine ja
      // muutmine ei ole eraldi samme, mille vahele teine kutse mahub. Varem tegi
      // see fake `await this.findMany(...)` ENNE mutatsiooni, nii et kaks
      // paralleelset kutset said mõlemad sama rea kätte ja tingimuslik üleminek
      // (`where: { status: "ACTIVE" }`) ei kaitsnud millegi eest. Match + mutatsioon
      // käivad nüüd ühes sünkroonses lõigus, nii et testid mõõdavad koodi, mitte
      // fake'i puudust. Tagastab Promise'i, sest kutsujad await'ivad.
      const matches = matchRows(rows, where);
      matches.forEach(row => Object.assign(row, data, { updatedAt: new Date() }));
      return Promise.resolve({ count: matches.length });
    },
    async deleteMany({ where } = {}) {
      const matches = await this.findMany({ where });
      let count = 0;
      for (const match of matches) {
        const index = rows.findIndex(row => row.id === match.id);
        if (index >= 0) {
          rows.splice(index, 1);
          count += 1;
        }
      }
      return { count };
    }
  };
}

function createPrisma() {
  return {
    callSession: createModel(),
    callParticipant: createModel(),
    callSpeakRequest: createModel(),
    callRecordingRequest: createModel(),
    callRecordingConsent: createModel(),
    callRecordingFile: createModel(),
    dataAuditLog: createModel(),
    userDocument: createModel(),
    roomMessage: createModel(),
    $transaction: async callback => callback(createPrisma())
  };
}

test("Covision call payload exposes only opaque participant identifiers", () => {
  const call = serializeCallSession(
    {
      id: "call_covision",
      contextType: "COVISION",
      contextId: "case_1",
      status: "ACTIVE",
      startedByUserId: "user_owner"
    },
    {
      participants: [
        {
          id: "call_participant_owner",
          userId: "user_owner",
          joinedAt: new Date("2026-07-14T10:00:00.000Z"),
          user: { email: "owner@example.test", profile: {} }
        },
        {
          id: "call_participant_guest",
          userId: "user_guest",
          joinedAt: new Date("2026-07-14T10:01:00.000Z"),
          user: { email: "guest@example.test", profile: { firstName: "Mari", lastName: "Mets" } }
        }
      ],
      speakRequests: [
        {
          id: "speak_1",
          userId: "user_guest",
          resolvedByUserId: "user_owner",
          status: "RESOLVED",
          requestedAt: new Date("2026-07-14T10:02:00.000Z"),
          user: { email: "guest@example.test", profile: { firstName: "Mari", lastName: "Mets" } }
        }
      ]
    }
  );

  assert.equal(call.startedByParticipantId, "call_participant_owner");
  assert.equal("startedByUserId" in call, false);
  assert.deepEqual(call.participants.map(participant => participant.id), [
    "call_participant_owner",
    "call_participant_guest"
  ]);
  assert.equal(call.participants.every(participant => !("userId" in participant)), true);
  assert.equal(call.participants[0].displayName, "");
  assert.equal(call.participants[1].displayName, "Mari Mets");
  assert.equal(call.speakRequests[0].participantId, "call_participant_guest");
  assert.equal(call.speakRequests[0].resolvedByParticipantId, "call_participant_owner");
  assert.equal("userId" in call.speakRequests[0], false);
  assert.equal("resolvedByUserId" in call.speakRequests[0], false);
  assert.doesNotMatch(JSON.stringify(call), /owner@example\.test|guest@example\.test|user_owner|user_guest/);
});

test("room call payload retains its user identifier contract", () => {
  const call = serializeCallSession(
    {
      id: "call_room",
      contextType: "ROOM",
      roomId: "room_1",
      status: "ACTIVE",
      startedByUserId: "user_owner"
    },
    {
      participants: [{ id: "participant_1", userId: "user_owner" }],
      speakRequests: [{
        id: "speak_1",
        userId: "user_owner",
        resolvedByUserId: "user_owner",
        status: "RESOLVED"
      }]
    }
  );

  assert.equal(call.startedByUserId, "user_owner");
  assert.equal(call.participants[0].userId, "user_owner");
  assert.equal(call.speakRequests[0].userId, "user_owner");
  assert.equal(call.speakRequests[0].resolvedByUserId, "user_owner");
});

test("starting a room call reuses the existing active session", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, now: () => new Date("2026-05-24T09:00:00Z") });

  const first = await service.startRoomCall({ roomId: "room_1", userId: "user_1" });
  const second = await service.startRoomCall({ roomId: "room_1", userId: "user_2" });

  assert.equal(first.id, second.id);
  assert.equal(prisma.callSession.rows.length, 1);
  assert.equal(first.provider, "MOCK");
  assert.equal(first.mode, "AUDIO");
});

test("joining respects max active participants", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, maxParticipants: 1 });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "user_1" });

  await assert.rejects(
    () => service.joinCall({ callSessionId: call.id, userId: "user_2" }),
    /call.participants_full/
  );
});

test("leaving as the last active participant ends the call and writes a system message", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, now: () => new Date("2026-05-24T10:15:00Z") });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "user_1" });

  const result = await service.leaveCall({ callSessionId: call.id, userId: "user_1" });

  assert.equal(result.status, "ENDED");
  assert.equal(prisma.callSession.rows[0].status, "ENDED");
  assert.match(prisma.roomMessage.rows[0].content, /Helikõne toimus/);
});

test("speak requests are active once per user, ordered by requested time, and cancellable", async () => {
  const prisma = createPrisma();
  const call = await prisma.callSession.create({
    data: {
      id: "call_1",
      roomId: "room_1",
      status: "ACTIVE",
      maxParticipants: 8,
      startedByUserId: "host"
    }
  });

  await createSpeakRequest({ prisma, callSessionId: call.id, userId: "user_2", now: () => new Date("2026-05-24T09:00:02Z") });
  await createSpeakRequest({ prisma, callSessionId: call.id, userId: "user_1", now: () => new Date("2026-05-24T09:00:01Z") });
  const duplicate = await createSpeakRequest({ prisma, callSessionId: call.id, userId: "user_1", now: () => new Date("2026-05-24T09:00:03Z") });

  assert.equal(duplicate.userId, "user_1");
  const active = await prisma.callSpeakRequest.findMany({ where: { callSessionId: call.id, status: "ACTIVE" }, orderBy: { requestedAt: "asc" } });
  assert.deepEqual(active.map(request => request.userId), ["user_1", "user_2"]);

  await cancelSpeakRequest({ prisma, callSessionId: call.id, userId: "user_1", now: () => new Date("2026-05-24T09:00:04Z") });
  const remaining = await prisma.callSpeakRequest.findMany({ where: { callSessionId: call.id, status: "ACTIVE" }, orderBy: { requestedAt: "asc" } });
  assert.deepEqual(remaining.map(request => request.userId), ["user_2"]);
});

test("LiveKit grants are audio-only and scoped to a concrete room", () => {
  const grant = buildLiveKitGrant({ providerRoomName: "sotsiaalai-room-room_1-call-call_1" });

  assert.deepEqual(grant, {
    room: "sotsiaalai-room-room_1-call-call_1",
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canPublishSources: [TrackSource.MICROPHONE]
  });
});

test("LiveKit grants can be serialized by the SDK", async () => {
  const token = new AccessToken("test-key", "test-secret", {
    identity: "user_1",
    ttl: "10m"
  });

  token.addGrant(buildLiveKitGrant({ providerRoomName: "sotsiaalai-room-room_1-call-call_1" }));

  const jwt = await token.toJwt();
  assert.equal(typeof jwt, "string");
  assert.ok(jwt.length > 0);
});

test("a call does not create recording requests or files by default", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });

  await service.startRoomCall({ roomId: "room_1", userId: "host" });

  assert.equal(prisma.callRecordingRequest.rows.length, 0);
  assert.equal(prisma.callRecordingConsent.rows.length, 0);
  assert.equal(prisma.callRecordingFile.rows.length, 0);
});

test("moderator can request recording consent and every active participant gets a consent row", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, now: () => new Date("2026-05-24T12:00:00Z") });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });

  const request = await createRecordingRequest({
    prisma,
    callSessionId: call.id,
    userId: "host",
    canModerate: true,
    purpose: "CASE_SUMMARY",
    purposeText: "Juhtumikokkuvotte mustand",
    requesterName: "Test Admin",
    now: () => new Date("2026-05-24T12:01:00Z")
  });

  assert.equal(request.status, "REQUESTED");
  assert.equal(prisma.callRecordingConsent.rows.length, 2);
  assert.deepEqual(prisma.callRecordingConsent.rows.map(consent => consent.userId).sort(), ["host", "user_2"]);
  assert.match(request.consentTextSnapshot, /Test Admin soovib selle helikõne salvestada/);
  assert.equal(prisma.callRecordingFile.rows.length, 1);
  assert.equal(prisma.callRecordingFile.rows[0].status, "NOT_CREATED");
});

test("non-moderator cannot request recording consent", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });

  await assert.rejects(
    () => createRecordingRequest({
      prisma,
      callSessionId: call.id,
      userId: "user_2",
      canModerate: false,
      purpose: "GENERAL_SUMMARY",
      requesterName: "Osaleja"
    }),
    /call.recording_forbidden/
  );
});

test("all participants consenting moves recording request to READY_TO_RECORD without transcription or audio file", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });

  const request = await createRecordingRequest({
    prisma,
    callSessionId: call.id,
    userId: "host",
    canModerate: true,
    purpose: "GENERAL_SUMMARY",
    requesterName: "Test Admin"
  });

  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  const updated = await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "CONSENTED" });

  assert.equal(updated.status, "READY_TO_RECORD");
  assert.equal(prisma.callRecordingFile.rows.length, 1);
  assert.equal(prisma.callRecordingFile.rows[0].status, "NOT_CREATED");
  assert.equal(prisma.callRecordingFile.rows[0].filePath, undefined);
});

test("one participant declining prevents recording from starting", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });

  const request = await createRecordingRequest({
    prisma,
    callSessionId: call.id,
    userId: "host",
    canModerate: true,
    purpose: "OTHER",
    purposeText: "Muu eesmark",
    requesterName: "Test Admin"
  });

  const updated = await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "DECLINED" });

  assert.equal(updated.status, "DECLINED");
  assert.equal(prisma.callRecordingConsent.rows.find(consent => consent.userId === "user_2").status, "DECLINED");
});

test("recording cannot start before READY_TO_RECORD or when consent is missing", async () => {
  const prisma = createPrisma();
  const egress = { startAudioRecording: async () => ({ egressId: "egress_1" }) };
  const service = createCallService({ prisma, egress });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await createRecordingRequest({
    prisma,
    callSessionId: call.id,
    userId: "host",
    canModerate: true,
    purpose: "GENERAL_SUMMARY",
    requesterName: "Host"
  });

  await assert.rejects(
    () => service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /call.recording_not_ready/
  );

  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await assert.rejects(
    () => service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /call.recording_not_ready/
  );
});

test("declined recording request cannot start", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, egress: { startAudioRecording: async () => ({ egressId: "egress_1" }) } });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await createRecordingRequest({
    prisma,
    callSessionId: call.id,
    userId: "host",
    canModerate: true,
    purpose: "GENERAL_SUMMARY",
    requesterName: "Host"
  });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "DECLINED" });

  await assert.rejects(
    () => service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /call.recording_not_ready/
  );
});

test("READY_TO_RECORD starts audio-only Egress and marks file processing", async () => {
  const prisma = createPrisma();
  const egressCalls = [];
  const service = createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async payload => {
        egressCalls.push(payload);
        return { egressId: "egress_audio_1" };
      }
    },
    recordingStorage: {
      ensureReady: async () => {}
    }
  });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "CONSENTED" });

  const started = await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  assert.equal(started.status, "ACTIVE");
  assert.equal(prisma.callRecordingFile.rows[0].status, "PROCESSING");
  assert.equal(prisma.callRecordingFile.rows[0].egressId, "egress_audio_1");
  assert.equal(egressCalls[0].audioOnly, true);
  assert.equal(egressCalls[0].videoOnly, false);
  assert.match(egressCalls[0].fileName, /^call-recording-/);
});

test("stopping an active recording finalizes file and creates a call audio document without transcription", async () => {
  const prisma = createPrisma();
  const service = createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => ({ egressId: "egress_audio_1" }),
      stopRecording: async () => ({ ok: true })
    },
    recordingStorage: {
      finalizeRecordingFile: async ({ fileName }) => ({
        storagePath: `uploads/${fileName}`,
        mimeType: "audio/webm",
        fileSizeBytes: 1234,
        durationSeconds: 42,
        checksum: "sha256-test"
      })
    }
  });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  const stopped = await service.stopRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  assert.equal(stopped.status, "COMPLETED");
  assert.equal(prisma.callRecordingFile.rows[0].status, "AVAILABLE");
  assert.equal(prisma.callRecordingFile.rows[0].createdDocumentId, prisma.userDocument.rows[0].id);
  assert.equal(prisma.userDocument.rows[0].kind, "CALL_AUDIO_RECORDING");
  assert.equal(prisma.userDocument.rows[0].ownerId, "host");
  assert.equal(prisma.userDocument.rows[0].mime, "audio/webm");
  assert.equal(prisma.dataAuditLog.rows.some(row => row.action === "CALL_RECORDING_STARTED"), true);
  assert.equal(prisma.dataAuditLog.rows.some(row => row.action === "CALL_RECORDING_STOPPED"), true);
  assert.equal(prisma.dataAuditLog.rows.some(row => row.action === "CALL_TRANSCRIPTION_STARTED"), false);
});

test("failed Egress stop marks recording and file failed", async () => {
  const prisma = createPrisma();
  const service = createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => ({ egressId: "egress_failed_1" }),
      stopRecording: async () => {
        throw new Error("egress with status EGRESS_FAILED cannot be stopped");
      }
    },
    recordingStorage: {
      finalizeRecordingFile: async () => {
        throw new Error("should not finalize after failed stop");
      }
    }
  });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  await assert.rejects(
    () => service.stopRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /EGRESS_FAILED/
  );

  assert.equal(prisma.callRecordingRequest.rows[0].status, "FAILED");
  assert.equal(prisma.callRecordingFile.rows[0].status, "FAILED");
});

// --- T12 ROOMS-CALLS-V1 ---

test("T12 E1: ending an active room call clears active participants and marks it ended (audit 16 K1)", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "user_1" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });

  const ended = await service.endActiveRoomCall({ roomId: "room_1", actorUserId: "user_1" });

  assert.equal(ended.status, "ENDED");
  assert.equal(prisma.callSession.rows[0].status, "ENDED");
  const active = prisma.callParticipant.rows.filter(row => row.leftAt == null);
  assert.equal(active.length, 0, "no active participants remain after room-call end");
});

test("T12 E1: endActiveRoomCall is a no-op when the room has no active call", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const result = await service.endActiveRoomCall({ roomId: "room_without_call", actorUserId: "user_1" });
  assert.equal(result, null);
});

test("T12 E1: releasing a room member from calls clears their participation and auto-ends when last (audit 16 K3)", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  await service.startRoomCall({ roomId: "room_1", userId: "user_1" });

  await service.releaseRoomMemberFromCalls({ roomId: "room_1", userId: "user_1" });

  const participant = prisma.callParticipant.rows.find(row => row.userId === "user_1");
  assert.ok(participant.leftAt, "leaving member's participation is marked left");
  assert.equal(prisma.callSession.rows[0].status, "ENDED", "last participant leaving auto-ends the call");
});

test("T12 E1: leaving a call drops the leaver's unanswered consent so the request unlocks (audit 4 K2)", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  // Host consents; user_2 has not answered → request stays locked at REQUESTED.
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  assert.equal(prisma.callRecordingRequest.rows[0].status, "REQUESTED");

  // user_2 leaves before answering → their pending consent row must not lock it forever.
  await service.leaveCall({ callSessionId: call.id, userId: "user_2" });

  const leftoverConsent = prisma.callRecordingConsent.rows.find(row => row.userId === "user_2");
  assert.equal(leftoverConsent, undefined, "leaver's unanswered consent row is removed");
  assert.equal(prisma.callRecordingRequest.rows[0].status, "READY_TO_RECORD", "request unlocks over the remaining consenters");
});

test("T12 E2: a second recording request while one is open returns the same request without duplicating", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  const first = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  const second = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  assert.equal(second.id, first.id);
  assert.equal(prisma.callRecordingRequest.rows.length, 1);
});

test("T12 E2: a racing recording request that hits the unique index returns the winner, not a 500", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  const realCreate = prisma.callRecordingRequest.create.bind(prisma.callRecordingRequest);
  // Simulate the TOCTOU window: pre-check sees no open request, then a concurrent
  // winner inserts one and our create hits the partial-unique index (P2002).
  prisma.callRecordingRequest.create = async ({ data }) => {
    await realCreate({ data: { ...data, id: "raced_open_request" } });
    const error = new Error("Unique constraint failed on the fields: (`callSessionId`)");
    error.code = "P2002";
    throw error;
  };

  const result = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });

  assert.equal(result.id, "raced_open_request", "returns the concurrent winner instead of throwing");
  const openRows = prisma.callRecordingRequest.rows.filter(row => ["REQUESTED", "READY_TO_RECORD", "ACTIVE"].includes(row.status));
  assert.equal(openRows.length, 1, "no duplicate open request survives the race");
});

function activeRecordingService(prisma, { egressStops, finalize = false } = {}) {
  return createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => ({ egressId: "egress_active_1" }),
      stopRecording: async payload => {
        if (egressStops) egressStops.push(payload);
        return { ok: true };
      }
    },
    recordingStorage: {
      ensureReady: async () => {},
      ...(finalize
        ? {
            finalizeRecordingFile: async ({ fileName }) => ({
              storagePath: `uploads/${fileName}`,
              mimeType: "audio/ogg",
              fileSizeBytes: 2048,
              durationSeconds: 30,
              checksum: "sha256-e5"
            })
          }
        : {})
    }
  });
}

test("T12 E5: a positive consent decision during an ACTIVE recording does not demote it (audit 5 K1 d)", async () => {
  const prisma = createPrisma();
  const service = activeRecordingService(prisma);
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "CONSENTED" });
  const started = await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });
  assert.equal(started.status, "ACTIVE");

  // Re-affirming consent while ACTIVE must NOT flip the request back to READY_TO_RECORD.
  const afterReconsent = await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "CONSENTED" });

  assert.equal(afterReconsent.status, "ACTIVE", "positive consent keeps the recording ACTIVE");
  assert.equal(prisma.callRecordingRequest.rows[0].status, "ACTIVE");
});

test("T12 E5: withdrawing consent during an ACTIVE recording stops egress and discards the artifact (audit 5 K1 c)", async () => {
  const prisma = createPrisma();
  const egressStops = [];
  const service = activeRecordingService(prisma, { egressStops });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "CONSENTED" });
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  const afterWithdraw = await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "WITHDRAWN" });

  assert.equal(afterWithdraw.status, "STOPPED", "withdraw during ACTIVE stops the request");
  assert.equal(egressStops.length, 1, "egress was stopped exactly once");
  assert.equal(egressStops[0].egressId, "egress_active_1");
  assert.equal(prisma.callRecordingFile.rows[0].status, "DELETED", "the mixed artifact is discarded, not made available");
  assert.equal(prisma.userDocument.rows.length, 0, "no recording document is created on discard");
  assert.equal(prisma.dataAuditLog.rows.some(row => row.action === "CALL_RECORDING_DISCARDED"), true);
});

test("T12 E5: a late joiner during an ACTIVE recording halts it before they are recorded (audit 4 K1)", async () => {
  const prisma = createPrisma();
  const egressStops = [];
  const service = activeRecordingService(prisma, { egressStops, finalize: true });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "CONSENTED" });
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });
  assert.equal(prisma.callRecordingRequest.rows[0].status, "ACTIVE");

  // A third participant joins mid-recording without having consented.
  await service.joinCall({ callSessionId: call.id, userId: "user_3" });

  assert.equal(egressStops.length, 1, "the late join halted egress");
  assert.equal(prisma.callRecordingRequest.rows[0].status, "COMPLETED", "the fully-consented portion is finalized, not left running");
  assert.equal(prisma.callRecordingFile.rows[0].status, "AVAILABLE");
});

test("T12 E5: cancelling cannot silently stop an ACTIVE recording and orphan egress (audit 5 K1 a)", async () => {
  const prisma = createPrisma();
  const egressStops = [];
  const service = activeRecordingService(prisma, { egressStops });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  // Cancel targets only pre-ACTIVE requests; an ACTIVE one must be stopped (egress + finalize), not cancelled.
  await assert.rejects(
    () => service.cancelRecordingRequest({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /call\.recording_request_not_found/
  );
  assert.equal(prisma.callRecordingRequest.rows[0].status, "ACTIVE", "the ACTIVE recording is untouched by cancel");
  assert.equal(egressStops.length, 0, "cancel did not touch egress");
});

function completedRecordingService(prisma, { deleted } = {}) {
  return createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => ({ egressId: "egress_active_1" }),
      stopRecording: async () => ({ ok: true })
    },
    recordingStorage: {
      ensureReady: async () => {},
      finalizeRecordingFile: async ({ fileName }) => ({
        storagePath: `uploads/${fileName}`,
        mimeType: "audio/ogg",
        fileSizeBytes: 1024,
        durationSeconds: 12,
        checksum: "sha256-e6"
      }),
      deleteStoredArtifact: async ({ storagePath }) => {
        if (deleted) deleted.push(storagePath);
      }
    }
  });
}

async function completeARecording(service, prisma) {
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });
  await service.stopRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });
  return { call, request };
}

test("T12 E6: the recording owner can manually delete a completed recording (audit 12 K1)", async () => {
  const prisma = createPrisma();
  const deleted = [];
  const service = completedRecordingService(prisma, { deleted });
  const { call, request } = await completeARecording(service, prisma);
  assert.equal(prisma.callRecordingFile.rows[0].status, "AVAILABLE");

  await service.deleteRecordingFile({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: false });

  assert.equal(prisma.callRecordingFile.rows[0].status, "DELETED");
  assert.equal(deleted.length, 1, "physical artifact is deleted");
  assert.equal(prisma.userDocument.rows.length, 0, "recording document is removed");
  assert.equal(prisma.dataAuditLog.rows.some(row => row.action === "CALL_RECORDING_DELETED"), true);
});

test("T12 E6: a non-owner non-moderator cannot delete a recording", async () => {
  const prisma = createPrisma();
  const service = completedRecordingService(prisma, {});
  const { call, request } = await completeARecording(service, prisma);

  await assert.rejects(
    () => service.deleteRecordingFile({ callSessionId: call.id, recordingRequestId: request.id, userId: "intruder", canModerate: false }),
    /call\.recording_forbidden/
  );
  assert.equal(prisma.callRecordingFile.rows[0].status, "AVAILABLE", "a forbidden delete leaves the recording intact");
});

test("T12: two simultaneous last-leavers end the call once and write one system message (audit 4 K4)", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, now: () => new Date("2026-08-03T20:00:00Z") });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "user_1" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });

  // Mõlemad lahkuvad korraga: mõlemad loevad activeCount = 0 ja mõlemad jõuavad
  // lõpetamiseni. Varem kirjutas kumbki oma „Helikõne toimus …" sõnumi.
  const [first, second] = await Promise.all([
    service.leaveCall({ callSessionId: call.id, userId: "user_1" }),
    service.leaveCall({ callSessionId: call.id, userId: "user_2" })
  ]);

  assert.equal(first.status, "ENDED");
  assert.equal(second.status, "ENDED");
  assert.equal(prisma.callSession.rows.filter(row => row.status === "ENDED").length, 1);
  const systemMessages = prisma.roomMessage.rows.filter(row => /Helikõne toimus/.test(row.content || ""));
  assert.equal(systemMessages.length, 1);
});

test("T12: ending an already ended call does not add a second system message (audit 4 K4)", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, now: () => new Date("2026-08-03T20:05:00Z") });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "user_1" });

  await service.endCall({ callSessionId: call.id, userId: "user_1" });
  await assert.rejects(
    () => service.endCall({ callSessionId: call.id, userId: "user_1" }),
    /call.not_active/
  );

  const systemMessages = prisma.roomMessage.rows.filter(row => /Helikõne toimus/.test(row.content || ""));
  assert.equal(systemMessages.length, 1);
});
