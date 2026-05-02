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
}

variable "aws_bucket" {
  default = "kfupm-geoguesser"
}

variable "jwt_secret" {
  sensitive = true
}
