// Independent, offline review of ca5970f9. No provider, database or network calls.
// node --import ./scripts/register-node-source-loader.mjs docs/audits/rag-rerank-cache-review-2026-10-08-probes.mjs [--with-local-raw]
// Run from the repository root. The optional raw check requires the retained, ignored measurement files.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareRerankRequest, rerankRequest } from '../../lib/rag-v2/pilot/search-assist.js';
import { digest } from '../../lib/rag-v2/pilot/contracts.js';
import { priceProviderUsage } from '../../lib/rag-v2/pilot/cost.js';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = value => createHash('sha256').update(value).digest('hex');
const prefix = 'docs/audits/evidence/';
const before = read(`${prefix}rag-rerank-cache-before-2026-10-08.json`);
const after = read(`${prefix}rag-rerank-cache-after-2026-10-08.json`);
const rejected = read(`${prefix}rag-rerank-cache-rejected-trials-2026-10-08.json`);
const probe = read(`${prefix}rag-rerank-cache-boundary-probe-2026-10-08.json`);
const comparison = read(`${prefix}rag-rerank-cache-comparison-2026-10-08.json`);
const requestIds = new Set();
let receiptCount = 0;
const sum = values => values.reduce((a, b) => a + b, 0);
const deltaPercent = (a, b) => 100 * (b / a - 1);
const at = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];

// Independent arithmetic, then compare both the frozen receipt and the production calculator.
function checkPrice(receipt, provider) {
  const u = receipt.usage;
  const embedding = receipt.stage === 'embedding';
  assert.ok(Number.isSafeInteger(u.input) && u.input >= 0);
  assert.ok(Number.isSafeInteger(u.output) && u.output >= 0);
  const long = !embedding && u.input > 272000;
  const plain = embedding ? u.input : u.input - u.cachedInput - u.cacheWriteInput;
  assert.ok(plain >= 0);
  const expected = embedding ? u.input * 130 : Math.ceil(
    (plain * 100 + u.cachedInput * 10 + u.cacheWriteInput * 125) * (long ? 2 : 1)
    + u.output * 500 * (long ? 1.5 : 1));
  assert.equal(provider.billing.serviceTier ?? 'default', 'default');
  assert.deepEqual(u, provider.usage);
  const calculated = priceProviderUsage({ stage: receipt.stage, usage: u, billing: provider.billing, mode: 'real' });
  assert.equal(calculated.nanoUsd, expected);
  assert.equal(receipt.pricing.nanoUsd, expected);
  assert.equal(Number(receipt.billedNanoUsd), expected);
  assert.equal(receipt.state, 'settled');
  assert.equal(requestIds.has(receipt.requestId), false, 'duplicate paid request');
  requestIds.add(receipt.requestId);
  receiptCount++;
  return expected;
}

for (const run of [before, ...rejected, after]) {
  assert.equal(run.casesHash, before.casesHash);
  assert.equal(run.generationId, before.generationId);
  const total = sum(run.turns.map(turn => {
    const total = sum(turn.receipts.map(r => checkPrice(r, turn.providers.find(p => p.requestId === r.requestId))));
    assert.equal(Number(turn.nanoUsd), total);
    return total;
  }));
  assert.equal(Number(run.nanoUsd), total);
}
for (const p of probe.calls) checkPrice({ stage: 'rerank', ...p, state: 'settled', billedNanoUsd: p.pricing.nanoUsd }, p);
const currentNanoUsd = sum([before, ...rejected, after, probe].map(run => Number(run.nanoUsd)));
const priorNanoUsd = 30712790;
assert.equal(currentNanoUsd + priorNanoUsd, comparison.cumulativeNanoUsd);
assert.ok(currentNanoUsd + priorNanoUsd < 1e9);

