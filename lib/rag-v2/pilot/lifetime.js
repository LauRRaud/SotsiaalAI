// null is an explicit owner-approved absence of a time limit, never an omitted default.
export const livePilotRows = () => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });
export const pilotExpired = value => value !== null && value !== undefined && new Date(value) <= new Date();
export function earliestExpiry(...values) {
  const times = values.filter(value => value !== null && value !== undefined).map(value => new Date(value).getTime());
  return times.length ? new Date(Math.min(...times)) : null;
}
// ADR-094: a conversation lives by the published rule, 90 days from its last activity (CONVERSATION_TTL_DAYS, as every
// other conversation), whatever time the plan gives a turn's audit row: the conversation is in its own messages and
// does not go with the row. The one exception is a plan with an explicit, owner-approved absence of any time limit
// (the development plan): its conversations are kept until deleted, as before.
export function conversationExpiry(config, now = new Date()) {
  if ((config.expiresAt ?? null) === null && (config.retentionHours ?? null) === null) return null;
  return new Date(now.getTime() + Math.max(1, Number(process.env.CONVERSATION_TTL_DAYS || 90)) * 86400000);
}
// When a turn's audit row ends: the plan's own end, or its retention time from now, whichever is first.
export function pilotExpiry(config) {
  return earliestExpiry(config.expiresAt, config.retentionHours === null ? null : new Date(Date.now() + config.retentionHours * 3600000));
}
