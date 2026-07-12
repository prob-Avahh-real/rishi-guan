#!/usr/bin/env bash
cd "$(dirname "$0")"
PORT="${1:-8765}"
echo "🌑 日食观 → http://localhost:$PORT"
python3 -m http.server "$PORT" --bind 127.0.0.1
