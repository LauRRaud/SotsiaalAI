#!/bin/sh
# The server half of a corpus increment (ADR-059): the store increment, the embedding plan, the purchase when some
# inputs have no vector yet, the index job and a hand-made chat plan for the new generation (ADR-037). The laptop half
# (scripts/rag-v2-corpus-refresh.mjs package) left ship-v<N>.tgz, ship-v<N>.json and policy-v<N>.json in the work dir.
#   sh $(systemctl show -p WorkingDirectory --value sotsiaalai-frontend)/scripts/rag-v2-corpus-run.sh \
#     <N> <previous N> <plan file> <cap USD> "<basis et>" "<basis en>"
# Example: sh .../rag-v2-corpus-run.sh 45 44 /etc/sotsiaalai/m4-corpus-chat-20261001a.json 0.10 "Omaniku ... ." "Owner's ..."
# Every step's failure ends the script with a non-zero exit and says what state it left (Codex R1, 30.09.2026). The index
# job activates the new generation before the chat plan is made, so a failed plan leaves the chat refusing turns
# (active_index_mismatch) until a plan for it exists: RESUME=plan with the same arguments makes only that step, with a
# new plan file name if the failed attempt left one.
# The service runs a release directory with that release's own env file (scripts/deploy-release-host.mjs, 04.10.2026);
# the first checkout /home/ubuntu/apps/sotsiaalai keeps the shared data only and its code is no longer the running code.
# So the code and the plan's settings come from the running release, and the plan is activated twice: in rag.env, which
# the next release's env file is made from, and in the running release's env file, the only one the service reads.
VERSION=$1; PREVIOUS=$2; OUT=$3; CAP=$4; BASIS_ET=$5; BASIS_EN=$6
[ -n "$VERSION" ] && [ -n "$PREVIOUS" ] && [ -n "$OUT" ] && [ -n "$CAP" ] && [ -n "$BASIS_ET" ] && [ -n "$BASIS_EN" ] || { echo "usage: <N> <previous N> <plan file> <cap> <basis et> <basis en>"; exit 1; }
# The paths are the server's; tests/rag-v2-corpus-run.test.mjs points them at a temporary tree.
S=${RAG_V2_WORK:-/home/ubuntu/rag-v2-work/rag-v2-v25}; E=${RAG_V2_EVAL:-/home/ubuntu/rag-v2-work/eval-app}; ETC=${RAG_V2_ETC:-/etc/sotsiaalai}
RELEASES=${RAG_V2_RELEASES:-/home/ubuntu/apps/sotsiaalai-releases}; SHARED=${RAG_V2_SHARED:-/home/ubuntu/apps/sotsiaalai}; UNIT=sotsiaalai-frontend
cd $S || exit 1
step() { echo "== $1 $(date -u +%H:%M:%S.%N | cut -c1-12)"; }
fail() { echo "FAILED: $1"; exit 1; }
field() { node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))[process.argv[2]])' "$1" "$2"; }
proof() { (cd $E && sudo -n node --env-file=$ETC/frontend.env version-proof.mjs "$1"); }
# The running release, as the unit names it: A is its directory and ENVF its env file (ENV is sh's own start-up file
# variable). A deploy changes both.
live() {
  A=$(systemctl show -p WorkingDirectory --value $UNIT); ENVF=$(systemctl show -p EnvironmentFiles --value $UNIT | cut -d' ' -f1)
  [ "$(echo "$ENVF" | grep -c .)" = 1 ] && case "$A $ENVF" in "$RELEASES"/?*" $ETC"/releases/?*.env) true ;; *) false ;; esac \
    || fail "$UNIT runs from '$A' with the env file '$ENVF': a release under $RELEASES with its one env file under $ETC/releases is expected"
  [ -f $A/scripts/rag-v2-chat-plan.mjs ] && sudo -n test -f $ENVF || fail "the release $A or its env file $ENVF cannot be read"
}
[ -e "$OUT" ] && fail "the plan file $OUT exists; give a new name"
live

