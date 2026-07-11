# Server Operations Notes

## Production Host

Keep production hostnames, IP addresses, SSH aliases, and user-specific access
details in private operations documentation or a secure password/secret manager,
not in the public repository.

```bash
ssh <production-host-alias>
```

Application directory:

```bash
cd <application-directory>
```

## Service Restarts

Restart RAG service:

```bash
sudo systemctl restart sotsiaalai-rag.service
sudo systemctl status sotsiaalai-rag.service --no-pager
```

Restart frontend service:

```bash
sudo systemctl restart sotsiaalai-frontend.service
sudo systemctl status sotsiaalai-frontend.service --no-pager
```

Restart deep research worker:

```bash
sudo systemctl restart sotsiaalai-research-worker.service
sudo systemctl status sotsiaalai-research-worker.service --no-pager
```

When deep research code changes, restart both `sotsiaalai-frontend.service` and
`sotsiaalai-research-worker.service`. Restart `sotsiaalai-rag.service` when the
retrieval service, index, or RAG environment changes.

## Retention Configuration

Application-level retention is configured through environment variables:

```bash
DATA_RETENTION_DAYS=90
CONVERSATION_TTL_DAYS=90
PAYMENT_RETENTION_DAYS=2555
PAYMENT_RAW_RETENTION_DAYS=90
LOG_RETENTION_DAYS=90
```

`DATA_RETENTION_DAYS` is the general cleanup window used by the app retention
job. `CONVERSATION_TTL_DAYS` controls new conversation expiry. Payment records
use `PAYMENT_RETENTION_DAYS`; provider raw payload cleanup uses
`PAYMENT_RAW_RETENTION_DAYS`. `LOG_RETENTION_DAYS` controls `ChatLog` cleanup.

User document deletion always attempts to delete the matching agent/RAG
document. If the RAG service is unavailable, the document delete leaves a
`DataDeletionJob` with `failed` status for automatic or manual follow-up. Account
deletion keeps the account suspended until every external cleanup succeeds.

`BACKUP_RETENTION_DAYS` may be documented in env files as an operations policy,
but the Next.js application does not enforce backup deletion. Backup retention
must be configured and verified in the server/provider backup tooling.

Systemd/journald, reverse-proxy, database, object storage, and provider logs are
outside application-level retention unless separately configured on the host or
provider side.
