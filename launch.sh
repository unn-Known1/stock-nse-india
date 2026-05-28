#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "=== NSE India Dashboard Launcher ==="

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install --silent
  echo "Dependencies installed."
fi

if [ ! -d build ]; then
  echo "Building TypeScript..."
  ./node_modules/.bin/rimraf ./build
  ./node_modules/.bin/tsc
  ./node_modules/.bin/copyfiles -f "./src/**/*.graphql" build/graphql-schema
  echo "Build complete."
fi

PORT="${PORT:-3000}"
PID=$(lsof -ti:"$PORT" 2>/dev/null || true)
if [ -n "$PID" ]; then
  PROC_NAME=$(ps -p "$PID" -o comm= 2>/dev/null || echo "")
  if echo "$PROC_NAME" | grep -qi "node"; then
    echo "Port $PORT is in use by a Node.js process (PID: $PID). Killing..."
    kill -9 "$PID" 2>/dev/null || true
    sleep 1
  else
    echo "Port $PORT is in use by non-Node process ($PROC_NAME, PID: $PID). Skipping."
  fi
fi

echo "Starting server on http://localhost:$PORT ..."
node build/server.js
