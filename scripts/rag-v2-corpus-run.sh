#!/bin/sh
# The server half of a corpus increment (ADR-059): the store increment, the embedding plan, the purchase when some
# inputs have no vector yet, the index job and a hand-made chat plan for the new generation (ADR-037). The laptop half
# (scripts/rag-v2-corpus-refresh.mjs package) left ship-v<N>.tgz, ship-v<N>.json and policy-v<N>.json in the work dir.
#   sh /home/ubuntu/apps/sotsiaalai/scripts/rag-v2-corpus-run.sh <N> <previous N> <plan file> <cap USD> "<basis et>" "<basis en>"
# Example: sh .../rag-v2-corpus-run.sh 45 44 /etc/sotsiaalai/m4-corpus-chat-20261001a.json 0.10 "Omaniku ... ." "Owner's ..."
# Every step's failure ends the script with a non-zero exit and says what state it left (Codex R1, 30.09.2026). The index
# job activates the new generation before the chat plan is made, so a failed plan leaves the chat refusing turns
# (active_index_mismatch) until a plan for it exists: RESUME=plan with the same arguments makes only that step, with a
# new plan file name if the failed attempt left one.
VERSION=$1; PREVIOUS=$2; OUT=$3; CAP=$4; BASIS_ET=$5; BASIS_EN=$6
[ -n "$VERSION" ] && [ -n "$PREVIOUS" ] && [ -n "$OUT" ] && [ -n "$CAP" ] && [ -n "$BASIS_ET" ] && [ -n "$BASIS_EN" ] || { echo "usage: <N> <previous N> <plan file> <cap> <basis et> <basis en>"; exit 1; }
# The paths are the server's; tests/rag-v2-corpus-run.test.mjs points them at a temporary tree.
A=${RAG_V2_APP:-/home/ubuntu/apps/sotsiaalai}; S=${RAG_V2_WORK:-/home/ubuntu/rag-v2-work/rag-v2-v25}; E=${RAG_V2_EVAL:-/home/ubuntu/rag-v2-work/eval-app}
ETC=${RAG_V2_ETC:-/etc/sotsiaalai}
cd $S || exit 1
step() { echo "== $1 $(date -u +%H:%M:%S.%N | cut -c1-12)"; }
fail() { echo "FAILED: $1"; exit 1; }
field() { node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))[process.argv[2]])' "$1" "$2"; }
proof() { (cd $E && sudo -n node --env-file=$ETC/frontend.env version-proof.mjs "$1"); }
[ -e "$OUT" ] && fail "the plan file $OUT exists; give a new name"

chat_plan() {
  step chat-plan-v$VERSION
  CURRENT=$(sudo -n grep -o "^M4_PILOT_CONFIG=.*" $ETC/rag.env | cut -d= -f2)
  [ -n "$CURRENT" ] || fail "no active plan in rag.env"
  LOG=$S/chat-plan-v$VERSION.log
  (cd $A && sudo -n node --env-file=$ETC/frontend.env --env-file=$ETC/rag.env --import ./scripts/register-node-source-loader.mjs scripts/rag-v2-chat-plan.mjs \
    --tenant sotsiaalai-corpus --profile hybrid-estnltk-chat-v5 --reasoning medium --template $ETC/m4-luna6-20260923.json --out $OUT --budget-usd 4 \
    --basis "$BASIS_EN" --activate) > $LOG 2>&1
  STATUS=$?
  tail -2 $LOG
  [ $STATUS -eq 0 ] || fail "chat plan (exit $STATUS, $LOG): index $NEXT is active and the plan $CURRENT is not for it, so the chat refuses turns until a plan exists; run again with RESUME=plan and a new plan file name"
  sudo -n chown root:ubuntu $OUT || fail "chown $OUT"
  sudo -n systemctl restart sotsiaalai-frontend || fail "restart sotsiaalai-frontend"
  sleep 4
  systemctl is-active --quiet sotsiaalai-frontend || fail "sotsiaalai-frontend is not active after the restart"
  echo active
  # The settings the new plan differs in from the one it replaces (the generation, ids, dates and the basis are expected).
  sudo -n node -e 'const fs=require("fs"), [a,b]=process.argv.slice(1).map(f=>JSON.parse(fs.readFileSync(f,"utf8")));
const flat=(o,p="")=>Object.entries(o??{}).flatMap(([k,v])=>v&&typeof v==="object"&&!Array.isArray(v)?flat(v,p+k+"."):[[p+k,JSON.stringify(v)]]);
const fa=new Map(flat(a)), fb=new Map(flat(b)); for (const k of new Set([...fa.keys(),...fb.keys()])) if (!k.startsWith("documents.") && fa.get(k)!==fb.get(k)) console.log("diff", k, (fa.get(k)??"-").slice(0,90), "->", (fb.get(k)??"-").slice(0,90));' $CURRENT $OUT \
    || fail "plan comparison"
}

