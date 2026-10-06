import test from 'node:test';
import assert from 'node:assert/strict';
import { packJson, unpackJson, isPackedJson, PACKED_JSON } from '../lib/rag-v2/pilot/packed-json.js';
import { PilotStore, openTurn } from '../lib/rag-v2/pilot/store.js';
import { auditPacketBytes, modelProjection, AUDIT_PACKET_BYTES } from '../lib/rag-v2/search/model-context.js';
import { stable } from '../lib/rag-v2/contracts.js';
import { digest } from '../lib/rag-v2/pilot/contracts.js';
import { municipalPacket } from './fixtures/rag-v2-municipal-packet.mjs';

// A turn's audit packet says many things more than once (ADR-089, "Auditipaketi piir"). packJson states each repeated
// part once and unpackJson gives the packed value back exactly; a turn's row is opened before its packet is read.

const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
// What Postgres does to a stored JSON value: object keys come back in its own order, not the one they were written in.
const reordered = value => (Array.isArray(value) ? value.map(reordered)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort((a, b) => a.length - b.length || (a < b ? -1 : 1)).map(key => [key, reordered(value[key])])) : value);

test('a packet the size of the largest municipality\'s comes back exactly, and is stored about two fifths smaller', () => {
  const packet = municipalPacket();
  // The synthetic packet is of Tallinn's size on 06.10.2026 (543 578 bytes): over the earlier limit, under the present one.
  assert(bytes(packet) > 512000 && bytes(packet) < 620000, String(bytes(packet)));
  const packed = packJson(packet);
  assert(isPackedJson(packed));
  assert.equal(packed.packed, PACKED_JSON);
  assert(bytes(packed) < bytes(packet) * 0.65, `${bytes(packed)} of ${bytes(packet)}`);
  // Exactly: the same JSON text, key order included, straight from the packer and after the database's reordering.
  assert.equal(JSON.stringify(unpackJson(packed)), JSON.stringify(packet));
  assert.equal(stable(unpackJson(reordered(JSON.parse(JSON.stringify(packed))))), stable(packet));
  // What the references are checked against is the same after the round trip.
  const back = unpackJson(reordered(JSON.parse(JSON.stringify(packed))));
  assert.equal(stable(modelProjection(back.evidence, back, { measure: 'none' }).references), stable(back.reference_map));
  assert.equal(auditPacketBytes(back), auditPacketBytes(packet));
  // Packing again changes nothing more: a packed value holds no part twice.
  assert.equal(bytes(packJson(packed)), bytes(packed));
});

test('what is stated once stays as it is; data that could be taken for a reference is never packed', () => {
  for (const plain of [null, 7, 'tekst', [], {}, { a: 1, b: [true, null, 'x'] }, { text: 'a'.repeat(500) }]) {
    assert.equal(packJson(plain), plain);
    assert.equal(unpackJson(plain), plain);
  }
  const part = { provenance: [{ path: '/document/fields/authority', sha256: 'a'.repeat(64) }], review_state: 'imported_not_verified' };
  const repeating = { cards: [part, { ...part }, { ...part }], texts: ['Sama pikk lõik, mis seisab paketis kaks korda: tõendi kirjes ja mudeli kontekstis.', 'Sama pikk lõik, mis seisab paketis kaks korda: tõendi kirjes ja mudeli kontekstis.'] };
  const packed = packJson(repeating);
  assert(isPackedJson(packed));
  assert.equal(packed.table.length, 2, 'the repeated card and the repeated text, once each');
  assert.deepEqual(unpackJson(packed), repeating);
  // An object keyed like a reference is data here: such a value is stored as it is, so nothing can be misread.
  const withKey = { cards: [part, { ...part }, { ...part }], odd: { '~': 0 } };
  assert.equal(packJson(withKey), withKey);
  assert.deepEqual(unpackJson(withKey), withKey);
  // A part shared in storage is not shared in memory: changing one place leaves the other.
  const opened = unpackJson(packed);
  opened.cards[0].review_state = 'changed';
  assert.equal(opened.cards[1].review_state, 'imported_not_verified');
  assert.equal(unpackJson(packed).cards[0].review_state, 'imported_not_verified');
  // Values JSON does not keep are left out the same way JSON.stringify leaves them out.
  const sparse = { a: undefined, b: [part, part], c: () => 1, d: part };
  assert.equal(JSON.stringify(unpackJson(packJson(sparse))), JSON.stringify(sparse));
});

