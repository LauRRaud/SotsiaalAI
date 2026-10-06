#!/usr/bin/env node
// ADR-062: what a stored chat turn's evidence gives the model now. The turn's packet is read as stored, each evidence
// entry is rebuilt from the bundle the index holds now (the same chunk, or the chunk with the same text at the same
// place of a version ingested again) and projected with the current serializer. The result must be the stored context
// with nothing but the legal dates added: act_dates on a legal act's source card, amendments on an excerpt.
// Prints the cards and excerpts that carry dates, the tokens they take against their cap, any cap hit, which
// provisions of each act the evidence holds, and the audit packet's bytes (as stored, as it would be stored now, and as
// the size limit counts it: without the dates). Reads only; no search, no model call, no embedding call, no write.
//   server, a stored turn and the active index generation (in the running release's directory, with its env file):
//     R=$(systemctl show -p WorkingDirectory --value sotsiaalai-frontend); cd $R
//     sudo -n node --env-file=/etc/sotsiaalai/releases/${R##*/}.env --import ./scripts/register-node-source-loader.mjs \
//       scripts/rag-v2-context-replay.mjs --turn <m4 turn id> [--turn <id> ...]
//   offline, a packet file and a local store:
//     node --import ./scripts/register-node-source-loader.mjs scripts/rag-v2-context-replay.mjs --packet packet.json --store tmp/rag-v2-corpus-store-v25
// Exit 1 when a context differs apart from the legal dates, or an entry's text is no longer in its document.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { id } from '../lib/rag-v2/contracts.js';
import { readActive } from '../lib/rag-v2/catalog.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { replayContext } from '../lib/rag-v2/search/context-replay.js';

const { values } = parseArgs({ options: { turn: { type: 'string', multiple: true }, packet: { type: 'string', multiple: true }, store: { type: 'string' } } });
const failed = code => { console.error(JSON.stringify({ ok: false, code })); process.exit(1); };
if (!values.turn?.length === !values.packet?.length || Boolean(values.packet?.length) !== Boolean(values.store)) failed('context_replay_usage');

const reports = [];
const report = (name, packet, generation, bundles, embedding) => {
  try {
    const { context: _context, ...result } = replayContext(packet, new Map(bundles.map(bundle => [bundle.document.id, bundle])), embedding);
    reports.push({ turn: name, stored_generation: packet.generation_id ?? null, read_from: generation, ...result });
  } catch (error) { reports.push({ turn: name, stored_generation: packet.generation_id ?? null, read_from: generation, error: error.code || 'replay_failed', ...(error.ref ? { ref: error.ref } : {}) }); }
};
const documentsOf = packet => [...new Set(packet.evidence.map(entry => entry.document_id))];

if (values.packet) {
  // A packet as the turn stores it ({ tenant, evidence, model_context, ... }), or a turn's payload that holds one.
  for (const file of values.packet) {
    const read = JSON.parse(await fs.readFile(file, 'utf8')), packet = read.packet ?? read.payload?.packet ?? read;
    if (!packet?.tenant || !Array.isArray(packet.evidence)) failed('context_replay_packet_required');
    const active = await readActive(path.resolve(values.store, id('tenant', packet.tenant)));
    const snapshot = await loadSnapshot(values.store, packet.tenant, documentsOf(packet).filter(doc => active.documents[doc]));
    report(file, packet, `store ${active.generation}`, snapshot.bundles, embeddingConfig());
  }
} else {
  const { default: prisma } = await import('../lib/prisma.js');
  const { PostgresCatalog } = await import('../lib/rag-v2/search/postgres.js');
  const postgres = new PostgresCatalog(process.env.RAG_V2_POSTGRES_URL);
  try {
    for (const turn of values.turn) {
      const row = await prisma.m4PilotTurn.findUnique({ where: { id: turn } }), packet = row?.payload?.packet;
      if (!packet) { reports.push({ turn, error: 'turn_without_packet' }); continue; }
      const generation = await postgres.active(packet.tenant);
      const bundles = await postgres.bundles(packet.tenant, generation.id, documentsOf(packet).filter(doc => generation.snapshot.documents[doc]));
      report(turn, packet, generation.id, bundles, generation.config.embedding);
    }
  } finally { await postgres.close(); await prisma.$disconnect(); }
}
const ok = reports.every(entry => entry.equal_without_legal_dates === true);
console.log(JSON.stringify({ ok, turns: reports }, null, 1));
process.exit(ok ? 0 : 1);
