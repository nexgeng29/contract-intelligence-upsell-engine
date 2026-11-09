#!/bin/bash

LOCALSTACK_URL="${LOCALSTACK_URL:-http://localhost:4566}"
AWS_REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="ai-engine"

CUSTOMER_ID="${1:-CUST001}"
QUESTION="${2:-What are the renewal dates?}"

if [ $# -eq 0 ]; then
  echo "Usage: ./call-lambda.sh <CUSTOMER_ID> <QUESTION>"
  echo ""
  echo "Examples:"
  echo "  ./call-lambda.sh CUST001 \"When does this contract expire?\""
  echo "  ./call-lambda.sh CUST001 \"What are the renewal terms?\""
  echo "  ./call-lambda.sh CUST001 \"What is the deadline to prevent renewal?\""
  echo "  ./call-lambda.sh CUST001 \"What is the annual license fee?\""
  echo ""
  echo "Running with defaults..."
  echo ""
fi

PAYLOAD="{\"customerId\":\"$CUSTOMER_ID\",\"question\":\"$QUESTION\"}"

echo "Invoking $FUNCTION_NAME..."
echo "Customer: $CUSTOMER_ID"
echo "Question: $QUESTION"
echo ""

ENCODED_PAYLOAD=$(echo -n "$PAYLOAD" | base64)

aws lambda invoke \
  --endpoint-url "$LOCALSTACK_URL" \
  --region "$AWS_REGION" \
  --function-name "$FUNCTION_NAME" \
  --invocation-type RequestResponse \
  --payload "$ENCODED_PAYLOAD" \
  response.json 2>&1

echo ""
cat response.json | jq '.' 2>/dev/null || cat response.json
