#!/usr/bin/env node
// The search gate (ADR-122, 10.10.2026): a free check that tells, before a release, whether search got worse.
// Until now a change to search was checked by paid conversation runs started by hand and by one-off probes. This
// command replays a fixed set of questions through the chat's own search (adapters.unifiedSearch of
// lib/rag-v2/pilot/retrieval.js: the knowledge lane, the municipal catalogue, the period lanes) and compares what comes
// back with a stored baseline. The questions are those of the graph catalogues (tests/evaluation/graph): each is a
// conversation's first message, its queries stand in for the search plan, and the query vectors are the ones
// scripts/rag-v2-graph-experiment.mjs saved (vectors.json, a map from text to vector). A hook stands in place of the
// selection model: it keeps the candidates and selects nothing, so the evidence is that of a turn whose selection
// failed. A question that names its municipality (region) is searched there; where a turn's municipality comes from is
// not what the gate judges. Rules, the row and the verdicts: scripts/lib/rag-v2-search-gate.mjs.
//
// Free, and made so that it cannot be otherwise: no model call, no embedding request, no database write, no conversation.
//   - Before any module of the application loads, globalThis.fetch is closed. From then on it lets through a request to
//     the Qdrant origin (RAG_V2_QDRANT_URL) and throws for every other host, a model's and an embedding's among them.
//   - A question any of whose texts has no saved vector is a row "skipped_no_vector"; the gate has no code that embeds.
//   - The plan is read with purpose "read": the gate runs changed, unmerged code, which the default purpose refuses, and
//     needs no model key. Its catalogue, state and search-assist versions are taken from the code under test, as the
//     release of that code renews them (ADR-037). No turn is made, so no ledger, store or conversation is touched; the
//     server's verified marks are read and none is written (ADR-069), and no warm-up is started.
//
//   record   --catalogue <json> [--catalogue <json> ...] --vectors <json> [--vectors <json> ...] --out <run.json>
//   compare  --baseline <run.json> --catalogue <json> ... --vectors <json> ... [--out <report.json>] [--allow <key>[,<key>]]
//   compare  --baseline <run.json> --run <run.json> [--out <report.json>] [--allow <key>[,<key>]]   two stored runs, nothing is searched
// A run and a report hold question ids, hashes, places, counts and times: no question, passage or title in clear.
// Exit: 0 the same or better, 10 differences to read, 20 a deciding passage lost from the candidates or an error (record:
// 20 when a question could not be searched), 2 refused or a wrong call.
// compare refuses when the two runs differ in what decides a search beside the code: the index generation, the plan's
// documents, the profile, the catalogue and search-assist versions, the embedding, or the calendar date in Estonia (legal
// validity reads today's date, so a baseline is recorded on the day it is used). --allow names the differences to
// compare across all the same, for example --allow generation,documents for a new corpus version.
//
// On the server, against the live release and with its env (the free runner; an empty overlay runs the release's own code):
//   sh /home/ubuntu/rag-v2-work/ov2-run.sh w4-empty scripts/rag-v2-search-gate.mjs record --catalogue <dir>/hard-conditions-3.json --vectors <dir>/vectors.json --out <dir>/gate-baseline.json
//   sh /home/ubuntu/rag-v2-work/ov2-run.sh <overlay dir> scripts/rag-v2-search-gate.mjs compare --baseline <dir>/gate-baseline.json --catalogue <dir>/hard-conditions-3.json --vectors <dir>/vectors.json
// The runner returns its own status, not this command's, and cuts every line at 700 characters (CUT=4000 lifts that): the
// verdict is the "exit" field of the summary line (the line before "overlay-end") or the --out report, never "$?".
// First run on the real index (10.10.2026): 33 questions of four catalogues, about 25 s a question.
// A release has no tests/ folder: the catalogues and the vectors are given by path, as copies.
// An overlay must hold a changed module together with every module that imports it by a relative path, up to this
// command and scripts/lib/rag-v2-search-gate.mjs: Node resolves a symlinked file to its real path, so a module the
// overlay holds only as a link imports the release's files beside it and the changed one is never loaded. A run names
// the directory this command itself was loaded from (code_root); the release's own name there, in a run meant to
// measure an overlay, means the overlay's code was not what ran.
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const network = globalThis.fetch;
globalThis.fetch = async () => { throw Object.assign(new Error('search_gate_network_closed'), { code: 'search_gate_network_closed' }); };
const { GATE_RUN_VERSION, DECIDES, qdrantOnly, validateGateCatalogue, releasedPlan, questionInput, searchIdentity, replayQuestion, refusal, compareRuns } = await import('./lib/rag-v2-search-gate.mjs');
globalThis.fetch = qdrantOnly(network, () => process.env.RAG_V2_QDRANT_URL);

const { values, positionals } = parseArgs({ allowPositionals: true, options: { catalogue: { type: 'string', multiple: true }, vectors: { type: 'string', multiple: true },
  out: { type: 'string' }, baseline: { type: 'string' }, run: { type: 'string' }, allow: { type: 'string', multiple: true } } });