if [ "$RESUME" = plan ]; then
  grep -q '"state": "ready"' index-run-v$VERSION.json || fail "index v$VERSION is not ready; RESUME=plan only makes the chat plan"
  NEXT=$(field tmp/rag-v2-corpus-index-v$VERSION/index-plan.json generation_id) || fail "index plan v$VERSION"
  chat_plan
  rm -f ship-v$VERSION.tgz
  step done
  exit 0
fi

cp -r $A/lib $A/scripts $A/package.json $S/ || fail "copy the app code"
SHIP=ship-v$VERSION.tgz; INFO=ship-v$VERSION.json
[ -s "$SHIP" ] && [ -s "$INFO" ] && [ -s "policy-v$VERSION.json" ] || fail "ship-v$VERSION.tgz, ship-v$VERSION.json and policy-v$VERSION.json are needed"
echo "$(field $INFO sha256)  $SHIP" | sha256sum -c - || fail "package hash"
BASE=$(field $INFO base_generation) && HEAD=$(field $INFO head_generation) || fail "ship-v$VERSION.json"
PRIOR=$(field tmp/rag-v2-corpus-index-v$PREVIOUS/index-plan.json generation_id) || fail "index plan v$PREVIOUS"
step proof-before
proof $PRIOR || fail "proof of $PRIOR"
# The store increment: the head (active.json, publications) and the new immutable versions, after a head backup.
T=$(ls -d tmp/rag-v2-corpus-store-v25/tenant_*)
[ "$(field $T/active.json generation)" = "$BASE" ] || fail "the server store head is not the base of this increment"
mkdir -p tmp/store-backup-v$PREVIOUS && cp $T/active.json tmp/store-backup-v$PREVIOUS/ && cp -r $T/publications tmp/store-backup-v$PREVIOUS/ || fail "store head backup"
tar xzf $SHIP -C $T || fail "unpack $SHIP (the head backup is tmp/store-backup-v$PREVIOUS)"
[ "$(field $T/active.json generation)" = "$HEAD" ] || fail "the store head after the increment is not $HEAD"
mkdir -p tmp/rag-v2-corpus-index-v$VERSION && mv policy-v$VERSION.json tmp/rag-v2-corpus-index-v$VERSION/policy.json || fail "policy"
POLICY=tmp/rag-v2-corpus-index-v$VERSION/policy.json
# The newest price file; the plan refuses one older than 24 hours (price_verification_stale).
PRICE=$(ls -t tmp/rag-v2-corpus-embeddings/prices/price-*.json | head -1); CONN=$A/tmp/rag-v2-services/connections.json
# pilot_7e23e68b is not a complete purchase; every other usage dir is reused.
USAGE=$(ls -d tmp/rag-v2-corpus-embeddings/usage/pilot_* | grep -v pilot_7e23e68b | sort)
REUSE=""; VECTORS=""; for d in $USAGE; do REUSE="$REUSE --reuse $d"; VECTORS="$VECTORS --vectors $d"; done
step embedding-plan
node scripts/rag-v2-corpus-embeddings.mjs --mode plan --development-only --store tmp/rag-v2-corpus-store-v25 --tenant sotsiaalai-corpus --subject operator \
  --policy $POLICY --price $PRICE $REUSE --indexed --connections $CONN --output tmp/rag-v2-corpus-embeddings/plan-v$VERSION > plan-v$VERSION.json 2>&1 \
  || { tail -5 plan-v$VERSION.json; fail "embedding plan (plan-v$VERSION.json)"; }
