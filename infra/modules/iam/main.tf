variable "project" {}
variable "aws_region" {}
variable "account_id" {}
variable "aws_bucket" {}

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2" {
  name               = "${var.project}-ec2"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "ec2_permissions" {
  name = "${var.project}-ec2-permissions"
  role = aws_iam_role.ec2.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
      { Effect = "Allow", Action = ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"], Resource = "arn:aws:ecr:${var.aws_region}:${var.account_id}:repository/${var.project}-*" },
      { Effect = "Allow", Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"], Resource = "arn:aws:s3:::${var.aws_bucket}/*" }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project}-ec2"
  role = aws_iam_role.ec2.name
}

data "aws_iam_policy_document" "github_oidc_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = ["arn:aws:iam::${var.account_id}:oidc-provider/token.actions.githubusercontent.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:*:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "${var.project}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_assume.json
}

resource "aws_iam_role_policy" "github_actions" {
  name = "${var.project}-deploy"
  role = aws_iam_role.github_actions.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
      { Effect = "Allow", Action = ["ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"], Resource = "arn:aws:ecr:${var.aws_region}:${var.account_id}:repository/${var.project}-*" },
      { Effect = "Allow", Action = ["ssm:SendCommand", "ssm:GetCommandInvocation"], Resource = ["arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript", "arn:aws:ec2:${var.aws_region}:${var.account_id}:instance/*"] },
      { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:ListBucket", "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"], Resource = ["arn:aws:s3:::kfupm-geo-tf-state", "arn:aws:s3:::kfupm-geo-tf-state/*", "arn:aws:dynamodb:${var.aws_region}:${var.account_id}:table/kfupm-geo-tf-lock"] }
    ]
  })
}

output "ec2_instance_profile_name" { value = aws_iam_instance_profile.ec2.name }
output "github_actions_role_arn"   { value = aws_iam_role.github_actions.arn }
