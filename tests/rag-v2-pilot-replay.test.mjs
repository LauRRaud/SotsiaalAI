import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { hash } from '../lib/rag-v2/contracts.js';
import { validateAnswer } from '../lib/rag-v2/pilot/contracts.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { pilotChatResult } from '../lib/chat/m4PilotClientContract.js';
import { pilotExpired } from '../lib/rag-v2/pilot/lifetime.js';

// Private original artifacts are optional and never checked into Git with the regression test.
test('F15: still-permitted original answers replay through restore and versioned rendering without changing historical bytes',
  { skip: !process.env.M4_REPLAY_ARTIFACT }, async () => {
    const file = path.resolve(process.env.M4_REPLAY_ARTIFACT);
    const original = await fs.readFile(file), parsed = JSON.parse(original);
    const comparison = Array.isArray(parsed), dialogue = Array.isArray(parsed.rows);
    const data = comparison ? parsed.find(arm => arm.arm === 'baseline') : dialogue ? { turns: parsed.rows } : parsed;
    let modelCalls = 0, searches = 0;
    const rows = data.turns.filter(row => row.state === 'completed');
    assert.equal(rows.length, dialogue ? 15 : 7);
    const comparisons = [];
    for (const row of rows) {
      assert.ok(!pilotExpired(row.expiresAt), 'historical artifact expired; do not reuse');
      const before = JSON.stringify(row);
      const refs = Object.keys(row.payload.packet.reference_map);
      validateAnswer(row.payload.answer, refs, row.payload.answerVersion || 'm4-text-refs-1');
      const service = new PilotService({ store: { mutate: async (_config, _row, fn) => fn() },
        readConfig: async () => ({ configHash: row.configHash, mode: 'real' }),
        adapters: { canonical: async (_config, packet, ref) => {
          const entry = packet.reference_map[ref];
          assert.equal(entry.source_text_sha256, hash(packet.evidence.find(e => e.evidence_id === entry.evidence_id).source_text));
        }, search: async () => { searches++; throw Error('unexpected new search'); } },
        call: async () => { modelCalls++; throw Error('unexpected model call'); } });
      const restored = await service.restore({ ...row, expiresAt: row.expiresAt === null ? null : new Date(row.expiresAt) });
      const after = pilotChatResult(restored, 'local-replay-only').answer;
      const old = [...row.payload.answer.blocks.map(b => b.text + (b.refs.length ? ' [' + b.refs.join(', ') + ']' : '')),
        ...row.payload.answer.limitations, ...(row.payload.answer.clarification ? [row.payload.answer.clarification] : [])].join('\n\n');
      assert.equal(JSON.stringify(row), before);
      assert.ok(!after.includes('cite'));
      comparisons.push({ id: row.id, before: old, after, displayChanged: old !== after, languageAndSemanticsRewritten: false });
    }
    if (!comparison && !dialogue) {
      const missing = data.turns.find(row => row.state !== 'completed');
      assert.equal(missing.payload.packet, undefined); assert.equal(missing.payload.answer, undefined);
    }
    assert.equal(comparisons.filter(x => x.displayChanged).length, comparison || dialogue ? 0 : 5);
    assert.equal(modelCalls, 0); assert.equal(searches, 0);
    assert.equal(hash(await fs.readFile(file)), hash(original));
    if (process.env.M4_REPLAY_OUTPUT) await fs.writeFile(process.env.M4_REPLAY_OUTPUT, JSON.stringify({ historicalSha256: hash(original),
      source: 'permitted_original_local_artifacts', displayOnly: true, externalCalls: modelCalls, newSearches: searches,
      ...(comparison || dialogue ? {} : { originalFourthPacketAndDraft: 'NOT_PROVEN' }), comparisons }, null, 2), { flag: 'wx', mode: 0o600 });
  });
