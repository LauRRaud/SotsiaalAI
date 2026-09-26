import { fail } from '../contracts.js';

/** One local index generation holds every active document and unit. The same capacity is checked
 *  before an embedding purchase is planned or reserved and again when indexing, so vectors are
 *  never bought for an index that cannot be published. Measured on 25.09.2026 with the full local
 *  corpus (5,985 documents, 29,103 units): batched index job 64 min, all retrieval directories
 *  0.3 s (11.8 MB), filtered vector query 0.13 s. The limits leave room to about twice that size. */
export const INDEX_CAPACITY = Object.freeze({ documents: 10000, units: 60000 });

export function assertIndexCapacity({ documents, units }) {
  if (!Number.isSafeInteger(documents) || !Number.isSafeInteger(units) || documents < 0 || units < 0
    || documents > INDEX_CAPACITY.documents || units > INDEX_CAPACITY.units) fail('local_index_limit');
}

/** Capacity of a loaded snapshot: its documents and their chunks (one index unit per chunk). */
export const snapshotCapacity = snapshot => ({
  documents: snapshot.bundles.length,
  units: snapshot.bundles.reduce((sum, bundle) => sum + bundle.chunks.length, 0),
});
