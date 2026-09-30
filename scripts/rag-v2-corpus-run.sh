#!/bin/sh
# The server half of a corpus increment (ADR-059): the store increment, the embedding plan, the purchase when some
# inputs have no vector yet, the index job and a hand-made chat plan for the new generation (ADR-037). The laptop half
# (scripts/rag-v2-corpus-refresh.mjs package) left ship-v<N>.tgz, ship-v<N>.json and policy-v<N>.json in the work dir.
#   sh /home/ubuntu/apps/sotsiaalai/scripts/rag-v2-corpus-run.sh <N> <previous N> <plan file> <cap USD> "<basis et>" "<basis en>"
# Example: sh .../rag-v2-corpus-run.sh 45 44 /etc/sotsiaalai/m4-corpus-chat-20261001a.json 0.10 "Omaniku ... ." "Owner's ..."
VERSION=$1; PREVIOUS=$2; OUT=$3; CAP=$4; BASIS_ET=$5; BASIS_EN=$6
[ -n "$VERSION" ] && [ -n "$PREVIOUS" ] && [ -n "$OUT" ] && [ -n "$CAP" ] && [ -n "$BASIS_ET" ] && [ -n "$BASIS_EN" ] || { echo "usage: <N> <previous N> <plan file> <cap> <basis et> <basis en>"; exit 1; }
A=/home/ubuntu/apps/sotsiaalai; S=/home/ubuntu/rag-v2-work/rag-v2-v25; E=/home/ubuntu/rag-v2-work/eval-app
cd $S || exit 1
step() { echo "== $1 $(date -u +%H:%M:%S.%N | cut -c1-12)"; }
[ -e "$OUT" ] && { echo "plan exists"; exit 1; }
cp -r $A/lib $A/scripts $A/package.json $S/
field() { node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))[process.argv[2]])' "$1" "$2"; }
SHIP=ship-v$VERSION.tgz; INFO=ship-v$VERSION.json
[ -s "$SHIP" ] && [ -s "$INFO" ] && [ -s "policy-v$VERSION.json" ] || { echo "ship-v$VERSION.tgz, ship-v$VERSION.json and policy-v$VERSION.json are needed"; exit 1; }
echo "$(field $INFO sha256)  $SHIP" | sha256sum -c - || exit 1
BASE=$(field $INFO base_generation); HEAD=$(field $INFO head_generation)
PRIOR=$(field tmp/rag-v2-corpus-index-v$PREVIOUS/index-plan.json generation_id) || exit 1
proof() { (cd $E && sudo -n node --env-file=/etc/sotsiaalai/frontend.env version-proof.mjs "$1"); }
step proof-before
proof $PRIOR || exit 1
# The store increment: the head (active.json, publications) and the new immutable versions, after a head backup.
T=$(ls -d tmp/rag-v2-corpus-store-v25/tenant_*)
[ "$(field $T/active.json generation)" = "$BASE" ] || { echo "the server store head is not the base of this increment"; exit 1; }
mkdir -p tmp/store-backup-v$PREVIOUS && cp $T/active.json tmp/store-backup-v$PREVIOUS/ && cp -r $T/publications tmp/store-backup-v$PREVIOUS/ || exit 1
tar xzf $SHIP -C $T || exit 1
[ "$(field $T/active.json generation)" = "$HEAD" ] || { echo "the store head after the increment is not $HEAD"; exit 1; }
mkdir -p tmp/rag-v2-corpus-index-v$VERSION && mv policy-v$VERSION.json tmp/rag-v2-corpus-index-v$VERSION/policy.json || exit 1
POLICY=tmp/rag-v2-corpus-index-v$VERSION/policy.json
# The newest price file; the plan refuses one older than 24 hours (price_verification_stale).
PRICE=$(ls -t tmp/rag-v2-corpus-embeddings/prices/price-*.json | head -1); CONN=$A/tmp/rag-v2-services/connections.json
# pilot_7e23e68b is not a complete purchase; every other usage dir is reused.
USAGE=$(ls -d tmp/rag-v2-corpus-embeddings/usage/pilot_* | grep -v pilot_7e23e68b | sort)
REUSE=""; VECTORS=""; for d in $USAGE; do REUSE="$REUSE --reuse $d"; VECTORS="$VECTORS --vectors $d"; done
step embedding-plan
node scripts/rag-v2-corpus-embeddings.mjs --mode plan --development-only --store tmp/rag-v2-corpus-store-v25 --tenant sotsiaalai-corpus --subject operator \
  --policy $POLICY --price $PRICE $REUSE --indexed --connections $CONN --output tmp/rag-v2-corpus-embeddings/plan-v$VERSION > plan-v$VERSION.json 2>&1
