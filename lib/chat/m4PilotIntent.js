const prefix = 'm4-pilot-intent/';
export async function rememberPilotIntent(storage, { convId, text, language, key, contextMode = 'new', contextTurnId, replyToTurnId, replyToBlock }) {
  const bytes = new TextEncoder().encode(JSON.stringify({ convId, text, language, contextMode, contextTurnId, replyToTurnId, replyToBlock }));
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  let previous; try { previous = JSON.parse(storage.getItem(prefix + convId)); } catch {}
  const chosen = previous?.hash === hash && previous.expiresAt > Date.now() ? previous.key : key;
  storage.setItem(prefix + convId, JSON.stringify({ hash, key: chosen, expiresAt: Date.now() + 24 * 3600000,
    context: { contextMode, contextTurnId, replyToTurnId, replyToBlock } }));
  return chosen;
}
export function readPilotIntentContext(storage, convId) {
  let pending; try { pending = JSON.parse(storage.getItem(prefix + convId)); } catch {}
  if (!pending?.context || pending.expiresAt <= Date.now() || !['same', 'new', 'new_person', 'correction'].includes(pending.context.contextMode)) return null;
  const { contextMode, contextTurnId, replyToTurnId, replyToBlock } = pending.context;
  return { contextMode, ...(contextTurnId ? { contextTurnId } : {}), ...(replyToTurnId ? { replyToTurnId } : {}), ...(replyToBlock ? { replyToBlock } : {}) };
}
export function forgetPilotIntent(storage, convId, key) {
  let previous; try { previous = JSON.parse(storage.getItem(prefix + convId)); } catch {}
  if (previous?.key === key) storage.removeItem(prefix + convId);
}
