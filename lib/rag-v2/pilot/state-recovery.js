// A rejected interpretation must not erase the user's words. Recovery is raw dialogue,
// never an accepted fact or a source of eligibility/authority. Only the server writes it.
export function recoveryState(previous, failedTurns, userTurns) {
  const turns = (previous?.turns || []).filter(item => userTurns[item.turn - 1]?.text?.includes(item.quote))
    .map(item => ({ ...item }));
  for (const turn of [...failedTurns].sort((a, b) => a - b)) {
    const text = Number.isInteger(turn) && userTurns[turn - 1]?.text;
    if (typeof text === 'string' && text.trim() && !turns.some(item => item.turn === turn && item.quote === text)) {
      for (let i = turns.length - 1; i >= 0; i--) if (turns[i].turn === turn && text.includes(turns[i].quote)) turns.splice(i, 1);
      turns.push({ turn, quote: text });
    }
  }
  turns.sort((a, b) => a.turn - b.turn);
  return turns.length || previous?.omitted ? { turns, omitted: Boolean(previous?.omitted) } : null;
}

export const recoveryView = value => value?.recovery ? { recovery: {
  turns: value.recovery.turns.map(item => item.turn), omitted: value.recovery.omitted,
  interpretation: 'UNPROCESSED_USER_WORDS_NOT_FACTS'
} } : {};

// Re-anchor only complete original messages that actually crossed the bounded topic boundary.
export function carryRecovery(recovery, turns) {
  if (!recovery) return null;
  let omitted = Boolean(recovery.omitted);
  const kept = [];
  for (const item of recovery.turns) {
    const index = turns.findIndex(turn => turn.text.includes(item.quote));
    if (index < 0) omitted = true;
    else if (!kept.some(old => old.turn === index + 1 && old.quote === item.quote)) kept.push({ turn: index + 1, quote: item.quote });
  }
  return { turns: kept, omitted };
}

export const RECOVERY_INSTRUCTIONS = ' previousState.recovery identifies earlier user turns whose interpretation was incomplete. Reread their original wording in userTurns and extract any missing circumstances with exact copied clauses; never turn a rejected interpretation into a fact. '
  + 'Carried statements may include such original messages: they are earlier dialogue, not new questions. Current facts and later corrections take precedence over older wording. '
  + 'If recovery.omitted is true, some unresolved earlier wording did not fit the context limit. Do not assume the memory is complete; ask only for a missing circumstance needed for the current answer.';
