variable "project" {}
variable "aws_region" {}
variable "account_id" {}
variable "vpc_id" {}
variable "subnet_ids" { type = list(string) }
variable "lambda_sg_id" {}
variable "db_host" {}
variable "db_name" {}
variable "db_username" {}
variable "db_password" { sensitive = true }
variable "aws_bucket" {}

# ─── IAM ──────────────────────────────────────────────────────────────────────

resource "aws_iam_role" "lambda" {
  name = "${var.project}-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda_s3" {
  name = "${var.project}-lambda-s3"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:GetObject"]
      Resource = "arn:aws:s3:::${var.aws_bucket}/*"
    }]
  })
}

# ─── S3 CORS (allows browsers to PUT via presigned URLs) ──────────────────────

resource "aws_s3_bucket_cors_configuration" "photos" {
  bucket = var.aws_bucket
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = ["*"]
    max_age_seconds = 3000
  }
}

# ─── Lambda code archives ─────────────────────────────────────────────────────

data "archive_file" "game" {
  type        = "zip"
  source_dir  = "${path.root}/lambdas/game"
  output_path = "${path.module}/game.zip"
}

data "archive_file" "upload" {
  type        = "zip"
  source_dir  = "${path.root}/lambdas/upload"
  output_path = "${path.module}/upload.zip"
}

# ─── Lambda Functions ─────────────────────────────────────────────────────────

resource "aws_lambda_function" "game" {
  filename         = data.archive_file.game.output_path
  source_code_hash = data.archive_file.game.output_base64sha256
  function_name    = "${var.project}-game"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 15
  memory_size      = 256

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.lambda_sg_id]
  }

  environment {
    variables = {
      DB_HOST     = var.db_host
      DB_USER     = var.db_username
      DB_PASSWORD = var.db_password
      DB_NAME     = var.db_name
    }
  }
}

resource "aws_lambda_function" "upload" {
  filename         = data.archive_file.upload.output_path
  source_code_hash = data.archive_file.upload.output_base64sha256
  function_name    = "${var.project}-upload"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 15
  memory_size      = 256

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.lambda_sg_id]
  }

  environment {
    variables = {
      DB_HOST     = var.db_host
      DB_USER     = var.db_username
      DB_PASSWORD = var.db_password
      DB_NAME     = var.db_name
      AWS_BUCKET  = var.aws_bucket
    }
  }
}

# ─── API Gateway HTTP API ─────────────────────────────────────────────────────

resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project}-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "game" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.game.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "upload" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.upload.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "game_random" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /game/random"
  target    = "integrations/${aws_apigatewayv2_integration.game.id}"
}

resource "aws_apigatewayv2_route" "upload_presign" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /upload/presign"
  target    = "integrations/${aws_apigatewayv2_integration.upload.id}"
}

resource "aws_lambda_permission" "game" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.game.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "upload" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.upload.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

output "api_gateway_url" {
  value = aws_apigatewayv2_stage.main.invoke_url
}

output "api_gateway_host" {
  value = replace(aws_apigatewayv2_stage.main.invoke_url, "https://", "")
}
