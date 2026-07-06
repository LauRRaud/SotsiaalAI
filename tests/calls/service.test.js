import assert from "node:assert/strict";
import test from "node:test";

import { AccessToken, TrackSource } from "livekit-server-sdk";

import {
  buildLiveKitGrant,
  cancelSpeakRequest,
  createCallService,
  createRecordingRequest,
  createSpeakRequest
} from "../../lib/calls/service.js";

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
    async updateMany({ where, data }) {
      const matches = await this.findMany({ where });
      matches.forEach(row => Object.assign(row, data, { updatedAt: new Date() }));
      return { count: matches.length };
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
