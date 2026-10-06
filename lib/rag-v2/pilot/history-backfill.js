import { openTurn } from './packed-json.js';
import { completedView } from './service.js';
import { historyMessages, historyRecord, isHistoryMessage } from './history.js';

// ADR-094: a turn published before its conversation was kept in the conversation's own messages has an audit row and
// two placeholder messages. While the row exists, the turn's durable record can be made from it, exactly as it is made
// at publication: after that the turn is in the history whichever plan runs, and it stays when the row is let go.
// A record of the first step, which did not yet keep the topic's user turns, gains them the same way.
// Only a placeholder, or the turn's own text, is ever written over; nothing is deleted and no audit row is changed.
export const PLACEHOLDERS = Object.freeze({ USER: '[Kaitstud M4 sisepiloodi küsimus]', ASSISTANT: '[Kaitstud M4 sisepiloodi vastus]' });

/** Gives every completed stored turn without a (whole) record its record. dryRun counts and writes nothing; where
 *  narrows the turns (a plan, a conversation's turns).
 *  Returns counts only: turns read, records made, records completed with the topic's user turns, turns that had
 *  theirs already, turns without their two messages, turns whose messages hold some other text (left as they are),
 *  turns whose record could not be made (by code), and the size of the records made. */
export async function recordStoredTurns(db, { dryRun = false, batch = 20, where = {} } = {}) {
  const summary = { turns: 0, made: 0, completed: 0, already: 0, noMessages: 0, otherContent: 0, failed: {}, recordBytes: { sum: 0, max: 0 }, dryRun };
  let cursor = null;
  for (;;) {
    const stored = await db.m4PilotTurn.findMany({ where: { ...where, state: 'completed' }, orderBy: { id: 'asc' }, take: batch, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { chatTurn: { select: { userMessageId: true, assistantMessageId: true } } } });
    if (!stored.length) break;
    cursor = stored.at(-1).id;
    for (const item of stored) {
      summary.turns++;
      const ids = [item.chatTurn?.userMessageId, item.chatTurn?.assistantMessageId];
      const [user, assistant] = ids.every(Boolean) ? await Promise.all(ids.map(id => db.conversationMessage.findUnique({ where: { id } }))) : [];
      if (!user || !assistant) { summary.noMessages++; continue; }
      const row = openTurn(item);
      let pair;
      try { pair = historyMessages(historyRecord({ row, view: completedView(row, row.payload.mode || 'real'), packet: row.payload.packet }), row.payload.question); }
      catch (error) { const code = error?.code || error?.name || 'error'; summary.failed[code] = (summary.failed[code] || 0) + 1; continue; }
      const record = pair.assistant.metadata.m4History, had = isHistoryMessage(assistant);
      if (had && (Array.isArray(assistant.metadata.m4History.dialogue?.userTurns) || !Array.isArray(record.dialogue.userTurns))) { summary.already++; continue; }
      if (![PLACEHOLDERS.USER, pair.user.content].includes(user.content) || ![PLACEHOLDERS.ASSISTANT, pair.assistant.content].includes(assistant.content)) { summary.otherContent++; continue; }
      if (!dryRun) await db.$transaction([
        db.conversationMessage.update({ where: { id: user.id }, data: { content: pair.user.content, metadata: { ...(user.metadata || {}), ...pair.user.metadata } } }),
        db.conversationMessage.update({ where: { id: assistant.id }, data: { content: pair.assistant.content, metadata: { ...(assistant.metadata || {}), ...pair.assistant.metadata } } })]);
      summary[had ? 'completed' : 'made']++;
      const bytes = Buffer.byteLength(JSON.stringify(record), 'utf8');
      summary.recordBytes.sum += bytes; summary.recordBytes.max = Math.max(summary.recordBytes.max, bytes);
    }
  }
  return summary;
}
