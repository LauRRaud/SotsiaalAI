# SotsiaalAI payment workers (T09 PAYMENTS-V1)

Repo-managed source of truth for scheduling the two T09 payment workers. Both are
**OFF by default** and change nothing on the server until an operator installs the
units and sets the enable flags. This mirrors the `sotsiaalai-research-worker` and
`sotsiaalai-rag-master-source-check` pattern.

## Why these exist

T09 shipped two repo-managed, non-activated workers as gated HTTP endpoints:

| Worker | Route | What it does |
|---|---|---|
| Email outbox | `POST /api/jobs/payment-emails` | Delivers queued payment/invite/clawback emails (idempotent claim, retry/backoff, terminal state, lease recovery). A retry only re-sends an email — never re-runs a payment or grant. |
| Reconciliation | `POST /api/jobs/subscription-reconcile` | Resolves stuck `INITIATED` payments. Only expired INITIATED rows; **never marks a payment PAID without a verified provider result**; admin can never hand-set PAID. |
| Renewals | `POST /api/jobs/subscription-renewals` | Charges due RECURRING+ACTIVE subscriptions (`nextBilling <= now`) via the stored, encrypted card mandate. Missing token key fail-closes per subscription (`token_unavailable`, no charge). Failed charges follow the retry schedule and eventually cancel. |

The endpoints do nothing on their own — something must call them on a schedule.
Until then the outbox never delivers and stuck payments never reconcile. These units
are that scheduler. The shims (`scripts/payment-emails.mjs`, `scripts/subscription-reconcile.mjs`)
only POST the gated route with the job key; they never touch the DB directly.

## Enable flags and keys (in `/etc/sotsiaalai/frontend.env`)

Nothing runs until BOTH the timer is installed AND these are set:

```dotenv
# Email outbox
PAYMENT_EMAIL_WORKER_ENABLED=1
PAYMENT_EMAIL_JOB_KEY=<random-long-secret>
# EMAIL_FROM / SMTP must already be configured for delivery to succeed.

# Reconciliation
SUBSCRIPTION_RECONCILE_ENABLED=1
SUBSCRIPTION_RECONCILE_JOB_KEY=<random-long-secret>
# Only query the real provider with explicit operator consent:
# SUBSCRIPTION_RECONCILE_QUERY_PROVIDER=1   # off => report-only, never activates

# Renewals (no separate *_ENABLED flag: gated by the job key + recurring flag)
SUBSCRIPTION_RECURRING_ENABLED=1
SUBSCRIPTION_RENEWAL_JOB_KEY=<random-long-secret>
# PAYMENT_TOKEN_ENC_KEY must be set or every charge skips as token_unavailable.
# SUBSCRIPTION_RENEWAL_DRY_RUN=1   # report due subscriptions, charge nothing

# Optional, shared by all shims (defaults to the local frontend):
# PAYMENT_JOB_BASE_URL=http://localhost:3000
```

Without a key the shim exits 1 (misconfig). With a key but the `*_ENABLED` flag unset
the route returns 503 and the shim exits 0 with a "disabled — nothing to do" note, so a
prematurely-enabled timer does not spam systemd with failures.

Safety notes:
- **Reconciliation is report-only** unless `SUBSCRIPTION_RECONCILE_QUERY_PROVIDER=1`. Report-only
  scans and counts stuck rows but activates nothing. Turning provider-query on makes it call
  Maksekeskus to verify status before resolving — do this only intentionally.
- **Recurring token encryption is dormant** on the current server (`SUBSCRIPTION_RECURRING_ENABLED=0`,
  no `PAYMENT_TOKEN_ENC_KEY`). If recurring is ever enabled, set `PAYMENT_TOKEN_ENC_KEY` first or
  mandate storage fails closed by design (no auto-renewal, logged).

## Install / update on the server

```bash
cd /home/ubuntu/apps/sotsiaalai
for u in sotsiaalai-payment-emails sotsiaalai-subscription-reconcile sotsiaalai-subscription-renewals; do
  sudo cp ops/systemd/$u.service /etc/systemd/system/$u.service
  sudo cp ops/systemd/$u.timer   /etc/systemd/system/$u.timer
done
sudo systemctl daemon-reload
# Enable only after the flags/keys above are set:
sudo systemctl enable --now sotsiaalai-payment-emails.timer
sudo systemctl enable --now sotsiaalai-subscription-reconcile.timer
sudo systemctl enable --now sotsiaalai-subscription-renewals.timer
systemctl list-timers 'sotsiaalai-*' --no-pager
```

Node path: the units call `/usr/bin/node scripts/<shim>.mjs`. If node lives elsewhere
(e.g. nvm), adjust `ExecStart`, or add an `npm run` alias and point `ExecStart` at it.

## Verify without enabling (dry run)

```bash
# 401 without the key:
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/jobs/payment-emails
# 503 with the key but the worker disabled:
curl -s -X POST -H "x-payment-email-key: $PAYMENT_EMAIL_JOB_KEY" \
  'http://localhost:3000/api/jobs/payment-emails?dryRun=1'
# With ENABLED + dryRun the route reports counts and sends nothing.
```

## Schedule

| Timer | Cadence | Rationale |
|---|---|---|
| payment-emails | every 3 min (`*:0/3`) | confirmations / sponsor invites / clawback notices should be timely |
| subscription-reconcile | every 15 min (`*:0/15`) | stuck payments are not time-critical |
| subscription-renewals | hourly | due-date based (`nextBilling`), retries are day-granular |

`scripts/deploy-server.mjs` does not restart these (they are timer-driven oneshots, not
long-running services), so no deploy change is needed once installed.