step embedding-plan-done
tail -16 plan-v$VERSION.json
EXTERNAL=$(field plan-v$VERSION.json external_inputs) || fail "embedding plan output"
echo "external inputs: $EXTERNAL"
NEW=""
if [ "$EXTERNAL" != "0" ]; then
  MANIFEST=$(field tmp/rag-v2-corpus-embeddings/plan-v$VERSION/approval.preview.json egress_manifest_sha256) || fail "approval preview"
  step approval
  mkdir -p tmp/rag-v2-corpus-embeddings/approval-v$VERSION
  sed "s/v37/v$VERSION/g" tmp/rag-v2-corpus-embeddings/approval-v37/make-approval-v37.mjs > tmp/rag-v2-corpus-embeddings/approval-v$VERSION/make-approval-v$VERSION.mjs || fail "approval script"
  node tmp/rag-v2-corpus-embeddings/approval-v$VERSION/make-approval-v$VERSION.mjs --manifest $MANIFEST --cap $CAP --by "Omanik (LauRRaud)" --price $PRICE \
    --basis "$BASIS_ET" || fail "approval"
  BEFORE=$(ls -d tmp/rag-v2-corpus-embeddings/usage/pilot_* | sort)
  step purchase
  sudo -n grep "^OPENAI_API_KEY=" $ETC/frontend.env | node --env-file=/dev/stdin scripts/rag-v2-corpus-embeddings.mjs --mode execute --development-only \
    --store tmp/rag-v2-corpus-store-v25 --tenant sotsiaalai-corpus --subject operator --policy $POLICY $REUSE --indexed --connections $CONN \
    --baseline tmp/rag-v2-corpus-embeddings/plan-v$VERSION/embedding-plan.json --approval tmp/rag-v2-corpus-embeddings/approval-v$VERSION/approval-v$VERSION.json \
    --price $PRICE --output tmp/rag-v2-corpus-embeddings/run-v$VERSION > purchase-v$VERSION.log 2>&1
  grep -v embedding_progress purchase-v$VERSION.log | tail -16
  step purchase-done
  # The purchase's own record decides: the key comes through a pipe, so its exit status is the last command's.
  grep -q '"state": "complete"' tmp/rag-v2-corpus-embeddings/run-v$VERSION/run.json || fail "purchase not complete (purchase-v$VERSION.log)"
  for d in $(ls -d tmp/rag-v2-corpus-embeddings/usage/pilot_*); do echo "$BEFORE" | grep -qx "$d" || NEW="$d"; done
  echo "new vectors: $NEW"
  [ -n "$NEW" ] || fail "no new vector directory"
fi
COMMON="--development-only --tenant sotsiaalai-corpus --subject operator --policy $POLICY --store tmp/rag-v2-corpus-store-v25
  --manifest tmp/rag-v2-corpus-index-v$VERSION/index-plan.json $VECTORS ${NEW:+--vectors $NEW} --connections $CONN"
step index-plan
env -u OPENAI_API_KEY RAG_V2_ESTNLTK_PYTHON=/opt/sotsiaalai/rag-v2-estnltk-1.7.5/bin/python node scripts/rag-v2-index-batch.mjs --mode plan $COMMON || fail "index plan"
step index-run
env -u OPENAI_API_KEY RAG_V2_ESTNLTK_PYTHON=/opt/sotsiaalai/rag-v2-estnltk-1.7.5/bin/python node scripts/rag-v2-index-batch.mjs --mode run $COMMON \
  --batch-size 100 --max-batches 10000 > index-run-v$VERSION.json 2>&1
STATUS=$?
step index-done
tail -26 index-run-v$VERSION.json
[ $STATUS -eq 0 ] && grep -q '"state": "ready"' index-run-v$VERSION.json || fail "index not ready (index-run-v$VERSION.json); the chat stays on $PRIOR"
NEXT=$(field tmp/rag-v2-corpus-index-v$VERSION/index-plan.json generation_id) || fail "index plan v$VERSION"
step proof-after
proof $PRIOR || fail "proof of $PRIOR after the index job"
proof $NEXT || fail "proof of $NEXT; it is active, run RESUME=plan only after checking it"
# A new generation needs a new plan (renewal keeps the generation, ADR-037): the owner's controlled path.
chat_plan
rm -f $SHIP
step done
