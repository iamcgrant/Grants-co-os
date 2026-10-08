#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIN_FILE="$ROOT/vendor/platform-imessage.pin.json"
DEST="$ROOT/vendor/platform-imessage"
REPO="$(node -p "require('$PIN_FILE').repository")"
SHA="$(node -p "require('$PIN_FILE').pinnedRef")"

if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "helper-fetch: invalid pin SHA" >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"

if [[ -d "$DEST/.git" ]]; then
  git -C "$DEST" fetch --depth 1 origin "$SHA"
  git -C "$DEST" checkout --detach "$SHA"
else
  rm -rf "$DEST"
  git clone --filter=blob:none "$REPO" "$DEST"
  git -C "$DEST" checkout --detach "$SHA"
fi

echo "helper-fetch: pinned $SHA"
