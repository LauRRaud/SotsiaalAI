#!/bin/sh
# A corpus increment on the server under a ceiling the caller names: a copy of the running release's
# rag-v2-corpus-run.sh with one added line that stops before the approval when the free plan shows more embedding
# inputs than permitted. Nothing is bought when the guard stops the run. A lock directory keeps a second start out.
# Upload this file to the server's work folder and start it detached:
#   (nohup sh /home/ubuntu/rag-v2-work/rag-v2-corpus-run-guarded.sh <version> <base version> <plan file> <cap usd> \
#      <permitted inputs> "<basis in Estonian, ASCII>" "<basis in English>" > /home/ubuntu/rag-v2-work/run-v<version>.log 2>&1 < /dev/null &)
# Before it: ship-v<version>.tgz, ship-v<version>.json and policy-v<version>.json under rag-v2-v25/, and the day's
# price file. The basis names the owner's words that permit the spend and says who set the ceiling.
N=$1; BASE=$2; PLAN=$3; CAP=$4; PERMITTED=$5; BASIS_ET=$6; BASIS_EN=$7
W=/home/ubuntu/rag-v2-work
case "$N$BASE$PERMITTED" in *[!0-9]*|'') echo "usage: <version> <base version> <plan file> <cap usd> <permitted inputs> <basis et> <basis en>"; exit 2;; esac
[ -n "$PLAN" ] && [ -n "$CAP" ] && [ -n "$BASIS_ET" ] && [ -n "$BASIS_EN" ] || { echo "usage: <version> <base version> <plan file> <cap usd> <permitted inputs> <basis et> <basis en>"; exit 2; }
mkdir "$W/run-v$N.lock" 2>/dev/null || { echo "run-v$N was already started (run-v$N.lock)"; exit 1; }
R=$(systemctl show -p WorkingDirectory --value sotsiaalai-frontend)
echo "release: ${R##*/}"
GUARDED=$W/corpus-run-v$N-guarded.sh
awk -v permitted="$PERMITTED" -v base="$BASE" '{ print } /^echo "external inputs: \$EXTERNAL"$/ { print "[ \"$EXTERNAL\" -le " permitted " ] || fail \"the plan shows $EXTERNAL external inputs, more than the " permitted " permitted: nothing was bought; the store head is raised (backup tmp/store-backup-v" base ")\""; added = 1 } END { if (!added) exit 3 }' \
  "$R/scripts/rag-v2-corpus-run.sh" > "$GUARDED" || { echo "FAILED: the guard line could not be added"; exit 1; }
[ "$(grep -c "more than the $PERMITTED permitted" "$GUARDED")" = 1 ] || { echo "FAILED: the guard line is not in the copy"; exit 1; }
[ "$(diff "$R/scripts/rag-v2-corpus-run.sh" "$GUARDED" | grep -c '^[<>]')" = 1 ] || { echo "FAILED: the copy differs from the release's script by more than the guard line"; exit 1; }
sh "$GUARDED" "$N" "$BASE" "$PLAN" "$CAP" "$BASIS_ET" "$BASIS_EN"
STATUS=$?
echo "run-v$N exit: $STATUS"
exit $STATUS
