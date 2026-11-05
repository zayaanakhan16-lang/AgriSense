#!/bin/bash
# Keeps the AgriSense dev server alive. The sandbox reaps long-lived processes
# between sessions, so restart automatically when the port stops responding.
cd /workspace/project/AgriSense || exit 1
while true; do
  if ! curl -sf -o /dev/null --max-time 5 http://localhost:12000/; then
    pkill -f "vite --host 0.0.0.0 --port 12000" 2>/dev/null
    sleep 1
    npx vite --host 0.0.0.0 --port 12000 --strictPort >> .vite-dev.log 2>&1 &
  fi
  sleep 15
done
