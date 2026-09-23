// Read-only planning: never enables a pilot, writes an approval or contacts a provider.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readJson, loadVersion } from '../lib/rag-v2/catalog.js';
import { hash } from '../lib/rag-v2/contracts.js';
import { implementationManifest } from '../lib/rag-v2/pilot/provenance.js';
import { digest, PROMPT_VERSION, QUESTION_VERSION, ANSWER_SCHEMA } from '../lib/rag-v2/pilot/contracts.js';

const out = path.resolve(process.argv[2] || 'tmp/rag-v2-m4-b-ready');
const privateRoot = path.resolve('tmp');
if (!out.startsWith(privateRoot + path.sep)) throw Error('private_output_required');
await fs.mkdir(out, { recursive: true });
const source = await readJson('tmp/rag-v2-multi-source/server-real-9526a805-1/corpus-manifest.json');
const candidate = await readJson('tmp/rag-v2-m2-3/selection-ranked-first-v1/m4-profile-candidate.json');
const previous = await readJson('tmp/rag-v2-m2-3/selection-ranked-first-v1/future-control-proposal.json');
const cases = previous.cases.map((c, i) => ({ ...c, split: i < 4 ? 'development' : 'held_out' }));
cases.push({ id: 'article-authority-boundary-new', split: 'held_out', language: 'et',
  query: 'Kas tehisintellekti käsitleva 2025. aasta artikli soovitusi saab kasutada kõigi Eesti valdade kohustusliku teenuseotsuse reeglistikuna?',
  requirements: ['Artikli soovituse ja õigusliku kohustuse eristus', 'Ei leiutata üldist kohustuslikkust', 'Näita antud allika ulatus ja tänase teenusereegli tõendi puudumine'],
  source: 'AI-artikli ning õppepaketi allikaliigi piir; käesolev korpus ei tõenda kõigi KOVide kehtivat teenusekorraldust' });
cases.push({ id: 'new-person-missing-municipality-new', split: 'held_out', language: 'ru',
  query: 'Это новый человек, его муниципалитет пока неизвестен. Какова точная цена домашней услуги и гарантированный срок её предоставления?',
  requirements: ['Ei kasutata teise inimese ega varasema teema andmeid', 'Puuduv vald küsitakse või nimetatakse vajalikuks täpsustuseks', 'Hinda ega garanteeritud teenuse tähtaega ei leiutata', 'Võimalik osaline abi märgitakse piiratud ulatusega'],
  source: 'Küsimus ei määra KOVi; corpus ei ole kõigi KOVide kehtiv hinnakiri' });
const evaluation = { schema_version: 'm4-answer-evaluation-1', status: 'frozen_before_real_answers_not_executed', createdAt: new Date().toISOString(),
  cases, counts: { families: 8, development: 4, held_out: 4, language: { et: 3, en: 2, ru: 3 } },
  dimensions: ['retrieval_evidence_coverage', 'claim_support', 'omitted_conditions', 'useful_partial_help', 'unjustified_certainty', 'unnecessary_refusal_or_clarification', 'citation_semantic_support', 'language', 'latency', 'provider_usage_and_cost'],
  outcomes: ['context_complete_answer_incomplete', 'context_partial_useful_answer', 'context_partial_hallucinated_gap', 'source_in_corpus_missing_from_context', 'source_not_in_allowed_corpus', 'technical_failure'],
  rule: 'No model grading, no aggregate accuracy percentage, report denominators per dimension. Seven unresolved M2 rows remain unresolved. These evaluation fields never enter runtime retrieval/model input.' };
