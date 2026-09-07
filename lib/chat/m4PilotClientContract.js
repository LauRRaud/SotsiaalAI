import { renderAnswer } from '../rag-v2/pilot/presentation.js';

// Failed turns expose a localized status key, never the protected draft or diagnostics.
export function pilotChatResult(turn, convId) {
  if (turn.state !== 'completed') {
    const terminal = ['answer_rejected', 'stopped'].includes(turn.state);
    return { ok: terminal, messageKey: terminal ? turn.failureKind === 'context' ? 'm4Pilot.contextFailed' : turn.failureKind === 'references' ? 'm4Pilot.referenceFailed' : 'm4Pilot.answerFailed'
      : turn.state === 'unknown' ? 'm4Pilot.unknown' : 'm4Pilot.pending', pilotState: turn.state,
      completionStatus: terminal ? 'FAILED' : 'PENDING', sources: [], ...(turn.context ? { pilotContext: turn.context } : {}) };
  }
  const answer = renderAnswer(turn.answer, turn.answerVersion);
  const sources = turn.sources.map(s => ({ key: `${turn.id}/${s.ref}`, id: `${turn.id}/${s.ref}`, title: s.title,
    label: `${s.ref} · ${s.title} · ${s.used ? 'Vastuses kasutatud' : 'Ainult otsingus leitud'}`, pages: s.pages,
    short_ref: `${s.ref} · ${s.title} · ${s.used ? 'Vastuses kasutatud' : 'Ainult otsingus leitud'}`,
    url: `/chat-source?convId=${encodeURIComponent(convId)}&turnId=${encodeURIComponent(turn.id)}&ref=${encodeURIComponent(s.ref)}`,
    source_type: 'm4_pilot', used: s.used }));
  return { ok: true, answer, sources, displayed_sources: sources, completionStatus: 'COMPLETED', pilotKind: turn.answer.kind, pilotMode: turn.mode,
    ...(turn.context ? { pilotContext: turn.context } : {}) };
}

export function pilotChatMessages(turns, convId) {
  return turns.flatMap(turn => {
    const result = pilotChatResult(turn, convId);
    return [{ role: 'user', text: turn.question, createdAt: turn.createdAt },
      { role: 'ai', text: result.answer || '', messageKey: result.messageKey, sources: result.sources,
        completionStatus: result.completionStatus, pilotState: turn.state, createdAt: turn.createdAt }];
  });
}
