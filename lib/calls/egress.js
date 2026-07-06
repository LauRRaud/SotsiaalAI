import { resolveEgressOutputFilePath } from "./recordingStorage.js";

function envEnabled(value) {
  return String(value || "false").trim().toLowerCase() === "true";
}

function getRecordingRuntimeConfig(env = process.env) {
  const recordingEnabled = envEnabled(env.RECORDING_ENABLED);
  const liveKitEgressEnabled = envEnabled(env.LIVEKIT_EGRESS_ENABLED);
  const liveKitConfigured = Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
  return {
    recordingEnabled,
    liveKitEgressEnabled,
    liveKitConfigured,
    configured: recordingEnabled && liveKitEgressEnabled && liveKitConfigured
  };
}

function recordingDisabledError() {
  return new Error("call.recording_disabled");
}

export function createConfiguredEgressProvider(env = process.env) {
  const config = getRecordingRuntimeConfig(env);
  return {
    configured: config.configured,

    async startAudioRecording({ providerRoomName, fileName }) {
      if (!config.configured) throw recordingDisabledError();
      const { EgressClient, EncodedFileType } = await import("livekit-server-sdk");
      const client = new EgressClient(env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
      const filepath = resolveEgressOutputFilePath(fileName, env);
      const info = await client.startRoomCompositeEgress(
        providerRoomName,
        {
          file: {
            filepath,
            fileType: EncodedFileType.OGG
          }
        },
        {
          audioOnly: true,
          videoOnly: false
        }
      );
      return {
        egressId: info?.egressId || ""
      };
    },

    async stopRecording({ egressId }) {
      if (!config.configured) throw recordingDisabledError();
      if (!egressId) return null;
      const { EgressClient } = await import("livekit-server-sdk");
      const client = new EgressClient(env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
      return client.stopEgress(egressId);
    }
  };
}