const mode = positionals[0], allow = (values.allow || []).flatMap(item => item.split(',')).filter(Boolean), stored = mode === 'compare' && Boolean(values.run);
const stop = problem => { console.error(JSON.stringify({ ok: false, ...problem })); process.exit(2); };
if (positionals.length !== 1 || !['record', 'compare'].includes(mode) || (mode === 'record' ? !values.out || values.baseline || values.run || allow.length : !values.baseline)
  || (stored ? values.catalogue || values.vectors : !values.catalogue?.length || !values.vectors?.length) || allow.some(key => !DECIDES.includes(key))) {
  stop({ usage: 'record --catalogue <json> ... --vectors <json> ... --out <run.json> | compare --baseline <run.json> (--catalogue <json> ... --vectors <json> ... | --run <run.json>) [--out <report.json>] [--allow <key>,...]', allow: DECIDES });
}
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const baseline = mode === 'compare' ? await readJson(values.baseline) : null;

let present = stored ? await readJson(values.run) : null, refused = [];
if (!stored) {
  const questions = [], vectors = new Map();
  for (const file of values.catalogue) questions.push(...((await readJson(file)).questions || []));
  const problems = validateGateCatalogue({ questions });
  if (problems.length) stop({ problems });
  for (const file of values.vectors) for (const [text, vector] of Object.entries(await readJson(file))) vectors.set(text, vector);

  const { default: prisma } = await import('../lib/prisma.js');
  const { readPilotConfig } = await import('../lib/rag-v2/pilot/config.js');
  const { runtimeAdapters } = await import('../lib/rag-v2/pilot/retrieval.js');
  const { municipalDirectoryAdapter } = await import('../lib/rag-v2/adapters/municipal-directory.js');
  const { processCatalog } = await import('../lib/rag-v2/search/postgres.js');
  const { estonianDate } = await import('../lib/rag-v2/search/legal-validity.js');
  try {
    const plan = await readJson(process.env.M4_PILOT_CONFIG), userId = plan.users[0];
    const readConfig = async () => releasedPlan(await readPilotConfig(userId, { purpose: 'read' }));
    const config = await readConfig();
    // The server's marks, read only: sources it has checked are read at once. Without them (no table, a failed read)
    // this process verifies each source it reads, as before.
    const verifiedMarks = await processCatalog(process.env.RAG_V2_POSTGRES_URL).inheritVerified({ keep: false }).catch(() => 0);
    const adapters = runtimeAdapters(readConfig, userId, municipalDirectoryAdapter(prisma));
    const run = { schema_version: GATE_RUN_VERSION, recorded_at: new Date().toISOString(), plan: config.id, verified_marks: verifiedMarks,
      code_root: path.basename(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')),
      // Where the search itself was really loaded from: a module left as a link in the overlay resolves to the release,
      // and a run meant to test changed code would then compare the release with itself and call it "same".
      search_roots: Object.fromEntries(['lib/rag-v2/pilot/retrieval.js', 'lib/rag-v2/search/retrieval.js', 'lib/rag-v2/search/structured-record-source.js'].map(file => {
        const real = fsSync.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', file));
        return [file, path.basename(path.resolve(real, ...file.split('/').map(() => '..')))]; })),
      catalogues: values.catalogue.map(file => path.basename(file)),
      search: searchIdentity(config, estonianDate()), inputs: {}, rows: [] };
    // Known before anything is searched: a baseline of another index or day is refused without the minutes of a replay.
    refused = baseline ? refusal(baseline, run, allow) : [];
    for (const question of refused.length ? [] : questions) {
      run.inputs[question.id] = questionInput(question, vectors);
      const row = await replayQuestion(adapters, config, question, vectors);
      run.rows.push(row);
      console.error(JSON.stringify({ question: row.id, state: row.state, ...(row.state === 'ok' ? { candidates: row.pool.length, deciding: row.deciding, ms: row.ms.search } : {}), ...(row.error ? { error: row.error } : {}) }));
    }
    // A run that passed midnight in Estonia searched under two dates: it names both, so no run is compared with it unasked.
    if (estonianDate() !== run.search.date) run.search.date = `${run.search.date}/${estonianDate()}`;
    present = run;
  } finally { await prisma.$disconnect(); }
}
if (refused.length) stop({ refused });

const write = async (file, value) => { await fs.mkdir(path.dirname(path.resolve(file)), { recursive: true }); await fs.writeFile(file, `${JSON.stringify(value)}\n`); };
if (mode === 'record') {
  const count = state => present.rows.filter(row => row.state === state).length;
  await write(values.out, present);
  // A baseline with a question that could not be searched, or with none searched at all, is not one to compare with.
  const exit = count('error') ? 20 : count('ok') ? 0 : 2;
  console.log(JSON.stringify({ out: values.out, ...present.search, questions: present.rows.length, replayed: count('ok'), skipped_no_vector: count('skipped_no_vector'), errors: count('error'),
    search_roots: present.search_roots ?? null, exit }));
  process.exit(exit);
}
const result = compareRuns(baseline, present, { allow });
if (!result.ok) stop({ refused: result.refused });
const head = ({ rows: _rows, inputs: _inputs, ...rest }) => rest;
if (values.out) await write(values.out, { schema_version: 'rag-v2/search-gate-comparison-1', compared_at: new Date().toISOString(), baseline: head(baseline), present: head(present),
  allowed: result.allowed, summary: result.summary, exit: result.exit, rows: result.rows });
for (const row of result.rows) if (!['same', 'skipped'].includes(row.verdict)) console.log(JSON.stringify(row));
console.log(JSON.stringify({ summary: result.summary, allowed: result.allowed, code_root: { baseline: baseline.code_root ?? null, present: present.code_root ?? null },
  search_roots: { baseline: baseline.search_roots ?? null, present: present.search_roots ?? null }, exit: result.exit }));
process.exit(result.exit);
