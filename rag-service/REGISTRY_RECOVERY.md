# RAG registry recovery

`registry.json` is fail-closed. If `/health` reports `REGISTRY_CORRUPT` or
`REGISTRY_IO_ERROR`, stop every RAG service process before recovery. Do not run
ingest, patch, reindex, or delete while the registry is unavailable.

1. Preserve the broken `registry.json` as an incident artifact outside the
   storage directory.
2. Validate `registry.json.last-good` as JSON and confirm that its root is an
   object whose values are objects; any embedded `docId` must match its key.
3. Copy the validated snapshot to a new file in the storage directory, fsync
   it, and atomically rename it over `registry.json`.
4. Start one RAG worker, require `/health` to return `ok: true`, and compare the
   document count with the snapshot before enabling other workers.
5. Reconcile documents changed after the snapshot from the operation audit;
   never infer success from files or Chroma rows alone.

Keep the broken file and the two `rag_proxy_operation_*` audit rows for the
incident record. Never edit the last-good snapshot in place.
