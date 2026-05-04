#!/usr/bin/env bash
set -euo pipefail

BRANCH="master"

while getopts ":b:" opt; do
  case "$opt" in
    b)
      BRANCH="$OPTARG"
      ;;
    *)
      echo "Usage: $0 [-b branch]"
      exit 1
      ;;
  esac
done

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$REPO_DIR/web.ochoworksdesigns"
API_DIR="$REPO_DIR/api.ochoworksdesigns"
API_ENV_FILE="$API_DIR/.env"
COMPOSE_FILE="$REPO_DIR/docker-compose.production.yml"
PM2_APP_NAME="${PM2_APP_NAME:-ochoworks}"
WEB_API_URL="${WEB_API_URL:-https://main.ochoworksdesigns.com}"
WEB_RECAPTCHA_SITE_KEY="${WEB_RECAPTCHA_SITE_KEY:-6Ld3o4grAAAAAKUyJe6pyRZO5cOa7otrjZFc5gBX}"

run_privileged() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
    return
  fi

  echo "This step needs root privileges and sudo is not installed: $*"
  exit 1
}

write_web_environment_files() {
  mkdir -p "$WEB_DIR/src/environments"

  cat > "$WEB_DIR/src/environments/environment.ts" <<EOF
export const environment = {
  production: false,
  recaptchaSiteKey: '$WEB_RECAPTCHA_SITE_KEY',
  apiUrl: 'http://localhost:8222',
  devLoginCredentials: null
};
EOF

  cat > "$WEB_DIR/src/environments/environment.prod.ts" <<EOF
export const environment = {
  production: true,
  recaptchaSiteKey: '$WEB_RECAPTCHA_SITE_KEY',
  apiUrl: '$WEB_API_URL',
  devLoginCredentials: null
};
EOF
}

echo "========================================"
echo "OchoWorks Designs production deploy"
echo "========================================"
echo "Branch: $BRANCH"

if [ ! -f "$API_ENV_FILE" ]; then
  echo "Missing $API_ENV_FILE"
  echo "Copy api.ochoworksdesigns/.env.production.example to api.ochoworksdesigns/.env and fill in real production values first."
  exit 1
fi

cd "$REPO_DIR"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
CURRENT_COMMIT="$(git rev-parse --short HEAD)"
echo "Current branch: $CURRENT_BRANCH ($CURRENT_COMMIT)"

echo "Fetching latest code..."
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

NEW_COMMIT="$(git rev-parse --short HEAD)"
echo "Updated to commit: $NEW_COMMIT"

echo "Ensuring production directories exist..."
mkdir -p "$WEB_DIR/logs"
mkdir -p "$API_DIR/files"
mkdir -p "$REPO_DIR/var/log/ochoworksdesigns"
write_web_environment_files

echo "Building Angular SSR frontend..."
cd "$WEB_DIR"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=768}"
npm run build

echo "Building and restarting PHP API containers..."
cd "$REPO_DIR"
docker compose -f "$COMPOSE_FILE" build api
docker compose -f "$COMPOSE_FILE" up -d api cron
docker compose -f "$COMPOSE_FILE" ps

echo "Starting or reloading PM2 web app..."
cd "$WEB_DIR"
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$PM2_APP_NAME" --update-env
else
  pm2 start ecosystem.config.js --only "$PM2_APP_NAME"
fi
pm2 save

if command -v nginx >/dev/null 2>&1; then
  echo "Testing Nginx configuration..."
  run_privileged nginx -t
  echo "Reloading Nginx..."
  run_privileged systemctl reload nginx
fi

echo
echo "Deployment complete."
echo "Branch: $BRANCH"
echo "Commit: $NEW_COMMIT"
echo "Frontend: http://127.0.0.1:4000"
echo "API: http://127.0.0.1:8888/api/health"
