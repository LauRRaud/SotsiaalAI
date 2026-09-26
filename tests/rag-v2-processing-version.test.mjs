import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { processingFingerprint, RECORD } from '../scripts/rag-v2-processing-fingerprint.mjs';

test('processing code and its version labels change together', () => {
  const recorded = JSON.parse(fs.readFileSync(RECORD, 'utf8')), current = processingFingerprint();
  assert.deepEqual(current.files, recorded.files, 'The fingerprinted file list changed; record it again.');
  assert.equal(current.sha256, recorded.sha256,
    'Ingest processing code changed. If it can change any bundle (text, blocks, sections, chunks or retrieval text), '
    + 'raise normalization/chunking in lib/rag-v2/contracts.js so a new immutable version is prepared; then run '
    + '`node scripts/rag-v2-processing-fingerprint.mjs --write`. A change proven not to alter output only needs the second step.');
  assert.deepEqual([current.normalization, current.chunking, current.parser], [recorded.normalization, recorded.chunking, recorded.parser],
    'Version labels changed without recording the fingerprint.');
});
