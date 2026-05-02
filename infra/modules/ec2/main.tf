variable "project" {}
variable "subnet_id" {}
variable "security_group_id" {}
variable "instance_profile_name" {}
variable "aws_region" {}
variable "account_id" {}
variable "db_host" {}
variable "db_name" {}
variable "db_username" {}
variable "db_password" { sensitive = true }
variable "aws_bucket" {}
variable "lambda_api_host" {}
variable "jwt_secret" { sensitive = true }

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_instance" "main" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = "t3.micro"
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [var.security_group_id]
  iam_instance_profile   = var.instance_profile_name

  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    aws_region  = var.aws_region
    account_id  = var.account_id
    project     = var.project
    db_host     = var.db_host
    db_name     = var.db_name
    db_username = var.db_username
    db_password     = var.db_password
    aws_bucket      = var.aws_bucket
    lambda_api_host = var.lambda_api_host
    jwt_secret      = var.jwt_secret
  }))

  tags = { Name = "${var.project}-server" }
}

resource "aws_eip" "main" {
  instance = aws_instance.main.id
  domain   = "vpc"
  tags     = { Name = "${var.project}-eip" }
}

output "public_ip"   { value = aws_eip.main.public_ip }
output "instance_id" { value = aws_instance.main.id }
