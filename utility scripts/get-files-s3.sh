#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
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
BUCKET="${BUCKET:-contract-documents}"

echo "==> Listing all files from S3"
echo "Bucket: $BUCKET"
echo "Endpoint: $ENDPOINT"
echo ""

aws --endpoint-url=$ENDPOINT s3 ls "s3://$BUCKET/" --recursive

echo ""
echo "==> Done"