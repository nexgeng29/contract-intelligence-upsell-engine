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
BUCKET="${BUCKET:-contract-documents}"

CONTRACTS_DIR="$BACKEND_DIR/sample-data/contracts"

echo "==> Uploading contracts to S3"
echo "Source: $CONTRACTS_DIR"
echo "Bucket: $BUCKET"
echo "Endpoint: $ENDPOINT"
echo ""

# Upload files organized by customer folder
for customer_dir in "$CONTRACTS_DIR"/CUST*/; do
  if [ -d "$customer_dir" ]; then
    customer_id=$(basename "$customer_dir")
    echo "Processing customer: $customer_id"
    
    for file in "$customer_dir"*; do
      if [ -f "$file" ]; then
        filename=$(basename "$file")
        s3_path="s3://$BUCKET/$customer_id/$filename"
        
        echo "  Uploading: $filename → $s3_path"
        aws --endpoint-url=$ENDPOINT s3 cp "$file" "$s3_path"
      fi
    done
    echo ""
  fi
done

echo "==> Listing all uploaded files from S3"
aws --endpoint-url=$ENDPOINT s3 ls "s3://$BUCKET/" --recursive

echo ""
echo "==> Done"