chat_plan() {
  step chat-plan-v$VERSION
  REFUSES="index $NEXT is active and the running plan is not for it, so the chat refuses turns; run again with RESUME=plan and a new plan file name"
  # A deploy reads rag.env, writes the next release's env file and switches the unit under this lock. Held from here to the
  # end of the script, it keeps the release read below the running one until the service has restarted with the plan.
  exec 9>>$RELEASES/deploy.lock
  flock -w 900 9 || fail "a deploy held $RELEASES/deploy.lock for 15 minutes: $REFUSES"
  live
  # The last assignment is the one in force: a release that renewed its plan has the line twice.
  CURRENT=$(sudo -n grep "^M4_PILOT_CONFIG=" $ENVF | tail -1 | cut -d= -f2-)
  [ -n "$CURRENT" ] || fail "no active plan in $ENVF"
  LOG=$S/chat-plan-v$VERSION.log
  NODE="sudo -n node --env-file=$ENVF --import ./scripts/register-node-source-loader.mjs"
  # ADR-092: the new plan keeps the running plan's answer effort and the efforts it lets a user choose between. A plan
  # made without the choices would take the lightning button "Kiire vastus" out of the composer; one made with a fixed
  # effort would undo the default the owner chose (low since 06.10.2026).
  EFFORT=$(sudo -n node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(p.reasoning||"medium")' "$CURRENT") \
    || fail "the running plan $CURRENT cannot be read: $REFUSES"
  CHOICES=$(sudo -n node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write((p.reasoningChoices||[]).join(","))' "$CURRENT") \
    || fail "the running plan $CURRENT cannot be read: $REFUSES"
  (cd $A && $NODE scripts/rag-v2-chat-plan.mjs \
    --tenant sotsiaalai-corpus --profile hybrid-estnltk-chat-v6 --reasoning $EFFORT --template $ETC/m4-luna6-20260923.json --out $OUT --budget-usd 4 \
    ${CHOICES:+--reasoning-choices $CHOICES} --basis "$BASIS_EN" --rag-env $ETC/rag.env --activate) > $LOG 2>&1
  STATUS=$?
  tail -2 $LOG
  [ $STATUS -eq 0 ] || fail "chat plan (exit $STATUS, $LOG): index $NEXT is active and the plan $CURRENT is not for it, so the chat refuses turns until a plan exists; run again with RESUME=plan and a new plan file name"
  sudo -n chown root:ubuntu $OUT || fail "chown $OUT"
  # rag.env now names the plan for the next release. The running one starts from its own env file: the same activation
  # there (a copy of the file stays next to it), then the check a deploy makes before it starts a release.
  (cd $A && $NODE scripts/rag-v2-plan-release.mjs activate --plan $OUT --rag-env $ENVF) >> $LOG 2>&1 \
    || fail "the plan $OUT is in rag.env but not in the running release's env file $ENVF ($LOG): $REFUSES"
  (cd $A && $NODE scripts/rag-v2-plan-release.mjs ready) >> $LOG 2>&1 \
    || fail "the plan $ENVF names cannot run a turn on the release $A ($LOG), so the service was not restarted: $REFUSES"
  sudo -n systemctl restart $UNIT || fail "restart $UNIT"
  sleep 4
  systemctl is-active --quiet $UNIT || fail "$UNIT is not active after the restart"
  echo active
  # What the restarted process holds, not what a file says.
  RUNNING=$(sudo -n cat /proc/$(systemctl show -p MainPID --value $UNIT)/environ | tr '\0' '\n' | grep "^M4_PILOT_CONFIG=" | cut -d= -f2-)
  [ "$RUNNING" = "$OUT" ] || fail "$UNIT runs with the plan '$RUNNING', not $OUT, though its env file $ENVF names $OUT: see what else sets it (systemctl cat $UNIT)"
  echo "running plan: $RUNNING"
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
# The copied code runs with the same release's packages. A release directory stays while it is the running or the
# previous one, so this link outlives one deploy during the run, not two.
[ -L node_modules ] || [ ! -e node_modules ] || fail "$S/node_modules is not a link"
ln -sfn $A/node_modules node_modules || fail "link the release's packages"
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
PRICE=$(ls -t tmp/rag-v2-corpus-embeddings/prices/price-*.json | head -1); CONN=$SHARED/tmp/rag-v2-services/connections.json
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
