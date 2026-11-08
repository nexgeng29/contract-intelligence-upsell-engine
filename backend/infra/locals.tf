locals {
  database_url = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/${var.postgres_db}"
}
