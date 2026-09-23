import fs from 'node:fs/promises';
import { reject } from './contracts.js';

// Local fixtures only. This path never invokes the provider and cannot run in production.
export async function testAnswer(config, body, packet, inputBound) {
  if (config.mode !== 'test' || process.env.NODE_ENV === 'production') reject('test_mode_development_only', 503);
  const question = JSON.parse(body.input[0].content).question;
  if (config.testResponsesPath) {
    const fixture = JSON.parse(await fs.readFile(config.testResponsesPath, 'utf8'));
    const value = fixture.responses.find(item => item.question === question)?.answer;
    if (!value) reject('test_response_missing');
    return { value, draftText: JSON.stringify(value), usage: { input: inputBound, output: 200 }, requestId: 'synthetic-fixture-answer' };
  }
  if (config.dialogueStateVersion) reject('dialogue_state_test_fixture_required');
  const value = { kind: 'partial', blocks: [{ text: 'Testvastaja kuvab allikakatkendi: ' + packet.evidence[0].source_text.slice(0, 700), factual: true,
    refs: [Object.keys(packet.reference_map)[0]] }], limitations: ['Fikseeritud testtransport. See ei tõenda Luna vastuse ega vektorotsingu kvaliteeti.'], clarification: null };
  return { value, usage: { input: inputBound, output: 200 }, requestId: 'test-answer' };
}
