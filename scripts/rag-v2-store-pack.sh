#!/bin/sh
# Packs the corpus store's version folders on the server (ADR-101, owner 07.10.2026: "aga kokku pakkida hoidla
# serveris?"). The chat does not read the store's files, and a corpus increment opens only the versions that are not
# indexed yet (measured: with no version folder present the embedding plan and the index plan of the running policy
# both ended with nothing to read). So the folders of indexed versions are kept as one compressed archive per packing
# and the loose files are removed: about a fifth of the room, and the server still holds every byte.
#
#   sh rag-v2-store-pack.sh pack   <tenant dir> <index-plan.json of the running corpus>
#   sh rag-v2-store-pack.sh unpack <tenant dir> [version id ...]     (no id: every archive)
#   sh rag-v2-store-pack.sh list   <tenant dir>
#
# pack takes every loose folder under versions/ that the index plan lists (its versions are sealed in the index) or
# that the store head does not name at all (an old version nobody reads). A version of the head that is not indexed
# yet stays loose: the next increment reads it. The archive is compared with the files on the disk member by member
# before a loose folder is removed; any difference leaves everything as it was. Each run writes one archive
# versions-packed/pack-<UTC time>.tar.zst with a .list of its version ids and a .sha256, so later increments are
# packed by running it again. Before an index verify or a rebuild from the store, unpack first. Unpacked folders hold
# their own copy of an original that loose versions shared by a hard link (about 1.2 GB more for the whole store).
# Refuses while a corpus run is going on. Needs GNU tar and zstd.
set -u
MODE=${1:-}; T=${2:-}
[ -n "$MODE" ] && [ -n "$T" ] && [ -f "$T/active.json" ] && [ -d "$T/versions" ] || { echo "usage: pack|unpack|list <tenant dir> [...]"; exit 2; }
P=$T/versions-packed
ZSTD="zstd --long=27"
# The run script packs at its own end, after the index is ready and the chat plan is made (RAG_V2_PACK_IN_RUN).
# Only a shell that runs a run script counts as a run: a looser pattern also met the test runner that names the run
# script's test, and any command line that merely mentions the script.
if [ -z "${RAG_V2_PACK_IN_RUN:-}" ] && pgrep -f "^(sh|dash|bash)( -[a-z]+)* [^ ]*(rag-v2-corpus-run(-guarded)?|corpus-run-v[0-9]+-guarded)[.]sh( |$)" >/dev/null 2>&1; then echo "a corpus run is going on"; exit 1; fi

case "$MODE" in
list)
  for f in "$P"/pack-*.tar.zst; do [ -f "$f" ] || continue; echo "$(basename "$f") $(wc -l < "${f%.tar.zst}.list") versions $(du -h "$f" | cut -f1)"; done
  echo "loose: $(ls "$T/versions" | wc -l)"
  ;;
