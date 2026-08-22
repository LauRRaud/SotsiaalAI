const DEFAULT_CHAT_SESSION_TURN_LIMIT = 200;
const MAX_CHAT_SESSION_TURN_LIMIT = 1000;

export function getChatSessionTurnLimit(value = process.env.CHAT_SESSION_TURN_LIMIT) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_CHAT_SESSION_TURN_LIMIT;
  return Math.min(MAX_CHAT_SESSION_TURN_LIMIT, Math.max(1, Math.trunc(parsed)));
}
