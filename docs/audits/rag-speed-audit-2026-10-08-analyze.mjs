// Offline arithmetic over already-paid synthetic evidence. No tests, network, DB, or model calls.
// node docs/audits/rag-speed-audit-2026-10-08-analyze.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const files = ['rag-audit-fixes-first-2026-10-08.json', 'rag-audit-fixes-second-2026-10-08.json',
  'rag-audit-fixes-third-2026-10-08.json', 'rag-audit-fixes-2026-10-08.json'];
const rounded = n => Number(n.toFixed(2));
const stats = values => {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? { n: v.length, mean: rounded(v.reduce((a, b) => a + b, 0) / v.length),
    p50: v[Math.ceil(v.length * .5) - 1], p95: v[Math.ceil(v.length * .95) - 1], min: v[0], max: v.at(-1) } : { n: 0 };
};
const reports = files.map(file => {
  const text = fs.readFileSync(path.join(dir, file), 'utf8'), data = JSON.parse(text);
  const rows = data.turns.filter(t => t.state === 'completed' && t.timings?.phases);
  const metrics = rows.map(t => {
    const p = t.timings.phases, s = t.timings.search, k = s?.lanes?.knowledge || {};
    const call = stage => t.providers.find(c => c.stage === stage)?.elapsedMs;
    const plan = call('plan'), rerank = call('rerank'), answer = call('answer');
    return { role: t.role, scenario: t.scenario, turnIndex: t.turnIndex, plan, embedding: call('embedding'),
      rerankCall: rerank, answerCall: answer, rerankStage: k.rerank, rerankOutsideCall: k.rerank - rerank,
      lexical: k.lexical, vectorWall: k.vector, vectorServer: k.vector_server,
      preLaneScope: s?.since_start_ms?.scope, firstText: p.first_text, answered: p.answered,
      planToSearched: p.searched - p.planned, searchedToAnswer: p.answered - p.searched,
      lunaTotal: plan + rerank + answer,
      periodSerialTail: s?.since_start_ms?.periods === undefined ? null : s.since_start_ms.periods - s.since_start_ms.knowledge_and_records };
  });
  const keys = Object.keys(metrics[0]).filter(k => !['role', 'scenario', 'turnIndex'].includes(k));
  const sum = key => metrics.reduce((n, r) => n + r[key], 0);
  return { file, sha256: createHash('sha256').update(text).digest('hex'), measuredAt: data.measuredAt,
    release: data.release, generationId: data.generationId, phase: data.phase, attempts: data.turns.length,
    completedWithTimings: metrics.length, reasoning: 'not_recorded_explicitly_in_this_evidence',
    summariesMs: Object.fromEntries(keys.map(key => [key, stats(metrics.map(row => row[key]))])),
    lunaShareOfAnsweredPct: rounded(100 * sum('lunaTotal') / sum('answered')), rows: metrics };
});
const out = { schema: 'rag-speed-offline-audit-1', freshPaidCalls: 0, testsExecuted: 0,
  quantiles: 'nearest rank ceil(n*p)-1; paired differences computed before aggregation; do not sum medians',
  timingBoundary: 'server phases start after claim; answered precedes validation and publication; no browser timing',
  callerElapsedWarning: 'old trial elapsedMs includes replay verification and DB reads; excluded from latency analysis',
  reports };
fs.writeFileSync(path.join(dir, 'rag-speed-audit-offline-2026-10-08.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(reports.map(r => ({ phase: r.phase, n: r.completedWithTimings,
  summariesMs: r.summariesMs, lunaShareOfAnsweredPct: r.lunaShareOfAnsweredPct })), null, 2));
