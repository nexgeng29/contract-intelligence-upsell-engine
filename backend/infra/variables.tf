variable "use_localstack" {
  type    = bool
  default = true
}

variable "localstack_endpoint" {
  type    = string
  default = "http://localhost:4566"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "contract_processor_lambda_dir" {
  description = "Folder containing the built Node.js code"
  type        = string
  default     = "../src/contract-processor-lambda"
}

variable "contract_documents_bucket" {
  type    = string
  default = "contract-documents"
}

variable "contract_processor_function_name" {
  type    = string
  default = "contract-processor"
}

variable "embedding_model" {
  type    = string
  default = "nomic-embed-text"
}

variable "ollama_url" {
  type    = string
  default = "http://host.docker.internal:11434"
}

variable "postgres_user" {
  description = "PostgreSQL username"
  type        = string
  default     = "postgres"
}

variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  default     = ""
}

variable "postgres_db" {
  description = "PostgreSQL database name"
  type        = string
  default     = "contract_db"
}

variable "recommendation_lambda_dir" {
  description = "Folder containing the built Node.js code"
  type        = string
  default     = "../src/recommendation-lambda"
}

variable "recommendation_function_name" {
  type    = string
  default = "recommendation"
}