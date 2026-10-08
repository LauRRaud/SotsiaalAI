"""Run over SSH as root. Read-only aggregate; never returns prompts or identities.

Uses the running service's environment internally. Does not print credentials.
No application methods, model calls, tests, or database writes are performed.
"""
import json
import os
import subprocess

pid = subprocess.check_output([
    'systemctl', 'show', 'sotsiaalai-frontend.service', '-p', 'MainPID', '--value'
], text=True).strip()
env = dict(item.split('=', 1) for item in open('/proc/' + pid + '/environ', 'rb')
           .read().decode().split('\0') if '=' in item)
cwd = subprocess.check_output([
    'systemctl', 'show', 'sotsiaalai-frontend.service', '-p', 'WorkingDirectory', '--value'
], text=True).strip()
script = r'''
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/package.json');
const { Client } = require('pg');
const plan = JSON.parse(fs.readFileSync(process.env.M4_PILOT_CONFIG, 'utf8'));
const db = new Client({ connectionString: process.env.DATABASE_URL,
  options: '-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=1000',
  application_name: 'rag_audit_readonly_20261008' });
const report = { measuredAt: new Date().toISOString(), release: process.cwd().split('/').at(-1),
  method: 'SQL aggregate only; READ ONLY; no message, question, answer or identity selected',
  plan: Object.fromEntries(['model','reasoning','profileId','maxInputTokens','maxOutputTokens','searchAssist',
    'promptVersion','dialogueStateVersion','recordCatalogue','generationId','retentionHours','auditDays','prices','budget']
    .map(k => [k, plan[k] ?? null])), documents: Object.keys(plan.documents).length };
try {
  await db.connect(); await db.query('BEGIN READ ONLY');
  const events = `SELECT t.id, t.state AS turn_state, t."createdAt", t."pilotId", t.payload->>'convId' AS conversation,
    e->>'stage' AS stage, e->>'state' AS event_state,
    (e->'usage'->>'input')::numeric AS input, (e->'usage'->>'output')::numeric AS output,
    (e->'usage'->>'cachedInput')::numeric AS cached,
    (e->'usage'->>'cacheWriteInput')::numeric AS cache_write,
    (e->'usage'->>'reasoning')::numeric AS reasoning,
    (e->>'estimatedNanoUsd')::numeric AS estimated,
    (e->'reservation'->>'nanoUsd')::numeric AS reserved,
    (e->'timings'->>'completeResponseMs')::numeric AS elapsed
    FROM "M4PilotTurn" t CROSS JOIN LATERAL jsonb_array_elements(coalesce(t.payload->'events', '[]'::jsonb)) e
    WHERE t.payload->>'mode' = 'real' AND t."createdAt" >= '2026-10-05T00:00:00Z'`;
  report.stages = (await db.query(`WITH e AS (${events}) SELECT stage, count(*)::int AS calls,
    count(input)::int AS measured_calls, sum(input) AS input, sum(output) AS output,
    round(avg(input),1) AS mean_input, percentile_cont(0.5) WITHIN GROUP (ORDER BY input) AS median_input,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY input) AS p95_input, max(input) AS max_input,
    count(cached)::int AS measured_cache_calls, sum(cached) AS cached_input, sum(cache_write) AS cache_write,
    sum(reasoning) AS reasoning_output, sum(estimated)/1e9 AS estimated_usd, sum(reserved)/1e9 AS reserved_usd,
    round(avg(elapsed)) AS mean_ms FROM e GROUP BY stage ORDER BY stage`)).rows;
  report.daily = (await db.query(`WITH e AS (${events}) SELECT to_char("createdAt" AT TIME ZONE 'Europe/Tallinn','YYYY-MM-DD') AS day,
    stage, count(*)::int AS calls, sum(input) AS input, sum(output) AS output, sum(estimated)/1e9 AS estimated_usd
    FROM e GROUP BY day,stage ORDER BY day,stage`)).rows;
  report.turns = (await db.query(`WITH e AS (${events}), turns AS (SELECT id, conversation,
    max(turn_state) AS state, sum(input) FILTER (WHERE stage <> 'embedding') AS input,
    sum(output) FILTER (WHERE stage <> 'embedding') AS output,
    sum(estimated)/1e9 AS estimated_usd FROM e GROUP BY id,conversation)
    SELECT state,count(*)::int AS turns, round(avg(input),1) AS mean_input,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY input) AS median_input,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY input) AS p95_input, max(input) AS max_input,
    round(avg(output),1) AS mean_output, avg(estimated_usd) AS mean_estimated_usd
    FROM turns GROUP BY state ORDER BY state`)).rows;
  report.conversations = (await db.query(`WITH e AS (${events}), conv AS (SELECT conversation,
    count(DISTINCT id)::int AS turns, sum(input) FILTER (WHERE stage <> 'embedding') AS input,
    sum(estimated)/1e9 AS estimated_usd FROM e GROUP BY conversation)
    SELECT count(*)::int AS conversations, min(turns) AS min_turns, max(turns) AS max_turns,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY turns) AS median_turns,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY input) AS median_input, max(input) AS max_input,
    max(estimated_usd) AS max_estimated_usd FROM conv`)).rows;
  report.largestConversations = (await db.query(`WITH e AS (${events}) SELECT count(DISTINCT id)::int AS turns,
    sum(input) FILTER (WHERE stage <> 'embedding') AS input, sum(output) FILTER (WHERE stage <> 'embedding') AS output,
    sum(estimated)/1e9 AS estimated_usd FROM e GROUP BY conversation ORDER BY input DESC LIMIT 3`)).rows;
  report.states = (await db.query(`SELECT state,count(*)::int AS turns FROM "M4PilotTurn"
    WHERE payload->>'mode'='real' GROUP BY state ORDER BY state`)).rows;
  report.failures = (await db.query(`SELECT payload->>'error' AS error, count(*)::int AS turns FROM "M4PilotTurn"
    WHERE payload->>'mode'='real' AND payload ? 'error' GROUP BY payload->>'error' ORDER BY turns DESC`)).rows;
  report.fallbacks = (await db.query(`SELECT payload->'dialogueStateFallback'->>'code' AS code,count(*)::int AS turns
    FROM "M4PilotTurn" WHERE payload->>'mode'='real' AND payload ? 'dialogueStateFallback'
    GROUP BY payload->'dialogueStateFallback'->>'code' ORDER BY turns DESC`)).rows;
  report.storage = (await db.query(`SELECT count(*)::int AS rows,
    round(avg(pg_column_size(payload)+coalesce(pg_column_size(packet),0)+coalesce(pg_column_size("requestAudit"),0)+coalesce(pg_column_size(vector),0))) AS mean_row_bytes,
    pg_total_relation_size('"M4PilotTurn"') AS table_bytes,
    count(*) FILTER (WHERE "expiresAt" IS NULL)::int AS no_expiry,
    count(*) FILTER (WHERE payload ? 'lean')::int AS lean
    FROM "M4PilotTurn"`)).rows;
  report.currentLedger = (await db.query('SELECT totals FROM "M4PilotLedger" WHERE id=$1', [plan.budgetLedger ?? plan.id])).rows;
  report.versions = (await db.query(`SELECT payload->'searchAssist'->>'version' AS search_assist,
    count(*)::int AS turns, min("createdAt") AS first_at, max("createdAt") AS last_at
    FROM "M4PilotTurn" WHERE payload->>'mode'='real' GROUP BY payload->'searchAssist'->>'version' ORDER BY first_at`)).rows;
  await db.query('ROLLBACK');
  const corpus = new Client({ connectionString: process.env.RAG_V2_POSTGRES_URL,
    options: '-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=1000',
    application_name: 'rag_corpus_audit_readonly_20261008' });
  try {
    await corpus.connect(); await corpus.query('BEGIN READ ONLY');
    report.index = (await corpus.query(`SELECT g.id,g.state,g.expected_count,
      (SELECT count(*)::int FROM rag_v2_generation_document d WHERE d.tenant=g.tenant AND d.generation_id=g.id) AS documents,
      g.id=$2 AS matches_plan FROM rag_v2_head h JOIN rag_v2_generation g ON g.tenant=h.tenant AND g.id=h.active_id WHERE h.tenant=$1`,
      [plan.tenant,plan.generationId])).rows;
    report.directory = (await corpus.query(`SELECT
      count(*)::int AS documents,
      count(*) FILTER (WHERE retrieval_directory->'source'->>'journal'='true')::int AS journal_documents,
      count(*) FILTER (WHERE retrieval_directory->'source'->>'record_kind' IS NOT NULL)::int AS structured_documents,
      count(*) FILTER (WHERE retrieval_directory->'fields'->'valid_from'->>'value' IS NOT NULL)::int AS has_valid_from,
      count(*) FILTER (WHERE retrieval_directory->'fields'->'publication_date'->>'value' IS NOT NULL
        OR retrieval_directory->'fields'->'publication_year'->>'value' IS NOT NULL)::int AS has_publication_date_or_year,
      sum(jsonb_array_length(retrieval_directory->'incoming')) AS incoming_dependencies,
      sum(jsonb_array_length(retrieval_directory->'units')) AS directory_units
      FROM rag_v2_generation_document WHERE tenant=$1 AND generation_id=$2`, [plan.tenant,plan.generationId])).rows;
    report.generations = (await corpus.query(`SELECT state,count(*)::int AS generations FROM rag_v2_generation WHERE tenant=$1 GROUP BY state`,[plan.tenant])).rows;
    report.chunkTokens = (await corpus.query(`SELECT count(*)::int AS units,
      round(avg((u.data->>'input_tokens')::int),1) AS mean,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY (u.data->>'input_tokens')::int) AS median,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY (u.data->>'input_tokens')::int) AS p95,
      max((u.data->>'input_tokens')::int) AS max
      FROM rag_v2_generation g JOIN rag_v2_generation_document d ON d.tenant=g.tenant AND d.generation_id=g.id
      JOIN rag_v2_version_unit u ON u.tenant=d.tenant AND u.config_id=g.config->>'id' AND u.version_id=d.version_id AND u.document_id=d.document_id
      WHERE g.tenant=$1 AND g.id=$2`,[plan.tenant,plan.generationId])).rows;
    await corpus.query('ROLLBACK');
  } finally { await corpus.end(); }
  console.log(JSON.stringify(report,null,2));
} catch(error) { console.error(JSON.stringify({code:error.code ?? error.name})); process.exitCode=1; }
finally { await db.end(); }
'''
result = subprocess.run(['/usr/bin/node', '--input-type=module', '-e', script],
                        cwd=cwd, env={**os.environ, **env}, text=True, capture_output=True)
print(result.stdout, end='')
if result.returncode:
    print(result.stderr, end='')
    raise SystemExit(result.returncode)
