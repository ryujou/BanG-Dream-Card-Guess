#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-5173}"

echo
echo "[BangBangCai] Start solo game"
echo "----------------------------"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js or npm was not found. Run ./scripts/install-env.sh first."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "node_modules was not found. Installing dependencies first..."
  npm install
fi

echo "Building web files..."
npm run build

echo
echo "Launching solo server on port $PORT..."
PORT="$PORT" node server.mjs --solo &
server_pid=$!

cleanup() {
  if kill -0 "$server_pid" >/dev/null 2>&1; then
    kill "$server_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

sleep 2

solo_url="http://127.0.0.1:$PORT/solo"

if command -v open >/dev/null 2>&1; then
  open "$solo_url"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$solo_url" >/dev/null 2>&1 || true
fi

echo
echo "Solo: $solo_url"
echo "QR:   http://127.0.0.1:$PORT/qr"
echo
echo "Press Ctrl+C in this terminal to stop the game."

wait "$server_pid"
