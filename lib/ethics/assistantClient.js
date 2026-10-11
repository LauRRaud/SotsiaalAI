// Use the same conversation and turn contract as the main assistant. The
// caller keeps this intent for a retry so a lost response cannot buy a second turn.
export async function askEthicsAssistant(input, intent, request = fetch) {
  const headers = { 'Content-Type': 'application/json' };
  const ensured = await request('/api/chat/pilot', { method: 'POST', headers, body: JSON.stringify({ action: 'ensure', convId: intent.convId }) });
  if (!ensured.ok) throw new Error('ethics.errors.assistant');
  const response = await request('/api/ethics/chat', { method: 'POST', headers: { ...headers, 'x-rag-pilot': '1', 'x-rag-pilot-format': 'chat' },
    body: JSON.stringify({ question: input.question, language: input.language, convId: intent.convId, clientTurnKey: intent.clientTurnKey, contextMode: 'new' }) });
  const result = await response.json();
  if (['source_scope_unavailable', 'source_scope_incompatible'].includes(result.code)) throw new Error('ethics.errors.sources');
  if (!response.ok || !result.ok || result.completionStatus !== 'COMPLETED') throw new Error(result.isCrisis ? 'chat.crisis.notice' : 'ethics.errors.assistant');
  return result;
}
