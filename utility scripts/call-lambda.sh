#!/bin/bash

LOCALSTACK_URL="${LOCALSTACK_URL:-http://localhost:4566}"
AWS_REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="ai-engine"

CUSTOMER_ID="CUST001"
QUESTION="What are the renewal dates?"

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
  /tmp/lambda-response.json 2>&1

echo ""
cat /tmp/lambda-response.json | jq '.' 2>/dev/null || cat /tmp/lambda-response.json
