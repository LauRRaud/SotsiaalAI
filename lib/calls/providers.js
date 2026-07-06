import { AccessToken } from "livekit-server-sdk";

import { buildLiveKitGrant, getCallRuntimeConfig } from "@/lib/calls/service";

class MockCallProvider {
  provider = "MOCK";

  async createCallSession() {
    return null;
  }

  async createJoinToken({ callSession, userId }) {
    return `mock-call-token:${callSession.id}:${userId}`;
  }

  async joinCall() {
    return null;
  }

  async leaveCall() {
    return null;
  }

  async endCall() {
    return null;
  }
}

class LiveKitSelfHostedCallProvider {
  provider = "LIVEKIT_SELF_HOSTED";

  constructor(env = process.env) {
    this.url = env.LIVEKIT_URL || "";
    this.apiKey = env.LIVEKIT_API_KEY || "";
    this.apiSecret = env.LIVEKIT_API_SECRET || "";
  }

  get configured() {
    return Boolean(this.url && this.apiKey && this.apiSecret);
  }

  async createCallSession() {
    return null;
  }

  async createJoinToken({ callSession, userId }) {
    if (!this.configured) {
      const error = new Error("call.livekit_not_configured");
      error.status = 503;
      throw error;
    }
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: userId,
      name: userId,
      ttl: "10m"
    });
    token.addGrant(buildLiveKitGrant({ providerRoomName: callSession.providerRoomName }));
    return token.toJwt();
  }

  async joinCall() {
    return null;
  }

  async leaveCall() {
    return null;
  }

  async endCall() {
    return null;
  }
}

export function createConfiguredCallProvider(env = process.env) {
  const config = getCallRuntimeConfig(env);
  if (config.provider === "LIVEKIT_SELF_HOSTED") return new LiveKitSelfHostedCallProvider(env);
  return new MockCallProvider();
}
