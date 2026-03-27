#!/usr/bin/env bash
set -euo pipefail

if command -v python3 >/dev/null 2>&1; then
  exec python3 scripts/start_system.py "$@"
fi

if command -v python >/dev/null 2>&1; then
  exec python scripts/start_system.py "$@"
fi

echo "Python was not found. Install Python 3 and run scripts/start_system.py manually."
exit 1
