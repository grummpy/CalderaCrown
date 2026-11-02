#!/bin/bash
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  exec python3 server.py
fi
echo "Python 3 is required to launch Caldera Crown."
echo "Install it from https://www.python.org/downloads/ and try again."
exit 1