const material = [];
for (const doc of source.documents.filter(d => !d.duplicate_of)) {
  const dir = 'tmp/rag-v2-multi-source/store/tenant_14adb6ca14328043b58abdabee85d62863056209a69bf8f9b1667dc2e7b45a98';
  const bundle = await loadVersion(dir, doc.version_id);
  material.push({ documentId: doc.document_id, versionId: doc.version_id, title: doc.title, pdfHash: doc.source_pdf_sha256, rights: doc.rights,
    chunks: bundle.chunks.map(c => ({ id: c.id, pages: c.pdf_pages, textHash: hash(c.source_text), spanIds: c.span_ids })) });
}
const implementation = await implementationManifest();
const operator = process.env.M4_PILOT_OPERATOR_CONFIG ? await readJson(process.env.M4_PILOT_OPERATOR_CONFIG) : {};
const plan = { schema_version: 'm4-pilot-plan-1', id: 'm4-real-plan-20260906', mode: 'real', status: 'not_authorized_not_configured',
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(), implementationHash: implementation.hash,
  promptVersion: PROMPT_VERSION, questionVersion: QUESTION_VERSION, answerSchemaHash: digest(ANSWER_SCHEMA),
  tenant: source.tenant, usage: 'development_only', users: operator.userId ? [operator.userId] : [], expiresAt: operator.expiresAt || null, retentionHours: 48,
  documents: Object.fromEntries(material.map(d => [d.documentId, d.versionId])), materialManifestHash: digest(material),
  generationId: candidate.generation_reference, profileId: candidate.profile.id, profileHash: digest(candidate.profile), embedding: candidate.embedding,
  model: 'gpt-6-luna', endpoint: 'https://api.openai.com/v1/responses', accountProject: operator.accountProject || null, accountAccess: 'NOT_PROVEN', modelContract: 'responses-strict-reasoning-v1',
  reasoning: 'medium', maxOutputTokens: 2048, maxInputTokens: 64000, timeoutMs: 30000,
  prices: { embeddingInput: 130, answerInput: 125, answerOutput: 500, unit: 'nano_USD_per_token',
    note: 'Public standard pricing candidate; answer input conservatively includes 1.25x cache-write rate. Account agreement and approved budget still required.',
    checkedAt: '2026-09-23', references: ['https://developers.openai.com/api/docs/models/text-embedding-3-large', 'https://developers.openai.com/api/docs/models/gpt-6-luna', 'https://developers.openai.com/api/docs/guides/prompt-caching'] },
  budget: { attempts: 16, embeddingAttempts: 8, answerAttempts: 8, tokens: 544384, nanoUsd: null },
  proposedBudgetNanoUsd: 250000000,
  proposedBudgetStatus: 'owner_approval_required_not_authorized',
  attemptRule: 'At most 8 query embeddings and 8 answer generations, plus 16 shared attempts and shared token/cost caps. A cache hit does not permit a ninth answer. Stage totals survive restarts, folder changes and conversation deletion; legacy ledgers missing stage counters fail closed. No retries. No M2 allowance reuse.',
  questionPolicy: { mode: 'locked', inputs: cases.map(c => ({ question: c.query, language: c.language, contextMode: 'new' })) },
  egress: { query: 'Exact locked text only; hash recorded before embedding.', source: 'Only chunks from the pinned material manifest, max 5 chunks and 6000 compact context tokens. Selected text and whole provider body hashes recorded before answer call.',
    reviewLimit: 'New question vectors and resulting selected source snippets are not yet computed. Material permission must cover bounded selection from these pinned versions; no precomputed packet claim.', dynamicQuestions: false },
  retention: { ownServer: 'Raw content and query vectors expire after 48h or pilot expiry, whichever is earlier. Delete cascades; archive/expiry deny reads immediately; existing retention sweep physically purges.',
    ledger: 'Content-free conservative totals retained to prevent resets; no user text or user FK.',
    browser: 'In-memory rendered content; sessionStorage carries only an intent key. No persisted question/source body.',
    provider: 'store:false; no hosted conversation/files/tools. Default abuse logs may retain content up to 30 days (exceptions apply); prompt cache may retain GPU-local state up to 24h. ZDR, MAM and residency have not been verified for an account.',
    providerReference: 'https://developers.openai.com/api/docs/guides/your-data', copies: ['Main isolated DB and its WAL', 'Private test screenshots/report under tmp/rag-v2-m4; manual cleanup due 2026-09-13', 'Canonical pre-existing development corpus retained under its separate source contract'], backups: 'No new backup was created. Existing host backup policy was not independently audited.' },
  stop: 'M4_PILOT_ENABLED=0 and restart process, or remove users/expire the server config for immediate next-check revocation. Never silently switch corpus/model.',
  missing: [...(!operator.accountProject ? ['OpenAI project with API key configured privately'] : []), ...(!operator.userId ? ['named real tester'] : []),
    ...(!operator.expiresAt ? ['permission expiry'] : []), 'approved total nanoUsd cap', 'query AND source-excerpt egress approval'],
  approval: null };
for (const [name, value] of Object.entries({ 'm4-pilot-plan.json': plan, 'm4-material-manifest.json': material, 'm4-answer-evaluation.json': evaluation, 'm4-implementation-manifest.json': implementation })) {
  await fs.writeFile(path.join(out, name), JSON.stringify(value, null, 2));
}
console.log(JSON.stringify({ output: out, implementationHash: implementation.hash, planHashWithoutApproval: digest(Object.fromEntries(Object.entries(plan).filter(([k]) => k !== 'approval'))),
  documents: material.length, questions: cases.length, approved: false, providerCalls: 0 }));
