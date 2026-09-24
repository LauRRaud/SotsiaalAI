#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const remote = process.env.DEPLOY_SSH_HOST || "sotsiaalai";
const appDir = process.env.DEPLOY_APP_DIR || "/home/ubuntu/apps/sotsiaalai";
const branch = process.env.DEPLOY_BRANCH || "main";
const frontendEnv = process.env.DEPLOY_FRONTEND_ENV || "/etc/sotsiaalai/frontend.env";
const ragEnv = process.env.DEPLOY_RAG_ENV || "/etc/sotsiaalai/rag.env";
const buildTimeoutSeconds = Number.parseInt(String(process.env.DEPLOY_BUILD_TIMEOUT_SECONDS || "900"), 10) || 900;
const artifactBackupKeep = Number.parseInt(String(process.env.DEPLOY_ARTIFACT_BACKUP_KEEP || "1"), 10) || 1;
const buildLogKeep = Number.parseInt(String(process.env.DEPLOY_BUILD_LOG_KEEP || "1"), 10) || 1;
const discardTracked = args.has("--discard-tracked");
const skipBuild = args.has("--skip-build");
const printScript = args.has("--print-script");

function fail(message, code = 1) {
  console.error(`[deploy:server] ${message}`);
  process.exit(code);
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

const remoteScript = `
set -euo pipefail

APP_DIR=${shellEscape(appDir)}
BRANCH=${shellEscape(branch)}
FRONTEND_ENV=${shellEscape(frontendEnv)}
RAG_ENV=${shellEscape(ragEnv)}
BUILD_TIMEOUT_SECONDS=${Math.max(60, buildTimeoutSeconds)}
ARTIFACT_BACKUP_KEEP=${Math.max(1, artifactBackupKeep)}
BUILD_LOG_KEEP=${Math.max(1, buildLogKeep)}
DISCARD_TRACKED=${discardTracked ? "1" : "0"}
SKIP_BUILD=${skipBuild ? "1" : "0"}

cd "$APP_DIR"
BACKUP_DIR="$(dirname "$APP_DIR")/sotsiaalai-deploy-backups"

frontend_was_active="0"
frontend_stopped_for_build="0"
frontend_masked_for_build="0"
schema_migrated="0"
migration_started="0"
migration_state_file=""
build_log=""
artifact_backup=""
previous_rev=""
deps_installed="0"

restore_frontend_on_failure() {
  status="$?"
  if [ "$status" != "0" ]; then
    database_unchanged="1"
    if [ "$migration_started" = "1" ] && [ -n "$migration_state_file" ] && [ -f "$migration_state_file" ]; then
      if node scripts/prisma-migration-state.mjs compare "$migration_state_file"; then
        database_unchanged="1"
      else
        database_unchanged="0"
      fi
    fi
    if [ "$schema_migrated" = "0" ] && [ "$database_unchanged" = "1" ] && [ -n "$artifact_backup" ] && [ -f "$artifact_backup" ]; then
      echo "[deploy:server] Deploy failed before schema change; restoring previous frontend artifact" >&2
      if [ "$APP_DIR" = "/" ] || [ -z "$APP_DIR" ]; then
        echo "[deploy:server] Unsafe APP_DIR; refusing artifact restore" >&2
        exit 90
      fi
      # The old artifact only runs with the old dependencies. On 24.09 a failed build left the
      # previous .next on the new node_modules and the site answered 500 until the next deploy.
      if [ "$deps_installed" = "1" ] && [ -n "$previous_rev" ] && [ "$previous_rev" != "$(git rev-parse HEAD)" ]; then
        echo "[deploy:server] Returning the checkout and dependencies to $previous_rev" >&2
        if ! { git reset --hard "$previous_rev" && npm ci --include=dev --no-audit --no-fund >&2; }; then
          echo "[deploy:server] Dependency rollback failed; the restored artifact may not start" >&2
        fi
      fi
      rm -rf -- "$APP_DIR/.next"
      tar -xzf "$artifact_backup" -C "$APP_DIR"
    elif [ "$database_unchanged" = "0" ]; then
      echo "[deploy:server] Migration state changed; keeping the validated candidate artifact" >&2
    fi
    if [ "$frontend_masked_for_build" = "1" ]; then
      sudo systemctl unmask --runtime sotsiaalai-frontend.service || true
      frontend_masked_for_build="0"
    fi
    if [ "$frontend_was_active" = "1" ] && [ "$frontend_stopped_for_build" = "1" ]; then
      echo "[deploy:server] Deploy interrupted/failed; restarting frontend" >&2
      sudo systemctl start sotsiaalai-frontend.service || true
    fi
  fi
}

handle_interrupt() {
  echo "[deploy:server] Deploy interrupted" >&2
  exit 130
}

trap restore_frontend_on_failure EXIT
trap handle_interrupt HUP INT TERM

current_branch="$(git branch --show-current)"
if [ "$current_branch" != "$BRANCH" ]; then
  echo "[deploy:server] Wrong branch: $current_branch, expected $BRANCH" >&2
  exit 2
fi

git config pull.ff only
git fetch origin "$BRANCH"

if ! git diff --quiet --ignore-submodules -- || ! git diff --cached --quiet --ignore-submodules --; then
  echo "[deploy:server] Server has tracked local changes:" >&2
  git status --short >&2

  if [ "$DISCARD_TRACKED" != "1" ]; then
    echo "[deploy:server] Pull stopped before changing anything." >&2
    echo "[deploy:server] Re-run with --discard-tracked to save a patch backup and reset tracked files." >&2
    exit 3
  fi

  backup_dir="$BACKUP_DIR"
  mkdir -p "$backup_dir"
  backup_file="$backup_dir/tracked-changes-$(date -u +%Y%m%dT%H%M%SZ).patch"
  git diff --binary > "$backup_file"
  git diff --cached --binary >> "$backup_file"
  echo "[deploy:server] Saved tracked changes to $backup_file" >&2
  git reset --hard HEAD
fi

mapfile -d '' untracked_files < <(git ls-files --others --exclude-standard -z)
if [ "\${#untracked_files[@]}" -gt 0 ]; then
  echo "[deploy:server] Server has untracked local files:" >&2
  printf '?? %s\n' "\${untracked_files[@]}" >&2

  if [ "$DISCARD_TRACKED" != "1" ]; then
    echo "[deploy:server] Pull stopped before changing anything." >&2
    echo "[deploy:server] Re-run with --discard-tracked to save backups and remove local tracked/untracked changes." >&2
    exit 3
  fi

  backup_dir="$BACKUP_DIR"
  mkdir -p "$backup_dir"
  backup_file="$backup_dir/untracked-files-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
  printf '%s\\0' "\${untracked_files[@]}" | tar --null -czf "$backup_file" --files-from -
  echo "[deploy:server] Saved untracked files to $backup_file" >&2
  printf '%s\\0' "\${untracked_files[@]}" | xargs -0 rm -f --
fi

# Next 16.3 Turbopack reads the whole project while tracing the proxy, ignored folders included.
# One root-owned file under tmp/ failed the 24.09 build. Files in the app directory belong to
# the deploy user, so repair ownership before anything changes and stop if a file stays unreadable.
deploy_user="$(id -un)"
foreign_files="$(sudo -n find "$APP_DIR" \\( -path "$APP_DIR/node_modules" -o -path "$APP_DIR/.git" \\) -prune -o ! -user "$deploy_user" -print 2>/dev/null | wc -l || true)"
if [ "$foreign_files" != "0" ]; then
  sudo -n find "$APP_DIR" \\( -path "$APP_DIR/node_modules" -o -path "$APP_DIR/.git" \\) -prune -o ! -user "$deploy_user" -exec chown "$deploy_user:$deploy_user" {} +
  echo "[deploy:server] Returned $foreign_files files in the app directory to $deploy_user"
fi
unreadable_files="$(find "$APP_DIR" \\( -path "$APP_DIR/node_modules" -o -path "$APP_DIR/.git" \\) -prune -o ! -readable -print 2>/dev/null | head -5 || true)"
if [ -n "$unreadable_files" ]; then
  echo "[deploy:server] Files the build cannot read; stopped before changing anything:" >&2
  printf '%s\\n' "$unreadable_files" >&2
  exit 7
fi

local_rev="$(git rev-parse HEAD)"
remote_rev="$(git rev-parse "origin/$BRANCH")"
base_rev="$(git merge-base HEAD "origin/$BRANCH")"
previous_rev="$local_rev"

if [ "$local_rev" = "$remote_rev" ]; then
  echo "[deploy:server] Already up to date at $(git rev-parse --short HEAD)"
elif [ "$local_rev" = "$base_rev" ]; then
  git merge --ff-only "origin/$BRANCH"
else
  echo "[deploy:server] Server branch has diverged from origin/$BRANCH." >&2
  echo "[deploy:server] local=$local_rev remote=$remote_rev base=$base_rev" >&2
  exit 4
fi

if systemctl is-active --quiet sotsiaalai-frontend.service; then
  frontend_was_active="1"
fi

# The production env files are intentionally root-readable only. Read them
# through the same non-interactive sudo gate used by the service controls;
# never print or copy their contents to the deploy log. rag.env holds the
# RAG v2 connections and plans (ADR-028) and is read after frontend.env, in the
# same order as the frontend unit.
for env_file in "$FRONTEND_ENV" "$RAG_ENV"; do
  if sudo -n test -r "$env_file"; then
    set -a
    source /dev/stdin < <(sudo -n cat -- "$env_file")
    set +a
  elif [ -f "$env_file" ]; then
    echo "[deploy:server] Env file exists but is not readable via sudo: $env_file" >&2
    exit 5
  fi
done

# From here node_modules may no longer match the previous release, even if npm ci fails midway.
deps_installed="1"
echo "[deploy:server] Installing locked dependencies"
npm ci --include=dev --no-audit --no-fund

# cross-env 10.1.0 can arrive from npm's cache without executable mode on its
# declared bin targets. Builds do not use it, but both production services do,
# so verify and repair the locked package immediately after every clean install.
for node_bin in cross-env cross-env-shell; do
  bin_path="node_modules/.bin/$node_bin"
  bin_target="$(readlink -f "$bin_path" || true)"
  if [ -z "$bin_target" ] || [ ! -f "$bin_target" ]; then
    echo "[deploy:server] Required executable is missing: $bin_path" >&2
    exit 6
  fi
  if [ ! -x "$bin_target" ]; then
    chmod 0755 "$bin_target"
    echo "[deploy:server] Restored executable mode: $node_bin"
  fi
done

if [ "$SKIP_BUILD" != "1" ]; then
  mkdir -p "$BACKUP_DIR"
  if [ -d "$APP_DIR/.next" ]; then
    artifact_backup="$BACKUP_DIR/frontend-artifact-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
    tar -czf "$artifact_backup" -C "$APP_DIR" .next
    echo "[deploy:server] Previous frontend artifact: $artifact_backup"
  fi

  if [ "$frontend_was_active" = "1" ]; then
    echo "[deploy:server] Entering maintenance gate before build"
    sudo systemctl mask --runtime sotsiaalai-frontend.service
    frontend_masked_for_build="1"
    sudo systemctl stop sotsiaalai-frontend.service
    frontend_stopped_for_build="1"
  fi

  mkdir -p "$APP_DIR/deploy-build-logs"
  build_log="$APP_DIR/deploy-build-logs/build-$(date -u +%Y%m%dT%H%M%SZ).log"
  echo "[deploy:server] Build log: $build_log"

  if timeout "$BUILD_TIMEOUT_SECONDS"s bash -lc 'npm run prisma:generate && npm run build' 2>&1 | tee "$build_log"; then
    :
  else
    build_status="\${PIPESTATUS[0]}"
    if [ "$build_status" = "124" ]; then
      echo "[deploy:server] Build timed out after \${BUILD_TIMEOUT_SECONDS}s" >&2
    fi
    exit "$build_status"
  fi
fi

echo "[deploy:server] Checking pending migration data, size and lock risks"
if [ "$SKIP_BUILD" = "1" ]; then
  npm run db:migrate:preflight -- --require-no-pending
else
  npm run db:migrate:preflight
fi

echo "[deploy:server] Applying Prisma migrations with bounded locks"
migration_state_file="$(mktemp "$APP_DIR/.migration-state.XXXXXX")"
rm -f -- "$migration_state_file"
node scripts/prisma-migration-state.mjs write "$migration_state_file"
migration_started="1"
PGOPTIONS="\${PGOPTIONS:-} -c lock_timeout=5s -c statement_timeout=15min" npx prisma migrate deploy
schema_migrated="1"
rm -f -- "$migration_state_file"
migration_state_file=""

# The RAG v2 pilot catalogue is a separate database with its own migrations. Without
# this step the 23.09 migrations stayed unapplied on the server while the code needed them.
if [ -n "\${RAG_V2_POSTGRES_URL:-}" ]; then
  echo "[deploy:server] Applying RAG v2 catalogue migrations with bounded locks"
  RAG_V2_DATABASE_URL="$RAG_V2_POSTGRES_URL" PGOPTIONS="\${PGOPTIONS:-} -c lock_timeout=5s -c statement_timeout=15min" \\
    npx prisma migrate deploy --config prisma/rag-v2/prisma.config.mjs
fi

# An approved chat pilot plan is bound to the exact runtime code (implementationHash).
# A release that changes that code stops new pilot answers until a new plan is approved;
# on 24.09 that happened unnoticed (ADR-028). Say so in the log and as a GitHub warning.
if [ "\${M4_PILOT_ENABLED:-}" = "1" ] && [ -n "\${M4_PILOT_CONFIG:-}" ]; then
  pilot_plan_state="$( (sudo -n cat -- "$M4_PILOT_CONFIG" 2>/dev/null || true) | node scripts/rag-v2-plan-freshness.mjs 2>/dev/null || true)"
  [ -n "$pilot_plan_state" ] || pilot_plan_state="invalid"
  if [ "$pilot_plan_state" = "current" ]; then
    echo "[deploy:server] RAG v2 pilot plan matches this release"
  else
    echo "[deploy:server] WARNING: RAG v2 pilot plan is $pilot_plan_state for this release; the chat pilot gives no new answers until a new plan is approved" >&2
    echo "::warning title=RAG v2 pilot plan $pilot_plan_state::The approved chat pilot plan does not match this release. New pilot answers stay stopped until a new plan is approved."
  fi
fi

# HALLATAVAD AJASTUSED (SOL-CW-14). Unit-failid elavad repositooriumis
# (\`deploy/systemd/\`), sest ajastus, mis elab ainult ühe masina crontabis, ei ole
# platvormi oma — ja just tema puudumine jäi märkamatuks: koodis olev
# säilitusreegel ei muutu iseenesest päris tööks.
#
# TAIMEREID SIIN EI LUBATA SISSE. See on teadlik: \`SotsiaalAI.md\` S1 lukustab
# järjekorra (andmekaitseanalüüs → cron → kuivjooks → aktiveerimine) ja
# lubamine kuulub aktiveerimise väljalaskesse, mitte igasse deploy'sse.
if [ -d "$APP_DIR/deploy/systemd" ]; then
  installed_units=""
  for unit in "$APP_DIR"/deploy/systemd/*.service "$APP_DIR"/deploy/systemd/*.timer "$APP_DIR"/deploy/systemd/*.mount; do
    [ -e "$unit" ] || continue
    name="$(basename "$unit")"
    if ! sudo cmp -s "$unit" "/etc/systemd/system/$name"; then
      sudo install -m 0644 "$unit" "/etc/systemd/system/$name"
      installed_units="$installed_units $name"
    fi
  done
  if [ -f "$APP_DIR/deploy/systemd/sotsiaalai-materials-tmpfiles.conf" ]; then
    sudo install -m 0644 "$APP_DIR/deploy/systemd/sotsiaalai-materials-tmpfiles.conf" /etc/tmpfiles.d/sotsiaalai-materials-tmpfiles.conf
  fi
  if [ -f "$APP_DIR/deploy/bin/sotsiaalai-material-cdr" ]; then
    sudo install -m 0755 "$APP_DIR/deploy/bin/sotsiaalai-material-cdr" /usr/local/bin/sotsiaalai-material-cdr
  fi
  if [ -f "$APP_DIR/deploy/bin/sotsiaalai-materials-storage-verify" ]; then
    sudo install -m 0755 "$APP_DIR/deploy/bin/sotsiaalai-materials-storage-verify" /usr/local/bin/sotsiaalai-materials-storage-verify
  fi
  if [ -f "$APP_DIR/deploy/systemd/sotsiaalai-frontend.service.d/20-materials-storage.conf" ]; then
    sudo install -d -m 0755 /etc/systemd/system/sotsiaalai-frontend.service.d
    sudo install -m 0644 "$APP_DIR/deploy/systemd/sotsiaalai-frontend.service.d/20-materials-storage.conf" /etc/systemd/system/sotsiaalai-frontend.service.d/20-materials-storage.conf
    installed_units="$installed_units sotsiaalai-frontend.service.d/20-materials-storage.conf"
  fi
  if [ -f "$APP_DIR/deploy/systemd/sotsiaalai-frontend.service" ]; then
    # Remove the short-lived drop-in from the first retirement attempt. Unit
    # dependency lists from the legacy base unit were not reset by that drop-in.
    sudo rm -f -- /etc/systemd/system/sotsiaalai-frontend.service.d/10-retired-rag-dependency.conf
  fi
  if [ -n "$installed_units" ]; then
    sudo systemctl daemon-reload
    echo "[deploy:server] Systemd units updated:$installed_units"
    echo "[deploy:server] NB: timers are NOT enabled by deploy — see deploy/systemd/README.md"
  fi
fi

if [ "$frontend_masked_for_build" = "1" ]; then
  sudo systemctl unmask --runtime sotsiaalai-frontend.service
  frontend_masked_for_build="0"
fi
# This release retires the old engines. Keep their data for explicit recovery.
for retired_unit in sotsiaalai-rag-master-source-check.timer sotsiaalai-rag-master-source-check.service sotsiaalai-research-worker.service sotsiaalai-rag.service; do
  if systemctl cat "$retired_unit" >/dev/null 2>&1; then
    sudo systemctl disable --now "$retired_unit"
  fi
done

sudo systemctl restart sotsiaalai-frontend.service
frontend_stopped_for_build="0"

systemctl is-active sotsiaalai-frontend.service

if [ -d "$BACKUP_DIR" ]; then
  if [ "$SKIP_BUILD" != "1" ] && [ -d "$APP_DIR/.next" ]; then
    if [ "$APP_DIR" = "/" ] || [ -z "$APP_DIR" ]; then
      echo "[deploy:server] Unsafe APP_DIR; refusing cache cleanup" >&2
      exit 91
    fi
    rm -rf -- "$APP_DIR/.next/cache"
    npm cache clean --force >/dev/null 2>&1 || echo "[deploy:server] npm cache cleanup failed" >&2
    rm -rf -- /home/ubuntu/.cache/prisma

    current_artifact="$BACKUP_DIR/frontend-current-$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD).tar.gz"
    tar -czf "$current_artifact" -C "$APP_DIR" .next
    tar -tzf "$current_artifact" >/dev/null
    echo "[deploy:server] Current frontend artifact: $current_artifact"
  fi

  mapfile -t rollback_artifacts < <(
    find "$BACKUP_DIR" -maxdepth 1 -type f -name 'frontend-artifact-*.tar.gz' -printf '%p\n'
  )
  for rollback_artifact in "\${rollback_artifacts[@]}"; do
    rm -f -- "$rollback_artifact"
  done

  mapfile -t artifact_backups < <(
    find "$BACKUP_DIR" -maxdepth 1 -type f -name 'frontend-current-*.tar.gz' -printf '%p\n' | sort -r
  )
  if [ "\${#artifact_backups[@]}" -gt "$ARTIFACT_BACKUP_KEEP" ]; then
    removed_artifacts=0
    for ((index = ARTIFACT_BACKUP_KEEP; index < \${#artifact_backups[@]}; index += 1)); do
      rm -f -- "\${artifact_backups[$index]}"
      removed_artifacts=$((removed_artifacts + 1))
    done
    echo "[deploy:server] Removed $removed_artifacts stale current frontend artifacts; kept $ARTIFACT_BACKUP_KEEP"
  fi
fi

if [ -d "$APP_DIR/deploy-build-logs" ]; then
  mapfile -t build_logs < <(
    find "$APP_DIR/deploy-build-logs" -maxdepth 1 -type f -name 'build-*.log' -printf '%p\n' | sort -r
  )
  if [ "\${#build_logs[@]}" -gt "$BUILD_LOG_KEEP" ]; then
    removed_build_logs=0
    for ((index = BUILD_LOG_KEEP; index < \${#build_logs[@]}; index += 1)); do
      rm -f -- "\${build_logs[$index]}"
      removed_build_logs=$((removed_build_logs + 1))
    done
    echo "[deploy:server] Removed $removed_build_logs stale build logs; kept $BUILD_LOG_KEEP"
  fi
fi

echo "[deploy:server] Deployed $(git rev-parse --short HEAD)"
git status --short
`;

if (printScript) {
  process.stdout.write(remoteScript);
  process.exit(0);
}

const result = spawnSync("ssh", [remote, "bash -s"], {
  input: remoteScript,
  stdio: ["pipe", "inherit", "inherit"],
  encoding: "utf8"
});

if (result.error) {
  fail(result.error.message);
}

process.exit(result.status ?? 0);
