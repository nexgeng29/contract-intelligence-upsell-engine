#!/bin/bash

LOCALSTACK_URL="${LOCALSTACK_URL:-http://localhost:4566}"
AWS_REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="ai-engine"

# Parse arguments - customerId is now optional
# Usage: ./call-lambda.sh <QUESTION>
# Or:    ./call-lambda.sh <CUSTOMER_ID> <QUESTION>

if [ $# -eq 0 ]; then
  echo "Usage: ./call-lambda.sh <QUESTION>"
  echo "   Or: ./call-lambda.sh <CUSTOMER_ID> <QUESTION>"
  echo ""
  echo "Examples (search all customers):"
  echo "  ./call-lambda.sh \"When does this contract expire?\""
  echo "  ./call-lambda.sh \"What are the renewal terms?\""
  echo ""
  echo "Examples (search specific customer):"
  echo "  ./call-lambda.sh CUST001 \"When does this contract expire?\""
  echo "  ./call-lambda.sh CUST002 \"What is the annual fee?\""
  echo ""
  exit 1
fi

# Determine if first arg is CUSTOMER_ID or QUESTION
# CUSTOMER_ID format: typically all caps with numbers (e.g., CUST001, ABC123)
# QUESTION: typically starts with lowercase or common question words

if [ $# -eq 1 ]; then
  # Only question provided
  CUSTOMER_ID=""
  QUESTION="$1"
elif [ $# -ge 2 ]; then
  # Both customerId and question provided
  CUSTOMER_ID="$1"
  QUESTION="$2"
fi

# Build payload - omit customerId if empty
if [ -z "$CUSTOMER_ID" ]; then
  PAYLOAD="{\"question\":\"$QUESTION\"}"
  echo "Invoking $FUNCTION_NAME (searching ALL customers)..."
else
  PAYLOAD="{\"customerId\":\"$CUSTOMER_ID\",\"question\":\"$QUESTION\"}"
  echo "Invoking $FUNCTION_NAME..."
  echo "Customer: $CUSTOMER_ID"
fi

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
