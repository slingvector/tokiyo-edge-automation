#!/bin/bash
set -e

echo "Deploying Tokiyo Cloud Orchestrator to Google Cloud Run..."

# Set your variables here or pass them as environment variables
if [ -f .env.production ]; then
  echo "Loading environment variables from .env.production..."
  export $(cat .env.production | grep -v '#' | xargs)
fi

PROJECT_ID=$(gcloud config get-value project)
REGION=${REGION:-"us-central1"}
SERVICE_NAME="tokiyo-orchestrator"
REPO_NAME="tokiyo-repo"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:latest"

echo "1. Ensuring Artifact Registry repository exists..."
gcloud artifacts repositories describe ${REPO_NAME} --location=${REGION} || \
gcloud artifacts repositories create ${REPO_NAME} --repository-format=docker --location=${REGION} --description="Tokiyo Docker repository"

echo "2. Building Docker image locally..."
docker build -t ${IMAGE} --platform linux/amd64 .

echo "3. Pushing image to Artifact Registry..."
# Ensure docker is authenticated with Artifact Registry
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet
docker push ${IMAGE}

echo "4. Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --session-affinity \
  --port 3000 \
  --set-env-vars="REDIS_URL=${REDIS_URL},DATABASE_URL=${DATABASE_URL},GEMINI_API_KEY=${GEMINI_API_KEY}"

echo "✅ Deployment complete!"
