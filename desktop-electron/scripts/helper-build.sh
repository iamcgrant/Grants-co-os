#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/vendor/platform-imessage"
BIN_DIR="$ROOT/native/messages-helper/bin"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "helper-build: Swift helper compiles only on macOS. Skipping."
  exit 0
fi

if [[ ! -d "$SRC" ]]; then
  echo "helper-build: run npm run helper:fetch first." >&2
  exit 1
fi

if ! command -v swift >/dev/null 2>&1; then
  echo "helper-build: swift is required on the owner Mac." >&2
  exit 1
fi

mkdir -p "$BIN_DIR"
(
  cd "$SRC"
  swift build -c release --product imessage-cli
  BIN_PATH="$(swift build -c release --product imessage-cli --show-bin-path)/imessage-cli"
  cp "$BIN_PATH" "$BIN_DIR/imessage-cli"
  chmod +x "$BIN_DIR/imessage-cli"
)

echo "helper-build: wrote $BIN_DIR/imessage-cli"
