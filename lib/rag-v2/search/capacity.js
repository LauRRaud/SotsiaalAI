import { fail } from '../contracts.js';

/** One local index generation holds every active document and unit. The same capacity is checked
 *  before an embedding purchase is planned or reserved and again when indexing, so vectors are
 *  never bought for an index that cannot be published. Measured on 25.09.2026 with the full local
 *  corpus (5,985 documents, 29,103 units): batched index job 64 min, all retrieval directories
 *  0.3 s (11.8 MB), filtered vector query 0.13 s. The limits then left room to about twice that size.
 *
 *  Units raised from 60,000 to 80,000 on 07.10.2026 (ADR-100), when the corpus stood at 57,860 units and
 *  a batch of studies was refused. Measured on the server with the same inputs against four kept
 *  generations of 40,489 to 57,860 units, warm: the three parts of a turn's search that grow with the
 *  generation (ADR-036) grow in a line. The directory of all documents 40 -> 63 ms; one lexical query
 *  over all documents 2.9 -> 3.6 s and 3.4 -> 4.2 s for two texts (about 0.4 s per 10,000 units; a
 *  real turn's whole lexical lane is cheaper, 1.1 to 1.5 s); one exact vector query 137 -> 188 ms.
 *  Carried on in that line to 80,000 units, these parts cost a quarter to a third more than at 57,860,
 *  about 0.5 to 0.7 s on a turn (not measured: no generation of that size exists). The documents
 *  bound stays: 8,179 of 10,000 are used. The server's disk (about 380 KB a unit) fills before
 *  80,000 units.
 *
 *  Units raised from 80,000 to 100,000 on 08.10.2026 (ADR-108, the owner's order), when the corpus stood at
 *  68,408 units. Measured again with the same inputs against six kept generations of 40,489 to 68,408
 *  units: the line holds. One lexical query over all documents 2.9 -> 4.1 s and 3.6 -> 4.6 s (0.4 s per
 *  10,000 units, as before), one exact vector query 128 -> 200 ms, the directory 38 -> 48 ms. Carried on to
 *  100,000 units: the lexical query about 5.3 and 5.8 s (under the 15 s statement limit), the vector query
 *  about 280 ms; on a real turn about 0.6 s more than now. Not measured: no generation above 68,408 exists.
 *  The same measurement found the live generation three times slower than the line, by stale planner
 *  statistics and not by size; an activation now refreshes them (postgres.js, activate). Documents stay
 *  at 10,000 (8,337 used). At 100,000 units the vectors take 1.2 GB of memory and the index about 12 GB
 *  more disk than now.
 *
 *  Documents raised from 10,000 to 15,000 on 11.10.2026 (ADR-143, the owner's order), when the corpus stood at
 *  9,735 documents and 90,707 units: short pages fill the documents bound before the units bound (265 places
 *  were left for a batch of 479 short articles of 670 units). What grows with the number of documents is the directory
 *  of all documents, which a turn reads once; the two queries and the vectors in memory grow with the units,
 *  whose bound stays. The directory was measured on the server with the generations of ADR-108 and ADR-137:
 *  38 ms at 6,470 documents, 48 ms at 8,337, 56 ms at 9,288, about 6 ms per 1,000 documents. Carried on in that
 *  line it costs about 90 ms at 15,000 documents, some 35 ms more on a turn than now. Not measured: no
 *  generation above 9,735 documents exists. The search holds the same bound (unified.js,
 *  UNIFIED_LIMITS.directoryDocuments) and a test keeps the two equal: a generation the index accepts and the
 *  search refuses would fail every turn. */
export const INDEX_CAPACITY = Object.freeze({ documents: 15000, units: 100000 });

export function assertIndexCapacity({ documents, units }) {
  if (!Number.isSafeInteger(documents) || !Number.isSafeInteger(units) || documents < 0 || units < 0
    || documents > INDEX_CAPACITY.documents || units > INDEX_CAPACITY.units) fail('local_index_limit');
}

/** Capacity of a loaded snapshot: its documents and their chunks (one index unit per chunk). */
export const snapshotCapacity = snapshot => ({
  documents: snapshot.bundles.length,
  units: snapshot.bundles.reduce((sum, bundle) => sum + bundle.chunks.length, 0),
});
