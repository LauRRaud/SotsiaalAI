#!/usr/bin/env node
// Where chat turns spend their time (Codex follow-up review 29.09, 7.8), from conversation evaluation results
// (observed.stages, scripts/rag-v2-conversation-eval.mjs): the sample size, median and quartiles of each stage, so one
// speed change at a time is read against the same stages. Durations are differences of the service's own phase marks
// (one clock); the search steps and lanes are the search's own marks; model calls report their own times.
// Usage: node scripts/rag-v2-stage-timings.mjs <eval-out-dir> [<eval-out-dir> ...] [--json]
import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2), json = args.includes('--json'), dirs = args.filter(arg => arg !== '--json');
if (!dirs.length) { console.error('usage: <eval-out-dir> [...] [--json]'); process.exit(2); }

/** n, median and quartiles of the finite values, in whole milliseconds (or tokens). */
function spread(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { n: 0, p25: null, median: null, p75: null };
  const at = q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { n: sorted.length, p25: Math.round(at(0.25)), median: Math.round(at(0.5)), p75: Math.round(at(0.75)) };
}

// The service's phases (lib/rag-v2/pilot/service.js): the turn's stages as the differences of consecutive marks. From
// 30.09 the search starts with the embedding request, not after it: "search" is then the search's time after the request
// ended, and "plan_to_searched" the embedding and the search together.
const STAGES = [['plan', null, 'planned'], ['embedding', 'planned', 'embedded'], ['search', 'embedded', 'searched'], ['plan_to_searched', 'planned', 'searched'],
  ['answer_to_first_text', 'searched', 'first_text'], ['answer_after_first_text', 'first_text', 'answered'], ['first_text', null, 'first_text'], ['answered', null, 'answered']];

function summarize(turns) {
  const collect = new Map(), push = (key, value) => { if (Number.isFinite(value)) (collect.get(key) || collect.set(key, []).get(key)).push(value); };
  for (const turn of turns) {
    const stages = turn.observed?.stages;
    if (!stages?.phases) continue;
    const phases = stages.phases;
    for (const [name, from, to] of STAGES) push(`stage.${name}`, phases[to] - (from ? phases[from] : 0));
    for (const [step, ms] of Object.entries(stages.search || {})) push(`search.${step}`, ms);
    for (const [lane, steps] of Object.entries(stages.lanes || {})) for (const [step, ms] of Object.entries(steps || {})) push(`lane.${lane}.${step}`, ms);
    for (const call of stages.calls || []) {
      for (const [key, value] of Object.entries(call.timings || {})) if (typeof value === 'number') push(`call.${call.stage}.${key}`, value);
      for (const [key, value] of Object.entries(call.usage || {})) if (typeof value === 'number') push(`tokens.${call.stage}.${key}`, value);
    }
    // The answer request's parts in estimated tokens (observed.stages.input).
    for (const [key, value] of Object.entries(stages.input || {})) if (typeof value === 'number') push(`input.${key}`, value);
    // The evaluating caller's own clock, from its call to the first text and to the end (Codex review 30.09: the service's
    // phases start after the turn is claimed). Neither is a browser's click-to-text time.
    for (const [key, value] of Object.entries(stages.caller || {})) if (typeof value === 'number') push(`caller.${key}`, value);
  }
  return Object.fromEntries([...collect].map(([key, values]) => [key, spread(values)]));
}

const report = [];
for (const dir of dirs) {
  const result = JSON.parse(await fs.readFile(path.join(dir, 'conversation-eval.json'), 'utf8'));
  const turns = result.scenarios.flatMap(scenario => scenario.turns);
  report.push({ run: path.basename(dir), turns: turns.length, stages: summarize(turns) });
}
if (json) console.log(JSON.stringify(report, null, 1));
else {
  const keys = [...new Set(report.flatMap(entry => Object.keys(entry.stages)))].sort();
  console.log(`| Etapp | ${report.map(entry => `${entry.run} (n, p25 / mediaan / p75)`).join(' | ')} |`);
  console.log(`|---|${report.map(() => '---:').join('|')}|`);
  for (const key of keys) console.log(`| ${key} | ${report.map(entry => { const s = entry.stages[key]; return s ? `${s.n}: ${s.p25} / **${s.median}** / ${s.p75}` : '-'; }).join(' | ')} |`);
}
