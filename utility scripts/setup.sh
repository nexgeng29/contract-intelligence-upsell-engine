#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
ENV_FILE="$PROJECT_ROOT/.env"

# Load environment variables from .env
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Set AWS credentials with defaults
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
ENDPOINT="${ENDPOINT:-http://localhost:4566}"

# PostgreSQL variables (these will be passed to Terraform)
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-password}"
POSTGRES_DB="${POSTGRES_DB:-contract_db}"

echo "==> Installing Terraform"
if ! command -v terraform &> /dev/null; then
  brew tap hashicorp/tap
  brew install hashicorp/tap/terraform
fi

echo "==> Starting containers from project root"
docker compose -f "$PROJECT_ROOT/docker-compose.yml" up -d

echo "==> Waiting for LocalStack"
until curl -sf $ENDPOINT/_localstack/health >/dev/null 2>&1; do sleep 2; done

echo "==> Running database migrations"
bash "$BACKEND_DIR/database/scripts/migrate.sh"

echo "==> Building Lambda functions"
for dir in "$BACKEND_DIR/src"/*; do
  if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
    echo "   Installing dependencies in $(basename $dir)..."
    (cd "$dir" && npm install)
  fi
done


echo "==> Deploying with Terraform"
(cd "$BACKEND_DIR/infra" && \
  export TF_VAR_postgres_user="$POSTGRES_USER"
  export TF_VAR_postgres_password="$POSTGRES_PASSWORD"
  export TF_VAR_postgres_db="$POSTGRES_DB"
  terraform init -input=false && \
  terraform apply -auto-approve -input=false)

echo ""
echo "==> Done"