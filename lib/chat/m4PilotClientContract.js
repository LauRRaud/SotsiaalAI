import { renderAnswer } from '../rag-v2/pilot/presentation.js';
import { detectCrisis } from './safety.js';

/** "Autor · Sotsiaaltöö 2/2025, lk 3–6": the checkable origin of a source, from fields the turn stored. */
export function citationLine({ authors, year, journal, issue, pageRange } = {}) {
  const people = Array.isArray(authors) && authors.length ? authors.length > 3 ? `${authors.slice(0, 3).join('; ')} jt` : authors.join('; ') : null;
  const where = [journal, issue, year && !String(issue || '').includes(String(year)) ? String(year) : null].filter(Boolean).join(' ');
  return [people, [where, pageRange ? `lk ${pageRange}` : null].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
}

// Failed turns expose a localized status key, never the protected draft or diagnostics.
// The crisis flag is derived from the stored question, so a reload shows the same notice.
export function pilotChatResult(turn, convId) {
  const isCrisis = detectCrisis(turn.question || '');
  if (turn.state !== 'completed') {
    const terminal = ['answer_rejected', 'stopped'].includes(turn.state);
    return { ok: terminal, messageKey: terminal ? turn.failureKind === 'context' ? 'm4Pilot.contextFailed' : turn.failureKind === 'references' ? 'm4Pilot.referenceFailed' : 'm4Pilot.answerFailed'
      : turn.state === 'unknown' ? 'm4Pilot.unknown' : 'm4Pilot.pending', pilotState: turn.state,
      completionStatus: terminal ? 'FAILED' : 'PENDING', sources: [], isCrisis, ...(turn.context ? { pilotContext: turn.context } : {}) };
  }
  const answer = renderAnswer(turn.answer, turn.answerVersion);
  const sources = turn.sources.map(s => {
    const citation = citationLine(s), heading = `${s.ref} · ${s.title}${citation ? ` · ${citation}` : ''} · ${s.used ? 'Vastuses kasutatud' : 'Ainult otsingus leitud'}`;
    return { key: `${turn.id}/${s.ref}`, id: `${turn.id}/${s.ref}`, title: s.title, label: heading, pages: s.pages,
    ...(s.source_locations === undefined ? {} : { source_locations: s.source_locations }),
    ...(s.authors ? { authors: s.authors } : {}), ...(s.journal ? { journalTitle: s.journal } : {}), ...(s.issue ? { issueLabel: s.issue } : {}), ...(s.year ? { year: s.year } : {}),
    short_ref: heading,
    url: `/chat-source?convId=${encodeURIComponent(convId)}&turnId=${encodeURIComponent(turn.id)}&ref=${encodeURIComponent(s.ref)}`,
    source_type: 'm4_pilot', used: s.used };
  });
  return { ok: true, answer, sources, displayed_sources: sources, completionStatus: 'COMPLETED', pilotKind: turn.answer.kind, pilotMode: turn.mode, isCrisis,
    ...(turn.context ? { pilotContext: turn.context } : {}) };
}

export function pilotChatMessages(turns, convId) {
  return turns.flatMap(turn => {
    const result = pilotChatResult(turn, convId);
    return [{ role: 'user', text: turn.question, createdAt: turn.createdAt },
      { role: 'ai', text: result.answer || '', messageKey: result.messageKey, sources: result.sources,
        completionStatus: result.completionStatus, pilotState: turn.state, isCrisis: result.isCrisis, createdAt: turn.createdAt }];
  });
}
