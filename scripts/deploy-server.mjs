#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const remote = process.env.DEPLOY_SSH_HOST || "sotsiaalai";
const appDir = process.env.DEPLOY_APP_DIR || "/home/ubuntu/apps/sotsiaalai";
const branch = process.env.DEPLOY_BRANCH || "main";
const frontendEnv = process.env.DEPLOY_FRONTEND_ENV || "/etc/sotsiaalai/frontend.env";
const buildTimeoutSeconds = Number.parseInt(String(process.env.DEPLOY_BUILD_TIMEOUT_SECONDS || "900"), 10) || 900;
const discardTracked = args.has("--discard-tracked");
const skipBuild = args.has("--skip-build");

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
BUILD_TIMEOUT_SECONDS=${Math.max(60, buildTimeoutSeconds)}
DISCARD_TRACKED=${discardTracked ? "1" : "0"}
SKIP_BUILD=${skipBuild ? "1" : "0"}

cd "$APP_DIR"
BACKUP_DIR="$(dirname "$APP_DIR")/sotsiaalai-deploy-backups"

frontend_was_active="0"
frontend_stopped_for_build="0"
build_log=""

restore_frontend_on_failure() {
  status="$?"
  if [ "$frontend_stopped_for_build" = "1" ] && [ "$status" != "0" ]; then
    echo "[deploy:server] Deploy interrupted/failed; restarting previous frontend state" >&2
    sudo systemctl start sotsiaalai-frontend.service || true
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

local_rev="$(git rev-parse HEAD)"
remote_rev="$(git rev-parse "origin/$BRANCH")"
base_rev="$(git merge-base HEAD "origin/$BRANCH")"

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

if [ -f "$FRONTEND_ENV" ]; then
  set -a
  . "$FRONTEND_ENV"
  set +a
fi

echo "[deploy:server] Applying Prisma migrations"
npx prisma migrate deploy

if [ "$SKIP_BUILD" != "1" ]; then
  if [ "$frontend_was_active" = "1" ]; then
    echo "[deploy:server] Stopping frontend before in-place build"
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
    if [ "$frontend_was_active" = "1" ]; then
      echo "[deploy:server] Build failed; restarting previous frontend state" >&2
      sudo systemctl start sotsiaalai-frontend.service || true
      frontend_stopped_for_build="0"
    fi
    exit "$build_status"
  fi
fi

if systemctl list-unit-files sotsiaalai-rag.service >/dev/null 2>&1; then
  sudo systemctl restart sotsiaalai-rag.service
fi
if systemctl list-unit-files sotsiaalai-research-worker.service >/dev/null 2>&1; then
  sudo systemctl restart sotsiaalai-research-worker.service
fi
sudo systemctl restart sotsiaalai-frontend.service
frontend_stopped_for_build="0"

if systemctl list-unit-files sotsiaalai-rag.service >/dev/null 2>&1; then
  systemctl is-active sotsiaalai-rag.service
fi
if systemctl list-unit-files sotsiaalai-research-worker.service >/dev/null 2>&1; then
  systemctl is-active sotsiaalai-research-worker.service
fi
systemctl is-active sotsiaalai-frontend.service

echo "[deploy:server] Deployed $(git rev-parse --short HEAD)"
git status --short
`;

const result = spawnSync("ssh", [remote, "bash -s"], {
  input: remoteScript,
  stdio: ["pipe", "inherit", "inherit"],
  encoding: "utf8"
});

if (result.error) {
  fail(result.error.message);
}

process.exit(result.status ?? 0);
