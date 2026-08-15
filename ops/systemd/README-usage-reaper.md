# SotsiaalAI usage reservation-reaper (PERF-P0)

Repo-managed source of truth for scheduling the usage reservation-reaper. **OFF by
default** — installing the unit and setting the flags below is required before it does
anything. Mirrors the payment-workers / research-worker pattern.

## Why it exists

`lib/usage/service.js` reserves quota by adding `reservedAmount` to a `UsageBucket`'s
`reserved` counter, then the request commits or releases it. If the request crashes or
the release is skipped, the `UsageReservation` stays `RESERVED` forever and that
capacity is never returned — the user's quota leaks until the period rolls over.

`lib/usage/reservationReaper.js` finds `RESERVED` rows whose `expiresAt` has passed (with
a grace window), but intentionally does not release them. Expiry is not proof that the
owning provider request has stopped; automatically settling such a row can return a paid
result without charging it. The endpoint therefore remains useful as a gated detector
until reservations have an explicit owner-liveness or abandonment signal.

`POST /api/jobs/usage-reservation-reaper` is the gated endpoint; this timer calls it via
`scripts/usage-reservation-reaper.mjs` (which only POSTs the route, never touches the DB).

## Enable flags and key (in `/etc/sotsiaalai/frontend.env`)

```dotenv
USAGE_REAPER_ENABLED=1
USAGE_REAPER_JOB_KEY=<random-long-secret>
# Optional tuning:
# USAGE_REAPER_GRACE_MINUTES=5     # only report rows expired longer ago than this
# USAGE_REAPER_BATCH_SIZE=100
# PAYMENT_JOB_BASE_URL=http://localhost:3000   # shared shim base URL
```

Without the key the shim exits 1. With the key but `USAGE_REAPER_ENABLED` unset the route
returns 503 and the shim exits 0 ("disabled — nothing to do"), so a prematurely-enabled
timer does not spam systemd with failures.

## Install / update on the server

```bash
cd /home/ubuntu/apps/sotsiaalai
sudo cp ops/systemd/sotsiaalai-usage-reservation-reaper.service /etc/systemd/system/
sudo cp ops/systemd/sotsiaalai-usage-reservation-reaper.timer   /etc/systemd/system/
sudo systemctl daemon-reload
# Enable only after the flags/key above are set:
sudo systemctl enable --now sotsiaalai-usage-reservation-reaper.timer
systemctl list-timers 'sotsiaalai-*' --no-pager
```

Node path: the unit calls `/usr/bin/node scripts/usage-reservation-reaper.mjs`. Adjust
`ExecStart` if node lives elsewhere (e.g. nvm).

## Verify without enabling (dry run)

```bash
# 401 without the key:
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/jobs/usage-reservation-reaper
# With the key + dryRun the route reports how many rows are expired and releases nothing:
curl -s -X POST -H "x-usage-reaper-key: $USAGE_REAPER_JOB_KEY" \
  'http://localhost:3000/api/jobs/usage-reservation-reaper?dryRun=1'
```

## Schedule

Every 10 minutes (`OnCalendar=*:0/10`, +90s jitter). The detector can feed operational
alerts, but it does not mutate quota. `scripts/deploy-server.mjs` does not restart it (it
is a timer-driven oneshot), so no deploy change is needed once installed.
