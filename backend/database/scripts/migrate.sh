
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../" && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
DB_DIR="$SCRIPT_DIR/.."
LOG_FILE="$DB_DIR/migrations.log"

# Load .env variables
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

DB_HOST="${DB_HOST:-host.docker.internal}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:-}"
DB_PASSWORD="${POSTGRES_PASSWORD:-}"
DB_NAME="${POSTGRES_DB:-}"

MIGRATIONS_DIR="$DB_DIR/migrations"

# Clear previous log
> "$LOG_FILE"

echo "==> Running database migrations via Docker"
echo "Connecting to $DB_HOST:$DB_PORT as $DB_USER to $DB_NAME"
echo "Logs saved to: $LOG_FILE" | tee -a "$LOG_FILE"

# Mount entire migrations directory and run all SQL files
docker run --rm \
  -v "$MIGRATIONS_DIR:/migrations" \
  -e PGPASSWORD=$DB_PASSWORD \
  postgres:16 \
  bash -c "
    for file in /migrations/*.sql; do
      filename=\$(basename \$file)
      echo \"[$(date '+%Y-%m-%d %H:%M:%S')] Executing: \$filename\"
      if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f \$file > /tmp/migration.log 2>&1; then
        echo \"[$(date '+%Y-%m-%d %H:%M:%S')] ✓ SUCCESS: \$filename\"
      else
        echo \"[$(date '+%Y-%m-%d %H:%M:%S')] ✗ FAILED: \$filename\"
        cat /tmp/migration.log
      fi
    done
  " | tee -a "$LOG_FILE"

echo "==> Database migrations completed" | tee -a "$LOG_FILE"
echo "Full logs: $LOG_FILE"
