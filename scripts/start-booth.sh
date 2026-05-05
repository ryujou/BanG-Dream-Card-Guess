#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-5173}"

echo
echo "[BangBangCai] Start booth game"
echo "------------------------------"

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
echo "Launching server on port $PORT..."
PORT="$PORT" node server.mjs --booth &
server_pid=$!

cleanup() {
  if kill -0 "$server_pid" >/dev/null 2>&1; then
    kill "$server_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

sleep 2

player_url="http://127.0.0.1:$PORT/player"
login_url="http://127.0.0.1:$PORT/login"

if command -v open >/dev/null 2>&1; then
  open "$player_url"
  open "$login_url"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$player_url" >/dev/null 2>&1 || true
  xdg-open "$login_url" >/dev/null 2>&1 || true
fi

echo
echo "Player: $player_url"
echo "Host:   http://127.0.0.1:$PORT/host"
echo "Setup:  http://127.0.0.1:$PORT/settings"
echo
echo "Press Ctrl+C in this terminal to stop the game."

wait "$server_pid"
