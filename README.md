# Contract Intelligence Upsell Engine

A contract intelligence platform that analyzes agreements to detect renewal signals, clause insights, and cross-sell/upsell opportunities using AI-powered document processing.

## 📋 Project Structure

```
contract-intelligence-upsell-engine/
├── frontend/                 # React + Vite application
├── backend/                  # Node.js Lambda functions & infrastructure
│   ├── src/                 # Lambda function code
│   ├── infra/               # Terraform configuration
│   ├── database/
│   │   ├── migrations/      # SQL migration files
│   │   └── scripts/         # Database utility scripts
│   └── sample-data/         # Test contracts and customer data
├── utility scripts/         # Utility scripts for setup & operations
├── setup.sh                # Main setup script
├── upload-file-s3.sh       # Upload contracts to S3
├── docker-compose.yml      # Docker services configuration
└── .env                    # Environment variables (git ignored)
```

## 🚀 Prerequisites

- Node.js 20.19+
- Docker & Docker Compose
- Terraform (auto-installed by setup script)
- AWS CLI
- PostgreSQL client (auto-installed via Docker)
- Homebrew (macOS)

## ⚙️ Setup

### 1. Create `.env` file

Create a `.env` file in the project root:

```bash
# Database
POSTGRES_USER=local_user
POSTGRES_PASSWORD=abcd@1234
POSTGRES_DB=contract_ai

# AWS (LocalStack)
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-1
ENDPOINT=http://localhost:4566

# LocalStack Token
LOCALSTACK_AUTH_TOKEN=ls-VOnE8192-KuSA-pAHE-fabI-biJu474927e0
```

### 2. Run Setup Script

The main setup script does everything:

```bash
chmod +x setup.sh
./setup.sh
```

**What it does:**
- ✅ Installs Terraform if needed
- ✅ Starts Docker containers (PostgreSQL, LocalStack)
- ✅ Runs database migrations
- ✅ Builds Lambda functions
- ✅ Deploys infrastructure with Terraform
- ✅ Tests S3 uploads

## 📦 Available Commands

### Backend Setup

```bash
# Run full setup from project root
./setup.sh

# Run database migrations only
bash backend/database/scripts/migrate.sh

# Upload sample contracts to S3
./upload-file-s3.sh
# or from utility scripts
bash "utility scripts/upload-file-s3.sh"

# List S3 bucket contents
bash "utility scripts/get-files-s3.sh"

# Run database setup from utility scripts
bash "utility scripts/setup.sh"
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

### Build & Deploy

```bash
# Build Lambda functions
cd backend/src
npm run build

# Deploy infrastructure
cd backend/infra
terraform init
terraform apply
```

## 🗄️ Database

### PostgreSQL Services

- **Host:** 127.0.0.1
- **Port:** 5432
- **User:** Configured in `.env` (POSTGRES_USER)
- **Database:** Configured in `.env` (POSTGRES_DB)

### Migrations

Database schema is managed with SQL migration files in `backend/database/migrations/`:

- `001-init.sql` - Tables: documents, document_chunks, recommendations, recommendation_evidence

Migrations run automatically during setup. To run manually:

```bash
bash backend/database/scripts/migrate.sh
```

## ☁️ AWS Services (LocalStack)

The project uses LocalStack for local AWS development:

- **S3** - Document storage
- **Lambda** - Contract processing
- **CloudWatch** - Logging
- **SQS/SNS** - Messaging

Endpoint: `http://localhost:4566`

## 📝 Sample Data

Sample contracts are provided in `backend/sample-data/contracts/`:

```
CUST001/
  ├── contract_001_cash_management.pdf
  └── contract_002_device_support.pdf
CUST002/
  ├── contract_001_cash_services.pdf
  └── contract_002_security_schedule.pdf
CUST003/
  ├── contract_001_logistics_cash.pdf
  └── contract_002_analytics.pdf
```

Upload with:

```bash
./upload-file-s3.sh
```

Files will be organized as: `s3://contract-documents/CUST001/filename.pdf`

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | Database username | `postgres` |
| `POSTGRES_PASSWORD` | Database password | *(required)* |
| `POSTGRES_DB` | Database name | `contract_db` |
| `AWS_ACCESS_KEY_ID` | AWS access key | `test` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `test` |
| `AWS_DEFAULT_REGION` | AWS region | `us-east-1` |
| `ENDPOINT` | LocalStack endpoint | `http://localhost:4566` |
| `LOCALSTACK_AUTH_TOKEN` | LocalStack auth token | *(optional)* |

### Terraform Variables

Configured in `backend/infra/variables.tf`:

- `postgres_user` - PostgreSQL username
- `postgres_password` - PostgreSQL password (sensitive)
- `postgres_db` - PostgreSQL database name

Passed from `.env` via setup script.

## 📊 Architecture

```
User Uploads Contract
        ↓
   S3 Bucket
        ↓
Lambda Processor
        ↓
Document Chunks + Embeddings
        ↓
Vector Database (pgvector)
        ↓
AI Recommendations
```

## 🐛 Troubleshooting

### PostgreSQL Connection Failed

```bash
# Check if PostgreSQL container is running
docker ps | grep postgres

# Check PostgreSQL logs
docker logs contract-ai-postgres

# Try connecting manually
PGPASSWORD=your_password psql -h 127.0.0.1 -U your_user -d contract_ai
```

### Terraform Apply Failed

```bash
# Check Terraform state
cd backend/infra
terraform state list

# Destroy and reapply
terraform destroy
terraform apply
```

### S3 Upload Errors

```bash
# Verify LocalStack is running
curl http://localhost:4566/_localstack/health

# Check S3 bucket exists
aws --endpoint-url=http://localhost:4566 s3 ls
```

## 📚 Additional Resources

- [Terraform Documentation](https://www.terraform.io/docs)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Node.js Lambda Runtime](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)

## 📄 License

TBD