pack)
  PLAN=${3:-}
  [ -f "$PLAN" ] || { echo "the running corpus's index-plan.json is needed"; exit 2; }
  mkdir -p "$P" || exit 1
  # An archive is named by the second it was begun in; a run in the same second as an earlier one waits for the next.
  STAMP=$(date -u +%Y%m%dT%H%M%SZ)
  while [ -e "$P/pack-$STAMP.tar.zst" ] || [ -e "$P/pack-$STAMP.tar.zst.part" ] || [ -e "$P/pack-$STAMP.list.part" ]; do sleep 1; STAMP=$(date -u +%Y%m%dT%H%M%SZ); done
  A=$P/pack-$STAMP.tar.zst; L=$P/pack-$STAMP.list
  # Eligible: loose folders that the index plan lists, or that the head does not name.
  node -e '
    const fs = require("fs"), [tenant, planFile] = process.argv.slice(1);
    const sealed = new Set(JSON.parse(fs.readFileSync(planFile, "utf8")).items.map(item => item.version_id));
    const head = new Set(Object.values(JSON.parse(fs.readFileSync(tenant + "/active.json", "utf8")).documents).map(entry => entry.version_id));
    let kept = 0;
    for (const id of fs.readdirSync(tenant + "/versions").sort()) {
      if (!/^version_[a-f0-9]{64}$/.test(id)) continue;
      if (sealed.has(id) || !head.has(id)) console.log(id); else kept++;
    }
    console.error("left loose (in the head, not indexed): " + kept);
  ' "$T" "$PLAN" > "$L.part" || { rm -f "$L.part"; echo "the list could not be made"; exit 1; }
  # A folder that an earlier archive already holds (unpacked for a verify) is not packed twice: it is compared with
  # that archive and, when equal, the loose copy is removed.
  for old in "$P"/pack-*.list; do
    [ -f "$old" ] || continue
    grep -x -F -f "$old" "$L.part" > "$L.again" || { rm -f "$L.again"; continue; }
    sed 's#^#versions/#' "$L.again" > "$L.again.paths"
    if $ZSTD -dc "${old%.list}.tar.zst" | tar -C "$T" -d -f - -T "$L.again.paths" > "$L.again.compare" 2>&1 && [ ! -s "$L.again.compare" ]; then
      while read -r id; do rm -rf "$T/versions/$id"; done < "$L.again"
      echo "already in $(basename "${old%.list}.tar.zst") and equal: $(wc -l < "$L.again") loose folders removed"
    else echo "already in $(basename "${old%.list}.tar.zst") but NOT equal: $(wc -l < "$L.again") folders left loose"; fi
    grep -v -x -F -f "$L.again" "$L.part" > "$L.rest"; mv "$L.rest" "$L.part"; rm -f "$L.again" "$L.again.paths" "$L.again.compare"
  done
  N=$(wc -l < "$L.part")
  [ "$N" -gt 0 ] || { rm -f "$L.part"; echo "nothing new to pack"; exit 0; }
  BEFORE=$(du -s --block-size=1M "$T/versions" | cut -f1)
  echo "packing $N version folders ($BEFORE MiB loose)"
  sed 's#^#versions/#' "$L.part" > "$L.paths"
  # --hard-dereference: versions of one source share its original file by a hard link; in the archive every folder
  # holds its own copy, so that one version can be taken out without the folder the link points to.
  nice -n 10 tar -C "$T" --hard-dereference -cf - -T "$L.paths" | nice -n 10 $ZSTD -10 -T2 -q -o "$A.part" || { rm -f "$A.part" "$L.part" "$L.paths"; echo "FAILED: archive"; exit 1; }
  # Every member against the file on the disk: contents, size, mode and time.
  if ! $ZSTD -dc "$A.part" | tar -C "$T" -d -f - > "$P/pack-$STAMP.compare" 2>&1; then
    echo "FAILED: the archive differs from the files ($(wc -l < "$P/pack-$STAMP.compare") lines in pack-$STAMP.compare); nothing removed"; rm -f "$A.part" "$L.part" "$L.paths"; exit 1
  fi
  [ -s "$P/pack-$STAMP.compare" ] && { echo "FAILED: the comparison was not silent; nothing removed"; rm -f "$A.part" "$L.part" "$L.paths"; exit 1; }
  MEMBERS=$($ZSTD -dc "$A.part" | tar -tf - | grep -c -E '^versions/version_[a-f0-9]{64}/$')
  [ "$MEMBERS" = "$N" ] || { echo "FAILED: the archive holds $MEMBERS folders, $N expected; nothing removed"; rm -f "$A.part" "$L.part" "$L.paths"; exit 1; }
  mv "$A.part" "$A" && mv "$L.part" "$L" && rm -f "$L.paths" "$P/pack-$STAMP.compare" || exit 1
  sha256sum "$A" | cut -c1-64 > "${A%.tar.zst}.sha256"
  while read -r id; do rm -rf "$T/versions/$id"; done < "$L"
  echo "packed: $(basename "$A") $(du -h "$A" | cut -f1) for $N folders; loose left: $(ls "$T/versions" | wc -l) ($(du -s --block-size=1M "$T/versions" | cut -f1) MiB)"
  ;;
unpack)
  shift 2
  if [ $# -eq 0 ]; then
    for f in "$P"/pack-*.tar.zst; do
      [ -f "$f" ] || continue
      [ "$(sha256sum "$f" | cut -c1-64)" = "$(cat "${f%.tar.zst}.sha256")" ] || { echo "FAILED: $(basename "$f") does not have its recorded hash"; exit 1; }
      $ZSTD -dc "$f" | tar -C "$T" --skip-old-files -xf - || { echo "FAILED: $(basename "$f")"; exit 1; }
      echo "unpacked: $(basename "$f")"
    done
  else
    for id in "$@"; do
      f=$(grep -l -x "$id" "$P"/pack-*.list 2>/dev/null | tail -1)
      [ -n "$f" ] || { echo "$id is in no archive"; exit 1; }
      $ZSTD -dc "${f%.list}.tar.zst" | tar -C "$T" --skip-old-files -xf - "versions/$id" || { echo "FAILED: $id"; exit 1; }
      echo "unpacked: $id"
    done
  fi
  echo "loose: $(ls "$T/versions" | wc -l)"
  ;;
*) echo "usage: pack|unpack|list <tenant dir> [...]"; exit 2 ;;
esac
