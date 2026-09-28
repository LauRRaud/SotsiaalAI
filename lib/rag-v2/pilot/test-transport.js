import fs from 'node:fs/promises';
import { reject } from './contracts.js';

// A local streamed answer (ADR-040): the fixture's JSON in small pieces, one event-loop turn apart.
async function streamFixture(value, onText) {
  if (!onText) return;
  const text = JSON.stringify(value);
  for (let i = 0; i < text.length; i += 24) { onText(text.slice(i, i + 24)); await new Promise(resolve => setImmediate(resolve)); }
}
// Local fixtures only. This path never invokes the provider and cannot run in production.
export async function testAnswer(config, body, packet, inputBound, { onText = null } = {}) {
  if (config.mode !== 'test' || process.env.NODE_ENV === 'production') reject('test_mode_development_only', 503);
  const question = JSON.parse(body.input[0].content).question;
  if (config.testResponsesPath) {
    const fixture = JSON.parse(await fs.readFile(config.testResponsesPath, 'utf8'));
    const value = fixture.responses.find(item => item.question === question)?.answer;
    if (!value) reject('test_response_missing');
    await streamFixture(value, onText);
    return { value, draftText: JSON.stringify(value), usage: { input: inputBound, output: 200 }, requestId: 'synthetic-fixture-answer' };
  }
  if (config.dialogueStateVersion) reject('dialogue_state_test_fixture_required');
  const value = { kind: 'partial', blocks: [{ text: 'Testvastaja kuvab allikakatkendi: ' + packet.evidence[0].source_text.slice(0, 700), factual: true,
    refs: [Object.keys(packet.reference_map)[0]] }], limitations: ['Fikseeritud testtransport. See ei tõenda Luna vastuse ega vektorotsingu kvaliteeti.'], clarification: null };
  await streamFixture(value, onText);
  return { value, usage: { input: inputBound, output: 200 }, requestId: 'test-answer' };
}
