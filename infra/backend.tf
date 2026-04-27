terraform {
  backend "s3" {
    bucket         = "kfupm-geo-tf-state"
    key            = "prod/terraform.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "kfupm-geo-tf-lock"
    encrypt        = true
  }
}
