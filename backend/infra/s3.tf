

resource "aws_s3_bucket" "documents" {
  bucket        = var.bucket_name
  force_destroy = true # lets terraform destroy delete a non-empty bucket (local dev)
}

resource "aws_s3_bucket_notification" "documents" {
  bucket = aws_s3_bucket.documents.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.processor.arn
    events              = ["s3:ObjectCreated:*"]
  }

  # S3 must be allowed to invoke the Lambda before the notification is created
  depends_on = [aws_lambda_permission.allow_s3]
}