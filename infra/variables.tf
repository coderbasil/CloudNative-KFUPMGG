variable "aws_region" {
  default = "eu-north-1"
}

variable "project" {
  default = "kfupm-geo"
}

variable "db_name" {
  default = "kfupm_guess"
}

variable "db_username" {
  default = "kfupmadmin"
}

variable "db_password" {
  sensitive = true
  validation {
    condition     = !can(regex("[/@\" ]", var.db_password))
    error_message = "db_password must not contain '/', '@', '\"', or spaces (RDS constraint)."
  }
}

variable "aws_bucket" {
  default = "kfupm-geoguesser"
}

variable "jwt_secret" {
  sensitive = true
}

variable "frontend_url" {
  default     = "*"
  description = "CloudFront domain to allow in CORS. Set to 'https://<dist>.cloudfront.net' after first deploy."
}

variable "domain_name" {
  default     = ""
  description = "Custom domain for the frontend (e.g. kfupmguessr.xyz). Leave empty to use the CloudFront domain only."
}
