#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-5173}"

echo
echo "[BangBangCai] Stop local server"
echo "-------------------------------"
echo "Port: $PORT"

pids=""

if command -v lsof >/dev/null 2>&1; then
  pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN || true)"
elif command -v fuser >/dev/null 2>&1; then
  pids="$(fuser -n tcp "$PORT" 2>/dev/null || true)"
elif command -v ss >/dev/null 2>&1; then
  pids="$(ss -ltnp "sport = :$PORT" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | sort -u)"
fi

if [ -z "$pids" ]; then
  echo "No server is listening on this port."
  exit 0
fi

echo "$pids" | while read -r pid; do
  [ -z "$pid" ] && continue
  echo "Stopping process $pid"
  kill "$pid" 2>/dev/null || true
done

sleep 1

if command -v lsof >/dev/null 2>&1 && lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Server is still listening."
  exit 1
fi

echo "Server stopped."
