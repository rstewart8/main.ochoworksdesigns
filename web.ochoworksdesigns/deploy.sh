#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "web.ochoworksdesigns/deploy.sh is now a compatibility wrapper."
echo "Running the root repo deploy script instead."

exec "$ROOT_DIR/deploy.sh" "$@"
