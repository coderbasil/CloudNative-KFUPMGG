output "frontend_url" {
  value = "https://${module.frontend.distribution_domain}"
}

output "frontend_bucket" {
  value = module.frontend.bucket_name
}

output "frontend_distribution_id" {
  value = module.frontend.distribution_id
}

output "api_ecr_url" {
  value = module.ecr.api_repo_url
}

output "api_gateway_url" {
  value = module.lambda.api_gateway_url
}

output "ec2_instance_id" {
  value = module.ec2.instance_id
}
