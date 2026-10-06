#!/bin/sh
# Uploads one file to the server in parts of 3 MB over plain ssh streams. Each part is sent again until its size on
# the server is right; the parts are joined there and the whole file's sha256 is compared with the local one.
# On 06.10.2026 scp hung on a 0.5 MB file and a plain stream of the same file was reset; 70 MB went through this way
# in about eight minutes.
#   sh scripts/rag-v2-upload-parts.sh <local file> <remote path> [ssh host, default sotsiaalai]
FILE=$1; REMOTE=$2; HOST=${3:-sotsiaalai}
[ -f "$FILE" ] && [ -n "$REMOTE" ] || { echo "usage: <local file> <remote path> [ssh host]"; exit 2; }
PARTS=$(dirname "$FILE")/upload-parts
SSH="ssh -o ConnectTimeout=15 -o ServerAliveInterval=5 -o ServerAliveCountMax=3 $HOST"
rm -rf "$PARTS"; mkdir -p "$PARTS"
split -b 3m -d -a 3 "$FILE" "$PARTS/part-"
echo "parts: $(ls "$PARTS" | wc -l)"
timeout 40 $SSH "rm -rf $REMOTE.parts && mkdir -p $REMOTE.parts" || { echo "FAILED: remote folder"; exit 1; }
for part in "$PARTS"/part-*; do
  name=$(basename "$part"); size=$(wc -c < "$part" | tr -d ' ')
  sent=0
  for try in 1 2 3 4 5 6 7 8; do
    got=$(timeout 90 $SSH "cat > $REMOTE.parts/$name && wc -c < $REMOTE.parts/$name" < "$part" 2>/dev/null | tr -d ' \r')
    if [ "$got" = "$size" ]; then sent=1; break; fi
    sleep 3
  done
  [ "$sent" = 1 ] || { echo "FAILED: $name after 8 tries"; exit 1; }
done
LOCAL=$(sha256sum "$FILE" | cut -c1-64)
GOT=$(timeout 120 $SSH "cat $REMOTE.parts/part-* > $REMOTE && sha256sum $REMOTE | cut -c1-64 && rm -rf $REMOTE.parts" | tr -d '\r')
rm -rf "$PARTS"
if [ "$GOT" = "$LOCAL" ]; then echo "uploaded: $(basename "$REMOTE") $LOCAL"; else echo "FAILED: sha256 differs ($GOT, local $LOCAL)"; exit 1; fi
