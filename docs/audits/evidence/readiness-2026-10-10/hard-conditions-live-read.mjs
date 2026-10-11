// Reads the turns of the hard-conditions check (my own test turns), numbers and catalogue ids only: per question, in how
// many of its runs the evidence held the deciding phrase and the answer cited a passage holding it, and how that passage
// entered the evidence.   node check83-read.mjs <turns.jsonl>
import fs from 'node:fs';
const turns = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
const total = { turns: turns.length, errors: turns.filter(turn => turn.error).length, usd: +(turns.reduce((sum, turn) => sum + Number(turn.nanoUsd || 0), 0) / 1e9).toFixed(4), kinds: {}, in_evidence: 0, cited: 0, reasons: {},
  median_ms: turns.map(turn => turn.elapsedMs).sort((a, b) => a - b)[Math.floor(turns.length / 2)] };
const perQuestion = new Map();
for (const turn of turns) {
  const kind = turn.answer?.kind ?? turn.error ?? turn.state ?? 'none'; total.kinds[kind] = (total.kinds[kind] || 0) + 1;
  const gold = turn.gold; if (!gold) continue;
  const found = gold.phrases.every(item => item.in_evidence), cited = gold.phrases.every(item => item.cited);
  if (found) total.in_evidence++; if (cited) total.cited++;
  for (const item of gold.phrases) for (const reason of item.reasons) total.reasons[reason] = (total.reasons[reason] || 0) + 1;
  const row = perQuestion.get(gold.id) ?? { runs: 0, found: 0, cited: 0, reasons: new Set(), kinds: [], region: [] };
  row.runs++; if (found) row.found++; if (cited) row.cited++; gold.phrases.forEach(item => item.reasons.forEach(reason => row.reasons.add(reason))); row.kinds.push(kind[0]); row.region.push(turn.scope?.state === 'region_required' ? 'R' : turn.scope?.region ? 'm' : '-');
  perQuestion.set(gold.id, row);
}
const questions = [...perQuestion.values()], count = test => questions.filter(test).length;
console.log(JSON.stringify(total));
console.log(JSON.stringify({ questions: questions.length, found_every_run: count(row => row.found === row.runs), found_some_runs: count(row => row.found > 0 && row.found < row.runs), found_never: count(row => row.found === 0),
  cited_every_run: count(row => row.cited === row.runs), cited_some_runs: count(row => row.cited > 0 && row.cited < row.runs), cited_never: count(row => row.cited === 0) }));
for (const [id, row] of perQuestion) console.log(`  ${id.padEnd(34)} found ${row.found}/${row.runs} cited ${row.cited}/${row.runs} kinds ${row.kinds.join('')} place ${row.region.join('')} via ${[...row.reasons].join(',') || '-'}`);
