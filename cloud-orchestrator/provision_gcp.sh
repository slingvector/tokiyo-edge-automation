#!/bin/bash
set -e

PROJECT_ID="tokito-edge-automation"
REGION="us-central1"
DB_INSTANCE="tokiyo-db-v1"
DB_NAME="tokiyo_orchestrator"
DB_PASS="tokiyo_strong_pass_123"
REDIS_INSTANCE="tokiyo-cache"

echo "Setting active project..."
gcloud config set project $PROJECT_ID

echo "Enabling APIs..."
gcloud services enable sqladmin.googleapis.com redis.googleapis.com run.googleapis.com artifactregistry.googleapis.com compute.googleapis.com servicenetworking.googleapis.com

echo "Creating Cloud SQL PostgreSQL Instance (this takes 5-10 mins)..."
gcloud sql instances create $DB_INSTANCE \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --root-password="$DB_PASS" || echo "SQL Instance may already exist."

gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE || echo "Database may already exist."
DB_CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)")
DATABASE_URL="postgresql://postgres:${DB_PASS}@localhost:5432/${DB_NAME}?host=/cloudsql/${DB_CONNECTION_NAME}"

echo "Creating Memorystore Redis Instance (this takes 5 mins)..."
# Create a Serverless VPC Access connector or use Direct VPC Egress. We'll use Direct VPC egress for Cloud Run later.
gcloud redis instances create $REDIS_INSTANCE \
  --size=1 \
  --region=$REGION \
  --redis-version=redis_7_0 \
  --tier=basic \
  --network=projects/${PROJECT_ID}/global/networks/default || echo "Redis Instance may already exist."

REDIS_IP=$(gcloud redis instances describe $REDIS_INSTANCE --region=$REGION --format="value(host)")
REDIS_URL="redis://${REDIS_IP}:6379"

echo "Writing configuration to .env.gcp..."
cat > .env.gcp <<EOL
DATABASE_URL="${DATABASE_URL}"
REDIS_URL="${REDIS_URL}"
DB_CONNECTION_NAME="${DB_CONNECTION_NAME}"
EOL

echo "Provisioning completed!"