test('a damaged packed value fails loudly instead of giving a wrong packet', () => {
  assert.throws(() => unpackJson({ packed: PACKED_JSON, table: ['a'], value: { x: { '~': 3 } } }), { code: 'packed_json_reference_out_of_range' });
  assert.throws(() => unpackJson({ packed: PACKED_JSON, table: [{ again: { '~': 0 } }], value: { '~': 0 } }), { code: 'packed_json_reference_loop' });
  // Another format's label is not read as this one.
  const other = { packed: 'rag-v2/packed-json-9', table: [], value: 1 };
  assert.equal(unpackJson(other), other);
});

test('a row is opened before its packet is read: a packed packet, a packet stored as it is and a row without one', async () => {
  const packet = municipalPacket({ records: 12, passages: 2 });
  const row = state => ({ id: 'turn', state, expiresAt: null, payload: { userId: 'u', convId: 'c', events: [], packet: reordered(JSON.parse(JSON.stringify(packJson(packet)))) } });
  assert(isPackedJson(row('completed').payload.packet));
  assert.equal(stable(openTurn(row('completed')).payload.packet), stable(packet));
  const plain = { id: 'old', payload: { packet } }, none = { id: 'new', payload: { events: [] } };
  assert.equal(openTurn(plain), plain);
  assert.equal(openTurn(none), none);
  assert.equal(openTurn(null), null);
  // Every way a row leaves the store: an existing turn, a claimed one, a step's result, a dialogue source and a turn
  // awaiting publication.
  const stored = row('needs_recovery');
  const tx = { $executeRaw: async () => {}, $queryRaw: async () => [], conversation: { findUnique: async () => ({ userId: 'u', metadata: { m4: true } }) },
    chatTurn: { findUnique: async () => ({ m4Pilot: { ...stored, inputHash: 'hash', configHash: 'config' } }) },
    m4PilotTurn: { findUnique: async () => stored, findFirst: async () => ({ ...stored, payload: { ...stored.payload, context: { scopeId: 's' } } }),
      findMany: async () => [stored], update: async ({ data }) => ({ ...stored, ...data }) } };
  const store = new PilotStore({ $transaction: async fn => fn(tx), m4PilotTurn: tx.m4PilotTurn });
  const config = { id: 'm4-plan', tenant: 't', configHash: 'config' }, held = { ...stored, payload: { ...stored.payload, context: { scopeId: 's' } } };
  const input = { convId: 'c', clientTurnKey: 'key', question: 'Küsimus', contextMode: 'new' };
  tx.chatTurn.findUnique = async () => ({ m4Pilot: { ...stored, inputHash: digest({ tenant: 't', userId: 'u', ...input }), configHash: 'config' } });
  const claimed = await store.claim(config, 'u', input);
  assert.equal(claimed.fresh, false);
  const opened = [await store.existing(config, 'u', input), claimed.row, await store.save(config, held, 'claimed', { note: 1 }), await store.dialogueSource(config, held, 'turn'),
    ...(await store.pendingRecovery(config, 'u', 'c'))];
  assert.equal(opened.length, 5);
  for (const result of opened) assert.equal(stable(result.payload.packet), stable(packet));
  // A step writes back the row as stored: the packed packet is carried, not unpacked and written wide again.
  let written = null;
  tx.m4PilotTurn.update = async ({ data }) => { written = data; return { ...stored, ...data }; };
  await store.save(config, held, 'claimed', { note: 2 });
  assert(isPackedJson(written.payload.packet));
  assert(AUDIT_PACKET_BYTES > auditPacketBytes(packet));
});
