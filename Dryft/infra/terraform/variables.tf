variable "project_name" {
  type        = string
  description = "Project name prefix"
  default     = "dryft"
}

variable "environment" {
  type        = string
  description = "Environment name"
  default     = "staging"
}

variable "region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
  default     = "10.50.0.0/16"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "Public subnet CIDRs"
  default     = ["10.50.1.0/24", "10.50.2.0/24"]
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "Private subnet CIDRs"
  default     = ["10.50.11.0/24", "10.50.12.0/24"]
}

variable "db_name" {
  type        = string
  description = "Postgres database name"
  default     = "dryft"
}

variable "db_username" {
  type        = string
  description = "Postgres username"
  default     = "dryft"
  sensitive   = true
}

variable "db_password" {
  type        = string
  description = "Postgres password"
  sensitive   = true
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class"
  default     = "db.t4g.micro"
}

variable "redis_node_type" {
  type        = string
  description = "ElastiCache node type"
  default     = "cache.t4g.micro"
}
