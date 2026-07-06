# CSS Cleanup Safe-Loop

A self-verifying loop for reducing CSS debt (`!important`, tokenization, dead
rules) **one file at a time, provably without visual regressions.**

It wires together pieces that already existed but were used ad-hoc:

| Step | Tool | Role |
|------|------|------|
| Audit oracle | `scripts/css-page-report.mjs` | what renders, rule provenance, dead/consistency (run periodically) |
| Coverage | `scripts/css-cleanup/targets-gen.mjs` | derives the **full** snapshot target set from page-report |
| Golden master | `scripts/css-snapshot.mjs` | computed-style per theme × viewport (**headed, all instances**) |
| Gate 1 | `scripts/css-snapshot-diff.mjs` | exit 0 = identical, 1 = something moved |
| Gate 2 | `npm test` | the 967/13 baseline |
| Worklist | `scripts/css-cleanup/worklist-gen.mjs` | ranked file-by-file "what to clean next" |
| Orchestrator | `scripts/css-cleanup/run.mjs` | before → edit → verify → green/auto-revert |

## Two non-negotiable safety principles

1. **Comprehensive coverage.** The snapshot is only as safe as its target list.
   `targets-gen.mjs` generates the full set (every tracked selector × route ×
   theme) so a change can't move a style the net never watches. Grow the tracked
   selector set in `scripts/css-page-report.targets.json` over time.
2. **Headed, never headless.** Headless does not faithfully render this app's
   token/glass/canvas components (see `css-page-report.mjs` header). A headless
   golden master compares two equally-wrong snapshots and passes real
   regressions. `run.mjs` always captures headed + all-instances.

## One-time / periodic setup

```bash
# 1. (periodic) refresh the audit oracle — needs a prod build + headed browser
node scripts/css-page-report.mjs --out reports/css-page-report/<date>

# 2. regenerate the full snapshot coverage from it
node scripts/css-cleanup/targets-gen.mjs
#    → scripts/css-snapshot.targets.generated.json

# 3. regenerate the worklist (what to clean next, ranked by debt)
node scripts/css-cleanup/worklist-gen.mjs
#    → reports/css-cleanup/worklist-<date>.md
```

## The loop (per file)

```bash
# auth for snapshots: export SNAPSHOT_SESSION=<next-auth.session-token>
#                     (or pass --token <t>); see css-snapshot.mjs header.
# dev/prod server must be running at --base-url (default http://localhost:3000)

# 1) capture baseline BEFORE editing
node scripts/css-cleanup/run.mjs before --file app/styles/theme/hc.css

# 2) ...make your !important / tokenization edit...

# 3) verify: diff (gate 1) + tests (gate 2), verdict + optional auto-revert
node scripts/css-cleanup/run.mjs verify --file app/styles/theme/hc.css --auto-revert
```

Green (🟢) = computed style identical AND tests pass → safe to commit.
Red (🔴) = something moved or tests failed → fix or (with `--auto-revert`) the
file is reverted **only if it is the sole working-tree change**.

### Fast inner loop vs final gate

```bash
# fast: narrow to the selectors you're touching (fewer per route)
node scripts/css-cleanup/run.mjs before --file <f> --selectors .back-button,.chat-send-btn
node scripts/css-cleanup/run.mjs verify --file <f> --no-tests

# MANDATORY before commit: full coverage + tests
node scripts/css-cleanup/run.mjs before --file <f>      # full generated targets
node scripts/css-cleanup/run.mjs verify --file <f>      # tests on
```
The scoped run is a convenience for iteration — it is **not** the safety gate.
Always re-run full (all selectors + tests) before committing.

## Useful flags (`run.mjs`)

- `--file <css>` — file under change (state key + auto-revert target)
- `--label <name>` — alternative state key when not tied to one file
- `--targets <f>` — explicit targets file (default: generated)
- `--selectors a,b` — narrow generated targets to these selectors (fast loop)
- `--no-tests` — skip gate 2 (iteration only, never the final gate)
- `--auto-revert` — revert the file on red, iff it is the only change
- `--base-url <url>` / `--token <t>` — passed through to css-snapshot

## State & outputs

- `reports/css-cleanup/state/<key>.{before,after,meta}.json` — per-file loop state
- `reports/css-cleanup/worklist-<date>.md` — ranked debt worklist
- `scripts/css-snapshot.targets.generated.json` — full coverage (regenerated)
