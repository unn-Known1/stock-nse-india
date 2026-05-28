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
if lsof -ti:"$PORT" &>/dev/null 2>&1; then
  echo "Port $PORT is in use. Killing process..."
  lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

echo "Starting server on http://localhost:$PORT ..."
node build/server.js
