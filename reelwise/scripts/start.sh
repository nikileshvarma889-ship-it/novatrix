#!/bin/sh
# Container entrypoint. ROLE=web | worker | all (default all: one machine, one shared storage disk).
set -e
: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${ENCRYPTION_KEY:?ENCRYPTION_KEY must be set}"
mkdir -p "${STORAGE_DIR:-/data/storage}"

# Public URL for OAuth redirects: explicit APP_URL wins, else the host's own URL.
if [ -z "$APP_URL" ] && [ -n "$RENDER_EXTERNAL_URL" ]; then APP_URL="$RENDER_EXTERNAL_URL"; fi
if [ -z "$APP_URL" ] && [ -n "$FLY_APP_NAME" ]; then APP_URL="https://$FLY_APP_NAME.fly.dev"; fi
export APP_URL

ROLE="${ROLE:-all}"
if [ "$ROLE" != "worker" ]; then
  npx tsx scripts/migrate.ts
fi

case "$ROLE" in
  web)    exec npx next start -H 0.0.0.0 -p "${PORT:-3000}" ;;
  worker) exec npx tsx worker/index.ts ;;
  all)
    npx tsx worker/index.ts &
    WORKER=$!
    npx next start -H 0.0.0.0 -p "${PORT:-3000}" &
    WEB=$!
    # If either process dies, stop the container so the host restarts it.
    while kill -0 "$WORKER" 2>/dev/null && kill -0 "$WEB" 2>/dev/null; do sleep 5; done
    echo "A process exited; shutting down so the platform restarts the container." >&2
    kill "$WORKER" "$WEB" 2>/dev/null || true
    exit 1 ;;
  *) echo "Unknown ROLE=$ROLE (use web, worker or all)" >&2; exit 2 ;;
esac
