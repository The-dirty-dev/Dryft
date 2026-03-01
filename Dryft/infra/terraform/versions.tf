terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure before first production apply:
  # backend "s3" {
  #   bucket         = "dryft-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "dryft-terraform-locks"
  #   encrypt        = true
  # }
}
