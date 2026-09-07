// null is an explicit owner-approved absence of a time limit, never an omitted default.
export const livePilotRows = () => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });
export const pilotExpired = value => value !== null && value !== undefined && new Date(value) <= new Date();
export function earliestExpiry(...values) {
  const times = values.filter(value => value !== null && value !== undefined).map(value => new Date(value).getTime());
  return times.length ? new Date(Math.min(...times)) : null;
}
export function pilotExpiry(config) {
  return earliestExpiry(config.expiresAt, config.retentionHours === null ? null : new Date(Date.now() + config.retentionHours * 3600000));
}
