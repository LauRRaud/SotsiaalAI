#!/usr/bin/env bash
set -euo pipefail

eval_root="/home/ubuntu/apps/sotsiaalai-luna-eval"

set -a
# shellcheck disable=SC1091
. /etc/sotsiaalai/frontend.env
set +a

export OPENAI_MODEL="gpt-5.6-luna"
export OPENAI_REASONING_EFFORT="medium"
export OPENAI_TEXT_VERBOSITY="medium"
export OPENAI_MAX_OUTPUT_TOKENS_WORKER="3000"
export CHAT_PROMPT_TOKEN_AUDIT="0"
export NODE_ENV="production"

exec "${eval_root}/node_modules/.bin/next" start \
  --hostname 127.0.0.1 \
  --port 3100
