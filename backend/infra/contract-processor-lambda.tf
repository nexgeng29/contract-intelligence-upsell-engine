data "archive_file" "contract_processor_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/${var.contract_processor_lambda_dir}"
  output_path = "${path.module}/build/contract_processor_lambda.zip"
  excludes    = ["dist", "build.mjs"]
}

resource "aws_lambda_function" "processor" {
  function_name    = var.contract_processor_function_name
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.contract_processor_lambda.output_path
  source_code_hash = data.archive_file.contract_processor_lambda.output_base64sha256
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      # Only set for LocalStack; the Lambda container reaches LocalStack by this hostname
      S3_ENDPOINT_URL = var.use_localstack ? "http://localhost.localstack.cloud:4566" : ""
      EMBEDDING_MODEL = var.embedding_model
      OLLAMA_URL = var.ollama_url
      DATABASE_URL = local.database_url
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda]
}

# Allows S3 to invoke the function
resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = "arn:aws:s3:::${aws_s3_bucket.contract_documents.bucket}"
}
resource "aws_iam_role" "lambda" {
  name = "${var.contract_processor_function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda" {
  name = "${var.contract_processor_function_name}-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.contract_documents.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.contract_processor_function_name}"
  retention_in_days = 7
}
