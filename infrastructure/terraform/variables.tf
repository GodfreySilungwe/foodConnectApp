variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Base project name"
  type        = string
  default     = "foodconnect"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "app_port" {
  description = "Port exposed by the backend container"
  type        = number
  default     = 3001
}
