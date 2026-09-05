import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { readJson } from '../lib/rag-v2/catalog.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { FilePolicy } from '../lib/rag-v2/search/policy.js';
import { evaluationPlan } from '../lib/rag-v2/search/evaluation-plan.js';
try {
  const { values } = parseArgs({ options: { store: { type: 'string' }, tenant: { type: 'string' }, subject: { type: 'string' }, policy: { type: 'string' },
    questions: { type: 'string', default: 'tests/evaluation/rag-v2-queries.json' }, prices: { type: 'string' }, output: { type: 'string' } } });
  const context = { tenant: values.tenant, subject: values.subject, usage: 'development_only' };
  const allowed = await new FilePolicy(values.policy).allowed(context);
  const snapshot = await loadSnapshot(values.store, values.tenant, allowed.documents);
  const plan = evaluationPlan(snapshot, await readJson(values.questions), values.prices ? await readJson(values.prices) : null);
  const out = path.resolve(values.output);
  if (!out.startsWith(path.resolve('tmp') + path.sep)) throw new Error('private_output_required');
  await fs.mkdir(path.dirname(out), { recursive: true }); await fs.writeFile(out, JSON.stringify(plan, null, 2));
  console.log(JSON.stringify({ state: plan.state, max_total_input_tokens: plan.max_total_input_tokens, max_api_attempts: plan.max_api_attempts,
    monetary_state: plan.monetary_state, output: out, external_calls: 0 }, null, 2));
} catch (error) { console.error(JSON.stringify({ code: error.code || 'plan_cli_failed' })); process.exitCode = 1; }
