import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Codex 7.8: stage times are read from the evaluation's observed.stages, as differences of the service's own phase marks.
test('stage timings: the median and quartiles of each stage, from the phase marks, search steps, lanes and model calls', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stage-timings-'));
  const turn = (planned, searched, firstText) => ({ observed: { stages: {
    phases: { planned, embedded: planned + 300, searched, first_text: firstText, answered: firstText + 2000 },
    search: { directory: 100, merged: searched - planned - 300 }, lanes: { knowledge: { lane: 2500, rerank: 1800 } },
    calls: [{ stage: 'answer', timings: { firstDataMs: 900, firstTextMs: firstText - searched, completeResponseMs: firstText - searched + 2000, streaming: true },
      usage: { input: 20000, output: 900 } }], input: { instructions: 6000, record_entries: 4000, question_in_turns: true },
    caller: { streamed: true, firstTextMs: firstText + 40, totalMs: firstText + 2100 } } } });
  // A turn without stages (an older result) is left out, not counted as zero.
  const scenarios = [{ turns: [turn(2000, 6000, 12000), turn(3000, 8000, 13000), turn(2500, 7000, 17000), { observed: { timings: {} } }] }];
  await fs.writeFile(path.join(dir, 'conversation-eval.json'), JSON.stringify({ scenarios }));
  const [report] = JSON.parse(execFileSync(process.execPath, ['scripts/rag-v2-stage-timings.mjs', dir, '--json'], { encoding: 'utf8' }));
  assert.equal(report.turns, 4);
  assert.deepEqual(report.stages['stage.plan'], { n: 3, p25: 2000, median: 2500, p75: 3000 });
  assert.deepEqual(report.stages['stage.search'], { n: 3, p25: 3700, median: 4200, p75: 4700 });
  assert.deepEqual(report.stages['stage.answer_to_first_text'], { n: 3, p25: 5000, median: 6000, p75: 10000 });
  assert.equal(report.stages['stage.first_text'].median, 13000);
  assert.equal(report.stages['lane.knowledge.rerank'].median, 1800);
  assert.equal(report.stages['call.answer.firstDataMs'].median, 900);
  assert.equal(report.stages['tokens.answer.input'].median, 20000);
  assert.ok(!('call.answer.streaming' in report.stages));
  assert.equal(report.stages['input.record_entries'].median, 4000);
  assert.ok(!('input.question_in_turns' in report.stages));
  assert.equal(report.stages['caller.firstTextMs'].median, 13040);
  assert.ok(!('caller.streamed' in report.stages));
  const table = execFileSync(process.execPath, ['scripts/rag-v2-stage-timings.mjs', dir], { encoding: 'utf8' });
  assert.match(table, /\| stage\.first_text \| 3: 12000 \/ \*\*13000\*\* \/ 17000 \|/);
  await fs.rm(dir, { recursive: true, force: true });
});
