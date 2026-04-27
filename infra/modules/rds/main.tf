variable "project" {}
variable "db_name" {}
variable "db_username" {}
variable "db_password" { sensitive = true }
variable "subnet_ids" { type = list(string) }
variable "security_group_ids" { type = list(string) }

resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db-subnet"
  subnet_ids = var.subnet_ids
}

resource "aws_db_instance" "main" {
  identifier        = "${var.project}-mysql"
  engine            = "mysql"
  engine_version    = "8.0"
  instance_class    = "db.t3.micro"
  allocated_storage = 20

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = var.security_group_ids
  publicly_accessible    = false

  backup_retention_period   = 7
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project}-final-snapshot"

  tags = { Name = "${var.project}-mysql" }
}

output "endpoint" { value = aws_db_instance.main.address }