function metrics(turns) {
  const rerank = turns.map(t => t.receipts.find(r => r.stage === 'rerank'));
  const input = sum(rerank.map(r => r.usage.input));
  const inputNanoUsd = sum(rerank.map(r => Number(r.billedNanoUsd) - r.pricing.components.output));
  return { turns: turns.length, rerankInput: input, rerankInputNanoUsd: inputNanoUsd,
    cacheRead: sum(rerank.map(r => r.usage.cachedInput)), cacheWrite: sum(rerank.map(r => r.usage.cacheWriteInput)),
    totalNanoUsd: sum(turns.map(t => Number(t.nanoUsd))),
    answerP50ms: at(turns.map(t => t.timings.phases.answered), 0.5),
    answerP95ms: at(turns.map(t => t.timings.phases.answered), 0.95),
    // Counterfactual tariff calculation only: same baseline input, no new model call.
    sameInputWithoutCacheNanoUsd: input * 100,
    sameInputWithoutCacheDeltaPercent: deltaPercent(inputNanoUsd, input * 100) };
}
const groups = ['all', 'CLIENT', 'SOCIAL_WORKER', 'SERVICE_PROVIDER'].map(role => {
  const a = metrics(before.turns.filter(t => role === 'all' || t.role === role));
  const b = metrics(after.turns.filter(t => role === 'all' || t.role === role));
  return { role, before: a, after: b, observedInputPriceDeltaPercent: deltaPercent(a.rerankInputNanoUsd, b.rerankInputNanoUsd),
    observedTotalPriceDeltaPercent: deltaPercent(a.totalNanoUsd, b.totalNanoUsd) };
});
const fixedInputTurns = before.turns.map(t => {
  const r = t.receipts.find(r => r.stage === 'rerank');
  const inputCost = Number(r.billedNanoUsd) - r.pricing.components.output;
  const uncachedCost = r.usage.input * 100;
  return { role: t.role, scenario: t.scenario, turnIndex: t.turnIndex,
    measuredInputNanoUsd: inputCost, counterfactualUncachedInputNanoUsd: uncachedCost,
    deltaPercent: deltaPercent(inputCost, uncachedCost) };
});
assert.equal(groups[0].after.cacheRead, 0);
assert.equal(groups[0].after.cacheWrite, 0);
let sameCandidateTextHashLists = 0;
for (let i = 0; i < before.turns.length; i++) {
  const a = before.turns[i], b = after.turns[i];
  assert.deepEqual([a.role, a.scenario, a.turnIndex, a.question], [b.role, b.scenario, b.turnIndex, b.question]);
  const pa = a.providers.find(p => p.stage === 'rerank'), pb = b.providers.find(p => p.stage === 'rerank');
  if (JSON.stringify(pa.candidateTextHashes) === JSON.stringify(pb.candidateTextHashes)) sameCandidateTextHashLists++;
}
const text = t => t.answer.blocks.map(b => b.text).join('\n');
const pick = (run, role, scenario, turn = 0) => run.turns.find(t => t.role === role && t.scenario === scenario && t.turnIndex === turn);
const oldProvider = pick(before, 'SERVICE_PROVIDER', 'home-care-dialogue');
const newProvider = pick(after, 'SERVICE_PROVIDER', 'home-care-dialogue');
const oldClient = pick(before, 'CLIENT', 'home-care-dialogue', 1);
const newClient = pick(after, 'CLIENT', 'home-care-dialogue', 1);
const quality = {
  specialistSelfReferral: text(pick(after, 'SOCIAL_WORKER', 'home-care-dialogue')).includes('pöörduda piirkonnakeskuse sotsiaaltöö spetsialisti poole'),
  providerNeedFactBefore: oldProvider.dialogueState.value.facts.some(f => f.support.some(s => s.quote.includes('vajab kodus'))),
  providerNeedFactAfter: newProvider.dialogueState.value.facts.some(f => f.support.some(s => s.quote.includes('vajab kodus'))),
  providerStateDrops: newProvider.dialogueState.value.model.dropped,
  providerNeedsBefore: oldProvider.dialogueState.value.needs.length,
  providerNeedsAfter: newProvider.dialogueState.value.needs.length,
  clientFeeAccessSafeguardBefore: /ei tohi takistada teenuse saamist/u.test(text(oldClient)),
  clientFeeAccessSafeguardAfter: /ei tohi takistada teenuse saamist/u.test(text(newClient)),
  note: 'These are observed coverage/state differences, not proof that cache policy caused them. No complete entailment score.'
};

let raw = { status: 'not_run' };
if (process.argv.includes('--with-local-raw')) {
  const hashes = read(`${prefix}rag-rerank-cache-raw-evidence-hashes-2026-10-08.json`);
  for (const [file, expected] of Object.entries(hashes)) assert.equal(sha(fs.readFileSync(file)), expected, file);
  const a = read('tmp/rag-rerank-input-baseline.json'), b = read('tmp/rag-rerank-cache-no-writes.json');
  const moduleMatches = Object.entries(b.runtimeModuleHashes).map(([file, hash]) => {
    assert.equal(sha(fs.readFileSync(file)), hash, file); return file;
  });
  let verifiedRequests = 0, verifiedCitedEvidence = 0;
  for (const t of b.turns) {
    const input = t.providers.find(p => p.stage === 'rerank').input;
    const config = { model: 'gpt-6-luna', rerankCachePolicy: 'uncached-full-text-1' };
    const original = rerankRequest(config, input.messages, input.passages, input.today);
    const prepared = prepareRerankRequest(config, input.messages, input.passages, input.today);
    const { prompt_cache_options, ...same } = prepared.body;
    assert.deepEqual(same, original);
    assert.deepEqual(prompt_cache_options, { mode: 'explicit', ttl: '30m' });
    assert.equal(digest(original.input), t.searchAssist.rerank.inputCostPolicy.inputHash);
    assert.equal(digest(original.instructions), t.searchAssist.rerank.inputCostPolicy.instructionsHash);
    verifiedRequests++;
  }
  for (const run of [a, b]) for (const t of run.turns) {
    for (const ref of new Set(t.answer.blocks.flatMap(block => block.refs))) {
      const binding = t.references[ref];
      const evidence = t.evidence.find(e => e.evidence_id === binding.evidence_id);
      assert.equal(sha(evidence.source_text), binding.source_text_sha256); verifiedCitedEvidence++;
    }
  }
  const legalXml = ['404072025051', '403102026022'].map(id => {
    const local = fs.readFileSync(`Andmebaasi/oigusaktid/${id}.xml`);
    const fetched = fs.readFileSync(`tmp/rag-cache-review-${id}.xml`);
    assert.equal(sha(local), sha(fetched));
    return { act: id, url: `https://www.riigiteataja.ee/et/akt/${id}.xml`, sha256: sha(local),
      terminologyHeadingPresent: /<paragrahvPealkiri[^>]*>Terminid<\/paragrahvPealkiri>/.test(local.toString('utf8')) };
  });
  raw = { status: 'passed', rawFileHashes: Object.keys(hashes).length, moduleMatches, verifiedRequests, verifiedCitedEvidence, legalXml };
}
const result = { reviewedCommit: 'ca5970f9', paidCallsThisReview: 0, reviewedPaidReceipts: receiptCount,
  currentNanoUsd, priorNanoUsd, cumulativeNanoUsd: currentNanoUsd + priorNanoUsd,
  sameCandidateTextHashLists, groups, fixedInputTurns, quality, raw };
const serialized = JSON.stringify(result, null, 2) + '\n';
const out = process.argv.indexOf('--out');
if (out !== -1) fs.writeFileSync(process.argv[out + 1], serialized);
console.log(serialized);
