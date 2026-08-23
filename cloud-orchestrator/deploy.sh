#!/bin/bash
set -e

echo "Deploying Tokiyo Cloud Orchestrator to Google Cloud Run..."

if [ -f .env.production ]; then
  echo "Loading production secrets..."
  export $(cat .env.production | grep -v '#' | xargs)
fi

if [ -f .env.gcp ]; then
  echo "Loading GCP configuration..."
  export $(cat .env.gcp | grep -v '#' | xargs)
else
  echo "Error: .env.gcp not found. Run provision_gcp.sh first."
  exit 1
fi

PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
SERVICE_NAME="tokiyo-orchestrator"
REPO_NAME="tokiyo-repo"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:latest"

echo "1. Ensuring Artifact Registry repository exists..."
gcloud artifacts repositories describe ${REPO_NAME} --location=${REGION} >/dev/null 2>&1 || \
gcloud artifacts repositories create ${REPO_NAME} --repository-format=docker --location=${REGION} --description="Tokiyo Docker repository"

echo "2. Building Docker image locally..."
docker build -t ${IMAGE} --platform linux/amd64 .

echo "3. Pushing image to Artifact Registry..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet
docker push ${IMAGE}

echo "4. Deploying to Cloud Run..."
# We use Direct VPC Egress (--network=default) to access Redis internally
# We use --add-cloudsql-instances to access Cloud SQL natively via Unix sockets
# We increase memory to 2Gi to solve the OOM 137 crashes we saw on Render!
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --network default \
  --add-cloudsql-instances ${DB_CONNECTION_NAME} \
  --set-env-vars="REDIS_URL=${REDIS_URL},DATABASE_URL=${DATABASE_URL},GEMINI_API_KEY=${GEMINI_API_KEY},NODE_ENV=production"

echo "✅ Tokiyo Cloud Orchestrator successfully deployed to GCP!"
