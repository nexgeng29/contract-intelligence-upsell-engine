data "archive_file" "ai_lambda_archieve" {
  type        = "zip"
  source_dir  = "${path.module}/${var.ai_engine_lambda_dir}"
  output_path = "${path.module}/build/ai_engine_lambda.zip"
  excludes    = ["dist", "build.mjs"]
}

resource "aws_lambda_function" "ai_engine_lambda" {
  function_name    = var.ai_engine_function_name
  role             = aws_iam_role.ai_engine_lambda_role.arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.ai_lambda_archieve.output_path
  source_code_hash = data.archive_file.ai_lambda_archieve.output_base64sha256
  timeout          = 120
  memory_size      = 1024

  environment {
    variables = {
      
      EMBEDDING_MODEL = var.embedding_model
      OLLAMA_URL = var.ollama_url
      DATABASE_URL = local.database_url
      LLM_MODEL = var.llm_model
    }
  }

  depends_on = [aws_cloudwatch_log_group.ai_engine_lambda]
}


resource "aws_iam_role" "ai_engine_lambda_role" {
  name = "${var.ai_engine_function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ai_engine_lambda_policy" {
  name = "${var.ai_engine_function_name}-policy"
  role = aws_iam_role.ai_engine_lambda_role.id

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

resource "aws_cloudwatch_log_group" "ai_engine_lambda" {
  name              = "/aws/lambda/${var.ai_engine_function_name}"
  retention_in_days = 7
}