step embedding-plan-done
tail -16 plan-v$VERSION.json
EXTERNAL=$(field plan-v$VERSION.json external_inputs) || exit 1
echo "external inputs: $EXTERNAL"
NEW=""
if [ "$EXTERNAL" != "0" ]; then
  MANIFEST=$(field tmp/rag-v2-corpus-embeddings/plan-v$VERSION/approval.preview.json egress_manifest_sha256) || exit 1
  step approval
  mkdir -p tmp/rag-v2-corpus-embeddings/approval-v$VERSION
  sed "s/v37/v$VERSION/g" tmp/rag-v2-corpus-embeddings/approval-v37/make-approval-v37.mjs > tmp/rag-v2-corpus-embeddings/approval-v$VERSION/make-approval-v$VERSION.mjs
  node tmp/rag-v2-corpus-embeddings/approval-v$VERSION/make-approval-v$VERSION.mjs --manifest $MANIFEST --cap $CAP --by "Omanik (LauRRaud)" --price $PRICE \
    --basis "$BASIS_ET" || exit 1
  BEFORE=$(ls -d tmp/rag-v2-corpus-embeddings/usage/pilot_* | sort)
  step purchase
  sudo -n grep "^OPENAI_API_KEY=" /etc/sotsiaalai/frontend.env | node --env-file=/dev/stdin scripts/rag-v2-corpus-embeddings.mjs --mode execute --development-only \
    --store tmp/rag-v2-corpus-store-v25 --tenant sotsiaalai-corpus --subject operator --policy $POLICY $REUSE --indexed --connections $CONN \
    --baseline tmp/rag-v2-corpus-embeddings/plan-v$VERSION/embedding-plan.json --approval tmp/rag-v2-corpus-embeddings/approval-v$VERSION/approval-v$VERSION.json \
    --price $PRICE --output tmp/rag-v2-corpus-embeddings/run-v$VERSION 2>&1 | grep -v embedding_progress | tail -16
  step purchase-done
  grep -q '"state": "complete"' tmp/rag-v2-corpus-embeddings/run-v$VERSION/run.json || { echo "purchase not complete"; exit 1; }
  for d in $(ls -d tmp/rag-v2-corpus-embeddings/usage/pilot_*); do echo "$BEFORE" | grep -qx "$d" || NEW="$d"; done
  echo "new vectors: $NEW"
  [ -n "$NEW" ] || exit 1
fi
COMMON="--development-only --tenant sotsiaalai-corpus --subject operator --policy $POLICY --store tmp/rag-v2-corpus-store-v25
  --manifest tmp/rag-v2-corpus-index-v$VERSION/index-plan.json $VECTORS ${NEW:+--vectors $NEW} --connections $CONN"
step index-plan
env -u OPENAI_API_KEY RAG_V2_ESTNLTK_PYTHON=/opt/sotsiaalai/rag-v2-estnltk-1.7.5/bin/python node scripts/rag-v2-index-batch.mjs --mode plan $COMMON || exit 1
step index-run
env -u OPENAI_API_KEY RAG_V2_ESTNLTK_PYTHON=/opt/sotsiaalai/rag-v2-estnltk-1.7.5/bin/python node scripts/rag-v2-index-batch.mjs --mode run $COMMON \
  --batch-size 100 --max-batches 10000 > index-run-v$VERSION.json 2>&1
step index-done
tail -26 index-run-v$VERSION.json
grep -q '"state": "ready"' index-run-v$VERSION.json || { echo "index not ready"; exit 1; }
NEXT=$(field tmp/rag-v2-corpus-index-v$VERSION/index-plan.json generation_id)
step proof-after
proof $PRIOR; proof $NEXT
# A new generation needs a new plan (renewal keeps the generation, ADR-037): the owner's controlled path.
step chat-plan-v$VERSION
CURRENT=$(sudo -n grep -o "^M4_PILOT_CONFIG=.*" /etc/sotsiaalai/rag.env | cut -d= -f2)
(cd $A && sudo -n node --env-file=/etc/sotsiaalai/frontend.env --env-file=/etc/sotsiaalai/rag.env --import ./scripts/register-node-source-loader.mjs scripts/rag-v2-chat-plan.mjs \
  --tenant sotsiaalai-corpus --profile hybrid-estnltk-chat-v3 --reasoning medium --template /etc/sotsiaalai/m4-luna6-20260923.json --out $OUT --budget-usd 4 \
  --basis "$BASIS_EN" --activate 2>&1 | tail -2) \
  && sudo -n chown root:ubuntu $OUT && sudo -n systemctl restart sotsiaalai-frontend && sleep 4 && systemctl is-active sotsiaalai-frontend
# The settings the new plan differs in from the one it replaces (the generation, ids, dates and the basis are expected).
sudo -n node -e 'const fs=require("fs"), [a,b]=process.argv.slice(1).map(f=>JSON.parse(fs.readFileSync(f,"utf8")));
const flat=(o,p="")=>Object.entries(o??{}).flatMap(([k,v])=>v&&typeof v==="object"&&!Array.isArray(v)?flat(v,p+k+"."):[[p+k,JSON.stringify(v)]]);
const fa=new Map(flat(a)), fb=new Map(flat(b)); for (const k of new Set([...fa.keys(),...fb.keys()])) if (!k.startsWith("documents.") && fa.get(k)!==fb.get(k)) console.log("diff", k, (fa.get(k)??"-").slice(0,90), "->", (fb.get(k)??"-").slice(0,90));' $CURRENT $OUT
rm -f $SHIP
step done
