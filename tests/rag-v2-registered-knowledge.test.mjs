import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { hash } from '../lib/rag-v2/contracts.js';
import { registeredSource, REGISTERED_KNOWLEDGE_SCHEMA } from '../lib/rag-v2/registered-source.js';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { KNOWLEDGE_SCHEMA } from '../lib/rag-v2/knowledge.js';

// ADR-054: knowledge prepared for a registered source in a batch reaches the ingest as the registry names its bytes.
// The Harku annex (ADR-053) is read from Andmebaasi as committed; no network.
const act = 'oigusaktid/404072025017.xml', annex = 'oigusaktid/lisad/404072025017-lisa';
let root;
before(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-registered-knowledge-')); });
after(async () => {
  const target = path.resolve(root);
  assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-registered-knowledge-'));
  await fs.rm(target, { recursive: true, force: true });
});

test('a registered knowledge file gives the source version its anchored cards; changed bytes or another source are refused', async () => {
  const files = [act, `${annex}.json`, `${annex}.meta.json`];
  for (const file of files) { await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true }); await fs.copyFile(path.join('Andmebaasi', file), path.join(root, file)); }
  const bytes = file => fs.readFile(path.join(root, file));
  const source = { role: 'source', path: files[1], sha256: hash(await bytes(files[1])), metadata_path: files[2] };
  const entries = [{ role: 'source', path: act, sha256: hash(await bytes(act)) }, source, { role: 'metadata', path: files[2], sha256: hash(await bytes(files[2])) }];
  const write = list => fs.writeFile(path.join(root, 'REGISTER.json'), JSON.stringify({ entries: list }));
  await write(entries);
  const rights = { access: 'local_private', usage: 'development_only' }, profile = { id: 'generic-fixtures', version: '1', months: [], categoryLabels: [] };
  const plain = await ingest({ tenant: 'registered-knowledge-test', inputRoot: root, metadata: await registeredSource(root, source), storeRoot: path.join(root, 'store-a'), rights, profile });
  assert.equal(plain.bundle.knowledge_cards.length, 0);
  // One card anchored in the annex's own text, as a batch draft writes it.
  const unit = plain.bundle.source_units.findIndex(item => item.raw_text.includes('Toimetuleku piirmäär Harku vallas on 600 eurot'));
  const quote = 'Toimetuleku piirmäär Harku vallas on 600 eurot kuus ühe pereliikme kohta (netosissetulek).';
  const knowledge = { schema_version: KNOWLEDGE_SCHEMA, dependencies: [], gaps: [], cards: [{ key: 'p1-c1', kind: 'condition',
    statement: 'Harku valla toimetulekupiir on 600 eurot kuus pereliikme kohta.', scope: 'Harku valla eelarvest makstavad sotsiaaltoetused', anchors: [{ source_unit_index: unit, quote }] }] };
  const file = {
    schema_version: REGISTERED_KNOWLEDGE_SCHEMA, source_path: source.path, source_sha256: source.sha256,
    preparation: { model: 'fixture', plan_hashes: ['0'.repeat(64)], draft_hash: '1'.repeat(64), source_version_id: plain.bundle.version.id,
      verification_state: 'source_anchored_unreviewed', dropped: {} }, knowledge };
  const knowledgePath = 'teadmised/404072025017-lisa.knowledge.json', text = JSON.stringify(file);
  await fs.mkdir(path.join(root, 'teadmised'), { recursive: true }); await fs.writeFile(path.join(root, knowledgePath), text);
  const withKnowledge = [...entries.map(entry => (entry === source ? { ...entry, knowledge_path: knowledgePath } : entry)),
    { role: 'knowledge', path: knowledgePath, sha256: hash(Buffer.from(text)) }];
  await write(withKnowledge);
  const metadata = await registeredSource(root, withKnowledge[1]);
  assert.deepEqual(metadata.knowledge, knowledge);
  assert.equal(metadata.knowledge_preparation.verification_state, 'source_anchored_unreviewed');
  const prepared = await ingest({ tenant: 'registered-knowledge-test', inputRoot: root, metadata, storeRoot: path.join(root, 'store-b'), rights, profile });
  assert.equal(prepared.bundle.knowledge_cards.length, 1);
  assert.notEqual(prepared.bundle.version.id, plain.bundle.version.id);
  assert.deepEqual(prepared.bundle.chunks.map(chunk => chunk.source_text), plain.bundle.chunks.map(chunk => chunk.source_text));
  assert(prepared.bundle.report.warnings.some(warning => warning.code === 'knowledge_import_unreviewed'));
  // The registry names the file's exact bytes and the file names its source.
  await fs.writeFile(path.join(root, knowledgePath), text.replace('600 eurot kuus pereliikme', '700 eurot kuus pereliikme'));
  await assert.rejects(registeredSource(root, withKnowledge[1]), { code: 'registry_knowledge_hash_mismatch' });
  const other = JSON.stringify({ ...file, source_sha256: '0'.repeat(64) });
  await fs.writeFile(path.join(root, knowledgePath), other);
  await write(withKnowledge.map(entry => (entry.role === 'knowledge' ? { ...entry, sha256: hash(Buffer.from(other)) } : entry)));
  await assert.rejects(registeredSource(root, withKnowledge[1]), { code: 'invalid_registered_knowledge' });
});
