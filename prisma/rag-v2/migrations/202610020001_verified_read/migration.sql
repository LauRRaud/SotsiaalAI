-- ADR-069: marks of the reads a server process verified in full (a bundle, a version's source objects, a document's
-- unit morphology). A mark is a hash of the read's key, the row versions it was verified at, the check scheme and the
-- analyzer version. The next process uses a read whose mark stands while it runs the same checks again itself.
CREATE TABLE rag_v2_verified_read (
 mark text PRIMARY KEY, verified_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
