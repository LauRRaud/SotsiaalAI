#!/usr/bin/env bash
set -euo pipefail

[ "$(id -u)" = "0" ] || { echo "run as root" >&2; exit 77; }

backing_file="${MATERIALS_VOLUME_FILE:-/var/lib/sotsiaalai-materials.luks}"
key_file="${MATERIALS_VOLUME_KEY_FILE:-/etc/sotsiaalai/materials-volume.key}"
mapping="sotsiaalai_materials"
mount_point="/var/lib/sotsiaalai/materials"
size="${MATERIALS_VOLUME_SIZE:-4G}"

case "$backing_file" in
  /var/lib/sotsiaalai-materials.luks) ;;
  *) echo "unsafe backing file" >&2; exit 78 ;;
esac

if findmnt -rn --mountpoint "$mount_point" >/dev/null 2>&1; then
  source="$(findmnt -rn -o SOURCE --mountpoint "$mount_point")"
  [ "$source" = "/dev/mapper/$mapping" ] && exit 0
  echo "mount point is already backed by $source" >&2
  exit 79
fi

if [ -d "$mount_point" ] && find "$mount_point" -mindepth 1 ! -type d -print -quit | grep -q .; then
  echo "mount point is not empty" >&2
  exit 80
fi

install -d -m 0750 -o ubuntu -g ubuntu /etc/sotsiaalai /var/lib/sotsiaalai "$mount_point"
if [ ! -e "$backing_file" ]; then
  truncate -s "$size" "$backing_file"
  chmod 0600 "$backing_file"
fi
if [ ! -s "$key_file" ]; then
  umask 077
  dd if=/dev/urandom of="$key_file" bs=64 count=1 status=none
fi
chmod 0600 "$key_file"

if ! cryptsetup isLuks "$backing_file" >/dev/null 2>&1; then
  cryptsetup luksFormat --type luks2 --batch-mode --key-file "$key_file" "$backing_file"
fi
if [ ! -e "/dev/mapper/$mapping" ]; then
  cryptsetup open --key-file "$key_file" "$backing_file" "$mapping"
fi
if ! blkid "/dev/mapper/$mapping" >/dev/null 2>&1; then
  mkfs.ext4 -L SOTSIAALAI_MATERIALS "/dev/mapper/$mapping"
fi

crypttab_line="$mapping $backing_file $key_file luks"
if ! grep -Fqx "$crypttab_line" /etc/crypttab 2>/dev/null; then
  printf '%s\n' "$crypttab_line" >> /etc/crypttab
fi
