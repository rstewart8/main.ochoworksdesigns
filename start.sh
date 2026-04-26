#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
cd "$ROOT_DIR"

if [ ! -f api.ochoworksdesigns/.env ]; then
  cp api.ochoworksdesigns/.env.example api.ochoworksdesigns/.env
fi

mkdir -p mysql-data
mkdir -p var/log/ochoworksdesigns

docker compose up -d --build

wait_for_url() {
  name=$1
  url=$2
  attempts=${3:-60}
  sleep_seconds=${4:-2}

  if ! command -v curl >/dev/null 2>&1; then
    return 0
  fi

  i=1
  while [ "$i" -le "$attempts" ]; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$sleep_seconds"
    i=$((i + 1))
  done

  echo "Timed out waiting for $name at $url" >&2
  return 1
}

if command -v curl >/dev/null 2>&1; then
  wait_for_url "MySQL-backed API" "http://localhost:8222/api/health"
  wait_for_url "Angular dev server" "http://localhost:4222"
fi

echo "Application URLs"
echo "Frontend: http://localhost:4222"
echo "API: http://localhost:8222"
echo "API health: http://localhost:8222/api/health"
echo "MySQL: 127.0.0.1:3622"
echo "Logs: $ROOT_DIR/var/log/ochoworksdesigns"
