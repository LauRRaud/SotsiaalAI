# Master-source recheck timer

These are repository-managed, inactive templates. They are not installed or enabled by this change.

The one-shot command runs `rag:master:check -- --recheck --fetch --limit 50`. It can make bounded, SSRF-protected public URL checks and updates only the candidate queue and `master_sources.runtime.json`. It does not auto-publish, auto-approve, or call a RAG ingest endpoint.

An operator must explicitly install the unit, provide `/etc/sotsiaalai/rag-master-source-check.env`, and enable the timer. That operational step is deliberately outside this change.
