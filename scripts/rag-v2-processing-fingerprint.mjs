#!/usr/bin/env node
// Fingerprint of the code that turns a source into a bundle (text, blocks, chunks, retrieval text).
// A bundle version is named by its processing labels (contracts.js); when this code changes, either
// the labels change too or the change is confirmed not to alter any output. Usage:
//   node scripts/rag-v2-processing-fingerprint.mjs          print the current fingerprint
//   node scripts/rag-v2-processing-fingerprint.mjs --write  record it with the current labels
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONFIG } from '../lib/rag-v2/contracts.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RECORD = path.join(root, 'lib/rag-v2/processing-implementation.json');
export const PROCESSING_FILES = [
  'lib/rag-v2/adapters/municipal-record.js', 'lib/rag-v2/chunking.js', 'lib/rag-v2/contracts.js', 'lib/rag-v2/ingestion.js',
  'lib/rag-v2/knowledge.js', 'lib/rag-v2/metadata-adapter.js', 'lib/rag-v2/metadata-values.js', 'lib/rag-v2/normalize.js',
  'lib/rag-v2/parser.js', 'lib/rag-v2/pdf-layout.js', 'lib/rag-v2/pdf-worker.js', 'lib/rag-v2/registered-source.js',
  'lib/rag-v2/source-locations.js', 'lib/rag-v2/structured-record.js', 'lib/rag-v2/text-source.js',
];

/** Line endings differ between checkouts; the fingerprint covers the text, not the platform. */
export function processingFingerprint() {
  const digest = createHash('sha256');
  for (const file of PROCESSING_FILES) {
    digest.update(`${file}\n`);
    digest.update(fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/gu, '\n'));
  }
  return { normalization: DEFAULT_CONFIG.normalization, chunking: DEFAULT_CONFIG.chunking, parser: DEFAULT_CONFIG.parser,
    files: PROCESSING_FILES, sha256: digest.digest('hex') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const current = processingFingerprint();
  if (process.argv.includes('--write')) fs.writeFileSync(RECORD, `${JSON.stringify(current, null, 2)}\n`);
  console.log(JSON.stringify(current, null, 2));
}
