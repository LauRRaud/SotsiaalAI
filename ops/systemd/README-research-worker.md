# sotsiaalai-research-worker.service

Repo-managed source of truth for the deep-research queue worker (decision **TE1**:
separate systemd unit over inline processing, so a ~minutes-long research job never
runs inside the Next.js request process on the shared VPS).

## Why it exists

`app/api/research/jobs/route.js` enqueues a `ResearchJob` and, when
`RESEARCH_JOB_MODE=worker` (the production setting), does **not** process it inline.
Something must drain the queue. That something is `scripts/research-worker.mjs`
(`npm run research:worker`), supervised by this unit. Without the unit, jobs stay
`queued` forever — the exact gap `scripts/deploy-server.mjs` and `scripts/check-env.mjs`
warn about.

## Install / update on the server

```bash
sudo cp /home/ubuntu/apps/sotsiaalai/ops/systemd/sotsiaalai-research-worker.service \
        /etc/systemd/system/sotsiaalai-research-worker.service
sudo systemctl daemon-reload
sudo systemctl enable --now sotsiaalai-research-worker.service
systemctl status sotsiaalai-research-worker.service --no-pager
```

`scripts/deploy-server.mjs` already restarts this unit on every deploy **if it exists**,
so once installed no deploy change is needed. Restart it (with the frontend) whenever
deep-research code changes — see `docs/internal/server-operations.md`.

## Why `--conditions=react-server`

`npm run research:worker` runs with `NODE_OPTIONS=--conditions=react-server` (set in the
`package.json` script). The pipeline imports `@/lib/server/ragAuth`, which imports
`server-only` — a guard that **throws in a plain Node process** (its `index.js` is only
replaced by a no-op `empty.js` under the `react-server` export condition that Next's own
server build uses). Without the condition the worker crash-loops immediately with
"This module cannot be imported from a Client Component module". The flag makes standalone
`node`/`tsx` resolve `server-only` to the same no-op Next uses server-side.

## Env (all from `/etc/sotsiaalai/frontend.env`)

Uses the same `DATABASE_URL`, OpenAI, and RAG keys as the frontend. Optional tuning
(defaults in `scripts/research-worker.mjs`): `RESEARCH_WORKER_POLL_MS`,
`RESEARCH_WORKER_LEASE_MS`, `RESEARCH_WORKER_MAX_ATTEMPTS`, `RESEARCH_WORKER_STALE_MS`,
`RESEARCH_WORKER_ID`.
