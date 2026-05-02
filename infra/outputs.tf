output "app_url" {
  value = "http://${module.ec2.public_ip}"
}

output "instance_id" {
  value = module.ec2.instance_id
}

output "api_ecr_url" {
  value = module.ecr.api_repo_url
}

output "frontend_ecr_url" {
  value = module.ecr.frontend_repo_url
}

output "api_gateway_url" {
  value = module.lambda.api_gateway_url
}
