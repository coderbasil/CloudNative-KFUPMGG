terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.6"
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

module "networking" {
  source  = "./modules/networking"
  project = var.project
}

module "security" {
  source  = "./modules/security"
  project = var.project
  vpc_id  = module.networking.vpc_id
}

module "ecr" {
  source  = "./modules/ecr"
  project = var.project
}

module "iam" {
  source     = "./modules/iam"
  project    = var.project
  aws_region = var.aws_region
  account_id = data.aws_caller_identity.current.account_id
  aws_bucket = var.aws_bucket
}

module "rds" {
  source             = "./modules/rds"
  project            = var.project
  db_name            = var.db_name
  db_username        = var.db_username
  db_password        = var.db_password
  subnet_ids         = module.networking.public_subnet_ids
  security_group_ids = [module.security.rds_sg_id]
}

module "lambda" {
  source          = "./modules/lambda"
  project         = var.project
  aws_region      = var.aws_region
  account_id      = data.aws_caller_identity.current.account_id
  vpc_id          = module.networking.vpc_id
  subnet_ids      = module.networking.public_subnet_ids
  lambda_sg_id    = module.security.lambda_sg_id
  db_host         = module.rds.endpoint
  db_name         = var.db_name
  db_username     = var.db_username
  db_password     = var.db_password
  aws_bucket      = var.aws_bucket
}

module "ec2" {
  source                = "./modules/ec2"
  project               = var.project
  subnet_id             = module.networking.public_subnet_ids[0]
  security_group_id     = module.security.ec2_sg_id
  instance_profile_name = module.iam.ec2_instance_profile_name
  aws_region            = var.aws_region
  account_id            = data.aws_caller_identity.current.account_id
  db_host               = module.rds.endpoint
  db_name               = var.db_name
  db_username           = var.db_username
  db_password           = var.db_password
  aws_bucket            = var.aws_bucket
  lambda_api_host       = module.lambda.api_gateway_host
  jwt_secret            = var.jwt_secret
}
