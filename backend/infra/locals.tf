locals {
  database_url = "postgresql://${var.postgres_user}:${var.postgres_password}@127.0.0.1:5432/${var.postgres_db}"
}
