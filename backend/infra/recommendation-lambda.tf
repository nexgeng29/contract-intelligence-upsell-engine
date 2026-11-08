data "archive_file" "recommendation_lambda_archieve" {
  type        = "zip"
  source_dir  = "${path.module}/${var.recommendation_lambda_dir}"
  output_path = "${path.module}/build/recommendation_lambda.zip"
  excludes    = ["dist", "build.mjs"]
}

resource "aws_lambda_function" "recommendation_lambda" {
  function_name    = var.recommendation_function_name
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.recommendation_lambda_archieve.output_path
  source_code_hash = data.archive_file.recommendation_lambda_archieve.output_base64sha256
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


resource "aws_iam_role" "lambda" {
  name = "${var.recommendation_function_name}-role"

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
  name = "${var.recommendation_function_name}-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [

      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.recommendation_function_name}"
  retention_in_days = 7
}
